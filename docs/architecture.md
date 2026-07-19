# Kiến trúc game ONE PIECE — Đối Kháng 2D

Tài liệu tham chiếu cho toàn bộ hệ thống. Cập nhật khi đổi kiến trúc lớn.

## 1. Tổng quan

- **Frontend**: HTML + CSS + JavaScript **thuần** (canvas 2D 960×540, 16:9), **không framework, không bước build**. Mở `index.html` là chạy.
- **Backend duy nhất**: `api/ws.ts` — một WebSocket server chạy trên **Vercel Functions (Fluid)**, chỉ phục vụ chế độ **chơi online**. Các chế độ khác chạy hoàn toàn ở client.
- **Hạ tầng online**: Vercel (host tĩnh + function) + **Upstash Redis** (pub/sub relay giữa các function instance).
- **Đóng gói**: PWA — "Thêm vào Màn hình chính" để chạy full màn hình như app trên iOS/Android.

## 2. Cấu trúc thư mục

```
game-dudu/
├─ index.html            # khung + nạp mọi script theo thứ tự
├─ style.css             # toàn bộ giao diện + HUD cảm ứng
├─ game.js               # ENGINE: vòng lặp, va chạm, HUD, chế độ, render
├─ adventure.js          # chế độ "đi bài" (beat-em-up 2.5D)
├─ multiplayer.js        # client online (host-authoritative + reconnect)
├─ touch.js              # điều khiển cảm ứng (bắn KeyboardEvent ảo)
├─ character/            # 10 nhân vật, mỗi file tự đăng ký chiêu + cách vẽ
│   ├─ luffy.js zoro.js sanji.js shanks.js ace.js
│   └─ aokiji.js sabo.js akainu.js whitebeard.js blackbeard.js
├─ api/ws.ts             # WebSocket server (Vercel + Redis)
├─ manifest.json         # PWA (standalone, landscape, icon)
├─ icon-*.png            # icon nón rơm cho PWA
├─ vercel.json           # fluid + region sin1 + maxDuration
├─ package.json tsconfig.json   # chỉ để build/kiểm tra type cho api/ws.ts
├─ serve.py              # dev server no-cache (chạy local)
└─ docs/                 # tài liệu này
```

**Thứ tự nạp script** (quan trọng): các file `character/*` nạp **trước** `game.js`. Vì thế lúc file nhân vật chạy, `window.OP_GAME` chưa tồn tại — các hook vẽ projectile phải tự cài qua `DOMContentLoaded` hoặc để `game.js` gọi lại.

## 3. Engine & hệ nhân vật

- `game.js` expose `window.OP_GAME` (đối tượng `Game`), `window.OP_MOVES` (bảng chiêu), `Game.Projectile`.
- Mỗi nhân vật là một hàm `window.XxxInit = (Fighter, MOVES) => {...}`:
  - Thêm `MOVES.xxx` — bộ **6 ô chiêu** (cận/xa/skill × biến thể khi thêm `↓`).
  - Thêm `Fighter.prototype.drawXxx` — cách vẽ riêng.
  - `game.js` gọi mọi `XxxInit` rồi điều phối vẽ trong `draw()` theo `s.id`.
- **6 ô chiêu**: 3 nút đòn (cận · xa · skill) × biến thể `↓`. Đầy 100% Haki → chiêu tốn Haki lên **SIÊU CHIÊU** (khựng hình điện ảnh, sát thương ×2.1).
- **Projectile hooks**: nhân vật mới tự cài qua `installHooks(Game)`; vài nhân vật cũ (sanji/shanks) dùng hook tên cố định `game.js` gọi.

## 4. Input

