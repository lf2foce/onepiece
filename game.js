/* =====================================================================
   ONE PIECE — Luffy vs Zoro | Game đối kháng 2D (canvas thuần)
   - Đòn tầm gần (cận chiến) + tầm xa (projectile) + tuyệt chiêu (Haki)
   - 1 người (vs AI) hoặc 2 người cùng bàn phím
   ===================================================================== */
(() => {
  "use strict";

  // ---------------------------------------------------------------- Canvas
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;   // 960
  const H = canvas.height;  // 540
  const GROUND = H - 78;    // cao độ mặt đất (chân đứng)

  // ---------------------------------------------------------------- Vật lý
  const GRAVITY = 2200;      // px/s^2
  const MOVE_SPEED = 260;    // px/s
  const JUMP_V = -820;       // px/s
  const FRICTION = 0.82;

  // ---------------------------------------------------------------- Input
  const held = new Set();       // phím đang giữ
  const justPressed = new Set(); // phím vừa bấm (edge) trong frame này

  const PREVENT = new Set([
    "ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space","Slash","Comma","Period"
  ]);

  window.addEventListener("keydown", (e) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    if (!held.has(e.code)) justPressed.add(e.code);
    held.add(e.code);
    // phím tiện ích
    if (e.code === "Escape") Game.toMenu();
    if (e.code === "KeyP") Game.togglePause();
  });
  window.addEventListener("keyup", (e) => held.delete(e.code));
  window.addEventListener("blur", () => held.clear());

  const CONTROLS = {
    p1: { left:"KeyA", right:"KeyD", jump:"KeyW", block:"KeyS",
          close:"KeyF", ranged:"KeyG", special:"KeyH" },
    p2: { left:"ArrowLeft", right:"ArrowRight", jump:"ArrowUp", block:"ArrowDown",
          close:"Comma", ranged:"Period", special:"Slash" },
  };

  // ---------------------------------------------------------------- Âm thanh (WebAudio, tạo bằng code)
  const Sound = (() => {
    let ac = null;
    const ensure = () => {
      if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
      if (ac && ac.state === "suspended") ac.resume();
      return ac;
    };
    const tone = (freq, dur, type="square", vol=0.14, slideTo=null) => {
      const a = ensure(); if (!a) return;
      const t = a.currentTime;
      const o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(a.destination);
      o.start(t); o.stop(t + dur + 0.02);
    };
    const noise = (dur, vol=0.2) => {
      const a = ensure(); if (!a) return;
      const n = Math.floor(a.sampleRate * dur);
      const buf = a.createBuffer(1, n, a.sampleRate);
      const d = buf.getChannelData(0);
      for (let i=0;i<n;i++) d[i] = (Math.random()*2-1) * (1 - i/n);
      const src = a.createBufferSource(); src.buffer = buf;
      const g = a.createGain(); g.gain.value = vol;
      src.connect(g).connect(a.destination); src.start();
    };
    return {
      punch: () => tone(160, 0.09, "square", 0.16, 90),
      slash: () => tone(720, 0.12, "sawtooth", 0.1, 220),
      shoot: () => tone(440, 0.16, "triangle", 0.12, 140),
      hit:   () => { tone(220, 0.08, "square", 0.16, 60); noise(0.08, 0.14); },
      special: () => { tone(120, 0.4, "sawtooth", 0.18, 500); noise(0.25, 0.12); },
      jump:  () => tone(300, 0.12, "sine", 0.1, 620),
      ko:    () => tone(500, 0.6, "triangle", 0.2, 60),
      round: () => tone(660, 0.25, "square", 0.14, 990),
      superFlash: () => { tone(140, 0.55, "sawtooth", 0.2, 1100); tone(70, 0.7, "square", 0.16, 320); noise(0.35, 0.16); },
    };
  })();

  // ---------------------------------------------------------------- Giọng hô tên chiêu (Web Speech API, không cần thư viện)
  const Voice = (() => {
    const ok = typeof window !== "undefined" && "speechSynthesis" in window;
    let voice = null;
    const pick = () => {
      if (!ok) return;
      const vs = window.speechSynthesis.getVoices();
      voice = vs.find(v => /^en/i.test(v.lang) && /male|daniel|alex|fred|arthur|google (uk|us)/i.test(v.name))
           || vs.find(v => /^en/i.test(v.lang)) || vs[0] || null;
    };
    if (ok) { pick(); window.speechSynthesis.onvoiceschanged = pick; }
    return {
      say(text) {
        if (!ok || !text) return;
        try {
          window.speechSynthesis.cancel();               // ngắt câu trước, không xếp hàng
          const u = new SpeechSynthesisUtterance(text);
          if (voice) u.voice = voice;
          u.rate = 1.02; u.pitch = 0.85; u.volume = 1;   // trầm, dứt khoát cho ngầu
          window.speechSynthesis.speak(u);
        } catch (e) {}
      },
    };
  })();

  // ---------------------------------------------------------------- Tiện ích
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rectsOverlap = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // ================================================================ MOVE SETS
  // type: "melee" (hitbox theo hướng) | "projectile" (bắn đạn)
  // Thời gian tính bằng ms: startup -> active -> recovery
  const MOVES = {
    luffy: {},
    zoro: {}
  };

  // Chiêu ↓+skill theo nhân vật: chưa đầy Haki -> "special"; đầy 100% -> "ult" (siêu chiêu 2)
  const DOWN_MOVES = {
    luffy: { special: "axe",   ult: "king" },
    zoro:  { special: "asura", ult: "sanzen" },
  };

  // ================================================================ PROJECTILE
  class Projectile {
    constructor(owner, def) {
      this.owner = owner;
      this.d = def;
      this.dir = owner.facing;
      this.x = owner.x + owner.facing * 40;
      this.y = owner.y - 66;
      this.vx = def.speed * this.dir;
      this.w = def.w; this.h = def.h;
      this.life = def.life;
      this.dead = false;
      this.t = 0;
    }
    get rect() { return { x:this.x - this.w/2, y:this.y - this.h/2, w:this.w, h:this.h }; }
    update(dt) {
      this.t += dt * 1000;
      this.x += this.vx * dt;
      this.life -= dt * 1000;
      // vệt đạn cho tuyệt chiêu
      if (this.d.kind === "redhawk") Game.addTrail(this.x - this.dir * 22, this.y, "#ff7a2b", "#ffd23f");
      else if (this.d.kind === "tatsumaki") Game.addTrail(this.x - this.dir * 10, this.y + (Math.random()*80 - 40), "#39d67e", "#bfffdb");
      else if (this.d.kind === "sanzen") Game.addTrail(this.x - this.dir * 14, this.y + (Math.random()*70 - 35), "#39d67e", "#d2ffe4");
      if (this.life <= 0 || this.x < -80 || this.x > W + 80) this.dead = true;
    }
    draw() {
      const { kind, color } = this.d;
      ctx.save();
      ctx.translate(this.x, this.y);
      if (this.dir < 0) ctx.scale(-1, 1);
      const spin = this.t / 90;

      // Quầng sáng cho đạn SUPER (full Haki)
      if (this.d.super) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const gr = this.w * 1.5;
        const g = ctx.createRadialGradient(0, 0, 4, 0, 0, gr);
        const warm = this.owner && this.owner.id === "luffy";
        g.addColorStop(0, warm ? "rgba(255,235,180,0.5)" : "rgba(235,255,240,0.6)");
        g.addColorStop(0.45, warm ? "rgba(255,130,30,0.5)" : "rgba(80,255,160,0.5)");
        g.addColorStop(1, warm ? "rgba(255,80,20,0)" : "rgba(40,220,120,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, gr, 0, Math.PI * 2); ctx.fill();
        // vảy sáng lấp lánh
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        for (let i = 0; i < 4; i++) {
          const a = spin * 1.4 + i * Math.PI / 2;
          ctx.beginPath(); ctx.arc(Math.cos(a) * this.w * 0.7, Math.sin(a) * this.h * 0.4, 2.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        ctx.scale(1.15, 1.15);   // đạn to hơn chút cho oách
      }

      if (kind === "gum") {
        // Nắm đấm cao su + tay kéo dài bọc ống tay áo đỏ
        ctx.strokeStyle = "#e0a06f"; ctx.lineWidth = 14; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(10, 0); ctx.stroke();
        
        // Ống tay áo đỏ co giãn ở gốc đấm
        ctx.strokeStyle = "#e5342e"; ctx.lineWidth = 17;
        ctx.beginPath(); ctx.moveTo(-75, 0); ctx.lineTo(-45, 0); ctx.stroke();
        
        // Nắm đấm tay trước
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(14, 0, 18, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#e0a06f";
        for (let i=0;i<3;i++){ ctx.beginPath(); ctx.arc(24, -8+i*8, 4, 0, Math.PI*2); ctx.fill(); }
        
        // Vệt gió lướt
        ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-90, -10); ctx.lineTo(-50, -10);
        ctx.moveTo(-90, 10); ctx.lineTo(-50, 10);
        ctx.stroke();
      } else if (kind === "gatling") {
        // Gomu Gomu no Gatling - Cánh tay kéo dài kết nối trực tiếp từ vai của Luffy
        const dx = (this.owner.x - this.x) * this.dir;
        const dy = (this.owner.y - 75) - this.y;
        const L = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = -dx / L;
        const uy = -dy / L;
        const sleeveLen = Math.min(30, L * 0.4);

        // 1. Vẽ ống tay áo đỏ co giãn từ vai
        ctx.strokeStyle = "#e5342e"; ctx.lineWidth = 16; ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.lineTo(dx + ux * sleeveLen, dy + uy * sleeveLen);
        ctx.stroke();

        // 2. Vẽ cánh tay kéo dài màu da trần nối tiếp tới nắm đấm
        ctx.strokeStyle = "#e0a06f"; ctx.lineWidth = 12; ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(dx + ux * (sleeveLen * 0.8), dy + uy * (sleeveLen * 0.8));
        ctx.lineTo(0, 0);
        ctx.stroke();

        // 3. Nắm đấm rực lửa/có lực đấm
        ctx.fillStyle = color || "#ffcf9e";
        ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#e0a06f";
        for (let i = 0; i < 3; i++) {
          ctx.beginPath(); ctx.arc(8, -6 + i * 6, 3.5, 0, Math.PI * 2); ctx.fill();
        }

        // 4. Vệt gió lướt vung đấm siêu tốc
        ctx.strokeStyle = "rgba(255, 255, 255, 0.45)"; ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-35, -8); ctx.lineTo(-10, -8);
        ctx.moveTo(-35, 8); ctx.lineTo(-10, 8);
        ctx.stroke();
      } else if (kind === "redhawk") {
        // ---- RED HAWK: nắm đấm bọc lửa hình chim ưng rực cháy ----
        const fl = this.t / 55;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        // Đuôi lửa nhiều lớp (comet) vẫy về sau
        const layers = [
          { c: "rgba(190,25,0,0.45)",   L: 84, w: 27 },
          { c: "rgba(255,80,0,0.55)",   L: 68, w: 19 },
          { c: "rgba(255,160,30,0.72)", L: 52, w: 13 },
          { c: "rgba(255,232,150,0.92)",L: 36, w: 7 },
        ];
        for (let k = 0; k < layers.length; k++) {
          const L = layers[k].L, w = layers[k].w, wob = Math.sin(fl + k * 0.7) * 4;
          ctx.fillStyle = layers[k].c;
          ctx.beginPath();
          ctx.moveTo(16, -w);
          ctx.quadraticCurveTo(-L * 0.35, -w - 3 + wob, -L, wob);
          ctx.quadraticCurveTo(-L * 0.35, w + 3 + wob, 16, w);
          ctx.quadraticCurveTo(26, 0, 16, -w);
          ctx.closePath(); ctx.fill();
        }

        // Hai cánh lửa chim ưng xoè trên/dưới, phần phật
        for (const s of [-1, 1]) {
          const wing = 14 + Math.sin(fl * 1.3) * 4;
          ctx.fillStyle = "rgba(255,110,10,0.42)";
          ctx.beginPath();
          ctx.moveTo(2, 0);
          ctx.quadraticCurveTo(-16, s * (24 + wing), -42, s * (12 + wing));
          ctx.quadraticCurveTo(-18, s * 7, 2, 0);
          ctx.closePath(); ctx.fill();
        }

        // Lưỡi lửa nhỏ lắt lay ở đuôi
        for (let i = 0; i < 5; i++) {
          const t = i / 5, bx = 12 - t * 66;
          const fy = Math.sin(fl * 1.6 + i * 1.4) * (8 + t * 14);
          ctx.fillStyle = i % 2 ? "rgba(255,150,0,0.5)" : "rgba(255,70,0,0.4)";
          ctx.beginPath();
          ctx.moveTo(bx, 0);
          ctx.quadraticCurveTo(bx - 7, fy, bx - 15, fy * 1.25);
          ctx.quadraticCurveTo(bx - 5, fy * 0.4, bx, 0);
          ctx.closePath(); ctx.fill();
        }

        ctx.globalCompositeOperation = "source-over";

        // Quầng nóng quanh nắm đấm
        const halo = ctx.createRadialGradient(22, 0, 3, 22, 0, 30);
        halo.addColorStop(0, "rgba(255,245,200,0.95)");
        halo.addColorStop(0.5, "rgba(255,120,20,0.65)");
        halo.addColorStop(1, "rgba(255,60,0,0)");
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(22, 0, 30, 0, Math.PI * 2); ctx.fill();

        // Ống tay áo đỏ + cổ tay da
        ctx.lineCap = "round";
        ctx.strokeStyle = "#c92a1c"; ctx.lineWidth = 15;
        ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(8, 0); ctx.stroke();
        ctx.strokeStyle = "#e8a878"; ctx.lineWidth = 11;
        ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(13, 0); ctx.stroke();

        // Nắm đấm đỏ rực (gradient) + đốt ngón + lõi trắng nóng
        const fg = ctx.createRadialGradient(20, -4, 3, 23, 3, 18);
        fg.addColorStop(0, "#fff4cc");
        fg.addColorStop(0.45, "#ff8a2b");
        fg.addColorStop(1, "#d1330f");
        ctx.fillStyle = fg;
        ctx.beginPath(); ctx.arc(21, 0, 15, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(140,30,8,0.55)"; ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) { ctx.moveTo(27, -6 + i * 6); ctx.lineTo(33, -6 + i * 6); }
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath(); ctx.arc(18, -4, 5.5, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
      } else if (kind === "slash") {
        // Lưỡi chém chân không hình bán nguyệt sắc lẹm
        ctx.strokeStyle = color; ctx.lineWidth = 8; ctx.lineCap = "round";
        for (let i=-1; i<=1; i++){
          ctx.globalAlpha = 1 - Math.abs(i)*0.35;
          ctx.beginPath();
          ctx.arc(i*12, 0, 30, -Math.PI*0.55, Math.PI*0.55);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        
        // Lõi trắng chém lẹm sắc bén
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(6, 0, 28, -Math.PI*0.45, Math.PI*0.45);
        ctx.stroke();
      } else if (kind === "tatsumaki") {
        // Long Quyển Phong - Cơn lốc rồng xanh cuộn trào
        ctx.rotate(spin * 1.4);
        for (let i=0; i<8; i++){
          const r = 10 + i*11;
          ctx.globalAlpha = 0.92 - i*0.11;
          ctx.strokeStyle = i%2 ? color : "#ffffff";
          ctx.lineWidth = 5 + i*1.2;
          ctx.beginPath();
          ctx.ellipse(0, i*4 - 15, r, r*1.8, spin*0.35 + i*0.2, 0, Math.PI*2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (kind === "sanzen") {
        // Santoryu Ougi: Sanzen Sekai — đĩa kiếm khí xoay (nhiều katana toả tròn)
        ctx.save();
        // đĩa khí xanh phát sáng
        ctx.globalCompositeOperation = "lighter";
        const disc = ctx.createRadialGradient(0, 0, 6, 0, 0, 62);
        disc.addColorStop(0, "rgba(210,255,225,0.85)");
        disc.addColorStop(0.55, "rgba(60,220,120,0.42)");
        disc.addColorStop(1, "rgba(30,150,80,0)");
        ctx.fillStyle = disc;
        ctx.beginPath(); ctx.arc(0, 0, 62, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        // các lưỡi katana toả tròn, xoay
        ctx.rotate(spin * 1.1);
        for (let i = 0; i < 6; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI) / 3);
          // chuôi
          ctx.strokeStyle = "#2c7a3f"; ctx.lineWidth = 4.5; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(12, 0); ctx.stroke();
          // đốc vàng
          ctx.fillStyle = "#d4a017"; ctx.beginPath(); ctx.arc(12, 0, 2.4, 0, Math.PI * 2); ctx.fill();
          // lưỡi kiếm sáng
          const bg = ctx.createLinearGradient(14, 0, 60, 0);
          bg.addColorStop(0, "#cfeed8"); bg.addColorStop(0.5, "#ffffff"); bg.addColorStop(1, "#eafff2");
          ctx.strokeStyle = bg; ctx.lineWidth = 5.5;
          ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(60, 0); ctx.stroke();
          ctx.restore();
        }
        // lõi sáng trung tâm
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(120,255,180,0.6)";
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
  }

  // ================================================================ FIGHTER
  class Fighter {
    constructor(id, x, facing) {
      this.id = id;                 // "luffy" | "zoro"
      this.moves = MOVES[id];
      this.x = x;
      this.y = GROUND;              // y = mặt đất của chân
      this.vx = 0; this.vy = 0;
      this.facing = facing;         // 1 phải, -1 trái
      this.onGround = true;
      this.hp = 100;
      this.meter = 0;               // Haki 0..100
      this.state = "idle";          // idle|walk|jump|block|attack|hurt|ko
      this.attack = null;           // {def, elapsed, phase, hit:Set, spawned}
      this.hurtTimer = 0;
      this.blocking = false;
      this.animTime = 0;
      this.walkPhase = 0;
      this.flash = 0;               // nhấp nháy khi trúng đòn
      this.width = 62;
      this.height = 135;
      this.wins = 0;
      this.combo = 0;               // số đòn liên hoàn ĐÃ đánh trúng
      this.comboTimer = 0;          // hết giờ -> reset combo
      this.comboPop = 0;            // hiệu ứng phóng to khi +combo
    }

    // hộp thân để tính va chạm
    get body() { return { x:this.x - 26, y:this.y - this.height, w:52, h:this.height }; }
    get cx() { return this.x; }

    reset(x, facing) {
      this.x = x; this.y = GROUND; this.vx = 0; this.vy = 0;
      this.facing = facing; this.onGround = true;
      this.hp = 100; this.meter = Math.min(this.meter, 30);
      this.state = "idle"; this.attack = null; this.hurtTimer = 0;
      this.blocking = false; this.flash = 0;
      this.combo = 0; this.comboTimer = 0; this.comboPop = 0;
    }

    canAct() { return this.state !== "attack" && this.state !== "hurt" && this.state !== "ko"; }

    gainMeter(n) { this.meter = clamp(this.meter + n, 0, 100); }

    startAttack(kind) {
      if (!this.canAct()) return;
      const def = this.moves[kind];
      if (!def) return;
      // SUPER: đầy Haki 100% -> siêu chiêu (khựng + mạnh). king/sanzen là chiêu riêng chỉ có ở super
      const canSuper = (kind === "special" || kind === "king" || kind === "sanzen");
      const isSuper = canSuper && this.meter >= 100;
      if (!isSuper && def.meterCost && this.meter < def.meterCost) return; // chưa đủ Haki
      if (isSuper) this.meter -= 100;
      else if (def.meterCost) this.meter -= def.meterCost;
      this.state = "attack";
      this.attack = { def, elapsed:0, phase:"startup", hit:new Set(), spawned:false, isSuper };
      this.vx *= 0.2;
      if (isSuper) Game.triggerSuper(this);   // triggerSuper sẽ hô tên chiêu (khi khựng hình)
    }

    takeHit(dmg, kb, launch, fromDir, isSpecial, attacker) {
      if (this.state === "ko") return;
      let real = dmg;
      let stun = isSpecial ? 520 : 340;
      const blocked = this.blocking && this.onGround;
      // Đỡ đòn: giảm 80% sát thương, ít giật, đứng vững
      if (blocked) {
        real = Math.max(1, Math.round(dmg * 0.2));
        kb *= 0.35; launch = 0; stun = 140;
        this.gainMeter(dmg * 0.4);
        if (attacker) attacker.combo = 0;          // đỡ được -> ngắt combo
      } else {
        this.state = "hurt";
        this.hurtTimer = stun;
        this.vy = launch;
        this.onGround = launch < 0 ? false : this.onGround;
        this.gainMeter(dmg * 0.6);
        if (attacker) {                            // cộng combo cho người tấn công
          attacker.combo++;
          attacker.comboTimer = 1400;
          attacker.comboPop = 1;
        }
      }
      this.hp = clamp(this.hp - real, 0, 100);
      this.vx = kb * fromDir;
      this.flash = 140;
      Sound.hit();
      Game.addHitSpark(this.x, this.y - 70, blocked, isSpecial);
      // HITSTOP — khựng nhanh, gọn để cú đánh có lực mà không lợn cợn
      Game.hitstop = Math.max(Game.hitstop, blocked ? 22 : (isSpecial ? 70 : 45));
      if (isSpecial && !blocked) Game.flashScreen = 1;
      if (this.hp <= 0) {
        this.hp = 0; this.state = "ko";
        this.attack = null;
        if (attacker) attacker.comboTimer = 1600;  // giữ combo hiện lúc KO
        Sound.ko();
      }
    }

    // intents: {left,right,jump,block, close,ranged,special}  (attacks là edge)
    update(dt, opp, intents) {
      this.animTime += dt;

      // ----- xử lý va chạm đạn của đối thủ (kiểm tra ở Game) -----

      if (this.state === "ko") {
        // ngã xuống
        this.vy += GRAVITY * dt;
        this.y += this.vy * dt;
        this.x += this.vx * dt;
        this.vx *= 0.9;
        if (this.y >= GROUND) { this.y = GROUND; this.vy = 0; }
        this.x = clamp(this.x, 40, W - 40);
        return;
      }

      // giảm bộ đếm
      if (this.flash > 0) this.flash -= dt * 1000;

      // hướng nhìn tự động về phía đối thủ khi rảnh
      if (this.canAct()) {
        this.facing = opp.x >= this.x ? 1 : -1;
      }

      // ------ trạng thái hurt ------
      if (this.state === "hurt") {
        this.hurtTimer -= dt * 1000;
        if (this.hurtTimer <= 0 && this.onGround) this.state = "idle";
      }

      // ------ điều khiển khi có thể hành động ------
      this.blocking = false;
      if (this.canAct()) {
        const hasAttackIntent = intents.close || intents.ranged || intents.special;

        // block (chỉ đỡ đòn nếu không có ý định tấn công)
        if (intents.block && this.onGround && !hasAttackIntent) {
          this.blocking = true;
          this.state = "block";
          this.vx *= 0.6;
        }

        if (!this.blocking) {
          // di chuyển
          let move = 0;
          if (intents.left) move -= 1;
          if (intents.right) move += 1;
          this.vx = move * MOVE_SPEED;
          if (this.onGround) this.state = move !== 0 ? "walk" : "idle";

          // nhảy
          if (intents.jump && this.onGround) {
            this.vy = JUMP_V; this.onGround = false; this.state = "jump";
            Sound.jump();
          }

          // tấn công (edge). ↓+skill: đầy Haki -> siêu chiêu 2, chưa đầy -> đặc biệt thường
          const dm = DOWN_MOVES[this.id];
          const downSkill = () => {
            this.startAttack(this.meter >= 100 ? dm.ult : dm.special);
            if (this.state === "attack") Sound.special();
          };
          if (intents.close) { this.startAttack("close"); Sound[this.moves.close.sfx](); }
          else if (intents.special) {
            if (intents.block) downSkill();                              // ↓ + tuyệt chiêu -> chiêu 2
            else this.startAttack("special");                           // tuyệt chiêu -> chiêu 1
          }
          else if (intents.ranged) {
            if (intents.block) downSkill();                              // ↓ + skill xa (tương thích)
            else { this.startAttack("ranged"); if (this.state === "attack") Sound[this.moves.ranged.sfx](); }
          }
        }
      }

      // ------ tiến trình đòn đánh ------
      if (this.state === "attack" && this.attack) {
        const a = this.attack;
        a.elapsed += dt * 1000;
        const d = a.def;
        const sEnd = d.startup;
        const aEnd = d.startup + d.active;
        const rEnd = d.startup + d.active + d.recovery;

        if (a.elapsed < sEnd) a.phase = "startup";
        else if (a.elapsed < aEnd || d.type==="projectile") a.phase = "active";
        else a.phase = "recovery";

        // sinh projectile (hỗ trợ loạt đạn hoặc đơn lẻ)
        if (d.type === "projectile" && a.elapsed >= sEnd) {
          if (d.multiProj) {
            if (a.spawnedCount === undefined) a.spawnedCount = 0;
            const nextSpawnTime = sEnd + a.spawnedCount * d.multiProj.interval;
            if (a.elapsed >= nextSpawnTime && a.spawnedCount < d.multiProj.count) {
              const isLast = a.spawnedCount === d.multiProj.count - 1;
              const pDef = {
                kind: "gatling",
                speed: d.multiProj.speed,
                w: d.proj.w,
                h: d.proj.h,
                dmg: isLast ? d.multiProj.dmg + 2 : d.multiProj.dmg,
                knockback: isLast ? d.proj.knockback * 2.2 : d.proj.knockback,
                launch: isLast ? d.proj.launch * 1.8 : d.proj.launch,
                life: d.proj.life,
                color: d.proj.color
              };
              const proj = new Projectile(this, pDef);
              // Lệch trục Y một ít ngẫu nhiên tạo độ loe cho thế liên hoàn đấm
              proj.y += (Math.random() * 32 - 16);
              Game.projectiles.push(proj);
              this.gainMeter(2);
              Sound.punch();
              a.spawnedCount++;
            }
          } else if (!a.spawned) {
            a.spawned = true;
            let pdef = d.proj;
            if (a.isSuper) {
              pdef = Object.assign({}, d.proj, {
                dmg: Math.round(d.proj.dmg * 2.1),
                knockback: d.proj.knockback * 1.5,
                launch: (d.proj.launch || 0) * 1.25,
                w: d.proj.w * 1.6, h: d.proj.h * 1.6,
                life: d.proj.life + 500,
                super: true,
              });
            }
            Game.projectiles.push(new Projectile(this, pdef));
            this.gainMeter(d.meterGain || 0);
            if (d.sfx === "special") Sound.special();
          }
        }

        // Xử lý di chuyển lướt thong thả siêu xa đặc biệt cho Ashura của Zoro (ở dưới đất)
        if (d.key === "asura") {
          if (a.phase === "startup") {
            this.vx = 450 * this.facing; // Thong thả lao lên chuẩn bị quét kiếm
          } else if (a.phase === "active") {
            this.vx = 360 * this.facing; // Lướt ngang đầm thong thả, xoay quét sạch đối thủ
          } else {
            this.vx *= 0.85; // Giảm tốc độ khi kết thúc đòn
          }
        }

        if (a.elapsed >= rEnd) {
          this.state = "idle";
          this.attack = null;
        }
      }

      // ------ vật lý ------
      if (!this.onGround) {
        this.vy += GRAVITY * dt;
      }
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      if (!this.onGround && this.vy > 0 && this.state !== "attack") this.state = "jump";

      if (this.y >= GROUND) {
        this.y = GROUND; this.vy = 0;
        if (!this.onGround) {
          this.onGround = true;
          if (this.state === "jump") this.state = "idle";
        }
      }
      if (this.onGround && this.state !== "attack" && this.state !== "hurt") this.vx *= FRICTION;

      this.x = clamp(this.x, 40, W - 40);
      this.walkPhase += Math.abs(this.vx) * dt * 0.05;
    }

    // hộp sát thương cho đòn melee (chỉ trong pha active)
    getHitbox() {
      if (this.state !== "attack" || !this.attack) return null;
      const d = this.attack.def;
      if (d.type !== "melee") return null;
      if (this.attack.phase !== "active") return null;
      // King Kong Gun: hitbox ĐỘNG bám theo nắm đấm vươn xa (trùng công thức vẽ)
      if (d.key === "king") {
        const sw = Math.max(0, this.armSwing());
        const reach = 40 + sw * 660;
        const R = 66 + sw * 58;
        const near = 6, far = reach + R * 0.55;
        const h = R * 1.9;
        const x = this.facing > 0 ? this.x + near : this.x - far;
        return { x, y: (this.y - 78) - h / 2, w: far - near, h };
      }
      const r = d.reach;
      const x = this.facing > 0 ? this.x + r.dx : this.x - r.dx - r.w;
      const y = this.y + r.dy;
      return { x, y, w:r.w, h:r.h };
    }

    // ---------------------------------------------------------- VẼ NHÂN VẬT
    drawAura() {
      if (this.state === "ko") return;
      const f = this;
      const isSpecialAttack = f.state === "attack" && f.attack && f.attack.def.key === "special";
      if (f.meter < 50 && !isSpecialAttack) return;

      ctx.save();
      // Vẽ Aura tại tọa độ nhân vật
      ctx.translate(f.x, f.y);
      ctx.scale(f.facing, 1);

      const anim = f.animTime * 12;
      const intensity = isSpecialAttack ? 1.6 : (f.meter >= 100 ? 1.15 : 0.75);
      
      // Sử dụng chế độ hòa trộn màn hình (screen) để tạo vệt phát sáng cộng gộp rực rỡ
      ctx.globalCompositeOperation = "screen";
      
      const numFlames = 6;
      for (let i = 0; i < numFlames; i++) {
        const angle = (i / numFlames) * Math.PI * 2 + anim * 0.04;
        const radiusX = 26 + Math.sin(anim * 0.35 + i) * 6 * intensity;
        const radiusY = 64 + Math.cos(anim * 0.3 + i * 1.5) * 12 * intensity;
        const offsetY = -f.height / 2 - 8 + Math.sin(anim * 0.45 + i) * 6 * intensity;
        
        ctx.save();
        ctx.translate(0, offsetY);
        ctx.rotate(angle * 0.08);
        
        const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, radiusY);
        if (f.id === "luffy") {
          // Luffy: Aura nhiệt lửa Gear 2 màu đỏ hồng rực nóng
          grad.addColorStop(0, "rgba(255, 230, 240, 0.95)");
          grad.addColorStop(0.25, "rgba(255, 90, 110, 0.75)");
          grad.addColorStop(0.55, "rgba(255, 40, 40, 0.32)");
          grad.addColorStop(1, "rgba(255, 100, 50, 0)");
        } else {
          // Zoro: Aura quỷ kiếm khí phong vân màu xanh lục bảo huyền bí
          grad.addColorStop(0, "rgba(230, 255, 240, 0.95)");
          grad.addColorStop(0.25, "rgba(100, 255, 180, 0.75)");
          grad.addColorStop(0.55, "rgba(30, 180, 90, 0.32)");
          grad.addColorStop(1, "rgba(15, 80, 35, 0)");
        }
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Các đốm lửa/kiếm khí Haki bay lơ lửng bốc lên trên
      ctx.globalCompositeOperation = "source-over";
      for (let i = 0; i < 4; i++) {
        const seed = Math.sin(i * 12.7 + Math.floor(anim * 0.12));
        const seedY = (anim * 0.42 + i * 24) % 105;
        const px = Math.sin(i * 6.5 + anim * 0.07) * 20;
        const py = -seedY - 10;
        const size = 1.8 + Math.abs(seed) * 2.5;
        ctx.fillStyle = f.id === "luffy" ? "#ffd23f" : "#bfffdb";
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    draw() {
      const s = this;
      
      // Vẽ Aura Haki tuyệt đẹp phía sau bóng nhân vật
      s.drawAura();

      ctx.save();
      // bóng đổ
      ctx.fillStyle = "rgba(0,0,0,.28)";
      ctx.beginPath();
      const shW = s.onGround ? 40 : 26;
      ctx.ellipse(s.x, GROUND + 6, shW, 10, 0, 0, Math.PI*2);
      ctx.fill();

      ctx.translate(s.x, s.y);
      ctx.scale(s.facing, 1);   // lật theo hướng

      // nghiêng người tới trước cho dáng sẵn sàng chiến đấu (xoay quanh bàn chân)
      if (s.onGround && s.state !== "ko") {
        const lean = s.state === "attack" ? 0.03 : 0.055;
        ctx.rotate(lean);
      }

      // nhấp nháy đỏ khi trúng đòn
      const flashing = s.flash > 0 && Math.floor(s.flash/40) % 2 === 0;

      if (s.id === "luffy") this.drawLuffy(flashing);
      else this.drawZoro(flashing);

      ctx.restore();
    }

    // tiến trình tay/kiếm: lấy đà (âm) -> bổ tới nhanh (1) -> thu về (0)
    armSwing() {
      if (this.state === "attack" && this.attack) {
        const d = this.attack.def, a = this.attack, e = a.elapsed;
        const sEnd = d.startup;
        const act = d.active || 130;           // cửa sổ vung cho đòn projectile
        const aEnd = sEnd + act;
        if (e < sEnd) {
          return -0.32 * (e / sEnd);           // kéo ra sau lấy đà
        } else if (e < aEnd) {
          const t = (e - sEnd) / act;
          return -0.32 + 1.32 * (1 - Math.pow(1 - t, 3)); // bổ tới (ease-out)
        }
        const t = clamp((e - aEnd) / d.recovery, 0, 1);
        return 1 - t;                          // thu về
      }
      return 0;
    }

    legPose() {
      if (!this.onGround) return { a:-0.5, b:0.6 };
      if (this.state === "walk") {
        const p = Math.sin(this.walkPhase);
        return { a:p*0.6, b:-p*0.6 };
      }
      if (this.state === "block") return { a:0.35, b:-0.35 };
      return { a:-0.26, b:0.28 };   // thế tấn dạng chân, khuỵu gối, bám đất vững
    }

    // ---- Helper dùng chung: hai chân + giày ----
    drawLegs(cfg, legs) {
      const one = (hipX, ang, back) => {
        const kneeX = hipX + Math.sin(ang) * 11;
        const footX = kneeX + Math.sin(ang) * 4 + 3;
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        
        // Vẽ Đùi (quần)
        ctx.strokeStyle = back ? cfg.pantsSh : cfg.pants;
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.moveTo(hipX, -48);
        ctx.lineTo(kneeX, -27);
        ctx.stroke();
        
        if (cfg.isLuffy) {
          // Luffy có gấu lông trắng của quần short và phần bắp chân da trần!
          ctx.strokeStyle = back ? "#dcdcdc" : "#ffffff";
          ctx.lineWidth = 20;
          ctx.beginPath();
          ctx.moveTo(kneeX - Math.sin(ang)*1.5, -28);
          ctx.lineTo(kneeX + Math.sin(ang)*1.5, -25);
          ctx.stroke();
          
          // Bắp chân (màu da trần)
          ctx.strokeStyle = back ? cfg.skinSh : cfg.skin;
          ctx.lineWidth = 12;
          ctx.beginPath();
          ctx.moveTo(kneeX, -26);
          ctx.lineTo(footX, -10);
          ctx.stroke();
        } else {
          // Zoro mặc quần võ phục đen phủ dài liên tục
          ctx.strokeStyle = back ? cfg.pantsSh : cfg.pants;
          ctx.lineWidth = 17;
          ctx.beginPath();
          ctx.moveTo(kneeX, -28);
          ctx.lineTo(footX, -10);
          ctx.stroke();
        }
        
        // Vẽ Giày / Dép rơm
        if (cfg.isLuffy) {
          // Dép rơm có quai đan chéo chữ X chi tiết trên mu bàn chân
          ctx.strokeStyle = "#402d1a"; ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(footX - 5, -9); ctx.lineTo(footX + 9, -11);
          ctx.moveTo(footX - 5, -11); ctx.lineTo(footX + 9, -9);
          ctx.stroke();
        }

        ctx.fillStyle = back ? cfg.shoeSh : cfg.shoe;
        roundRect(footX - 7, -11, 22, 9, 4); ctx.fill();
        ctx.fillStyle = cfg.sole;
        roundRect(footX - 7, -4, 22, 4, 2); ctx.fill();
      };
      one(-5, legs.a, true);   // chân sau (tối hơn)
      one(6, legs.b, false);   // chân trước
    }

    // ---- Helper dùng chung: tay sau ----
    drawBackArm(skin, skinSh, opts = {}) {
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = skinSh || skin; ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(-11, -85);
      ctx.lineTo(-19, -70);
      ctx.lineTo(-14, -55);
      ctx.stroke();
      if (opts.bandana) {
        ctx.strokeStyle = "#1b1b22"; ctx.lineWidth = 12;
        ctx.beginPath(); ctx.moveTo(-13, -80); ctx.lineTo(-18, -72); ctx.stroke();
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-18, -73); ctx.lineTo(-23, -65); ctx.stroke();
      }
      ctx.fillStyle = skinSh || skin;
      ctx.beginPath(); ctx.arc(-14, -55, 5.5, 0, Math.PI * 2); ctx.fill();
    }
      }

  // Load character extensions
  if (typeof window !== "undefined") {
    if (window.LuffyInit) window.LuffyInit(Fighter, MOVES);
    if (window.ZoroInit) window.ZoroInit(Fighter, MOVES);
  }

  // helper vẽ chữ nhật bo góc
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    ctx.closePath();
  }

  // ================================================================ AI
  class AI {
    constructor(fighter) {
      this.f = fighter;
      this.decideTimer = 0;
      this.want = {};
      this.aggro = 0.6;
    }
    think(dt, opp) {
      this.decideTimer -= dt * 1000;
      const f = this.f;
      const dist = opp.x - f.x;         // >0 đối thủ bên phải
      const adist = Math.abs(dist);
      const intents = { left:false,right:false,jump:false,block:false,close:false,ranged:false,special:false };

      if (f.state === "ko" || opp.state === "ko") { this.want = intents; return intents; }

      // đỡ đòn nếu đối thủ đang tung đòn gần / có đạn bay tới
      const incoming = Game.projectiles.some(p => p.owner !== f &&
        Math.sign(p.vx) === Math.sign(f.x - p.x) && Math.abs(p.x - f.x) < 240);
      const oppAttacking = opp.state === "attack" && adist < 130;
      if ((incoming || oppAttacking) && Math.random() < 0.7) {
        intents.block = true;
        this.want = intents;
        // vẫn có thể nhích lại một chút — nhưng ưu tiên đỡ
        return intents;
      }

      // ra quyết định mới mỗi ~300ms
      if (this.decideTimer <= 0) {
        this.decideTimer = 220 + Math.random()*260;
        this.mode = Math.random();
      }

      // hướng tiếp cận
      if (adist > 120) {
        if (dist > 0) intents.right = true; else intents.left = true;
        // thi thoảng bắn tầm xa khi ở xa
        if (this.mode < 0.5 && Math.random() < 0.06) {
          if (f.meter >= 50 && Math.random() < 0.5) intents.special = true;
          else intents.ranged = true;
        }
        if (Math.random() < 0.01) intents.jump = true;
      } else if (adist > 74) {
        // khoảng cách trung: tiến, bắn hoặc kích hoạt Ashura xoay nhảy
        if (Math.random() < 0.04) {
          if (Math.random() < 0.35 && f.id === "zoro") {
            intents.block = true; intents.ranged = true; // Kích hoạt Ashura
          } else {
            intents.ranged = true;
          }
        }
        else if (dist > 0) intents.right = true; else intents.left = true;
      } else {
        // cận chiến
        if (f.meter >= 50 && Math.random() < 0.03) intents.special = true;
        else if (Math.random() < 0.09) intents.close = true;
        // giữ khoảng cách nhẹ
        if (Math.random() < 0.2) { if (dist>0) intents.left=true; else intents.right=true; }
      }

      this.want = intents;
      return intents;
    }
  }

  // ================================================================ GAME MANAGER
  const Game = {
    state: "menu",       // menu | playing | paused | roundover | matchover
    mode: "1p",
    players: [],
    ai: null,
    projectiles: [],
    sparks: [],
    round: 1,
    roundTime: 60,
    timeLeft: 60,
    hitstop: 0,          // ms đóng băng khi trúng đòn
    flashScreen: 0,      // 0..1 chớp trắng cho tuyệt chiêu
    superFreeze: 0,      // ms khựng điện ảnh khi tung super (full Haki)
    superDur: 820,       // đủ để hô xong tên chiêu trước khi tung đòn
    superFocus: null,    // {x, y, id, name}
    announce: null,      // {text, t}
    lastPressAttack: { p1:{}, p2:{} },

    init() {
      this.luffy = new Fighter("luffy", W*0.32, 1);
      this.zoro  = new Fighter("zoro",  W*0.68, -1);
      this.players = [this.luffy, this.zoro];
      this.bindUI();
      requestAnimationFrame(this.loop.bind(this));
    },

    bindUI() {
      document.querySelectorAll(".mode-buttons .btn").forEach(b => {
        b.addEventListener("click", () => this.startMatch(b.dataset.mode));
      });
      document.getElementById("howtoBtn").addEventListener("click", () => {
        document.getElementById("howto").classList.toggle("hidden");
      });
      document.getElementById("resultBtn").addEventListener("click", () => this.onResultContinue());
      document.getElementById("menuBtn").addEventListener("click", () => this.toMenu());
    },

    show(id) { document.getElementById(id).classList.remove("hidden"); },
    hide(id) { document.getElementById(id).classList.add("hidden"); },

    startMatch(mode) {
      this.mode = mode;
      this.luffy.wins = 0; this.zoro.wins = 0;
      this.round = 1;
      this.ai = mode === "1p" ? new AI(this.zoro) : null;
      this.hide("menu"); this.hide("result");
      this.show("pauseHint");
      this.startRound();
    },

    startRound() {
      this.luffy.reset(W*0.30, 1);
      this.zoro.reset(W*0.70, -1);
      this.luffy.meter = 0; this.zoro.meter = 0;
      this.projectiles = [];
      this.sparks = [];
      this.hitstop = 0; this.flashScreen = 0;
      this.superFreeze = 0; this.superFocus = null;
      this.timeLeft = this.roundTime;
      this.state = "playing";
      this.announce = { text: `HIỆP ${this.round}`, sub:"CHIẾN ĐẤU!", t: 1600 };
      Sound.round();
    },

    // Kích hoạt SUPER: khựng hình điện ảnh + luồng sáng hội tụ (Street Fighter style)
    triggerSuper(fighter) {
      this.superFreeze = this.superDur;
      const def = fighter.attack && fighter.attack.def;
      const name = def ? def.name : fighter.moves.special.name;
      this.superFocus = { x: fighter.x, y: fighter.y, id: fighter.id, name };
      Sound.superFlash();
      Voice.say(def && def.cry ? def.cry : name);   // HÔ tên chiêu ngay lúc khựng, trước khi ra đòn
    },

    toMenu() {
      this.state = "menu";
      this.hide("result"); this.hide("pauseHint");
      this.show("menu");
    },

    togglePause() {
      if (this.state === "playing") { this.state = "paused"; this.announce = { text:"TẠM DỪNG", sub:"Nhấn P để tiếp tục", t: 999999 }; }
      else if (this.state === "paused") { this.state = "playing"; this.announce = null; }
    },

    addHitSpark(x, y, blocked, isSpecial) {
      const n = blocked ? 7 : (isSpecial ? 22 : 13);
      const spd = isSpecial ? 420 : 280;
      for (let i=0;i<n;i++){
        this.sparks.push({
          kind: "dot",
          x, y,
          vx:(Math.random()*2-1)*spd,
          vy:(Math.random()*-1-0.2)*spd,
          life: 300 + Math.random()*220,
          color: blocked ? "#8fd0ff" : (Math.random()<0.5?"#ffd23f":"#ff6b3f"),
          r: 2+Math.random()*3.5,
        });
      }
      // vòng xung kích
      this.sparks.push({
        kind: "ring", x, y, vx:0, vy:0,
        life: isSpecial ? 320 : 210, life0: isSpecial ? 320 : 210,
        r: 6, rMax: isSpecial ? 64 : 34,
        color: blocked ? "#bfe4ff" : "#fff3c4",
      });
    },

    addTrail(x, y, c1, c2) {
      this.sparks.push({
        kind: "dot", x, y,
        vx:(Math.random()*2-1)*70, vy:(Math.random()*2-1)*70,
        life: 200 + Math.random()*160,
        color: Math.random()<0.5 ? c1 : c2,
        r: 2 + Math.random()*3,
      });
    },

    // Hiệu ứng 2 chưởng va nhau (strong=true khi triệt tiêu cả hai)
    addClash(x, y, a, b, strong) {
      const cA = a.d.color || "#ffd23f", cB = b.d.color || "#8fffbf";
      const n = strong ? 22 : 12;
      const spd = strong ? 280 : 180;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2;
        this.sparks.push({
          kind: "dot", x, y,
          vx: Math.cos(ang) * (spd * (0.5 + Math.random())),
          vy: Math.sin(ang) * (spd * (0.5 + Math.random())) - 40,
          life: 320 + Math.random() * 240,
          color: i % 2 ? cA : cB,
          r: 2 + Math.random() * (strong ? 3.5 : 2.5),
        });
      }
      this.sparks.push({ kind: "ring", x, y, life: strong ? 280 : 190, life0: strong ? 280 : 190,
        r: 8, rMax: strong ? 56 : 34, color: "#ffffff" });
      if (strong) { this.flashScreen = Math.max(this.flashScreen, 0.35); this.hitstop = Math.max(this.hitstop, 70); }
      Sound.hit();
    },

    // ---------- vòng lặp chính ----------
    loop(now) {
      if (!this._last) this._last = now;
      let dt = (now - this._last) / 1000;
      this._last = now;
      dt = Math.min(dt, 0.05); // chống nhảy cóc

      this.update(dt);
      this.render();
      justPressed.clear();
      requestAnimationFrame(this.loop.bind(this));
    },

    // đọc intent người chơi từ bàn phím
    humanIntents(which) {
      const c = CONTROLS[which];
      return {
        left: held.has(c.left),
        right: held.has(c.right),
        jump: held.has(c.jump),
        block: held.has(c.block),
        close: justPressed.has(c.close),
        ranged: justPressed.has(c.ranged),
        special: justPressed.has(c.special),
      };
    },

    update(dt) {
      if (this.demoFreeze) return;   // chỉ dùng khi chụp ảnh minh hoạ
      // SUPER FREEZE: đóng băng điện ảnh khi tung super (full Haki)
      if (this.state === "playing" && this.superFreeze > 0) {
        this.superFreeze -= dt * 1000;
        if (this.superFreeze <= 0) { this.superFreeze = 0; this.flashScreen = 0.7; }
        return;
      }
      // HITSTOP: đóng băng toàn bộ vài chục ms để cú đánh dội lại
      if (this.state === "playing" && this.hitstop > 0) {
        this.hitstop -= dt * 1000;
        return;
      }
      if (this.flashScreen > 0) this.flashScreen = Math.max(0, this.flashScreen - dt * 6);

      // hiệu ứng announce đếm ngược
      if (this.announce && this.announce.t < 999999) {
        this.announce.t -= dt * 1000;
        if (this.announce.t <= 0) this.announce = null;
      }
      // đếm giờ combo cho cả hai
      for (const f of this.players) {
        if (f.comboTimer > 0) { f.comboTimer -= dt * 1000; if (f.comboTimer <= 0) f.combo = 0; }
        if (f.comboPop > 0) f.comboPop = Math.max(0, f.comboPop - dt * 6);
      }

      // cập nhật spark luôn (kể cả lúc pause để mượt) — nhưng bỏ qua nếu menu
      for (const s of this.sparks) {
        if (s.kind === "ring") { s.life -= dt*1000; continue; }
        s.x += s.vx*dt; s.y += s.vy*dt; s.vy += 900*dt; s.life -= dt*1000;
      }
      this.sparks = this.sparks.filter(s => s.life > 0);

      if (this.state !== "playing") return;

      // đồng hồ
      this.timeLeft -= dt;

      // intents
      const i1 = this.humanIntents("p1");
      const i2 = this.mode === "2p" ? this.humanIntents("p2") : this.ai.think(dt, this.luffy);

      // đẩy nhau để không chồng lên nhau
      this.separate();

      this.luffy.update(dt, this.zoro, i1);
      this.zoro.update(dt, this.luffy, i2);

      // va chạm đòn melee
      this.resolveMelee(this.luffy, this.zoro);
      this.resolveMelee(this.zoro, this.luffy);

      // projectiles
      for (const p of this.projectiles) p.update(dt);

      // ---- ĐẤU CHƯỞNG: 2 projectile đối phương chạm nhau ----
      const projs = this.projectiles;
      for (let i = 0; i < projs.length; i++) {
        const a = projs[i];
        if (a.dead) continue;
        for (let j = i + 1; j < projs.length; j++) {
          const b = projs[j];
          if (b.dead || a.owner === b.owner) continue;      // chỉ đấu với chưởng đối phương
          if (!rectsOverlap(a.rect, b.rect)) continue;
          const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
          const pa = a.d.dmg * (a.d.super ? 2.2 : 1);
          const pb = b.d.dmg * (b.d.super ? 2.2 : 1);
          if (pa > pb * 1.35) { b.dead = true; this.addClash(cx, cy, a, b, false); }        // a mạnh -> xuyên qua
          else if (pb > pa * 1.35) { a.dead = true; this.addClash(cx, cy, a, b, false); }   // b mạnh -> xuyên qua
          else { a.dead = true; b.dead = true; this.addClash(cx, cy, a, b, true); }         // ngang tài -> triệt tiêu
          if (a.dead) break;
        }
      }

      for (const p of this.projectiles) {
        const target = p.owner === this.luffy ? this.zoro : this.luffy;
        if (!p.dead && target.state !== "ko" && rectsOverlap(p.rect, target.body)) {
          const dir = Math.sign(p.vx) || target.facing*-1;
          target.takeHit(p.d.dmg, p.d.knockback, p.d.launch, dir, p.d.kind==="redhawk"||p.d.kind==="tatsumaki"||p.d.super, p.owner);
          p.owner.gainMeter(6);
          if (p.d.super) { this.flashScreen = 1.3; this.hitstop = Math.max(this.hitstop, 150); this.addHitSpark(p.x, p.y, false, true); }
          p.dead = true;
        }
      }
      this.projectiles = this.projectiles.filter(p => !p.dead);

      // điều kiện kết thúc hiệp
      const ko = this.luffy.hp <= 0 || this.zoro.hp <= 0;
      const timeUp = this.timeLeft <= 0;
      if (ko || timeUp) {
        this.endRound();
      }
    },

    separate() {
      const a = this.luffy, b = this.zoro;
      const minDist = 44;
      const d = b.x - a.x;
      const ad = Math.abs(d);
      if (ad < minDist && a.onGround && b.onGround) {
        const push = (minDist - ad) / 2;
        const dir = d >= 0 ? 1 : -1;
        a.x -= push * dir;
        b.x += push * dir;
        a.x = clamp(a.x, 40, W-40);
        b.x = clamp(b.x, 40, W-40);
      }
    },

    resolveMelee(attacker, defender) {
      const hb = attacker.getHitbox();
      if (!hb) return;
      if (attacker.attack.hit.has(defender)) return;
      if (defender.state === "ko") return;
      if (rectsOverlap(hb, defender.body)) {
        attacker.attack.hit.add(defender);
        const d = attacker.attack.def;
        const dir = attacker.facing;
        const sup = attacker.attack.isSuper;
        const dmg    = sup ? Math.round(d.dmg * 2.1) : d.dmg;
        const kb     = sup ? d.knockback * 1.5 : d.knockback;
        const launch = sup ? (d.launch || 0) * 1.3 : d.launch;
        defender.takeHit(dmg, kb, launch, dir, sup, attacker);   // sup -> flash + stun mạnh
        if (sup) { this.flashScreen = 1.3; this.hitstop = Math.max(this.hitstop, 150); this.addHitSpark(hb.x + hb.w * 0.5, defender.y - 70, false, true); }
        attacker.gainMeter(d.meterGain || 0);
      }
    },

    endRound() {
      this.state = "roundover";
      let winner = null;
      if (this.luffy.hp <= 0 && this.zoro.hp <= 0) winner = null;
      else if (this.luffy.hp <= 0) winner = this.zoro;
      else if (this.zoro.hp <= 0) winner = this.luffy;
      else winner = this.luffy.hp === this.zoro.hp ? null
                    : (this.luffy.hp > this.zoro.hp ? this.luffy : this.zoro);

      if (winner) winner.wins++;

      const target = 2; // thắng 2 hiệp
      const matchOver = this.luffy.wins >= target || this.zoro.wins >= target;

      const nameOf = f => f.id === "luffy" ? "LUFFY 👒" : "ZORO ⚔️";
      const rt = document.getElementById("resultTitle");
      const tx = document.getElementById("resultText");
      const btn = document.getElementById("resultBtn");

      if (matchOver) {
        this.state = "matchover";
        const champ = this.luffy.wins >= target ? this.luffy : this.zoro;
        rt.textContent = "🏆 CHIẾN THẮNG!";
        tx.innerHTML = `<b>${nameOf(champ)}</b> vô địch trận đấu!<br>Tỉ số: ${this.luffy.wins} – ${this.zoro.wins}`;
        btn.textContent = "CHƠI LẠI";
      } else {
        rt.textContent = winner ? `${nameOf(winner)} THẮNG HIỆP` : "HÒA HIỆP";
        tx.innerHTML = `Tỉ số: <b>${this.luffy.wins}</b> – <b>${this.zoro.wins}</b><br>Cần thắng ${target} hiệp để vô địch.`;
        btn.textContent = "HIỆP TIẾP THEO";
      }
      setTimeout(() => this.show("result"), 700);
    },

    onResultContinue() {
      this.hide("result");
      if (this.state === "matchover") {
        this.luffy.wins = 0; this.zoro.wins = 0;
        this.round = 1;
        this.startRound();
      } else {
        this.round++;
        this.startRound();
      }
    },

    // ---------------------------------------------------------- RENDER
    render() {
      ctx.save();
      this.drawBackground();

      // sắp xếp vẽ theo hp? vẽ cả hai
      this.luffy.draw();
      this.zoro.draw();

      for (const p of this.projectiles) p.draw();
      this.drawSparks();

      ctx.restore();

      // chớp trắng khi trúng tuyệt chiêu
      if (this.flashScreen > 0) {
        ctx.fillStyle = `rgba(255,255,255,${clamp(this.flashScreen, 0, 1) * 0.45})`;
        ctx.fillRect(0, 0, W, H);
      }

      // màn khựng điện ảnh SUPER
      if (this.superFreeze > 0 && this.superFocus) this.drawSuperFlash();

      // HUD (không rung)
      this.drawHUD();
      this.drawCombos();
      this.drawAnnounce();
    },

    drawBackground() {
      // trời hoàng hôn đậm chất anime hải tặc đầy mộng mơ
      const sky = ctx.createLinearGradient(0,0,0,GROUND);
      sky.addColorStop(0,"#141f45");
      sky.addColorStop(0.45,"#253e85");
      sky.addColorStop(0.85,"#c26857");
      sky.addColorStop(1,"#e8a86a");
      ctx.fillStyle = sky;
      ctx.fillRect(0,0,W,GROUND+40);

      // Tia nắng mặt trời lung linh (Sunbeams) tỏa nhẹ nhẹ
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = "rgba(255, 230, 180, 0.04)";
      const sunX = W * 0.5, sunY = GROUND - 40;
      for (let i = 0; i < 6; i++) {
        const angle = 0.22 + i * 0.52 + Math.sin(this.animT * 0.012) * 0.12;
        ctx.beginPath();
        ctx.moveTo(sunX, sunY);
        ctx.arc(sunX, sunY, 450, angle - 0.14, angle + 0.14);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // mặt trời
      ctx.fillStyle = "rgba(255,220,140,.92)";
      ctx.beginPath(); ctx.arc(sunX, sunY, 60, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "rgba(255,235,180,.26)";
      ctx.beginPath(); ctx.arc(sunX, sunY, 105, 0, Math.PI*2); ctx.fill();

      // Mây cuộn trôi mịn màng bồng bềnh trôi parallax trong gió chiều hải trình
      const drawCloud = (cx, cy, size) => {
        ctx.beginPath();
        ctx.arc(cx, cy, size, 0, Math.PI * 2);
        ctx.arc(cx + size * 0.6, cy - size * 0.3, size * 0.8, 0, Math.PI * 2);
        ctx.arc(cx - size * 0.6, cy - size * 0.2, size * 0.7, 0, Math.PI * 2);
        ctx.arc(cx + size * 1.2, cy, size * 0.6, 0, Math.PI * 2);
        ctx.arc(cx - size * 1.2, cy, size * 0.5, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
      };
      // Đám mây 1
      ctx.fillStyle = "rgba(255,255,255,.09)";
      drawCloud((W * 0.2 + (this.animT * 0.22)) % (W + 160) - 80, GROUND - 180, 35);
      // Đám mây 2
      ctx.fillStyle = "rgba(255,255,255,.05)";
      drawCloud((W * 0.72 + (this.animT * 0.11)) % (W + 140) - 70, GROUND - 250, 26);

      // biển
      ctx.fillStyle = "#2274b4";
      ctx.fillRect(0, GROUND-70, W, 70);
      
      // Sóng biển dập dềnh lấp lánh phản chiếu ánh tà dương hải trình sinh động
      ctx.fillStyle = "rgba(255,255,255,.20)";
      for (let i=0; i<10; i++){
        const wx = (i * 120 + this.animT * 0.8) % (W + 100) - 50;
        const wy = GROUND - 64 + (i % 3) * 16;
        const ww = 40 + Math.sin(this.animT * 0.05 + i) * 15;
        roundRect(wx, wy, ww, 3.5, 1.5);
        ctx.fill();
      }

      // thuyền Going Merry (bóng xa chân trời)
      ctx.fillStyle = "rgba(90,60,30,.92)";
      ctx.beginPath();
      ctx.moveTo(W*0.72, GROUND-58); ctx.lineTo(W*0.86, GROUND-58);
      ctx.lineTo(W*0.83, GROUND-42); ctx.lineTo(W*0.75, GROUND-42); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#f3ede0";
      ctx.fillRect(W*0.785, GROUND-96, 3, 40);
      ctx.beginPath(); ctx.moveTo(W*0.79, GROUND-92); ctx.lineTo(W*0.83, GROUND-72); ctx.lineTo(W*0.79, GROUND-72); ctx.fill();

      // sàn đấu (boong tàu gỗ Going Merry cổ kính)
      ctx.fillStyle = "#633816"; // Nền gỗ nâu sẫm
      ctx.fillRect(0, GROUND, W, H-GROUND);
      
      // Vẽ các đường nứt tấm ván ngang boong tàu
      ctx.strokeStyle = "#49260c";
      ctx.lineWidth = 2.5;
      for (let y = GROUND + 15; y < H; y += 18) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      
      // Hiệu ứng đổ bóng chuyển màu giữa các tấm ván boong tàu
      ctx.fillStyle = "rgba(255,255,255,0.032)";
      for (let y = GROUND; y < H; y += 36) {
        ctx.fillRect(0, y, W, 18);
      }
      
      // Các khớp nối ván dọc so le nhau sinh động chân thực
      ctx.strokeStyle = "#49260c"; ctx.lineWidth = 1.5;
      for (let x = 0; x < W + 100; x += 110) {
        const offset = (Math.floor(x / 110) % 2) * 55;
        for (let y = GROUND; y < H; y += 18) {
          ctx.beginPath(); 
          ctx.moveTo(x + offset, y); 
          ctx.lineTo(x + offset, y + 18); 
          ctx.stroke();
          
          // Các đinh tán đồng cổ kính gia cố tấm ván gỗ boong tàu
          ctx.fillStyle = "#2c1505";
          ctx.beginPath();
          ctx.arc(x + offset - 4, y + 9, 1.5, 0, Math.PI*2);
          ctx.arc(x + offset + 4, y + 9, 1.5, 0, Math.PI*2);
          ctx.fill();
        }
      }
      
      // Bóng đổ của boong tàu phía giáp biển
      ctx.fillStyle = "rgba(0,0,0,.32)";
      ctx.fillRect(0, GROUND, W, 7);

      this.animT = (this.animT||0) + 0.6;
    },

    drawSparks() {
      for (const s of this.sparks) {
        if (s.kind === "ring") {
          const p = 1 - s.life / s.life0;              // 0 -> 1
          ctx.globalAlpha = clamp(1 - p, 0, 1) * 0.9;
          ctx.strokeStyle = s.color;
          ctx.lineWidth = clamp(4 * (1 - p), 1, 4);
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r + (s.rMax - s.r) * p, 0, Math.PI*2); ctx.stroke();
          continue;
        }
        ctx.globalAlpha = clamp(s.life/300, 0, 1);
        ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    },

    // Màn hình super điện ảnh: nền tối tập trung + luồng sáng hội tụ ở nhân vật
    drawSuperFlash() {
      const f = this.superFocus;
      const p = clamp(this.superFreeze / this.superDur, 0, 1);   // 1 -> 0
      const vig = clamp(Math.sin((1 - p) * Math.PI), 0, 1);       // vào & ra mượt
      const warm = f.id === "luffy";
      const c1 = warm ? "255,222,150" : "180,255,210";
      const c2 = warm ? "255,90,40"  : "40,220,120";
      const cx = f.x, cy = f.y - 62;

      ctx.save();
      // nền tối tập trung ánh nhìn
      ctx.fillStyle = `rgba(4,3,12,${0.5 * vig})`;
      ctx.fillRect(0, 0, W, H);

      // cộng sáng
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(cx, cy);

      // tia sáng phóng xạ (speed lines) từ nhân vật
      const rays = 18, spin = (1 - p) * 0.5;
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * Math.PI * 2 + spin;
        ctx.strokeStyle = `rgba(${i % 2 ? c1 : c2},${0.5 * vig})`;
        ctx.lineWidth = (i % 2 ? 7 : 16) * vig;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 46, Math.sin(a) * 46);
        ctx.lineTo(Math.cos(a) * 620, Math.sin(a) * 620);
        ctx.stroke();
      }

      // quầng sáng hội tụ quanh nhân vật
      const glow = ctx.createRadialGradient(0, 0, 6, 0, 0, 200);
      glow.addColorStop(0,   `rgba(255,255,255,${0.95 * vig})`);
      glow.addColorStop(0.3, `rgba(${c1},${0.8 * vig})`);
      glow.addColorStop(0.7, `rgba(${c2},${0.32 * vig})`);
      glow.addColorStop(1,   `rgba(${c2},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, 0, 200, 0, Math.PI * 2); ctx.fill();

      // vòng xung kích nở bung
      const ringR = 24 + (1 - p) * 300;
      ctx.strokeStyle = `rgba(255,255,255,${0.75 * p})`;
      ctx.lineWidth = 8 * p;
      ctx.beginPath(); ctx.arc(0, 0, ringR, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();

      // tên chiêu bay vào (điện ảnh)
      ctx.save();
      ctx.globalAlpha = vig;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = warm ? "#ffd23f" : "#8fffbf";
      ctx.strokeStyle = "rgba(0,0,0,.7)"; ctx.lineWidth = 6;
      ctx.font = "900 42px Trebuchet MS, sans-serif";
      const ty = f.y - 150;
      ctx.strokeText(f.name.toUpperCase(), W / 2, ty);
      ctx.fillText(f.name.toUpperCase(), W / 2, ty);
      ctx.font = "800 20px Trebuchet MS, sans-serif";
      ctx.fillStyle = "#fff";
      ctx.strokeText("★ SIÊU CHIÊU ★", W / 2, ty - 34);
      ctx.fillText("★ SIÊU CHIÊU ★", W / 2, ty - 34);
      ctx.restore();
    },

    drawHUD() {
      // thanh máu + haki cho 2 người
      this.drawBar(this.luffy, 24, false);
      this.drawBar(this.zoro, W-24, true);

      // đồng hồ
      const t = Math.max(0, Math.ceil(this.timeLeft));
      ctx.fillStyle = "rgba(0,0,0,.5)";
      roundRect(W/2-38, 16, 76, 44, 8); ctx.fill();
      ctx.fillStyle = t <= 10 ? "#ff5a5a" : "#fff";
      ctx.font = "bold 30px Trebuchet MS, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(t, W/2, 40);

      // số hiệp thắng (chấm tròn)
      this.drawWinPips(this.luffy, 24+8, 64, false);
      this.drawWinPips(this.zoro, W-24-8, 64, true);
    },

    drawCombos() {
      const one = (f, cx, tint) => {
        if (f.combo < 2) return;
        const pop = 1 + f.comboPop * 0.5;
        ctx.save();
        ctx.translate(cx, 150);
        ctx.scale(pop, pop);
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = tint;
        ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 5;
        ctx.font = "900 46px Trebuchet MS, sans-serif";
        ctx.strokeText(`${f.combo}`, 0, 0); ctx.fillText(`${f.combo}`, 0, 0);
        ctx.font = "800 18px Trebuchet MS, sans-serif";
        ctx.fillStyle = "#fff";
        ctx.strokeText("COMBO", 0, 30); ctx.fillText("COMBO", 0, 30);
        ctx.restore();
      };
      one(this.luffy, W*0.26, "#ffcf33");
      one(this.zoro,  W*0.74, "#8fffbf");
    },

    drawBar(f, edgeX, right) {
      const cx = right ? W - 56 : 56;
      const cy = 42;
      const radius = 32;

      // 1. Vẽ khung Avatar tròn kiểu One Piece Fighting Path (viền kim loại vàng/bạc dập nổi)
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 8;
      
      // Viền dập nổi bằng gradient vàng/bạc sang trọng
      const borderGrd = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
      if (f.id === "luffy") {
        borderGrd.addColorStop(0, "#ffd700");
        borderGrd.addColorStop(0.5, "#ff8c00");
        borderGrd.addColorStop(1, "#b8860b");
      } else {
        borderGrd.addColorStop(0, "#e6e6fa");
        borderGrd.addColorStop(0.5, "#708090");
        borderGrd.addColorStop(1, "#2f4f4f");
      }
      ctx.strokeStyle = borderGrd;
      ctx.lineWidth = 4;
      ctx.fillStyle = "#151522";
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();

      // Vẽ hình đại diện (Avatar) biểu tượng
      ctx.fillStyle = "#fff";
      ctx.font = "bold 28px Trebuchet MS, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(f.id === "luffy" ? "👒" : "⚔️", cx, cy);

      // Nhãn cấp độ (Lv. 100) kiểu Fighting Path RPG
      const lvX = right ? cx - 22 : cx + 22;
      const lvY = cy + 22;
      ctx.fillStyle = "#ffd700";
      ctx.strokeStyle = "#151522"; ctx.lineWidth = 3;
      ctx.font = "900 11px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.strokeText("Lv.100", lvX, lvY); ctx.fillText("Lv.100", lvX, lvY);

      // 2. Vẽ Tên Nhân Vật và Khung Slanted (Parallelogram) Máu + Haki
      const barW = 280, barH = 16;
      const slant = right ? 8 : -8; // Nghiêng góc hiện đại
      const x = right ? W - 100 - barW : 100;
      const y = 20;

      // Vẽ tên nhân vật bóng đổ tinh xảo
      ctx.fillStyle = "#fff";
      ctx.font = "italic 900 18px Trebuchet MS, sans-serif";
      ctx.textBaseline = "bottom";
      ctx.textAlign = right ? "right" : "left";
      const nameX = right ? W - 105 : 105;
      ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 4;
      const nameStr = f.id === "luffy" ? "LUFFY" : "ZORO";
      ctx.strokeText(nameStr, nameX, y - 4);
      ctx.fillText(nameStr, nameX, y - 4);

      // Khung nền đen mờ cho cột máu (bao quanh ngoài)
      ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)"; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + slant - 3, y - 2);
      ctx.lineTo(x + barW + slant + 3, y - 2);
      ctx.lineTo(x + barW + 3, y + barH + 2);
      ctx.lineTo(x - 3, y + barH + 2);
      ctx.closePath(); ctx.fill(); ctx.stroke();

      // Nền cột máu trống màu đỏ sậm
      ctx.fillStyle = "#3a1414";
      ctx.beginPath();
      ctx.moveTo(x + slant, y);
      ctx.lineTo(x + barW + slant, y);
      ctx.lineTo(x + barW, y + barH);
      ctx.lineTo(x, y + barH);
      ctx.closePath(); ctx.fill();

      // Cột máu hiện tại (Slanted) có Gradient bóng loáng cực kỳ đẹp mắt
      if (f.hp > 0) {
        const hpW = barW * (f.hp / 100);
        const hpGrd = ctx.createLinearGradient(x, y, x + barW, y + barH);
        if (f.id === "luffy") {
          hpGrd.addColorStop(0, "#ffa07a"); // Light salmon
          hpGrd.addColorStop(0.3, "#ff4500"); // Orange-red
          hpGrd.addColorStop(1, "#b22222"); // Firebrick shadow
        } else {
          hpGrd.addColorStop(0, "#adff2f"); // Green-yellow glow
          hpGrd.addColorStop(0.3, "#32cd32"); // Lime-green
          hpGrd.addColorStop(1, "#006400"); // Dark green shadow
        }
        ctx.fillStyle = hpGrd;
        
        // Vẽ cột máu lấp đầy
        ctx.beginPath();
        const startX = right ? x + barW - hpW : x;
        const endX = startX + hpW;
        const sSlant = right ? (barW - hpW) / barW * slant : 0;
        const eSlant = right ? slant : hpW / barW * slant;
        
        ctx.moveTo(startX + sSlant, y);
        ctx.lineTo(endX + eSlant, y);
        ctx.lineTo(endX, y + barH);
        ctx.lineTo(startX, y + barH);
        ctx.closePath(); ctx.fill();
        
        // Vẽ vệt sáng phản chiếu (shimmer) trên đầu thanh máu
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.beginPath();
        ctx.moveTo(startX + sSlant, y);
        ctx.lineTo(endX + eSlant, y);
        ctx.lineTo(endX - (endX-startX)*0.1, y + barH*0.4);
        ctx.lineTo(startX + (endX-startX)*0.1, y + barH*0.4);
        ctx.closePath(); ctx.fill();
      }

      // 3. Thanh Năng lượng HAKI Slanted dẹt hơn bên dưới
      const mY = y + barH + 4;
      const mH = 6;
      const mSlant = right ? 6 : -6;

      // Khung nền Haki đen mờ
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.beginPath();
      ctx.moveTo(x + mSlant - 2, mY - 1);
      ctx.lineTo(x + barW + mSlant + 2, mY - 1);
      ctx.lineTo(x + barW + 2, mY + mH + 1);
      ctx.lineTo(x - 2, mY + mH + 1);
      ctx.closePath(); ctx.fill();

      // Nền trống Haki
      ctx.fillStyle = "#1e1e12";
      ctx.beginPath();
      ctx.moveTo(x + mSlant, mY);
      ctx.lineTo(x + barW + mSlant, mY);
      ctx.lineTo(x + barW, mY + mH);
      ctx.lineTo(x, mY + mH);
      ctx.closePath(); ctx.fill();

      // Haki lấp đầy
      if (f.meter > 0) {
        const mW = barW * (f.meter / 100);
        const mGrd = ctx.createLinearGradient(x, mY, x + barW, mY + mH);
        mGrd.addColorStop(0, "#ffeb3b");
        mGrd.addColorStop(0.5, "#ffc107");
        mGrd.addColorStop(1, "#ff9800");
        ctx.fillStyle = f.meter >= 50 ? mGrd : "#b9962e";

        const startMX = right ? x + barW - mW : x;
        const endMX = startMX + mW;
        const sMSlant = right ? (barW - mW) / barW * mSlant : 0;
        const eMSlant = right ? mSlant : mW / barW * mSlant;

        ctx.beginPath();
        ctx.moveTo(startMX + sMSlant, mY);
        ctx.lineTo(endMX + eMSlant, mY);
        ctx.lineTo(endMX, mY + mH);
        ctx.lineTo(startMX, mY + mH);
        ctx.closePath(); ctx.fill();
      }

      // Nhãn: đầy 100% -> SIÊU CHIÊU MAX (nhấp nháy), đầy 50% -> HAKI READY
      if (f.meter >= 100) {
        const blink = Math.floor(this.animT / 12) % 2 === 0;
        ctx.fillStyle = blink ? "#fff" : "#ff4d4d";
        ctx.font = "900 11px Arial, sans-serif";
        ctx.textBaseline = "top";
        ctx.textAlign = right ? "right" : "left";
        const labelX = right ? x + barW - 10 : x + 10;
        ctx.fillText("★ SIÊU CHIÊU MAX! ★", labelX, mY + mH + 3);
      } else if (f.meter >= 50) {
        ctx.fillStyle = "#ffe14d";
        ctx.font = "bold 9px Arial, sans-serif";
        ctx.textBaseline = "top";
        ctx.textAlign = right ? "right" : "left";
        const labelX = right ? x + barW - 10 : x + 10;
        ctx.fillText("HAKI READY!", labelX, mY + mH + 3);
      }
    },

    drawWinPips(f, x, y, right) {
      for (let i=0;i<2;i++){
        const px = right ? x - i*18 : x + i*18;
        ctx.beginPath(); ctx.arc(px, y, 6, 0, Math.PI*2);
        ctx.fillStyle = i < f.wins ? "#ffd23f" : "rgba(255,255,255,.22)";
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth = 1.5; ctx.stroke();
      }
    },

    drawAnnounce() {
      if (!this.announce) return;
      const a = this.announce;
      ctx.save();
      ctx.textAlign = "center";
      let alpha = 1;
      if (a.t < 400) alpha = a.t/400;
      ctx.globalAlpha = clamp(alpha,0,1);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 6;
      ctx.font = "900 62px Trebuchet MS, sans-serif";
      ctx.textBaseline = "middle";
      ctx.strokeText(a.text, W/2, H/2 - 30);
      ctx.fillText(a.text, W/2, H/2 - 30);
      if (a.sub) {
        ctx.font = "bold 26px Trebuchet MS";
        ctx.fillStyle = "#ffd23f";
        ctx.fillText(a.sub, W/2, H/2 + 22);
      }
      ctx.restore();
    },
  };

  Game.init();

  // ---- Hook debug/chụp ảnh (chỉ chạy trong trình duyệt, không ảnh hưởng lúc chơi thường) ----
  if (typeof location !== "undefined" && location.search) {
    const params = new URLSearchParams(location.search);
    if (params.get("auto")) {
      Game.startMatch(params.get("mode") || "2p");
      const poseFrac = params.get("pe") ? +params.get("pe") : 0.42;
      const poseFighter = (f, moveKey) => {
        if (moveKey === "none") return;
        f.meter = 100;                       // để pose được cả king/sanzen (cần 100)
        f.startAttack(moveKey);
        if (f.attack) {
          const d = f.attack.def;
          const total = d.startup + d.active + d.recovery;
          f.attack.elapsed = total * poseFrac;
          f.attack.phase = "active";
        }
      };
      setTimeout(() => {
        if (params.get("pose")) {
          poseFighter(Game.luffy, params.get("l") || "close");
          poseFighter(Game.zoro, params.get("z") || "close");
          Game.superFreeze = 0; Game.superFocus = null;   // bỏ chớp super để soi rõ tư thế
        }
        // spawn 1 projectile bất kỳ để chụp (sproj=sanzen / redhawk / ...)
        const sproj = params.get("sproj");
        if (sproj) {
          const owner = sproj === "sanzen" ? Game.zoro : Game.luffy;
          const mv = (MOVES.zoro[sproj] && MOVES.zoro[sproj].proj) ? MOVES.zoro[sproj] : MOVES.luffy[sproj];
          if (mv && mv.proj) {
            let pd = Object.assign({}, mv.proj);
            if (params.get("psuper")) pd = Object.assign(pd, { w: pd.w * 1.6, h: pd.h * 1.6, super: true });
            const pr = new Projectile(owner, pd);
            pr.x = W * 0.5; pr.y = GROUND - 76;
            Game.projectiles.push(pr);
            Game.demoFreeze = true;
          }
        }
        // TEST trực tiếp: 2 chưởng chồng nhau -> 1 tick -> kiểm tra triệt tiêu + hiệu ứng
        if (params.get("clashtest")) {
          Game.luffy.x = 410; Game.luffy.facing = 1;
          Game.zoro.x = 470; Game.zoro.facing = -1;
          const p1 = new Projectile(Game.luffy, MOVES.luffy.special.proj);
          const p2 = new Projectile(Game.zoro, MOVES.zoro.special.proj);
          p1.x = 430; p2.x = 450;                       // chồng nhau
          Game.projectiles.push(p1, p2);
          const before = Game.projectiles.length;
          Game.update(0.016);                           // 1 tick -> chạy đấu chưởng
          const after = Game.projectiles.length;
          Game.announce = { text: `chưởng ${before} -> ${after}  ·  sparks ${Game.sparks.length}`, sub: "CLASH TEST", t: 999999 };
          Game.demoFreeze = true;
        }
        // TEST đấu chưởng: 2 projectile lao vào nhau
        if (params.get("clash")) {
          Game.luffy.x = 250; Game.luffy.facing = 1;
          Game.zoro.x = 710; Game.zoro.facing = -1;
          const lp = params.get("lp") || "special", zp = params.get("zp") || "special";
          Game.projectiles.push(new Projectile(Game.luffy, MOVES.luffy[lp].proj));
          Game.projectiles.push(new Projectile(Game.zoro, MOVES.zoro[zp].proj));
        }
        if (params.get("lx")) Game.luffy.x = +params.get("lx");
        if (params.get("zx")) Game.zoro.x = +params.get("zx");
        // TEST: chạy 1 tick với intent block+special để kiểm tra siêu chiêu 2
        if (params.get("combotest")) {
          const testIntent = { left:false, right:false, jump:false, block:true, close:false, ranged:false, special:true };
          Game.zoro.meter = 100; Game.zoro.state = "idle"; Game.zoro.attack = null; Game.superFreeze = 0;
          Game.zoro.update(0.016, Game.luffy, testIntent);
          const mk = Game.zoro.attack && Game.zoro.attack.def.key;
          const su = Game.zoro.attack && Game.zoro.attack.isSuper;
          Game.announce = { text: `move=${mk}  super=${su}  freeze=${Math.round(Game.superFreeze)}`, sub: "↓+SPECIAL TEST", t: 999999 };
          Game.demoFreeze = true;
        }
        // dựng cảnh SUPER (full Haki) để chụp màn khựng điện ảnh
        const sup = params.get("sup");
        if (sup && Game[sup]) {
          const who = Game[sup];
          who.meter = 100;
          who.facing = sup === "luffy" ? 1 : -1;
          who.startAttack(params.get("mv") || "special");   // -> triggerSuper (mv=axe/asura cho ulti 2)
          Game.superFreeze = Game.superDur * (params.get("sf") ? +params.get("sf") : 0.5);
        }
        // dựng cảnh minh hoạ hiệu ứng (combo + vòng xung kích + chớp)
        const demo = params.get("demo");
        if (demo) {
          const isSp = demo === "special";
          Game.luffy.combo = isSp ? 6 : 4; Game.luffy.comboPop = 0.6;
          Game.zoro.state = "hurt"; Game.zoro.flash = 60;
          const ix = Game.zoro.x - 24, iy = Game.zoro.y - 70;
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2, rr = 8 + Math.random() * 24;
            Game.sparks.push({ kind: "dot", x: ix + Math.cos(a) * rr, y: iy + Math.sin(a) * rr,
              vx: 0, vy: 0, life: 500, color: i % 2 ? "#ffd23f" : "#ff6b3f", r: 2 + Math.random() * 3.5 });
          }
          Game.sparks.push({ kind: "ring", x: ix, y: iy, life: 130, life0: 260, r: 6, rMax: isSp ? 60 : 38, color: "#fff3c4" });
          if (isSp) {
            Game.flashScreen = 0.5;
            let pdef = MOVES.luffy.special.proj;
            if (params.get("psuper")) pdef = Object.assign({}, pdef, { w: pdef.w * 1.6, h: pdef.h * 1.6, super: true });
            const pr = new Projectile(Game.luffy, pdef);
            pr.x = ix - 30;
            Game.projectiles.push(pr);
          }
          Game.demoFreeze = true;
        }
        if (!params.get("combotest") && !params.get("clashtest")) Game.announce = null;
        if (!params.get("nopause")) Game.state = "paused";   // đóng băng để chụp
      }, 60);
    }
  }
})();
