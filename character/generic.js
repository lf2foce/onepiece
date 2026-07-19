/**
 * NHÂN VẬT DO AI SINH (generic, tham số hoá).
 * AI chỉ sinh DATA (JSON spec) — file này đọc spec để VẼ + build bộ chiêu bằng cơ chế engine sẵn có.
 * Không eval, không code từ AI. Hiện dùng cho các chế độ OFFLINE (online cần đồng bộ spec — làm sau).
 */
(() => {
  "use strict";

  const CTX = () => document.getElementById("game").getContext("2d");
  const rr = (ctx, x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // ---------------------------------------------------------------- VẼ nhân vật generic
  function drawGeneric(flash) {
    const ctx = CTX();
    const spec = (window.OP_SPECS || {})[this.id] || {};
    const C = spec.colors || {};
    const skin = flash ? "#ffd0c0" : (C.skin || "#f0c49a");
    const skinSh = C.skinSh || "#d9a878";
    const hair = C.hair || "#33241a";
    const top = flash ? "#ffffff" : (C.top || "#c33a5a");
    const topSh = C.topSh || "#8f2740";
    const bottom = C.bottom || "#28324c";
    const accent = C.accent || spec.aura || "#7fd0ff";
    const walking = this.state === "walk";
    const bob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 2 : (walking ? Math.abs(Math.sin(this.walkPhase)) * 3 : 0);
    const legSw = walking ? Math.sin(this.walkPhase) * 12 : 0;
    // Tay trước vung tới khi ra đòn
    let punch = 0;
    if (this.attack && this.attack.def && this.attack.def.type === "melee") {
      const d = this.attack.def, e = this.attack.elapsed;
      const aEnd = d.startup + d.active;
      if (e < d.startup) punch = (e / d.startup) * 0.4;
      else if (e < aEnd) punch = 0.4 + ((e - d.startup) / d.active) * 0.6;
      else punch = Math.max(0, 1 - (e - aEnd) / (d.recovery || 200));
    }

    // draw() ngoài đã translate tới (x,y) + scale(facing) + bóng -> chỉ vẽ ở gốc, thêm nhún người
    ctx.save();
    ctx.translate(0, -bob);

    // chân
    ctx.fillStyle = bottom;
    rr(ctx, -14 - legSw * 0.3, -46, 12, 46 + legSw, 5); ctx.fill();
    rr(ctx, 3 + legSw * 0.3, -46, 12, 46 - legSw, 5); ctx.fill();
    ctx.fillStyle = "#e8e2d0"; // giày
    rr(ctx, -15 - legSw * 0.3, -6, 15, 7, 3); ctx.fill();
    rr(ctx, 2 + legSw * 0.3, -6, 15, 7, 3); ctx.fill();

    // tay sau
    ctx.fillStyle = skinSh;
    rr(ctx, -20, -96, 10, 34, 5); ctx.fill();

    // thân
    ctx.fillStyle = topSh; rr(ctx, -17, -100, 34, 56, 8); ctx.fill();
    ctx.fillStyle = top; rr(ctx, -16, -100, 30, 54, 8); ctx.fill();
    // đai/khăn accent
    ctx.fillStyle = accent; rr(ctx, -17, -60, 34, 8, 3); ctx.fill();

    // đầu
    const hy = -118;
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(2, hy, 15, 0, Math.PI * 2); ctx.fill();
    // tóc
    ctx.fillStyle = hair;
    ctx.beginPath(); ctx.arc(2, hy - 3, 15, Math.PI, 0); ctx.fill();
    rr(ctx, -13, hy - 4, 30, 8, 4); ctx.fill();
    // băng đầu accent
    ctx.fillStyle = accent; rr(ctx, -14, hy - 1, 30, 4, 2); ctx.fill();
    // mắt
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath(); ctx.arc(9, hy, 2.2, 0, Math.PI * 2); ctx.fill();

    // tay trước (vung tới khi đấm)
    ctx.save();
    ctx.translate(8, -92);
    ctx.rotate(-0.3 - punch * 1.5);
    ctx.fillStyle = skin;
    rr(ctx, 0, -5, 12 + punch * 26, 11, 5); ctx.fill();
    ctx.fillStyle = accent; // găng accent ở nắm đấm
    ctx.beginPath(); ctx.arc(12 + punch * 26, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  // ---------------------------------------------------------------- HOOK vẽ đạn generic
  function installHooks(Game) {
    if (!Game.Projectile || Game.Projectile.prototype._genericHooked) return;
    const origDraw = Game.Projectile.prototype.draw;
    Game.Projectile.prototype.draw = function () {
      const k = this.d.kind;
      if (k !== "gen_orb" && k !== "gen_beam") return origDraw.call(this);
      const ctx = CTX();
      const col = this.d.color || "#7fd0ff";
      ctx.save();
      ctx.shadowColor = col; ctx.shadowBlur = 16;
      if (k === "gen_beam") {
        ctx.fillStyle = col; ctx.globalAlpha = 0.9;
        rr(ctx, this.x - this.w / 2, this.y - this.h / 2, this.w, this.h, this.h / 2); ctx.fill();
        ctx.globalAlpha = 1; ctx.fillStyle = "#ffffff";
        rr(ctx, this.x - this.w / 2, this.y - this.h / 6, this.w, this.h / 3, this.h / 6); ctx.fill();
      } else {
        const r = Math.max(this.w, this.h) / 2;
        const g = ctx.createRadialGradient(this.x, this.y, 1, this.x, this.y, r);
        g.addColorStop(0, "#ffffff"); g.addColorStop(0.45, col); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      if (Game.addTrail) Game.addTrail(this.x - this.dir * 10, this.y, col, "#ffffff");
    };
    Game.Projectile.prototype._genericHooked = true;
  }

  // ---------------------------------------------------------------- BUILD bộ chiêu từ spec
  const clampPow = (p) => Math.max(1, Math.min(3, Math.round(p || 2)));
  function shotProj(m, dfltPow, big, accent) {
    const p = clampPow(m && m.power != null ? m.power : dfltPow);
    const beam = m && m.shot === "beam";
    const kind = beam ? "gen_beam" : "gen_orb";
    return {
      kind, speed: beam ? 820 : 600, w: big ? 74 : 50, h: big ? 46 : 30,
      dmg: (big ? 14 : 8) + p * 4, knockback: 120 + p * 45, launch: -24,
      life: beam ? 900 : 1500, color: (m && m.color) || accent,
    };
  }
  function buildMoves(spec) {
    const m = spec.moves || {};
    const accent = spec.aura || "#7fd0ff";
    const close = {
      key: "close", name: (m.close && m.close.name) || "Đòn Cận", type: "melee",
      dmg: 5 + clampPow(m.close && m.close.power) * 3, startup: 80, active: 90, recovery: 180,
      reach: { dx: 32, dy: -58, w: 60, h: 36 }, knockback: 190 + clampPow(m.close && m.close.power) * 40,
      launch: -30, meterGain: 9, color: (m.close && m.close.color) || accent,
    };
    const ranged = {
      key: "ranged", name: (m.ranged && m.ranged.name) || "Chưởng Xa", type: "projectile",
      dmg: 10 + clampPow(m.ranged && m.ranged.power) * 4, startup: 120, active: 60, recovery: 240,
      meterGain: 12, proj: shotProj(m.ranged, 2, false, accent),
    };
    if (m.ranged && m.ranged.shot === "spread") {
      ranged.spread = { count: 5, arcDeg: 60, dmg: 6 + clampPow(m.ranged.power) * 2, speed: 600 };
    }
    const special = {
      key: "special", name: (m.special && m.special.name) || "Tuyệt Chiêu", type: "projectile",
      dmg: 16 + clampPow(m.special && m.special.power) * 6, startup: 220, active: 0, recovery: 440,
      meterCost: 50, meterGain: 0, sfx: "special",
      cry: (m.special && m.special.cry) || ((m.special && m.special.name) || "Special") + "!",
      proj: shotProj(m.special, 3, true, accent),
    };
    if (m.special && m.special.shot === "spread") {
      special.spread = { count: 7, arcDeg: 78, dmg: 8, speed: 640 };
    }
    return { close, ranged, special };
  }

  // ---------------------------------------------------------------- ĐĂNG KÝ nhân vật
  const HEX = (s, d) => (typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s)) ? s : d;
  let counter = 0;
  function normalize(spec) {
    spec = spec || {};
    const name = (spec.name || "Chiến Binh").toString().slice(0, 22).toUpperCase();
    const id = "ai" + (++counter) + Math.floor((window.OP_SPECS_SEED = (window.OP_SPECS_SEED || 7) * 33 + 1) % 9973).toString(36);
    const aura = HEX(spec.aura, "#7fd0ff");
    const colors = spec.colors || {};
    return {
      id, name, emoji: (spec.emoji || "✨").toString().slice(0, 4),
      title: (spec.title || "Do AI sinh").toString().slice(0, 24),
      desc: (spec.desc || "Nhân vật tuỳ biến").toString().slice(0, 40),
      aura,
      colors: {
        skin: HEX(colors.skin, "#f0c49a"), hair: HEX(colors.hair, "#33241a"),
        top: HEX(colors.top, "#c33a5a"), bottom: HEX(colors.bottom, "#28324c"),
        accent: HEX(colors.accent, aura),
      },
      moves: spec.moves || {},
    };
  }
  function register(rawSpec) {
    const spec = normalize(rawSpec);
    (window.OP_SPECS = window.OP_SPECS || {})[spec.id] = spec;
    if (window.OP_MOVES) window.OP_MOVES[spec.id] = buildMoves(spec);
    if (window.OP_CHAR_INFO) window.OP_CHAR_INFO[spec.id] = {
      name: spec.name, emoji: spec.emoji, aura: spec.aura, warm: true, title: spec.title, desc: spec.desc,
    };
    if (window.OP_ROSTER && !window.OP_ROSTER.includes(spec.id)) window.OP_ROSTER.push(spec.id);
    return spec;
  }

  // ---------------------------------------------------------------- BỘ SINH DỰ PHÒNG (không cần API)
  function fallback(desc) {
    const d = (desc || "").toLowerCase();
    const themes = [
      { k: ["băng", "ice", "lạnh", "tuyết", "frost"], accent: "#7fe0ff", top: "#2b6fa0", hair: "#dff5ff", shot: "beam", name: "Băng Kiếm", verb: "Đóng Băng" },
      { k: ["lửa", "fire", "hoả", "nhiệt", "magma", "dung nham", "flame"], accent: "#ff7a2b", top: "#a3331f", hair: "#3a1a10", shot: "orb", name: "Hoả Quyền", verb: "Bùng Cháy" },
      { k: ["điện", "sét", "thunder", "lightning"], accent: "#ffe14d", top: "#5a4bd6", hair: "#2a2050", shot: "beam", name: "Lôi Đình", verb: "Sấm Sét" },
      { k: ["độc", "poison", "axit", "acid", "green"], accent: "#9be24b", top: "#3a6b1f", hair: "#22400f", shot: "spread", name: "Độc Trảo", verb: "Phun Độc" },
      { k: ["bóng", "tối", "dark", "shadow", "hắc", "đêm"], accent: "#b060ff", top: "#2a1440", hair: "#120022", shot: "orb", name: "Ám Ảnh", verb: "Nuốt Bóng" },
      { k: ["gió", "wind", "phong", "khí", "bão"], accent: "#a0ffd0", top: "#2f7a5a", hair: "#123", shot: "spread", name: "Cuồng Phong", verb: "Xé Gió" },
      { k: ["nước", "water", "thuỷ", "biển", "sóng"], accent: "#4fb8ff", top: "#1f5a8f", hair: "#0a2a44", shot: "beam", name: "Thuỷ Long", verb: "Cuốn Sóng" },
    ];
    let t = themes.find((th) => th.k.some((w) => d.includes(w))) || themes[Math.abs(hash(d)) % themes.length];
    const name = (firstWords(desc) || t.name).toUpperCase();
    return {
      name, emoji: "✨", title: "Do AI sinh (bản thử)", desc: (desc || t.name).slice(0, 40),
      aura: t.accent,
      colors: { skin: "#f0c49a", hair: t.hair, top: t.top, bottom: "#26304a", accent: t.accent },
      moves: {
        close: { name: t.verb, power: 2, color: t.accent },
        ranged: { name: t.name, power: 2, color: t.accent, shot: t.shot === "beam" ? "beam" : (t.shot === "spread" ? "spread" : "orb") },
        special: { name: t.verb + " Tối Thượng", power: 3, color: t.accent, shot: t.shot === "spread" ? "spread" : "beam", cry: t.verb + "!" },
      },
    };
  }
  const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
  const firstWords = (s) => (s || "").trim().split(/\s+/).slice(0, 2).join(" ").slice(0, 20);

  // ---------------------------------------------------------------- Sinh qua API (Claude), rơi về fallback
  async function generate(desc) {
    try {
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ desc }),
      });
      if (res.ok) {
        const j = await res.json();
        if (j && j.character) return { spec: j.character, ai: true };
      }
    } catch (_) { /* offline / chưa có key -> fallback */ }
    return { spec: fallback(desc), ai: false };
  }

  window.OP_AICHAR = { register, fallback, generate, buildMoves };

  // ---------------------------------------------------------------- CÀI ĐẶT (DOM + hook)
  function setup() {
    if (window.OP_FIGHTER) window.OP_FIGHTER.prototype.drawGeneric = drawGeneric;
    if (window.OP_GAME) installHooks(window.OP_GAME);

    const byId = (i) => document.getElementById(i);
    const picker = byId("charPicker"), creator = byId("aiCreator");
    const prompt = byId("aiPrompt"), status = byId("aiStatus"), genBtn = byId("aiGenBtn");

    // nhớ ô đang chọn (p1/p2) để sau khi tạo mở lại đúng bảng
    let lastSlot = "p1Select";
    ["p1Select", "p2Select"].forEach((id) => byId(id)?.addEventListener("click", () => { lastSlot = id; }, true));

    // gợi ý mô tả bấm nhanh
    const suggest = byId("aiSuggest");
    if (suggest) {
      ["Kiếm sĩ băng phóng lửa xanh", "Vua sấm sét áo tím", "Sát thủ bóng đêm", "Chiến binh cuồng phong"].forEach((s) => {
        const b = document.createElement("button");
        b.className = "ai-chip"; b.textContent = s;
        b.addEventListener("click", () => { if (prompt) prompt.value = s; });
        suggest.appendChild(b);
      });
    }

    byId("aiCreateBtn")?.addEventListener("click", () => {
      picker?.classList.add("hidden");
      creator?.classList.remove("hidden");
      if (status) status.textContent = "";
      prompt?.focus();
    });
    const closeCreator = () => {
      creator?.classList.add("hidden");
      byId(lastSlot)?.click();   // mở lại bảng chọn tướng (đã có nhân vật mới)
    };
    byId("aiCloseBtn")?.addEventListener("click", () => { creator?.classList.add("hidden"); picker?.classList.remove("hidden"); });

    // Debug: ?aigen=<mô tả> -> tự sinh (bản thử) + gán làm P1 để test nhanh không cần bấm.
    // Debug nhanh: ?aigen=<mô tả> -> sinh (bản thử) + gán P1 + vào trận 1p để xem ngay.
    const testDesc = new URLSearchParams(location.search).get("aigen");
    if (testDesc && window.OP_GAME) {
      const s = register(fallback(testDesc));
      setTimeout(() => { window.OP_GAME.p1CharId = s.id; window.OP_GAME.startMatch("1p"); }, 800);
    }

    genBtn?.addEventListener("click", async () => {
      const desc = (prompt?.value || "").trim();
      if (desc.length < 3) { if (status) status.textContent = "Hãy mô tả vài chữ về nhân vật."; return; }
      genBtn.disabled = true;
      if (status) status.textContent = "✨ Đang sinh nhân vật…";
      const { spec, ai } = await window.OP_AICHAR.generate(desc);
      const reg = window.OP_AICHAR.register(spec);
      genBtn.disabled = false;
      if (status) status.textContent = `Đã tạo ${reg.emoji} ${reg.name}${ai ? "" : " (bản thử — thêm API key để dùng Claude)"}! Đang mở bảng chọn…`;
      setTimeout(closeCreator, 900);
    });
  }

  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", setup);
  else setup();
})();