- Module-scope `held` (Set phím đang giữ) + `justPressed` (Set phím vừa bấm frame này, xoá cuối mỗi frame).
- `CONTROLS.p1` = WASD + F/G/H; `CONTROLS.p2` = mũi tên + `,`/`.`/`/`.
- `humanIntents(which)` đọc từ 2 Set trên ra intent `{left,right,jump,block,close,ranged,special}`.
- **Cảm ứng** (`touch.js`): mỗi nút HTML bắn `KeyboardEvent` ảo → **dùng lại y nguyên pipeline phím**, không đụng logic game. Khi máy là P2, tự đổi mã phím P1→P2 để engine nhận đúng đấu sĩ.
  - Di chuyển dùng **cần analog tròn** (bên trái): đẩy theo trục để bật/tắt phím hướng, cho phép **đẩy chéo** (lên+phải = nhảy tiến). Có vùng chết mỗi trục để đẩy nhẹ không trôi hướng.
  - Nút chiêu (phải) + nút Nhảy vẫn là nút bấm rời.

## 5. Các chế độ

`1p` (đấu máy) · `2p` (chung bàn phím) · `sandbox` (vô hạn Haki) · `2v2` (2 người + 2 máy) · `adventure` (đi bài) · **`online`** (2 máy qua mạng).

Trong `update()`, mỗi chế độ chọn `intentOf(fighter)` từ nguồn phù hợp (người/máy/mạng).

---

## 6. Chơi online (phần phức tạp nhất)

### 6.1 Kiến trúc tổng

```
Điện thoại A ─┐                              ┌─ Điện thoại B
  (P1)        │   WebSocket                  │   (P2)
              ▼                              ▼
      Vercel Function (api/ws.ts, region sin1) ── Fluid: 1 instance giữ nhiều kết nối
              │            ▲
              ▼            │  pub/sub (chỉ khi 2 người KHÁC instance)
        Upstash Redis (Singapore)
```

- **Frontend tĩnh** (`multiplayer.js`) nối WebSocket tới `/api/ws`.
- **Function** giữ kết nối, gán vai, chuyển tiếp tin.
- **Redis** chỉ để nối các function instance khác nhau (vì 2 kết nối WS **có thể** rơi vào 2 instance).

### 6.2 Mô hình host-authoritative

- **P1 là authority**: chạy mô phỏng "thật".
- **Cả hai máy đều mô phỏng** input để phản hồi tức thì (đòn của chính mình không chờ mạng).
- **P1 phát snapshot ~14Hz** (vị trí, HP, Haki, projectile...) → **P2 hiệu chỉnh** sai lệch.
- Chọn host-authoritative (thay vì lockstep) vì game có `Math.random`, không deterministic — mô hình này chịu được lệch.

### 6.3 Giao thức tin nhắn (JSON qua WS)

| type | hướng | ý nghĩa |
|---|---|---|
| `create` / `join` / `leave` | client→server | tạo / vào / rời phòng hẳn (nhả slot) |
| `assigned` | server→client | báo vai (p1/p2) + mã phòng + `lastSnapshot` để khôi phục |
| `ready` / `start` | server→client | đủ 2 người / bắt đầu trận (kèm nhân vật 2 bên) |
| `selection` | client→server | chọn nhân vật |
| `input` | 2 chiều (relay) | `{held, edges}` — phím giữ + đòn vừa bấm |
| `snapshot` | P1→relay→P2 | trạng thái đầy đủ (có `at` = mốc thời gian P1) |
| `control` | relay | `continue` / `round_end` / `quit` (chỉ P1 phát) |
| `peer_status` | server→client | đối thủ nối/ngắt/rời (`connected`, `left`) |
| `error` | server→client | lỗi phòng |

### 6.4 Vòng đời phòng (Redis)

- Phòng = **Redis hash** `game-dudu:room:<MÃ>` chứa `p1Token/p2Token/p1Char/p2Char/lastSnapshot`, **TTL 1 giờ**, gia hạn khi đang chơi.
- Mã phòng 5 ký tự (bỏ ký tự dễ nhầm). Giành slot bằng `HSETNX` → chống 2 người cùng chiếm P2.
- **Token người chơi** lưu ở `localStorage` → cùng thiết bị nối lại đúng vai.

### 6.5 Relay & tối ưu

