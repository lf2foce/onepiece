import { randomInt, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createClient, type RedisClientType } from "redis";
import { WebSocket, WebSocketServer } from "ws";

type Role = "p1" | "p2";
type GameSocket = WebSocket & {
  roomCode?: string;
  role?: Role;
  playerToken?: string;
  lastSnapshotSave?: number;
  messagesInWindow?: number;
  windowStartedAt?: number;
};

type WireEnvelope = {
  exceptToken?: string;
  origin?: string;
  payload: Record<string, unknown>;
};

// ID riêng mỗi instance — để phân biệt tin do CHÍNH instance này phát (đã giao local rồi)
// với tin từ instance khác (mới cần giao). Nhờ vậy same-instance khỏi vòng Redis.
const INSTANCE_ID = randomUUID();

const ROOM_TTL_SECONDS = 60 * 60;
const MAX_MESSAGE_BYTES = 32 * 1024;
const ROOM_PREFIX = "game-dudu:room:";
const CHANNEL_PREFIX = "game-dudu:channel:";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const server = createServer();
const wss = new WebSocketServer({ server, maxPayload: MAX_MESSAGE_BYTES });
const localRooms = new Map<string, Set<GameSocket>>();

let publisher: RedisClientType | undefined;
let publisherPromise: Promise<RedisClientType> | undefined;
let subscriber: RedisClientType | undefined;
let subscriberPromise: Promise<RedisClientType> | undefined;

function redisUrl() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("Thiếu biến môi trường REDIS_URL");
  return url;
}

async function getPublisher() {
  if (publisher?.isReady) return publisher;
  if (!publisherPromise) {
    const client = createClient({
      url: redisUrl(),
      pingInterval: 30000,   // PING 30s/lần: giữ kết nối Upstash sống + phát hiện đứt để tự nối+subscribe lại
      socket: {
        keepAlive: true,
        reconnectStrategy: (retries) => Math.min(1000 + retries * 500, 8000),
      },
    });
    client.on("error", (error) => console.error("Redis publisher:", error));
    publisherPromise = client.connect().then(() => {
      publisher = client as RedisClientType;
      return publisher;
    }).finally(() => {
      publisherPromise = undefined;
    });
  }
  return publisherPromise;
}

function roomKey(code: string) {
  return `${ROOM_PREFIX}${code}`;
}

function channelKey(code: string) {
  return `${CHANNEL_PREFIX}${code}`;
}

function send(ws: WebSocket, payload: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function validToken(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{16,80}$/.test(value);
}

function validRoom(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z2-9]{4,6}$/.test(value);
}

function makeRoomCode() {
  let value = "";
  for (let i = 0; i < 5; i++) value += ALPHABET[randomInt(ALPHABET.length)];
  return value;
}

function rateAllowed(ws: GameSocket) {
  const now = Date.now();
  if (!ws.windowStartedAt || now - ws.windowStartedAt >= 1000) {
    ws.windowStartedAt = now;
    ws.messagesInWindow = 0;
  }
  ws.messagesInWindow = (ws.messagesInWindow || 0) + 1;
  return ws.messagesInWindow <= 90;
}

// Giao tin cho các thành viên phòng ĐANG nằm trên instance này (không đụng Redis).
function deliverLocal(code: string, payload: Record<string, unknown>, exceptToken?: string) {
  for (const member of localRooms.get(code) || []) {
    if (exceptToken && member.playerToken === exceptToken) continue;
    send(member, payload);
  }
}

async function publishRoom(code: string, payload: Record<string, unknown>, exceptToken?: string) {
  // FAST-PATH: giao ngay cho người cùng instance (bỏ qua vòng tới Redis rồi quay lại
  // — vốn tốn cả một RTT tới Singapore mỗi tin). Làm TRƯỚC await nên độ trễ local ~0.
  deliverLocal(code, payload, exceptToken);
  const redis = await getPublisher();
  const envelope: WireEnvelope = { payload, exceptToken, origin: INSTANCE_ID };
  await redis.publish(channelKey(code), JSON.stringify(envelope));
}

