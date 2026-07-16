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

    takeHit(dmg, kb, launch, fromDir, isSpecial) {
      if (this.state === "ko") return;
      let real = dmg;
      let stun = isSpecial ? 520 : 340;
      // Đỡ đòn: giảm 80% sát thương, ít giật, đứng vững
      if (this.blocking && this.onGround) {
        real = Math.max(1, Math.round(dmg * 0.2));
        kb *= 0.35; launch = 0; stun = 140;
        this.gainMeter(dmg * 0.4);
      } else {
        this.state = "hurt";
        this.hurtTimer = stun;
        this.vy = launch;
        this.onGround = launch < 0 ? false : this.onGround;
        this.gainMeter(dmg * 0.6);
      }
      this.hp = clamp(this.hp - real, 0, 100);
      this.vx = kb * fromDir;
      this.flash = 140;
      Sound.hit();
      Game.addHitSpark(this.x, this.y - 70, this.blocking);
      Game.shake(isSpecial ? 12 : 6);
      if (this.hp <= 0) {
        this.hp = 0; this.state = "ko";
        this.attack = null;
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

    // tính góc tay cho đòn đánh
    armSwing() {
      if (this.state === "attack" && this.attack) {
        const d = this.attack.def; const a = this.attack;
        const total = d.startup + d.active + d.recovery;
        const p = clamp(a.elapsed / total, 0, 1);
        // vung ra rồi thu về
        return Math.sin(p * Math.PI) ; // 0..1..0
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

    // ---- LUFFY ----
    drawLuffy(flash) {
      const swing = this.armSwing();
      const legs = this.legPose();
      const skin = flash ? "#ffb0b0" : "#f4c9a0";
      const bob = this.state === "walk" ? Math.abs(Math.sin(this.walkPhase))*3 : 0;

      ctx.save();
      ctx.translate(0, -bob);

      // ---- chân ----
      ctx.strokeStyle = "#2b6cff"; ctx.lineWidth = 13; ctx.lineCap = "round";
      leg(-6, -46, legs.a);
      leg(6, -46, legs.b);
      function leg(hx, hy, ang){
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        const kx = hx + Math.sin(ang)*20, ky = hy + 24;
        ctx.lineTo(kx, ky);
        ctx.lineTo(kx + Math.sin(ang)*8, ky + 22);
        ctx.stroke();
      }
      // dép/chân
      ctx.fillStyle = "#e8e8e8";

      // ---- thân: áo vest đỏ ----
      ctx.fillStyle = flash ? "#ff8a8a" : "#e23b3b";
      roundRect(-16, -92, 32, 48, 8); ctx.fill();
      // ngực (da)
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.moveTo(-6,-90); ctx.lineTo(6,-90); ctx.lineTo(0,-58); ctx.closePath(); ctx.fill();
      // vết sẹo dưới mắt sẽ ở mặt; sẹo ngực
      ctx.strokeStyle = "#b02a2a"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-14,-70); ctx.lineTo(14,-70); ctx.stroke();

      // ---- tay sau ----
      ctx.strokeStyle = skin; ctx.lineWidth = 11; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-10,-84); ctx.lineTo(-22,-62); ctx.lineTo(-16,-44); ctx.stroke();

      // ---- đầu ----
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(0, -104, 14, 0, Math.PI*2); ctx.fill();
      // tóc đen
      ctx.fillStyle = "#20242e";
      ctx.beginPath(); ctx.arc(0, -108, 14, Math.PI*1.05, Math.PI*2.0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-13,-106); ctx.quadraticCurveTo(-16,-116,-6,-116); ctx.lineTo(-8,-104); ctx.fill();
      // mắt + sẹo
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath(); ctx.arc(6, -104, 2.2, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = "#b02a2a"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(2,-96); ctx.lineTo(9,-96); ctx.stroke();
      // miệng cười
      ctx.strokeStyle = "#7a2a2a"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(4,-99,4,0,Math.PI); ctx.stroke();

      // ---- mũ rơm ----
      ctx.fillStyle = flash ? "#ffe6a0" : "#e7c463";
      ctx.beginPath(); ctx.ellipse(0,-116, 22, 7, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "#d8b24e";
      ctx.beginPath(); ctx.ellipse(0,-120, 12, 8, 0, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = "#b23b3b"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-11,-118); ctx.lineTo(11,-118); ctx.stroke();

      // ---- tay trước (đấm) ----
      // nếu đang tung đòn projectile ranged/special thì tay duỗi thẳng; melee thì đấm tới
      this.drawFrontArmLuffy(swing, skin);

      ctx.restore();
    }

    drawFrontArmLuffy(swing, skin) {
      const attacking = this.state === "attack" && this.attack;
      const isMelee = attacking && this.attack.def.type === "melee";
      const reachX = isMelee ? 22 + swing*40 : (attacking ? 20 + swing*10 : 8);
      ctx.strokeStyle = skin; ctx.lineWidth = 12; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(10, -84);
      const midX = reachX * 0.6, midY = -72;
      ctx.lineTo(midX, midY);
      ctx.lineTo(reachX, -66);
      ctx.stroke();
      // nắm đấm
      ctx.fillStyle = "#f0bd8f";
      ctx.beginPath(); ctx.arc(reachX, -66, 8, 0, Math.PI*2); ctx.fill();
    }

    // ---- ZORO ----
    drawZoro(flash) {
      const swing = this.armSwing();
      const legs = this.legPose();
      const skin = flash ? "#ffb0b0" : "#f0c49a";
      const bob = this.state === "walk" ? Math.abs(Math.sin(this.walkPhase))*3 : 0;

      ctx.save();
      ctx.translate(0, -bob);

      // ---- chân (quần đen) ----
      ctx.strokeStyle = "#26282e"; ctx.lineWidth = 14; ctx.lineCap = "round";
      leg(-6, -46, legs.a);
      leg(6, -46, legs.b);
      function leg(hx, hy, ang){
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        const kx = hx + Math.sin(ang)*20, ky = hy + 24;
        ctx.lineTo(kx, ky);
        ctx.lineTo(kx + Math.sin(ang)*8, ky + 22);
        ctx.stroke();
      }

      // ---- thân: áo trắng + đai xanh (haramaki) ----
      ctx.fillStyle = flash ? "#ffffff" : "#f0f0ea";
      roundRect(-16, -92, 32, 34, 7); ctx.fill();
      // đai bụng xanh
      ctx.fillStyle = flash ? "#7ff0ad" : "#2ea15a";
      roundRect(-17, -66, 34, 20, 5); ctx.fill();
      ctx.strokeStyle = "#1c6e3c"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-17,-58); ctx.lineTo(17,-58); ctx.stroke();

      // ---- 3 thanh kiếm giắt bên đai (sau lưng bên trái) ----
      ctx.save();
      ctx.strokeStyle = "#111"; ctx.lineWidth = 4; ctx.lineCap = "round";
      for (let i=0;i<3;i++){
        const off = -20 - i*4;
        ctx.strokeStyle = ["#c0392b","#2c3e50","#16a085"][i];
        ctx.beginPath(); ctx.moveTo(off, -62); ctx.lineTo(off-6, -40); ctx.stroke();
      }
      ctx.restore();

      // ---- tay sau ----
      ctx.strokeStyle = skin; ctx.lineWidth = 11; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-10,-86); ctx.lineTo(-22,-64); ctx.lineTo(-16,-46); ctx.stroke();

      // ---- đầu + khăn bandana + tóc xanh ----
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(0, -104, 14, 0, Math.PI*2); ctx.fill();
      // tóc xanh
      ctx.fillStyle = flash ? "#9ff0c0" : "#3fae6d";
      ctx.beginPath(); ctx.arc(0,-110, 14, Math.PI, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-14,-108); ctx.quadraticCurveTo(-18,-120,-8,-120); ctx.lineTo(-9,-106); ctx.fill();
      ctx.beginPath(); ctx.moveTo(14,-108); ctx.quadraticCurveTo(18,-120,8,-120); ctx.lineTo(9,-106); ctx.fill();
      // khuyên tai
      ctx.strokeStyle = "#f0c000"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(-11, -100, 3, 0, Math.PI*2); ctx.stroke();
      // mắt nghiêm
      ctx.strokeStyle = "#1a1a1a"; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(4,-105); ctx.lineTo(10,-104); ctx.stroke();
      // sẹo mắt trái (dọc)
      ctx.strokeStyle = "#b23a3a"; ctx.lineWidth = 1.6;

      // miệng nghiêm
      ctx.strokeStyle = "#7a2a2a"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(3,-97); ctx.lineTo(9,-97); ctx.stroke();

      // ---- tay trước cầm kiếm ----
      this.drawFrontArmZoro(swing, skin, flash);

      ctx.restore();
    }

    drawFrontArmZoro(swing, skin, flash) {
      const attacking = this.state === "attack" && this.attack;
      // góc vung kiếm: từ trên xuống
      const ang = attacking ? (-1.1 + swing*1.9) : -0.2;
      ctx.save();
      ctx.translate(12, -82);
      ctx.rotate(ang);
      // cánh tay
      ctx.strokeStyle = skin; ctx.lineWidth = 12; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(20,2); ctx.stroke();
      // chuôi + lưỡi kiếm
      ctx.translate(20, 2);
      ctx.strokeStyle = "#3a2a1a"; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(-4,0); ctx.lineTo(6,0); ctx.stroke();
      // lưỡi kiếm sáng
      const bladeGrd = ctx.createLinearGradient(6,0,58,0);
      bladeGrd.addColorStop(0,"#dfeaf2"); bladeGrd.addColorStop(1,"#ffffff");
      ctx.strokeStyle = bladeGrd; ctx.lineWidth = 5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(8,0); ctx.lineTo(58,-3); ctx.stroke();
      // ánh chém
      if (attacking && this.attack.def.type === "melee" && this.attack.phase !== "startup") {
        ctx.strokeStyle = "rgba(200,255,220,.6)"; ctx.lineWidth = 10;
        ctx.beginPath(); ctx.arc(0,0, 50, -0.6, 0.6); ctx.stroke();
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
    shakeAmt: 0,
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

    shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); },

    addHitSpark(x, y, blocked) {
      for (let i=0;i<(blocked?6:12);i++){
        this.sparks.push({
          x, y,
          vx:(Math.random()*2-1)*260,
          vy:(Math.random()*-1-0.2)*260,
          life: 300 + Math.random()*200,
          max: 500,
          color: blocked ? "#8fd0ff" : (Math.random()<0.5?"#ffd23f":"#ff6b3f"),
          r: 2+Math.random()*3,
        });
      }
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
      // hiệu ứng announce đếm ngược
      if (this.announce && this.announce.t < 999999) {
        this.announce.t -= dt * 1000;
        if (this.announce.t <= 0) this.announce = null;
      }
      if (this.shakeAmt > 0) this.shakeAmt = Math.max(0, this.shakeAmt - dt*40);

      // cập nhật spark luôn (kể cả lúc pause để mượt) — nhưng bỏ qua nếu menu
      for (const s of this.sparks) {
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
          target.takeHit(p.d.dmg, p.d.knockback, p.d.launch, dir, p.d.kind==="redhawk"||p.d.kind==="tatsumaki");
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
        defender.takeHit(d.dmg, d.knockback, d.launch, dir, false);
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
      // rung màn hình
      if (this.shakeAmt > 0) {
        const dx = (Math.random()*2-1) * this.shakeAmt;
        const dy = (Math.random()*2-1) * this.shakeAmt;
        ctx.translate(dx, dy);
      }
      this.drawBackground();

      // sắp xếp vẽ theo hp? vẽ cả hai
      this.luffy.draw();
      this.zoro.draw();

      for (const p of this.projectiles) p.draw();
      this.drawSparks();

      ctx.restore();

      // HUD (không rung)
      this.drawHUD();
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
})();