- **1 `PSUBSCRIBE game-dudu:channel:*` dùng chung** cho mọi phòng → chỉ **2 kết nối Redis/instance** (1 publish + 1 subscribe), tránh cạn connection-limit Upstash. *(Đánh đổi: mỗi instance nhận traffic mọi phòng — chấp nhận ở quy mô hobby.)*
- **Fast-path**: `publishRoom` giao thẳng cho người **cùng instance** trước khi `await` Redis → bỏ hẳn 1 RTT tới Singapore mỗi tin (Fluid hay gom 2 người 1 phòng vào chung instance).
- **`INSTANCE_ID`** gắn vào mỗi tin publish → subscriber bỏ echo của chính mình (khỏi giao trùng khi đã fast-path).

### 6.6 Reconnect & khôi phục

- **Rớt tạm** (function tái tạo mỗi ~60–300s, hoặc mạng chập): client tự `scheduleReconnect` (backoff) rồi gửi lại `join` với token cũ → **giữ nguyên vai + trận**. Báo "đối thủ mất kết nối" **hoãn 2s** để reconnect chớp nhoáng khỏi nhấp nháy.
- **Reload trang**: client lấy `lastSnapshot` (server trả trong `assigned`) → **cả P1 lẫn P2 dựng lại trận** (trước đây P1 reload làm reset trận).
- **Rời hẳn** (`leave`): server `hDel` token+char → người khác vào thế được ngay, không đợi TTL.
- **Snapshot cũ đến muộn** bị bỏ qua nhờ so mốc `at` (đồng hồ P1, một nguồn nên tăng đều).

### 6.7 Chống lag / giữ mượt

- **Throttle input**: chỉ gửi khi đổi phím / có đòn / heartbeat 120ms (không spam 60fps).
- **Vị trí hiệu chỉnh mềm**: snapshot không gán thẳng x/y (sẽ giật lùi ~nửa RTT) mà **hoà 35%/snapshot**; chỉ bật thẳng khi lệch >140px.
- **Buffer đòn qua khựng hình**: engine bỏ qua intent lúc hitstop/super-freeze nhưng vẫn xoá `justPressed` → phải giữ đòn đã bấm lại, kẻo hai máy diễn khác nhau.
- **P2 không tự kết thúc hiệp**: chờ hiệu lệnh `round_end`/`continue` từ P1 (authority).
- **Region `sin1`**: ghim function về Singapore cho khớp Redis + gần người chơi VN — nếu không, tin đi vòng qua US mặc định.

### 6.8 Đánh đổi đã biết (không phải bug)

| Điểm | Vì sao chấp nhận |
|---|---|
| Thấy đối thủ trễ ~1 RTT | Bản chất relay; đòn của chính mình vẫn tức thì. Muốn thấp hơn phải **WebRTC P2P / LAN** |
| Hobby cap maxDuration → reconnect theo chu kỳ | Client tự nối lại; hết hẳn cần gói Pro |
| `PSUBSCRIBE *` không tối ưu ở quy mô lớn | Đổi lấy ít kết nối Upstash; đông thật mới cần subscribe từng phòng động |
| Snapshot 14Hz tốn quota | Nới 70→100ms nếu cần tiết kiệm |

---

## 7. PWA

- `manifest.json`: `display: standalone`, khoá `landscape`, icon.
- Meta iOS (`apple-mobile-web-app-capable`, status bar, `viewport-fit=cover`) → mở từ icon là full màn hình, mất thanh Safari.
- Nút cảm ứng né tai thỏ/vạch home bằng `env(safe-area-inset-*)`; chặn kéo-nảy + pull-to-refresh.
- Trên thiết bị cảm ứng, canvas lấp đầy màn hình (giãn ngang nhẹ, giữ đủ HUD).

## 8. Deploy

- **GitHub import trên Vercel** → mỗi lần push `main` là tự deploy (không cần `vercel` CLI).
- Preset **Other**, root `./`, không build (api/ws.ts tự nhận là function + `npm install`).
- **Env `REDIS_URL`** = chuỗi **native `rediss://…:6379`** của Upstash (KHÔNG dùng REST URL). Thêm Upstash qua Vercel Storage/Marketplace là env tự tiêm.
- **Region**: đảm bảo `api/ws` chạy **Singapore (sin1)** — qua `vercel.json` hoặc Settings → Functions → Region.