// Một subscriber dùng chung cho MỌI phòng (PSUBSCRIBE) — tiết kiệm kết nối Upstash:
// chỉ 2 kết nối/instance (1 publish + 1 subscribe) dù có bao nhiêu phòng.
async function ensureSubscriber() {
  if (subscriber?.isReady) return subscriber;
  if (!subscriberPromise) {
    subscriberPromise = getPublisher().then(async (pub) => {
      const client = pub.duplicate() as RedisClientType;
      client.on("error", (error) => console.error("Redis subscriber:", error));
      await client.connect();
      await client.pSubscribe(`${CHANNEL_PREFIX}*`, (raw, channel) => {
        try {
          const code = channel.slice(CHANNEL_PREFIX.length);
          const envelope = JSON.parse(raw) as WireEnvelope;
          if (envelope.origin === INSTANCE_ID) return;   // tin của chính mình — đã giao local ở publishRoom
          deliverLocal(code, envelope.payload, envelope.exceptToken);
        } catch (error) {
          console.error("Invalid Redis pub/sub payload:", error);
        }
      });
      subscriber = client;
      return client;
    }).finally(() => {
      subscriberPromise = undefined;
    });
  }
  return subscriberPromise;
}

async function attachToRoom(ws: GameSocket, code: string, role: Role, token: string) {
  if (ws.roomCode) detachFromRoom(ws);
  ws.roomCode = code;
  ws.role = role;
  ws.playerToken = token;
  if (!localRooms.has(code)) localRooms.set(code, new Set());
  localRooms.get(code)?.add(ws);
  await ensureSubscriber();
}

function detachFromRoom(ws: GameSocket) {
  if (!ws.roomCode) return;
  const clients = localRooms.get(ws.roomCode);
  clients?.delete(ws);
  if (clients?.size === 0) localRooms.delete(ws.roomCode);
}

// Rời phòng HẲN: nhả slot (token + nhân vật) trong Redis để người khác vào thế.
// Khác với đóng socket do ngắt tạm — lúc đó slot phải giữ để chính người đó nối lại.
async function leaveRoom(ws: GameSocket) {
  const code = ws.roomCode, role = ws.role, token = ws.playerToken;
  if (!code || !role) return;
  const redis = await getPublisher();
  await redis.hDel(roomKey(code), [`${role}Token`, `${role}Char`]);
  detachFromRoom(ws);
  ws.roomCode = undefined;
  await publishRoom(code, { type: "peer_status", role, connected: false, left: true }, token);
}

async function createRoom(ws: GameSocket, token: string, mode: string) {
  const gameMode = mode === "adventure" ? "adventure" : "versus";
  const redis = await getPublisher();
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeRoomCode();
    const created = await redis.hSetNX(roomKey(code), "p1Token", token);
    if (!created) continue;
    await redis.hSet(roomKey(code), "mode", gameMode);
    await redis.expire(roomKey(code), ROOM_TTL_SECONDS);
    await attachToRoom(ws, code, "p1", token);
    send(ws, { type: "assigned", room: code, role: "p1", mode: gameMode });
    return;
  }
  send(ws, { type: "error", message: "Không tạo được mã phòng, hãy thử lại." });
}

