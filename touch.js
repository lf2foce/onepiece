/**
 * Điều khiển cảm ứng cho điện thoại/màn cảm ứng.
 * Không sửa logic game: mỗi nút chỉ "bắn" KeyboardEvent ảo -> hệ input phím sẵn có xử lý như thường.
 * Điều khiển Người chơi 1 (P1). Ép hiện bằng ?touch=1 để test trên máy tính.
 */
(() => {
  "use strict";

  const params = new URLSearchParams(location.search || "");
  const isTouch =
    params.get("touch") === "1" ||
    (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches) ||
    "ontouchstart" in window ||
    (navigator.maxTouchPoints || 0) > 0;

  if (!isTouch) return;   // máy tính có chuột: giữ nguyên bàn phím, không hiện nút

  document.body.classList.add("touch-device");
  const pad = document.getElementById("touchpad");
  if (pad) pad.classList.remove("hidden");

  const fireKey = (type, code) => {
    try { window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true })); } catch (e) {}
  };

  // Gắn 1 nút -> giữ = keydown, thả = keyup (dùng pointer capture để không kẹt khi trượt ngón)
  const bind = (btn) => {
    const code = btn.dataset.key;
    if (!code) return;
    let down = false;
    const press = (e) => {
      e.preventDefault();
      if (down) return;
      down = true;
      btn.classList.add("pressed");
      try { btn.setPointerCapture(e.pointerId); } catch (_) {}
      fireKey("keydown", code);
    };
    const release = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      if (!down) return;
      down = false;
      btn.classList.remove("pressed");
      fireKey("keyup", code);
    };
    btn.addEventListener("pointerdown", press);
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("lostpointercapture", release);
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  };
  document.querySelectorAll("#touchpad [data-key]").forEach(bind);

  // Nút ⏸ -> Escape (về menu, tiện đổi tướng/chế độ trên điện thoại)
  const pause = document.getElementById("tpPause");
  if (pause) {
    pause.addEventListener("pointerdown", (e) => { e.preventDefault(); fireKey("keydown", "Escape"); });
    pause.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  // Xin toàn màn hình khi chạm lần đầu (chơi đã hơn trên điện thoại) — im lặng nếu bị chặn
  const goFS = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
    window.removeEventListener("pointerdown", goFS);
  };
  window.addEventListener("pointerdown", goFS, { once: true });
})();
