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
    luffy: {
      close: { key:"close", name:"Gomu Gomu no Pistol", type:"melee",
        dmg:8, startup:70, active:90, recovery:170,
        reach:{dx:34,dy:-58,w:56,h:30}, knockback:230, launch:-40, meterGain:9,
        sfx:"punch", color:"#ff6b6b" },
      ranged: { key:"ranged", name:"Gomu Gomu no Rocket", type:"projectile",
        dmg:11, startup:150, active:0, recovery:300, meterGain:11,
        sfx:"shoot",
        proj:{ kind:"gum", speed:560, w:44, h:26, dmg:11, knockback:300, launch:-60, life:2000, color:"#ffcf9e" } },
      special: { key:"special", name:"Red Hawk", type:"projectile",
        dmg:22, startup:230, active:0, recovery:430, meterCost:50, meterGain:0,
        sfx:"special",
        proj:{ kind:"redhawk", speed:640, w:66, h:44, dmg:22, knockback:520, launch:-180, life:2200, color:"#ff5a2b" } },
    },
    zoro: {
      close: { key:"close", name:"Santoryu — Chém Ba Kiếm", type:"melee",
        dmg:9, startup:60, active:100, recovery:180,
        reach:{dx:32,dy:-64,w:64,h:60}, knockback:210, launch:-30, meterGain:9,
        sfx:"slash", color:"#c8ffe0" },
      ranged: { key:"ranged", name:"36 Pao Phách Phong", type:"projectile",
        dmg:10, startup:130, active:0, recovery:290, meterGain:11,
        sfx:"slash",
        proj:{ kind:"slash", speed:600, w:40, h:70, dmg:10, knockback:280, launch:-70, life:2000, color:"#9affc4" } },
      special: { key:"special", name:"Long Quyển Phong (Tatsumaki)", type:"projectile",
        dmg:21, startup:210, active:0, recovery:440, meterCost:50, meterGain:0,
        sfx:"special",
        proj:{ kind:"tatsumaki", speed:460, w:70, h:120, dmg:21, knockback:480, launch:-220, life:2400, color:"#39d67e" } },
    },
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
      if (this.life <= 0 || this.x < -80 || this.x > W + 80) this.dead = true;
    }
    draw() {
      const { kind, color } = this.d;
      ctx.save();
      ctx.translate(this.x, this.y);
      if (this.dir < 0) ctx.scale(-1, 1);
      const spin = this.t / 90;

      if (kind === "gum") {
        // nắm đấm cao su + tay kéo dài
        ctx.strokeStyle = "#f2c69b"; ctx.lineWidth = 14; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(6, 0); ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(14, 0, 18, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#e0a06f";
        for (let i=0;i<3;i++){ ctx.beginPath(); ctx.arc(24, -8+i*8, 4, 0, Math.PI*2); ctx.fill(); }
      } else if (kind === "redhawk") {
        // nắm đấm lửa
        const grd = ctx.createLinearGradient(-40,0,40,0);
        grd.addColorStop(0,"rgba(255,90,30,0)");
        grd.addColorStop(1,"#ffd23f");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.moveTo(-46,-8); ctx.quadraticCurveTo(-10,-26,30,-14);
        ctx.quadraticCurveTo(40,0,30,14); ctx.quadraticCurveTo(-10,26,-46,8);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#ff9a3f";
        ctx.beginPath(); ctx.arc(20, 0, 20, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#ffe08a";
        ctx.beginPath(); ctx.arc(24, -3, 10, 0, Math.PI*2); ctx.fill();
      } else if (kind === "slash") {
        // lưỡi chém bay hình lưỡi liềm
        ctx.strokeStyle = color; ctx.lineWidth = 8; ctx.lineCap = "round";
        for (let i=-1;i<=1;i++){
          ctx.globalAlpha = 1 - Math.abs(i)*0.35;
          ctx.beginPath();
          ctx.arc(i*10, 0, 30, -Math.PI*0.55, Math.PI*0.55);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (kind === "tatsumaki") {
        // lốc xoáy rồng xanh
        ctx.rotate(spin);
        for (let i=0;i<6;i++){
          const r = 12 + i*8;
          ctx.globalAlpha = 0.85 - i*0.1;
          ctx.strokeStyle = i%2 ? color : "#bfffdb";
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.ellipse(0, 0, r, r*1.6, spin*0.5, 0, Math.PI*2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
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
      this.width = 60;
      this.height = 118;
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
      if (def.meterCost && this.meter < def.meterCost) return; // chưa đủ Haki
      if (def.meterCost) this.meter -= def.meterCost;
      this.state = "attack";
      this.attack = { def, elapsed:0, phase:"startup", hit:new Set(), spawned:false };
      this.vx *= 0.2;
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
      // HITSTOP — đóng băng vài chục ms để cú đánh "nặng tay"
      Game.hitstop = Math.max(Game.hitstop, blocked ? 45 : (isSpecial ? 130 : 85));
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
        // block
        if (intents.block && this.onGround) {
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

          // tấn công (edge)
          if (intents.close)   { this.startAttack("close");   Sound[this.moves.close.sfx](); }
          else if (intents.ranged) { this.startAttack("ranged"); if (this.state==="attack") Sound[this.moves.ranged.sfx](); }
          else if (intents.special){ this.startAttack("special");}
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

        // sinh projectile (một lần, khi vào active)
        if (d.type === "projectile" && !a.spawned && a.elapsed >= sEnd) {
          a.spawned = true;
          Game.projectiles.push(new Projectile(this, d.proj));
          this.gainMeter(d.meterGain || 0);
          if (d.sfx === "special") Sound.special();
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
      const r = d.reach;
      const x = this.facing > 0 ? this.x + r.dx : this.x - r.dx - r.w;
      const y = this.y + r.dy;
      return { x, y, w:r.w, h:r.h };
    }

    // ---------------------------------------------------------- VẼ NHÂN VẬT
    draw() {
      const s = this;
      ctx.save();
      // bóng đổ
      ctx.fillStyle = "rgba(0,0,0,.28)";
      ctx.beginPath();
      const shW = s.onGround ? 40 : 26;
      ctx.ellipse(s.x, GROUND + 6, shW, 10, 0, 0, Math.PI*2);
      ctx.fill();

      ctx.translate(s.x, s.y);
      ctx.scale(s.facing, 1);   // lật theo hướng

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
      return { a:0.15, b:-0.15 };
    }

    // ---- Helper dùng chung: hai chân + giày ----
    drawLegs(cfg, legs) {
      const one = (hipX, ang, back) => {
        const kneeX = hipX + Math.sin(ang) * 9;
        const footX = kneeX + Math.sin(ang) * 3 + 2;
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.strokeStyle = back ? cfg.pantsSh : cfg.pants;
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.moveTo(hipX, -48);
        ctx.lineTo(kneeX, -26);
        ctx.lineTo(footX, -10);
        ctx.stroke();
        // giày
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

    // ---- LUFFY ----
    drawLuffy(flash) {
      const swing = this.armSwing();
      const legs = this.legPose();
      const bob = this.state === "walk" ? Math.abs(Math.sin(this.walkPhase)) * 3 : 0;
      const skin    = flash ? "#ffc2ad" : "#f6cfa4";
      const skinSh  = flash ? "#f0a48f" : "#e0ac7f";
      const red     = flash ? "#ff7358" : "#e5342e";
      const redSh   = flash ? "#d8503c" : "#a81f1a";
      const blue    = flash ? "#5c93ef" : "#2f6fd8";
      const blueSh  = flash ? "#3f6fc4" : "#1f4fa8";

      ctx.save();
      ctx.translate(0, -bob);
      ctx.lineJoin = "round"; ctx.lineCap = "round";

      this.drawBackArm(skin, skinSh);
      this.drawLegs({ pants: blue, pantsSh: blueSh, shoe: "#efe2c8", shoeSh: "#cdbf9f", sole: "#a98d5f" }, legs);

      // ---- áo vest đỏ mở, để lộ ngực ----
      const vg = ctx.createLinearGradient(-15, -90, 15, -52);
      vg.addColorStop(0, red); vg.addColorStop(1, redSh);
      ctx.fillStyle = vg;
      ctx.beginPath();
      ctx.moveTo(-16, -90); ctx.quadraticCurveTo(0, -95, 16, -90);
      ctx.lineTo(13, -54); ctx.quadraticCurveTo(0, -50, -13, -54); ctx.closePath(); ctx.fill();
      // ngực trần (chữ V)
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.moveTo(-8, -90); ctx.lineTo(8, -90); ctx.lineTo(0, -58); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = redSh; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-8, -90); ctx.lineTo(0, -58); ctx.lineTo(8, -90); ctx.stroke();
      // sẹo X trứ danh trên ngực
      ctx.strokeStyle = "#c05a49"; ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-4, -84); ctx.lineTo(3, -72);
      ctx.moveTo(3, -84); ctx.lineTo(-4, -72);
      ctx.stroke();

      // ---- thắt lưng vàng + quần short xanh ----
      ctx.fillStyle = "#ffd23f";
      roundRect(-15, -58, 30, 7, 3); ctx.fill();
      ctx.fillStyle = "#e0b02e"; ctx.fillRect(-15, -53, 30, 2);
      const sg = ctx.createLinearGradient(0, -52, 0, -40);
      sg.addColorStop(0, blue); sg.addColorStop(1, blueSh);
      ctx.fillStyle = sg;
      roundRect(-14, -53, 28, 15, 4); ctx.fill();
      ctx.fillStyle = blueSh; ctx.fillRect(-14, -42, 28, 3);

      this.drawHeadLuffy(skin, skinSh, flash);
      this.drawFrontArmLuffy(swing, skin, skinSh);

      ctx.restore();
    }

    drawHeadLuffy(skin, skinSh, flash) {
      // cổ
      ctx.fillStyle = skinSh; roundRect(-4, -98, 8, 10, 2); ctx.fill();
      // mặt (đổ bóng)
      const fg = ctx.createLinearGradient(-14, -118, 14, -96);
      fg.addColorStop(0, skin); fg.addColorStop(1, skinSh);
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(0, -107, 15, 0, Math.PI * 2); ctx.fill();
      // tai
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(-13, -106, 3, 0, Math.PI * 2); ctx.fill();

      // tóc đen bù xù
      ctx.fillStyle = flash ? "#37323d" : "#181820";
      ctx.beginPath();
      ctx.moveTo(-15, -104);
      ctx.quadraticCurveTo(-17, -118, -8, -120);
      ctx.quadraticCurveTo(-4, -127, 2, -121);
      ctx.quadraticCurveTo(9, -126, 12, -118);
      ctx.quadraticCurveTo(17, -114, 14, -104);
      ctx.quadraticCurveTo(6, -112, -2, -110);
      ctx.quadraticCurveTo(-10, -111, -15, -104);
      ctx.closePath(); ctx.fill();

      // mắt to tròn
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.ellipse(6, -107, 3.6, 4.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#15151c";
      ctx.beginPath(); ctx.arc(7, -106, 2.1, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#181820"; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(2.5, -113); ctx.lineTo(10.5, -112); ctx.stroke();
      // sẹo dưới mắt
      ctx.strokeStyle = "#c05a49"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(3, -100); ctx.lineTo(9, -100); ctx.stroke();
      // nụ cười toe toét
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(-1, -99); ctx.quadraticCurveTo(6, -90, 13, -99);
      ctx.quadraticCurveTo(6, -96, -1, -99); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#7a2a2a"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-1, -99); ctx.quadraticCurveTo(6, -90, 13, -99); ctx.stroke();

      // ---- mũ rơm ----
      const brimY = -117;
      ctx.fillStyle = flash ? "#ffe6a0" : "#e6c163";
      ctx.beginPath(); ctx.ellipse(0, brimY, 25, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#c8a44e"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(0, brimY, 25, 8, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = flash ? "#f2d68a" : "#d8b24e";
      ctx.beginPath(); ctx.ellipse(0, brimY - 3, 13, 10, 0, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = "#cf3b3b"; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(-12, brimY - 3); ctx.lineTo(12, brimY - 3); ctx.stroke();
      // sợi rơm
      ctx.strokeStyle = "rgba(150,110,40,.4)"; ctx.lineWidth = 1;
      for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * 5, brimY - 1); ctx.lineTo(i * 6, brimY + 6); ctx.stroke(); }
    }

    drawFrontArmLuffy(swing, skin, skinSh) {
      const attacking = this.state === "attack" && this.attack;
      const isMelee = attacking && this.attack.def.type === "melee";
      const reach = isMelee ? 20 + swing * 46 : (attacking ? 24 + swing * 8 : 7);
      const y = -75;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      // vệt tốc độ khi đấm cao su
      if (isMelee && this.attack.phase !== "startup") {
        ctx.strokeStyle = "rgba(255,220,140,.45)"; ctx.lineWidth = 14;
        ctx.beginPath(); ctx.moveTo(14, y); ctx.lineTo(reach - 6, y); ctx.stroke();
      }
      // cánh tay
      ctx.strokeStyle = skin; ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(12, -84);
      ctx.lineTo(reach * 0.55, y + 1);
      ctx.lineTo(reach, y);
      ctx.stroke();
      // nắm đấm
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(reach, y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skinSh;
      ctx.beginPath(); ctx.arc(reach, y + 3.5, 4.5, 0, Math.PI * 2); ctx.fill();
      // đốt ngón
      ctx.strokeStyle = skinSh; ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let i = -1; i <= 1; i++) { ctx.moveTo(reach + 6, y - 4 + i * 4); ctx.lineTo(reach + 9, y - 4 + i * 4); }
      ctx.stroke();
    }

    // ---- ZORO ----
    drawZoro(flash) {
      const swing = this.armSwing();
      const legs = this.legPose();
      const bob = this.state === "walk" ? Math.abs(Math.sin(this.walkPhase)) * 3 : 0;
      const skin    = flash ? "#ffc2ad" : "#f0c49a";
      const skinSh  = flash ? "#f0a48f" : "#d9a877";
      const white   = flash ? "#ffffff" : "#f2f2ea";
      const whiteSh = flash ? "#e6e6dc" : "#d0d0c4";
      const green   = flash ? "#59d488" : "#2ea15a";
      const greenSh = flash ? "#3aa564" : "#1c6e3c";

      ctx.save();
      ctx.translate(0, -bob);
      ctx.lineJoin = "round"; ctx.lineCap = "round";

      this.drawSwords();                                   // 2 kiếm giắt hông (phía sau)
      this.drawBackArm(skin, skinSh, { bandana: true });   // tay sau + băng đen bắp tay
      this.drawLegs({ pants: flash ? "#3a3d47" : "#26282e", pantsSh: "#181a1f",
                      shoe: "#2a2c33", shoeSh: "#17181d", sole: "#0e0f12" }, legs);

      // ---- áo trắng ----
      const sg = ctx.createLinearGradient(-15, -90, 15, -64);
      sg.addColorStop(0, white); sg.addColorStop(1, whiteSh);
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(-16, -90); ctx.quadraticCurveTo(0, -95, 16, -90);
      ctx.lineTo(15, -62); ctx.lineTo(-15, -62); ctx.closePath(); ctx.fill();
      // cổ áo hở (da)
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.moveTo(-6, -90); ctx.lineTo(6, -90); ctx.lineTo(0, -77); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = whiteSh; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-6, -90); ctx.lineTo(0, -77); ctx.lineTo(6, -90); ctx.stroke();

      // ---- đai bụng xanh (haramaki) ----
      const hg = ctx.createLinearGradient(0, -64, 0, -42);
      hg.addColorStop(0, green); hg.addColorStop(1, greenSh);
      ctx.fillStyle = hg;
      roundRect(-16, -64, 32, 23, 6); ctx.fill();
      ctx.strokeStyle = greenSh; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-16, -57); ctx.lineTo(16, -57);
      ctx.moveTo(-16, -50); ctx.lineTo(16, -50);
      ctx.stroke();

      this.drawHeadZoro(skin, skinSh, green, greenSh, flash);
      this.drawFrontArmZoro(swing, skin, skinSh, flash);

      ctx.restore();
    }

    drawSwords() {
      const cols = [["#c0392b", "#7a2418"], ["#2c3e50", "#1a252f"]];
      for (let i = 0; i < 2; i++) {
        const bx = -15 - i * 6, top = -60;
        ctx.strokeStyle = i === 0 ? "#3a1f16" : "#1a2530";
        ctx.lineWidth = 6; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(bx, top); ctx.lineTo(bx - 9, top + 40); ctx.stroke();
        ctx.strokeStyle = cols[i][0]; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(bx + 3, top - 10); ctx.lineTo(bx, top + 1); ctx.stroke();
        ctx.fillStyle = "#d4a017";
        ctx.beginPath(); ctx.arc(bx + 1, top - 1, 3, 0, Math.PI * 2); ctx.fill();
      }
    }

    drawHeadZoro(skin, skinSh, green, greenSh, flash) {
      // cổ
      ctx.fillStyle = skinSh; roundRect(-4, -98, 8, 10, 2); ctx.fill();
      // mặt
      const fg = ctx.createLinearGradient(-14, -118, 14, -96);
      fg.addColorStop(0, skin); fg.addColorStop(1, skinSh);
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(0, -107, 15, 0, Math.PI * 2); ctx.fill();
      // tai + 3 khuyên vàng
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(-13, -105, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f5c518";
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-14, -100 + i * 4, 1.6, 0, Math.PI * 2); ctx.fill(); }

      // tóc xanh: nền ôm đầu + gai trên đỉnh (đầy đặn, không hở nền)
      const hairCol = flash ? "#7de0a4" : green;
      ctx.fillStyle = hairCol;
      ctx.beginPath();
      ctx.arc(0, -107, 15, Math.PI * 1.03, Math.PI * 1.97);   // nền dome
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-15, -108);
      ctx.lineTo(-13, -121); ctx.lineTo(-7, -111);
      ctx.lineTo(-2, -124); ctx.lineTo(3, -111);
      ctx.lineTo(9, -122); ctx.lineTo(14, -110);
      ctx.lineTo(15, -108);
      ctx.closePath(); ctx.fill();
      // khối tối nhẹ tạo chiều sâu
      ctx.fillStyle = greenSh;
      ctx.beginPath(); ctx.moveTo(-2, -124); ctx.lineTo(3, -111); ctx.lineTo(-1, -112); ctx.closePath(); ctx.fill();

      // mắt nghiêm nghị
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.ellipse(6, -106, 3, 3.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#15151c";
      ctx.beginPath(); ctx.arc(6.6, -106, 1.7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#20242b"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(2.5, -112); ctx.lineTo(10.5, -111); ctx.stroke();
      // sẹo dọc qua mắt
      ctx.strokeStyle = "#b5493a"; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(6, -114); ctx.lineTo(6, -101); ctx.stroke();
      // miệng nghiêm
      ctx.strokeStyle = "#6a2626"; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(2, -99); ctx.lineTo(10, -99); ctx.stroke();
    }

    drawFrontArmZoro(swing, skin, skinSh, flash) {
      const attacking = this.state === "attack" && this.attack;
      const ang = attacking ? (-1.2 + swing * 2.0) : -0.42;
      ctx.save();
      ctx.translate(12, -82);
      ctx.rotate(ang);
      // cánh tay (2 đốt)
      ctx.strokeStyle = skin; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.lineWidth = 11;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(12, 3); ctx.lineTo(24, 3); ctx.stroke();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(24, 3, 5.5, 0, Math.PI * 2); ctx.fill();

      // ---- katana ----
      ctx.translate(24, 3);
      ctx.strokeStyle = "#2c7a3f"; ctx.lineWidth = 6;   // chuôi bọc xanh
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
      ctx.fillStyle = "#d4a017"; ctx.fillRect(6, -4, 3, 8);   // tsuba
      const bg = ctx.createLinearGradient(9, 0, 66, 0);
      bg.addColorStop(0, "#cfdae4"); bg.addColorStop(0.5, "#ffffff"); bg.addColorStop(1, "#eef4fa");
      ctx.strokeStyle = bg; ctx.lineWidth = 5.5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(9, -1); ctx.lineTo(66, -4); ctx.stroke();
      ctx.strokeStyle = "rgba(120,140,160,.6)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(9, -3); ctx.lineTo(64, -6); ctx.stroke();
      // ánh chém
      if (attacking && this.attack.def.type === "melee" && this.attack.phase !== "startup") {
        ctx.strokeStyle = "rgba(190,255,215,.55)"; ctx.lineWidth = 12;
        ctx.beginPath(); ctx.arc(-6, 0, 54, -0.7, 0.7); ctx.stroke();
      }
      ctx.restore();
    }
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
        // khoảng cách trung: tiến hoặc bắn
        if (Math.random() < 0.04) intents.ranged = true;
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
      this.timeLeft = this.roundTime;
      this.state = "playing";
      this.announce = { text: `HIỆP ${this.round}`, sub:"CHIẾN ĐẤU!", t: 1600 };
      Sound.round();
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
      for (const p of this.projectiles) {
        p.update(dt);
        const target = p.owner === this.luffy ? this.zoro : this.luffy;
        if (!p.dead && target.state !== "ko" && rectsOverlap(p.rect, target.body)) {
          const dir = Math.sign(p.vx) || target.facing*-1;
          target.takeHit(p.d.dmg, p.d.knockback, p.d.launch, dir, p.d.kind==="redhawk"||p.d.kind==="tatsumaki", p.owner);
          p.owner.gainMeter(6);
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
        defender.takeHit(d.dmg, d.knockback, d.launch, dir, false, attacker);
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

      // HUD (không rung)
      this.drawHUD();
      this.drawCombos();
      this.drawAnnounce();
    },

    drawBackground() {
      // trời
      const sky = ctx.createLinearGradient(0,0,0,GROUND);
      sky.addColorStop(0,"#1a2a5c");
      sky.addColorStop(0.6,"#3a5aa8");
      sky.addColorStop(1,"#e8a86a");
      ctx.fillStyle = sky;
      ctx.fillRect(0,0,W,GROUND+40);

      // mặt trời
      ctx.fillStyle = "rgba(255,220,140,.9)";
      ctx.beginPath(); ctx.arc(W*0.5, GROUND-40, 60, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "rgba(255,235,180,.25)";
      ctx.beginPath(); ctx.arc(W*0.5, GROUND-40, 100, 0, Math.PI*2); ctx.fill();

      // biển
      ctx.fillStyle = "#2f8fd0";
      ctx.fillRect(0, GROUND-70, W, 70);
      ctx.fillStyle = "rgba(255,255,255,.18)";
      for (let i=0;i<8;i++){
        ctx.fillRect((i*140 + (this.animT||0)) % W - 40, GROUND-56 + (i%3)*12, 60, 3);
      }

      // thuyền Going Merry (bóng xa)
      ctx.fillStyle = "rgba(90,60,30,.9)";
      ctx.beginPath();
      ctx.moveTo(W*0.72, GROUND-58); ctx.lineTo(W*0.86, GROUND-58);
      ctx.lineTo(W*0.83, GROUND-42); ctx.lineTo(W*0.75, GROUND-42); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#f3ede0";
      ctx.fillRect(W*0.785, GROUND-96, 3, 40);
      ctx.beginPath(); ctx.moveTo(W*0.79, GROUND-92); ctx.lineTo(W*0.83, GROUND-72); ctx.lineTo(W*0.79, GROUND-72); ctx.fill();

      // sàn đấu (boong tàu gỗ)
      ctx.fillStyle = "#7a4a24";
      ctx.fillRect(0, GROUND, W, H-GROUND);
      ctx.fillStyle = "#8a5a2e";
      for (let x=0; x<W; x+=48) ctx.fillRect(x, GROUND, 44, H-GROUND);
      ctx.fillStyle = "rgba(0,0,0,.25)";
      ctx.fillRect(0, GROUND, W, 5);

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
      const barW = 360, barH = 22;
      const x = right ? edgeX - barW : edgeX;
      const y = 22;
      // khung
      ctx.fillStyle = "rgba(0,0,0,.55)";
      roundRect(x-4, y-4, barW+8, barH+8, 6); ctx.fill();
      // nền
      ctx.fillStyle = "#3a1414";
      roundRect(x, y, barW, barH, 4); ctx.fill();
      // máu
      const hpW = barW * (f.hp/100);
      const grd = ctx.createLinearGradient(x, 0, x+barW, 0);
      if (f.id === "luffy") { grd.addColorStop(0,"#ff9a3f"); grd.addColorStop(1,"#ff3b3b"); }
      else { grd.addColorStop(0,"#8fffbf"); grd.addColorStop(1,"#2ea15a"); }
      ctx.fillStyle = grd;
      const hx = right ? x + barW - hpW : x;
      roundRect(hx, y, hpW, barH, 4); ctx.fill();

      // haki
      const mY = y + barH + 5, mH = 8;
      ctx.fillStyle = "rgba(0,0,0,.5)";
      roundRect(x, mY, barW, mH, 3); ctx.fill();
      const mW = barW * (f.meter/100);
      const mx = right ? x + barW - mW : x;
      ctx.fillStyle = f.meter >= 50 ? "#ffe14d" : "#b9962e";
      roundRect(mx, mY, mW, mH, 3); ctx.fill();
      if (f.meter >= 50) {
        ctx.fillStyle = "rgba(255,255,255,.85)";
        ctx.font = "bold 9px Trebuchet MS"; ctx.textBaseline = "middle";
        ctx.textAlign = right ? "right" : "left";
        ctx.fillText("HAKI SẴN SÀNG!", right ? x+barW : x, mY+mH+8);
      }

      // tên
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px Trebuchet MS";
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = right ? "right" : "left";
      const label = f.id === "luffy" ? "👒 LUFFY" : "ZORO ⚔️";
      ctx.fillText(label, right ? edgeX : x, y - 8);
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
      const poseFighter = (f, moveKey) => {
        if (moveKey === "none") return;
        f.startAttack(moveKey);
        if (f.attack) {
          const d = f.attack.def;
          const total = d.startup + d.active + d.recovery;
          f.attack.elapsed = total * 0.42;
          f.attack.phase = "active";
        }
      };
      setTimeout(() => {
        if (params.get("pose")) {
          poseFighter(Game.luffy, params.get("l") || "close");
          poseFighter(Game.zoro, params.get("z") || "close");
        }
        if (params.get("lx")) Game.luffy.x = +params.get("lx");
        if (params.get("zx")) Game.zoro.x = +params.get("zx");
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
          if (isSp) { Game.flashScreen = 0.5; Game.projectiles.push(new Projectile(Game.luffy, MOVES.luffy.special.proj)); Game.projectiles[0].x = ix - 30; }
          Game.demoFreeze = true;
        }
        Game.announce = null;
        Game.state = "paused";   // đóng băng để chụp
      }, 60);
    }
  }
})();