async function joinRoom(ws: GameSocket, code: string, token: string) {
  const redis = await getPublisher();
  const key = roomKey(code);
  const room = await redis.hGetAll(key);
  if (!room.p1Token) {
    send(ws, { type: "error", message: "Phòng không tồn tại hoặc đã hết hạn." });
    return;
  }

  let role: Role | undefined;
  if (room.p1Token === token) role = "p1";
  else if (room.p2Token === token) role = "p2";
  else if (!room.p2Token && await redis.hSetNX(key, "p2Token", token)) role = "p2";

  if (!role) {
    send(ws, { type: "error", message: "Phòng đã đủ hai người chơi." });
    return;
  }

  await redis.expire(key, ROOM_TTL_SECONDS);
  await attachToRoom(ws, code, role, token);
  const latest = await redis.hGetAll(key);
  send(ws, {
    type: "assigned",
    room: code,
    role,
    mode: latest.mode || "versus",
    peerReady: Boolean(latest.p1Token && latest.p2Token),
    lastSnapshot: latest.lastSnapshot ? JSON.parse(latest.lastSnapshot) : undefined,
  });
  await publishRoom(code, { type: "peer_status", role, connected: true }, token);
  if (latest.p1Token && latest.p2Token) {
    await publishRoom(code, { type: "ready" });
  }
}

async function handleSelection(ws: GameSocket, charId: unknown) {
  if (!ws.roomCode || !ws.role || typeof charId !== "string" || !/^[a-z]{3,16}$/.test(charId)) return;
  const redis = await getPublisher();
  const key = roomKey(ws.roomCode);
  await redis.hSet(key, `${ws.role}Char`, charId);
  await redis.expire(key, ROOM_TTL_SECONDS);
  const room = await redis.hGetAll(key);
  if (room.p1Char && room.p2Char) {
    await publishRoom(ws.roomCode, {
      type: "start",
      mode: room.mode || "versus",
      p1Char: room.p1Char,
      p2Char: room.p2Char,
    });
  }
}

async function handleRoomMessage(ws: GameSocket, message: Record<string, unknown>) {
  if (!ws.roomCode || !ws.role || !ws.playerToken) return;
  const type = message.type;
  if (type === "selection") {
    await handleSelection(ws, message.charId);
    return;
  }
  if (type === "snapshot") {
    if (ws.role !== "p1" || typeof message.state !== "object" || !message.state) return;
    const now = Date.now();
    if (!ws.lastSnapshotSave || now - ws.lastSnapshotSave >= 1000) {
      ws.lastSnapshotSave = now;
      const redis = await getPublisher();
      await redis.hSet(roomKey(ws.roomCode), "lastSnapshot", JSON.stringify(message.state));
      await redis.expire(roomKey(ws.roomCode), ROOM_TTL_SECONDS);
    }
  }
  if (type === "input" || type === "snapshot" || type === "control") {
    await publishRoom(ws.roomCode, { ...message, from: ws.role }, ws.playerToken);
  }
}

wss.on("connection", (rawSocket) => {
  const ws = rawSocket as GameSocket;
  send(ws, { type: "hello" });

  ws.on("message", async (data) => {
    try {
      if (!rateAllowed(ws)) {
        ws.close(1008, "Rate limit");
        return;
      }
      const message = JSON.parse(data.toString()) as Record<string, unknown>;
      if (!validToken(message.token) && !ws.playerToken) {
        send(ws, { type: "error", message: "Player token không hợp lệ." });
        return;
      }
      if (message.type === "create") await createRoom(ws, message.token as string, typeof message.mode === "string" ? message.mode : "versus");
      else if (message.type === "join") {
        const code = typeof message.room === "string" ? message.room.trim().toUpperCase() : "";
        if (!validRoom(code)) send(ws, { type: "error", message: "Mã phòng không hợp lệ." });
        else await joinRoom(ws, code, message.token as string);
      } else if (message.type === "leave") await leaveRoom(ws);
      else await handleRoomMessage(ws, message);
    } catch (error) {
      console.error("WebSocket message:", error);
      send(ws, { type: "error", message: "Server không xử lý được yêu cầu." });
    }
  });

  ws.on("close", () => {
    const { roomCode, role, playerToken } = ws;
    detachFromRoom(ws);
    if (roomCode && role) {
      void publishRoom(roomCode, { type: "peer_status", role, connected: false }, playerToken)
        .catch((error) => console.error("Publish disconnect:", error));
    }
  });
});

export default server;
