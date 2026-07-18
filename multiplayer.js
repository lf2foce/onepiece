/**
 * Multiplayer online cho game Canvas thuần.
 * P1 là authority; cả hai máy mô phỏng input để phản hồi nhanh, P1 phát snapshot
 * định kỳ để P2 hiệu chỉnh sai lệch do độ trễ hoặc tốc độ khung hình.
 */
(() => {
  "use strict";

  const Game = window.OP_GAME;
  if (!Game) return;

  const EMPTY_INTENT = Object.freeze({
    left: false, right: false, jump: false, block: false,
    close: false, ranged: false, special: false,
  });
  const HELD_KEYS = ["left", "right", "jump", "block"];
  const EDGE_KEYS = ["close", "ranged", "special"];
  const ROSTER = new Set(["luffy", "zoro", "sanji", "shanks", "ace", "aokiji", "sabo", "akainu", "whitebeard", "blackbeard"]);

  const byId = (id) => document.getElementById(id);
  const lobby = byId("onlineLobby");
  const actions = byId("onlineActions");
  const waiting = byId("onlineWaiting");
  const errorBox = byId("onlineError");
  const statusBox = byId("onlineStatus");
  const roomBox = byId("onlineRoomCode");
  const roleBox = byId("onlineRole");
  const roomInput = byId("roomCodeInput");
  const badge = byId("networkBadge");

  function playerToken() {
    const key = "gameDuduPlayerToken";
    let token = localStorage.getItem(key);
    if (!token) {
      const bytes = new Uint8Array(18);
      crypto.getRandomValues(bytes);
      token = Array.from(bytes, (value) => value.toString(36).padStart(2, "0")).join("");
      localStorage.setItem(key, token);
    }
    return token;
  }

  function socketUrl() {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${location.host}/api/ws`;
  }

  const Online = {
    role: null,
    room: null,
    socket: null,
    token: playerToken(),
    pendingAction: null,
    reconnectTimer: 0,
    reconnectDelay: 1000,
    intentionallyClosed: false,
    started: false,
    seq: 0,
    lastInputSignature: "",
    lastInputSentAt: 0,
    lastSnapshotAt: 0,
    pendingSnapshot: null,
    applyingControl: false,
    remoteHeld: { p1: {}, p2: {} },
    remoteEdges: { p1: new Set(), p2: new Set() },
    // Phím đòn bấm trong lúc khựng hình (hitstop/super freeze) — engine không đọc
    // intent ở các frame đó nhưng vẫn xoá justPressed, nên phải tự giữ lại ở đây.
    localEdgeBuffer: new Set(),

    showLobby() {
      this.intentionallyClosed = false;
      errorBox.classList.add("hidden");
      actions.classList.remove("hidden");
      waiting.classList.add("hidden");
      lobby.classList.remove("hidden");
      if (roomInput) roomInput.value = new URLSearchParams(location.search).get("room") || "";
    },

    closeLobby() {
      lobby.classList.add("hidden");
      if (!this.started) this.disconnect(true);
    },

    createRoom() {
      this.begin({ type: "create", token: this.token });
    },

    joinRoom(code) {
      const room = String(code || "").trim().toUpperCase();
      if (!/^[A-Z2-9]{4,6}$/.test(room)) {
        this.showError("Hãy nhập mã phòng gồm 4–6 ký tự.");
        return;
      }
      this.begin({ type: "join", room, token: this.token });
    },

    begin(action) {
      this.pendingAction = action;
      this.intentionallyClosed = false;
      actions.classList.add("hidden");
      waiting.classList.remove("hidden");
      errorBox.classList.add("hidden");
      this.setStatus("Đang kết nối tới phòng game…");
      if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(action));
      else this.connect();
    },

    connect() {
      if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) return;
      let socket;
      try {
        socket = new WebSocket(socketUrl());
      } catch (_) {
        this.scheduleReconnect();
        return;
      }
      this.socket = socket;
      socket.addEventListener("open", () => {
        this.reconnectDelay = 1000;
        this.setConnected(true);
        const action = this.room
          ? { type: "join", room: this.room, token: this.token }
          : this.pendingAction;
        if (action) socket.send(JSON.stringify(action));
      });
      socket.addEventListener("message", (event) => {
        try { this.onMessage(JSON.parse(event.data)); } catch (_) {}
      });
      socket.addEventListener("close", () => {
        this.socket = null;
        this.setConnected(false);
        if (!this.intentionallyClosed && (this.pendingAction || this.room)) this.scheduleReconnect();
      });
      socket.addEventListener("error", () => {
        this.setStatus("Không kết nối được server. Đang thử lại…");
      });
    },

    scheduleReconnect() {
      clearTimeout(this.reconnectTimer);
      this.setStatus("Mất kết nối, đang nối lại…");
      this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 15000);
    },

    disconnect(intentional) {
      this.intentionallyClosed = intentional;
      clearTimeout(this.reconnectTimer);
      if (this.socket) this.socket.close();
      this.socket = null;
      if (intentional) {
        this.pendingAction = null;
        this.room = null;
        this.role = null;
        this.started = false;
        badge.classList.add("hidden");
      }
    },

    send(payload) {
      if (this.socket?.readyState !== WebSocket.OPEN) return false;
      this.socket.send(JSON.stringify(payload));
      return true;
    },

    onMessage(message) {
      if (!message || typeof message.type !== "string") return;
      if (message.type === "assigned") {
        this.role = message.role;
        this.room = message.room;
        this.pendingAction = { type: "join", room: this.room, token: this.token };
        roleBox.textContent = this.role === "p1" ? "PLAYER 1 — CHỦ PHÒNG" : "PLAYER 2";
        roomBox.textContent = this.room;
        waiting.classList.remove("hidden");
        actions.classList.add("hidden");
        this.setStatus(message.peerReady ? "Đã đủ hai người, đang chuẩn bị trận…" : "Đang chờ Player 2 vào phòng…");
        this.updateInviteUrl();
        this.sendSelection();
        if (message.lastSnapshot && this.role === "p2") this.pendingSnapshot = message.lastSnapshot;
        return;
      }
      if (message.type === "ready") {
        this.setStatus("Đã đủ hai người, đang đồng bộ nhân vật…");
        this.sendSelection();
        return;
      }
      if (message.type === "start") {
        this.startGame(message.p1Char, message.p2Char);
        return;
      }
      if (message.type === "input" && message.from && message.from !== this.role) {
        this.receiveInput(message.from, message);
        return;
      }
      if (message.type === "snapshot" && message.from === "p1" && this.role === "p2") {
        this.applySnapshot(message.state);
        return;
      }
      if (message.type === "control" && message.from !== this.role) {
        this.receiveControl(message.action);
        return;
      }
      if (message.type === "peer_status") {
        const peerRole = this.role === "p1" ? "p2" : "p1";
        if (message.role === peerRole) {
          if (!message.connected) {
            this.remoteHeld[peerRole] = {};
            this.remoteEdges[peerRole].clear();
          }
          this.setStatus(message.connected ? "Đối thủ đã kết nối." : "Đối thủ mất kết nối — đang chờ nối lại…");
        }
        return;
      }
      if (message.type === "error") this.showError(message.message || "Có lỗi xảy ra.");
    },

    sendSelection() {
      if (!this.role) return;
      const charId = this.role === "p1" ? Game.p1CharId : Game.p2CharId;
      this.send({ type: "selection", charId: ROSTER.has(charId) ? charId : (this.role === "p1" ? "luffy" : "zoro") });
    },

    startGame(p1Char, p2Char) {
      if (!ROSTER.has(p1Char) || !ROSTER.has(p2Char)) return;
      Game.p1CharId = p1Char;
      Game.p2CharId = p2Char;
      lobby.classList.add("hidden");
      badge.classList.remove("hidden");
      badge.textContent = `${this.role?.toUpperCase()} · ${this.room}`;
      this.started = true;
      this.localEdgeBuffer.clear();
      this.setConnected(true);
      if (Game.mode !== "online" || Game.state === "menu") Game.startMatch("online");
      if (this.pendingSnapshot && this.role === "p2") {
        this.applySnapshot(this.pendingSnapshot);
        this.pendingSnapshot = null;
      }
    },

    sendInput(role, intent) {
      if (!this.started || role !== this.role) return;
      const held = {};
      const edges = [];
      for (const key of HELD_KEYS) held[key] = Boolean(intent[key]);
      for (const key of EDGE_KEYS) if (intent[key]) edges.push(key);
      const signature = JSON.stringify(held);
      const now = performance.now();
      if (signature !== this.lastInputSignature || edges.length || now - this.lastInputSentAt >= 120) {
        this.lastInputSignature = signature;
        this.lastInputSentAt = now;
        this.send({ type: "input", seq: ++this.seq, held, edges });
      }
    },

    receiveInput(role, message) {
      if (role !== "p1" && role !== "p2") return;
      this.remoteHeld[role] = message.held || {};
      for (const key of message.edges || []) if (EDGE_KEYS.includes(key)) this.remoteEdges[role].add(key);
    },

    remoteIntent(role) {
      if (!role) return { ...EMPTY_INTENT };
      const held = this.remoteHeld[role] || {};
      const edges = this.remoteEdges[role] || new Set();
      const intent = { ...EMPTY_INTENT };
      for (const key of HELD_KEYS) intent[key] = Boolean(held[key]);
      for (const key of EDGE_KEYS) intent[key] = edges.has(key);
      edges.clear();
      return intent;
    },

    afterUpdate(game) {
      if (!this.started || this.role !== "p1" || game.mode !== "online") return;
      const now = performance.now();
      if (now - this.lastSnapshotAt < 70) return;
      this.lastSnapshotAt = now;
      this.send({ type: "snapshot", state: this.makeSnapshot(game) });
    },

    makeSnapshot(game) {
      const fighter = (value) => ({
        id: value.id, x: value.x, y: value.y, vx: value.vx, vy: value.vy,
        facing: value.facing, onGround: value.onGround, hp: value.hp, meter: value.meter,
        formT: value.formT, state: value.state, hurtTimer: value.hurtTimer,
        blocking: value.blocking, flash: value.flash, combo: value.combo,
        comboTimer: value.comboTimer, comboPop: value.comboPop, wins: value.wins,
        animTime: value.animTime, walkPhase: value.walkPhase, scripted: value._scripted,
        attack: value.attack ? {
          key: value.attack.def.key, elapsed: value.attack.elapsed, phase: value.attack.phase,
          spawned: value.attack.spawned, spawnedCount: value.attack.spawnedCount,
          nextHit: value.attack.nextHit, isSuper: value.attack.isSuper,
          formed: value.attack.formed, shaked: value.attack.shaked,
        } : null,
      });
      return {
        at: Date.now(), state: game.state, round: game.round, timeLeft: game.timeLeft,
        hitstop: game.hitstop, flashScreen: game.flashScreen, superFreeze: game.superFreeze,
        superFocus: game.superFocus, announce: game.announce,
        p1: fighter(game.luffy), p2: fighter(game.zoro),
        projectiles: game.projectiles.map((p) => ({
          owner: p.owner === game.luffy ? "p1" : "p2", d: p.d,
          x: p.x, y: p.y, vx: p.vx, vy: p.vy, ang: p.ang,
          w: p.w, h: p.h, life: p.life, t: p.t, dir: p.dir,
        })),
      };
    },

    applySnapshot(snapshot) {
      if (!snapshot || !this.started || this.role !== "p2" || Game.mode !== "online") return;
      const MOVES = window.OP_MOVES || {};
      const applyFighter = (fighter, data) => {
        if (!data || !ROSTER.has(data.id) || !MOVES[data.id]) return;
        fighter.id = data.id;
        fighter.moves = MOVES[data.id];
        for (const key of ["vx","vy","facing","onGround","hp","meter","formT","state","hurtTimer","blocking","flash","combo","comboTimer","comboPop","wins","animTime","walkPhase"]) {
          if (data[key] !== undefined) fighter[key] = data[key];
        }
        // Vị trí: snapshot luôn cũ hơn hiện tại ~nửa RTT, gán thẳng sẽ giật lùi.
        // Hoà dần về vị trí authority (hết lệch sau ~2-3 snapshot); chỉ bật thẳng khi lệch quá xa.
        if (typeof data.x === "number" && typeof data.y === "number") {
          const ex = data.x - fighter.x, ey = data.y - fighter.y;
          if (Math.abs(ex) > 140 || Math.abs(ey) > 140) { fighter.x = data.x; fighter.y = data.y; }
          else { fighter.x += ex * 0.35; fighter.y += ey * 0.35; }
        }
        fighter._scripted = Boolean(data.scripted);
        const def = data.attack && fighter.moves[data.attack.key];
        fighter.attack = def ? {
          def, elapsed: data.attack.elapsed, phase: data.attack.phase,
          spawned: data.attack.spawned, spawnedCount: data.attack.spawnedCount,
          nextHit: data.attack.nextHit, isSuper: data.attack.isSuper,
          formed: data.attack.formed, shaked: data.attack.shaked, hit: new Set(),
        } : null;
      };
      applyFighter(Game.luffy, snapshot.p1);
      applyFighter(Game.zoro, snapshot.p2);
      Game.round = snapshot.round;
      Game.timeLeft = snapshot.timeLeft;
      Game.hitstop = snapshot.hitstop || 0;
      Game.flashScreen = snapshot.flashScreen || 0;
      Game.superFreeze = snapshot.superFreeze || 0;
      Game.superFocus = snapshot.superFocus || null;
      Game.announce = snapshot.announce || null;
      Game.projectiles = (snapshot.projectiles || []).map((data) => {
        const owner = data.owner === "p1" ? Game.luffy : Game.zoro;
        const projectile = new Game.Projectile(owner, data.d);
        Object.assign(projectile, data);
        projectile.owner = owner;
        projectile.dead = false;
        return projectile;
      });
    },

    sendControl(action) {
      this.send({ type: "control", action });
    },

    receiveControl(action) {
      if (action === "continue" && Game.mode === "online") {
        this.applyingControl = true;
        Game.onResultContinue();
        this.applyingControl = false;
      } else if (action === "round_end" && Game.mode === "online" && Game.state === "playing") {
        this.applyingControl = true;
        Game.endRound();
        this.applyingControl = false;
      } else if (action === "quit" && Game.mode === "online") {
        this.applyingControl = true;
        Game.toMenu();
        this.applyingControl = false;
      }
    },

    setConnected(connected) {
      if (!this.started) return;
      badge.classList.remove("hidden");
      badge.classList.toggle("offline", !connected);
      badge.textContent = connected ? `${this.role?.toUpperCase()} · ${this.room}` : "ĐANG NỐI LẠI…";
    },

    setStatus(text) {
      statusBox.textContent = text;
    },

    showError(text) {
      errorBox.textContent = text;
      errorBox.classList.remove("hidden");
      this.setStatus("Hãy kiểm tra rồi thử lại.");
      if (!this.room) actions.classList.remove("hidden");
    },

    updateInviteUrl() {
      const url = new URL(location.href);
      url.searchParams.set("room", this.room);
      history.replaceState(null, "", url);
    },

    async copyInvite() {
      const url = new URL(location.href);
      url.searchParams.set("room", this.room);
      try {
        await navigator.clipboard.writeText(url.toString());
        this.setStatus("Đã sao chép link — gửi cho Player 2 nhé!");
      } catch (_) {
        this.setStatus(`Gửi mã ${this.room} cho Player 2.`);
      }
    },
  };

  window.OP_ONLINE = Online;

  byId("onlineBtn")?.addEventListener("click", () => Online.showLobby());
  byId("createRoomBtn")?.addEventListener("click", () => Online.createRoom());
  byId("joinRoomBtn")?.addEventListener("click", () => Online.joinRoom(roomInput.value));
  byId("copyRoomBtn")?.addEventListener("click", () => Online.copyInvite());
  byId("onlineCloseBtn")?.addEventListener("click", () => Online.closeLobby());
  roomInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") Online.joinRoom(roomInput.value);
  });
  roomInput?.addEventListener("input", () => {
    roomInput.value = roomInput.value.toUpperCase().replace(/[^A-Z2-9]/g, "");
  });

  // Giữ phím đòn bấm giữa hitstop/super freeze: engine bỏ qua intent các frame đó
  // nhưng vẫn xoá justPressed mỗi frame -> không có buffer này là mất đòn (và lệch
  // với máy đối thủ, vì phím gửi qua mạng lại được remoteEdges giữ hộ).
  const EDGE_KEYCODES = {
    p1: { KeyF: "close", KeyG: "ranged", KeyH: "special" },
    p2: { Comma: "close", Period: "ranged", Slash: "special" },
  };
  window.addEventListener("keydown", (event) => {
    if (!Online.started || Game.mode !== "online" || Game.state !== "playing" || event.repeat) return;
    const map = EDGE_KEYCODES[Online.role];
    const key = map && map[event.code];
    if (key) Online.localEdgeBuffer.add(key);
  });

  // Chế độ online lấy intent local từ đúng vai và intent đối thủ từ WebSocket.
  const originalHumanIntents = Game.humanIntents;
  Game.onlineIntents = function() {
    const role = Online.role;
    const local = originalHumanIntents.call(this, role || "p1");
    for (const key of Online.localEdgeBuffer) local[key] = true;
    Online.localEdgeBuffer.clear();
    Online.sendInput(role, local);
    return {
      p1: role === "p1" ? local : Online.remoteIntent("p1"),
      p2: role === "p2" ? local : Online.remoteIntent("p2"),
    };
  };

  const originalUpdate = Game.update;
  Game.update = function(dt) {
    originalUpdate.call(this, dt);
    Online.afterUpdate(this);
  };

  const originalContinue = Game.onResultContinue;
  Game.onResultContinue = function() {
    if (this.mode === "online" && Online.started && !Online.applyingControl) {
      if (Online.role !== "p1") {
        Online.setStatus("Đang chờ Player 1 bắt đầu hiệp tiếp theo…");
        return;
      }
      Online.sendControl("continue");
    }
    return originalContinue.call(this);
  };

  const originalEndRound = Game.endRound;
  Game.endRound = function() {
    // P1 là authority: sim của P2 có thể lệch nhẹ nên KHÔNG được tự kết thúc hiệp,
    // phải chờ hiệu lệnh round_end từ P1 (nếu không hai máy hết hiệp hai thời điểm khác nhau).
    if (this.mode === "online" && Online.started && Online.role === "p2" && !Online.applyingControl) {
      return;
    }
    const wasPlaying = this.state === "playing";
    const result = originalEndRound.call(this);
    Online.localEdgeBuffer.clear();   // bỏ phím đòn bấm đúng khoảnh khắc KO, khỏi tự ra đòn đầu hiệp sau
    if (wasPlaying && this.mode === "online" && Online.role === "p1" && !Online.applyingControl) {
      Online.sendControl("round_end");
    }
    return result;
  };

  const originalToMenu = Game.toMenu;
  Game.toMenu = function() {
    if (this.mode === "online" && Online.started) {
      if (!Online.applyingControl) Online.sendControl("quit");
      const result = originalToMenu.call(this);
      Online.disconnect(true);
      return result;
    }
    return originalToMenu.call(this);
  };

  // Link mời tự điền mã và mở thẳng sảnh online.
  const invitedRoom = new URLSearchParams(location.search).get("room");
  if (invitedRoom) setTimeout(() => Online.showLobby(), 0);
})();
