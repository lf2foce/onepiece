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
      ranged: { key:"ranged", name:"Gomu Gomu no Gatling", type:"projectile",
        dmg:18, startup:120, active:360, recovery:240, meterGain:12,
        sfx:"punch",
        multiProj: { count: 6, interval: 60, dmg: 3, speed: 650 },
        proj:{ kind:"gatling", speed:650, w:44, h:26, dmg:3, knockback:110, launch:-22, life:1000, color:"#ffcf9e" } },
      axe: { key:"axe", name:"Gomu Gomu no Ono", type:"melee",
        dmg:16, startup:220, active:150, recovery:230,
        reach:{dx:15,dy:-200,w:340,h:205}, knockback:350, launch:140, meterGain:14,
        sfx:"punch", color:"#ff9a6b" },
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
      asura: { key:"asura", name:"Kijin Ashura — Chém Xoay Nhảy", type:"melee",
        dmg:16, startup:350, active:650, recovery:300,
        reach:{dx:15,dy:-80,w:260,h:90}, knockback:260, launch:-50, meterGain:14,
        sfx:"slash", color:"#df9cff" },
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
        // Red Hawk - Nắm đấm lửa rực cháy hoành tráng
        const grd = ctx.createLinearGradient(-60, 0, 60, 0);
        grd.addColorStop(0, "rgba(255, 50, 0, 0)");
        grd.addColorStop(0.4, "rgba(255, 90, 0, 0.85)");
        grd.addColorStop(0.8, "#ff4a00");
        grd.addColorStop(1, "#ffd23f");
        ctx.fillStyle = grd;
        
        // Vỏ lửa bọc ngoài dạng giọt nước
        ctx.beginPath();
        ctx.moveTo(-60, -12); 
        ctx.quadraticCurveTo(-10, -32, 45, -18);
        ctx.quadraticCurveTo(60, 0, 45, 18); 
        ctx.quadraticCurveTo(-10, 32, -60, 12);
        ctx.closePath(); ctx.fill();
        
        // Lõi lửa trong phát sáng
        ctx.fillStyle = "#ffaa3f";
        ctx.beginPath(); ctx.arc(26, 0, 22, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.arc(32, -2, 12, 0, Math.PI*2); ctx.fill();
        
        // Vòng hơi nước bọc quanh (Steam rings)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(15, 0, 10, 25, Math.PI*0.1, 0, Math.PI*2);
        ctx.stroke();
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

          // tấn công (edge)
          if (intents.close)   { this.startAttack("close");   Sound[this.moves.close.sfx](); }
          else if (intents.ranged) {
            if (intents.block) {
              if (this.id === "luffy") {
                this.startAttack("axe");
                if (this.state === "attack") Sound.special();
              } else if (this.id === "zoro") {
                this.startAttack("asura");
                if (this.state === "attack") Sound.special();
              }
            } else {
              this.startAttack("ranged");
              if (this.state === "attack") Sound[this.moves.ranged.sfx]();
            }
          }
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
            Game.projectiles.push(new Projectile(this, d.proj));
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

    legAxeSwing() {
      if (this.state === "attack" && this.attack && this.attack.def.key === "axe") {
        const d = this.attack.def, a = this.attack, e = a.elapsed;
        const sEnd = d.startup;
        const aEnd = sEnd + d.active;
        if (e < sEnd) {
          // Lấy đà: chân nâng cực kỳ cao lên bầu trời và hơi co về sau
          const t = e / sEnd;
          return { h: -48 - t * 180, x: 10 - t * 35, state: "rising" };
        } else if (e < aEnd) {
          // Đập xuống: Chân giáng mạnh từ độ cao -228px xuống mặt đất cách xa 340px
          const t = (e - sEnd) / d.active;
          const h = -228 + t * 218; // từ -228 xuống -10
          const x = -25 + t * 365;   // vươn cực xa ra 340px phía trước!
          return { h, x, state: "slamming" };
        }
        // Thu chân về
        const t = clamp((e - aEnd) / d.recovery, 0, 1);
        return { h: -10 + t * (-38), x: 340 - t * 330, state: "recovery" };
      }
      return null;
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
    // ---- LUFFY ----
    drawLuffy(flash) {
      const swing = this.armSwing();
      const legs = this.legPose();
      // Nhịp thở phập phồng sinh động ở trạng thái đứng yên (idle) hoặc di chuyển (walk)
      const bob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 2.5 : (this.state === "walk" ? Math.abs(Math.sin(this.walkPhase)) * 3.5 : 0);
      const skin    = flash ? "#ffc2ad" : "#f6cfa4";
      const skinSh  = flash ? "#f0a48f" : "#e0ac7f";
      const red     = flash ? "#ff7358" : "#e5342e";
      const redSh   = flash ? "#d8503c" : "#a81f1a";
      const blue    = flash ? "#5c93ef" : "#2f6fd8";
      const blueSh  = flash ? "#3f6fc4" : "#1f4fa8";

      ctx.save();
      ctx.translate(0, -bob);
      ctx.lineJoin = "round"; ctx.lineCap = "round";

      // ---- HIỆU ỨNG GEAR 2 (Hơi nước bốc khói màu hồng nhạt bồng bềnh bốc thẳng từ chân lên đầu) ----
      if (this.meter >= 100 || this.hp < 50) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const anim = this.animTime * 8;
        for (let i = 0; i < 4; i++) {
          const steamY = (anim + i * 18) % 110;
          const steamX = Math.sin(anim * 0.15 + i * 1.8) * 16;
          const r = 4.5 + Math.sin(anim * 0.1 + i) * 1.8;
          ctx.fillStyle = i % 2 ? "rgba(255, 200, 215, 0.35)" : "rgba(255, 255, 255, 0.28)";
          ctx.beginPath();
          ctx.arc(steamX, -steamY, r, 0, Math.PI * 2);
          ctx.arc(steamX - r*0.5, -steamY + r*0.2, r*0.7, 0, Math.PI*2);
          ctx.arc(steamX + r*0.5, -steamY - r*0.2, r*0.6, 0, Math.PI*2);
          ctx.fill();
        }
        ctx.restore();
      }

      this.drawBackArm(skin, skinSh);
      
      const isAxe = this.state === "attack" && this.attack && this.attack.def.key === "axe";
      if (isAxe) {
        const axe = this.legAxeSwing();
        if (axe) {
          // Chân sau đứng tấn chịu lực vững chắc
          const backAng = 0.35;
          const kneeX = -5 + Math.sin(backAng) * 11;
          const footX = kneeX + Math.sin(backAng) * 4 + 3;
          
          ctx.strokeStyle = blueSh; ctx.lineWidth = 18; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(-5, -48); ctx.lineTo(kneeX, -27); ctx.stroke();
          
          ctx.strokeStyle = "#dcdcdc"; ctx.lineWidth = 20;
          ctx.beginPath(); ctx.moveTo(kneeX - 1, -28); ctx.lineTo(kneeX + 1, -25); ctx.stroke();
          
          ctx.strokeStyle = skinSh; ctx.lineWidth = 12;
          ctx.beginPath(); ctx.moveTo(kneeX, -26); ctx.lineTo(footX, -10); ctx.stroke();
          
          ctx.fillStyle = "#cdbf9f"; roundRect(footX - 7, -11, 22, 9, 4); ctx.fill();
          ctx.fillStyle = "#a98d5f"; roundRect(footX - 7, -4, 22, 4, 2); ctx.fill();

          // Chân trước siêu dài của Luffy quật lên trời rồi nện xuống (Gomu Gomu no Ono!)
          const hipX = 6;
          const hipY = -48;
          const targetX = axe.x;
          const targetY = axe.h;

          // Quần đùi chân trước kéo căng nhẹ
          ctx.strokeStyle = blue; ctx.lineWidth = 18;
          ctx.beginPath();
          ctx.moveTo(hipX, hipY);
          ctx.lineTo(hipX + (targetX - hipX) * 0.15, hipY + (targetY - hipY) * 0.15);
          ctx.stroke();

          // Gấu quần trắng
          ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 20;
          ctx.beginPath();
          const gx = hipX + (targetX - hipX) * 0.15;
          const gy = hipY + (targetY - hipY) * 0.15;
          ctx.moveTo(gx - 2, gy); ctx.lineTo(gx + 2, gy);
          ctx.stroke();

          // Bắp chân trần siêu dài kéo giãn
          ctx.strokeStyle = skin; ctx.lineWidth = 12;
          ctx.beginPath();
          ctx.moveTo(gx, gy);
          ctx.lineTo(targetX, targetY);
          ctx.stroke();

          // Dép rơm nện xuống
          ctx.save();
          ctx.translate(targetX, targetY);
          const rotateAng = axe.state === "slamming" ? Math.PI * 0.25 : 0;
          ctx.rotate(rotateAng);
          ctx.fillStyle = "#efe2c8"; roundRect(-7, -11, 22, 9, 4); ctx.fill();
          ctx.fillStyle = "#a98d5f"; roundRect(-7, -4, 22, 4, 2); ctx.fill();
          ctx.restore();

          // Hiệu ứng luồng gió quật mạnh sấm sét khi đang giáng đòn
          if (axe.state === "slamming") {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.45)"; ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(targetX - 10, targetY - 45);
            ctx.lineTo(targetX - 25, targetY - 15);
            ctx.stroke();
          }
        }
      } else {
        this.drawLegs({ pants: blue, pantsSh: blueSh, shoe: "#efe2c8", shoeSh: "#cdbf9f", sole: "#a98d5f", isLuffy: true, skin: skin, skinSh: skinSh }, legs);
      }

      // ---- áo vest đỏ mở, để lộ ngực ----
      const vg = ctx.createLinearGradient(-15, -90, 15, -52);
      vg.addColorStop(0, red); vg.addColorStop(1, redSh);
      ctx.fillStyle = vg;
      ctx.beginPath();
      ctx.moveTo(-16, -90); ctx.quadraticCurveTo(0, -95, 16, -90);
      ctx.lineTo(13, -54); ctx.quadraticCurveTo(0, -50, -13, -54); ctx.closePath(); ctx.fill();
      
      // Cúc áo vàng lấp lánh trên vest đỏ
      ctx.fillStyle = "#ffd23f";
      ctx.beginPath();
      ctx.arc(-11, -68, 2.5, 0, Math.PI*2);
      ctx.arc(11, -68, 2.5, 0, Math.PI*2);
      ctx.fill();

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
      
      // Dải thắt lưng vàng cột nút rủ xuống đung đưa theo nhịp thở/di chuyển
      const sashWiggle = (this.state === "walk") ? Math.sin(this.walkPhase * 2) * 5 : Math.sin(this.animTime * 4.5) * 2;
      ctx.fillStyle = "#ffd23f";
      ctx.beginPath();
      ctx.moveTo(2, -54);
      ctx.quadraticCurveTo(sashWiggle - 3, -42, sashWiggle - 7, -25);
      ctx.lineTo(sashWiggle - 1, -25);
      ctx.quadraticCurveTo(sashWiggle - 1, -42, 7, -54);
      ctx.closePath(); ctx.fill();

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
      // Chuyển động nảy đầu nhẹ nhàng khi đứng thở yên (Idle Head Bobbing)
      const headBob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 0.8 : 0;
      ctx.save();
      ctx.translate(0, headBob);

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

      // Vẽ chiếc mũi dễ thương kiểu anime
      ctx.strokeStyle = skinSh; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(1, -104); ctx.lineTo(3, -103); ctx.stroke();

      // Đôi má hồng ửng dễ thương của nhân vật anime sống động
      ctx.fillStyle = "rgba(255, 100, 100, 0.32)";
      ctx.beginPath();
      ctx.ellipse(8, -101, 3.2, 1.6, Math.PI * 0.1, 0, Math.PI * 2);
      ctx.ellipse(-4, -102, 2.2, 1.3, -Math.PI * 0.1, 0, Math.PI * 2);
      ctx.fill();

      // ---- BIỂU CẢM GƯƠNG MẶT DYNAMIC CHO LUFFY ----
      if (this.state === "hurt") {
        // 1. Dính đòn (Hurt face)
        // Mắt nhắm nghiền nhăn nhó dạng dấu sắc chéo góc
        ctx.strokeStyle = "#181820"; ctx.lineWidth = 2.5;
        ctx.beginPath();
        // Mắt trái nhắm nghiền nhăn nhó
        ctx.moveTo(3, -110); ctx.lineTo(11, -106);
        ctx.moveTo(3, -106); ctx.lineTo(11, -110);
        ctx.stroke();
        
        // Miệng nghiến răng đau nhức méo xệch
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#181820"; ctx.lineWidth = 1.8;
        roundRect(-2, -100, 10, 6, 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-2, -97); ctx.lineTo(8, -97); ctx.stroke(); // đường kẻ răng
      } else if (this.state === "ko") {
        // 2. Bị hạ gục (KO face)
        // Mắt xoáy xệ đờ đẫn hoặc nhắm tịt dạng nẹp xéo ngủ lịm
        ctx.strokeStyle = "#181820"; ctx.lineWidth = 2;
        // Vẽ dấu X chéo đờ đẫn ở hai mắt
        ctx.beginPath();
        ctx.moveTo(4, -109); ctx.lineTo(10, -103);
        ctx.moveTo(10, -109); ctx.lineTo(4, -103);
        ctx.stroke();

        // Miệng mở ngáp ngáp méo xệch hình oval dẹt thở dài
        ctx.fillStyle = "#4a1515";
        ctx.beginPath(); ctx.ellipse(5, -97, 4, 3, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "#181820"; ctx.lineWidth = 1.5; ctx.stroke();
      } else {
        // 3. Bình thường / Tấn công (Happy/Normal face)
        // mắt to tròn rực rỡ đặc trưng của Luffy
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.ellipse(6, -107, 3.6, 4.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#15151c";
        ctx.beginPath(); ctx.arc(7, -106, 2.1, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#181820"; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(2.5, -113); ctx.lineTo(10.5, -112); ctx.stroke();

        // nụ cười toe toét ngoác rộng khoe răng trắng xóa
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.moveTo(-1, -99); ctx.quadraticCurveTo(6, -90, 13, -99);
        ctx.quadraticCurveTo(6, -96, -1, -99); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#7a2a2a"; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(-1, -99); ctx.quadraticCurveTo(6, -90, 13, -99);
        ctx.stroke();
      }

      // sẹo dưới mắt (vẫn luôn hiện hữu)
      ctx.strokeStyle = "#c05a49"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(3, -100); ctx.lineTo(9, -100); ctx.stroke();

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

      // Dây nơ đỏ buộc mũ rơm bay đung đưa trong gió ở phía sau gáy cổ
      const bowWiggle = Math.sin(this.animTime * 6) * 3;
      ctx.fillStyle = "#cf3b3b";
      ctx.beginPath();
      ctx.moveTo(-9, brimY - 2);
      ctx.quadraticCurveTo(-17, brimY + 3 + bowWiggle, -24, brimY + 14 + bowWiggle * 1.5);
      ctx.quadraticCurveTo(-15, brimY + 11, -7, brimY - 2);
      ctx.closePath(); ctx.fill();

      ctx.restore();
    }

    drawFrontArmLuffy(swing, skin, skinSh) {
      const attacking = this.state === "attack" && this.attack;
      const y = -75;

      // Hiệu ứng liên hoàn đấm mờ cho chiêu Gatling Cao Su
      if (attacking && this.attack.def.key === "ranged") {
        ctx.save();
        ctx.strokeStyle = "rgba(224, 160, 111, 0.4)";
        ctx.lineWidth = 9;
        const anim = this.animTime * 25;
        for (let i = 0; i < 3; i++) {
          const angle = (anim + i * 2) % (Math.PI * 2);
          const bx = 12 + Math.cos(angle) * 12;
          const by = y + Math.sin(angle) * 12;
          ctx.beginPath();
          ctx.moveTo(12, -84);
          ctx.lineTo(bx, by);
          ctx.stroke();
          
          ctx.fillStyle = "rgba(246, 207, 164, 0.5)";
          ctx.beginPath();
          ctx.arc(bx, by, 7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        return;
      }

      const isMelee = attacking && this.attack.def.type === "melee";
      const reach = isMelee ? 20 + swing * 46 : (attacking ? 24 + swing * 8 : 7);
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
      // Nhịp thở phập phồng sinh động ở trạng thái đứng yên (idle) hoặc di chuyển (walk)
      const bob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 2.5 : (this.state === "walk" ? Math.abs(Math.sin(this.walkPhase)) * 3.5 : 0);
      const skin    = flash ? "#ffc2ad" : "#f0c49a";
      const skinSh  = flash ? "#f0a48f" : "#d9a877";
      const white   = flash ? "#ffffff" : "#f2f2ea";
      const whiteSh = flash ? "#e6e6dc" : "#d0d0c4";
      const green   = flash ? "#59d488" : "#2ea15a";
      const greenSh = flash ? "#3aa564" : "#1c6e3c";

      // Trạng thái quấn khăn nghiêm túc: Chỉ khi máu dưới 50 (hp < 50) thì mới quấn khăn bandana đen lên đầu
      const isSerious = (this.hp < 50);

      ctx.save();
      
      // Xoay toàn bộ cơ thể Zoro để tạo chuyển động nhào lộn hoặc xoay ngang chém gió thật sự!
      const isAsura = this.state === "attack" && this.attack && this.attack.def.key === "asura";
      if (isAsura) {
        const a = this.attack;
        const e = a.elapsed;
        const sEnd = a.def.startup;
        const act = a.def.active;
        
        ctx.translate(0, -60); // Tâm xoay nằm ở ngực
        if (e < sEnd) {
          const t = e / sEnd;
          ctx.rotate(-t * Math.PI * 0.12); // Hơi cúi/ngửa người chuẩn bị nhảy
        } else if (e < sEnd + act) {
          const t = (e - sEnd) / act;
          const spinCount = 2; // Xoay 2 vòng cực kỳ uy lực và rõ nét!
          const angle = t * Math.PI * 2 * spinCount;
          
          if (!this.onGround) {
            // TRÊN CAO: Nhào lộn lộn vòng (xoay quanh tâm ngực)
            ctx.rotate(angle);
          } else {
            // MẶT ĐẤT: Xoay ngang người như lốc xoáy (co giãn trục X tạo ảo giác 3D)
            ctx.scale(Math.cos(angle), 1);
          }
        } else {
          const t = clamp((e - (sEnd + act)) / a.def.recovery, 0, 1);
          ctx.rotate((1 - t) * Math.PI * 0.05); // Trả lại tư thế đứng vững sau khi xoay chém
        }
        ctx.translate(0, 60);
      }

      ctx.translate(0, -bob);
      ctx.lineJoin = "round"; ctx.lineCap = "round";

      this.drawSwords();                                   // 3 kiếm giắt hông huyền thoại phía sau
      this.drawBackArm(skin, skinSh, { bandana: !isSerious }); // Tay sau (Chỉ buộc khăn ở bắp tay nếu không quấn đầu)
      this.drawLegs({ pants: flash ? "#3a3d47" : "#26282e", pantsSh: "#181a1f",
                      shoe: "#2a2c33", shoeSh: "#17181d", sole: "#0e0f12" }, legs);

      // ---- áo trắng ----
      const sg = ctx.createLinearGradient(-15, -90, 15, -64);
      sg.addColorStop(0, white); sg.addColorStop(1, whiteSh);
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(-16, -90); ctx.quadraticCurveTo(0, -95, 16, -90);
      ctx.lineTo(15, -62); ctx.lineTo(-15, -62); ctx.closePath(); ctx.fill();
      
      // Vết sẹo chém chéo khổng lồ huyền thoại của Mihawk trên ngực áo trắng
      ctx.strokeStyle = "#9a2a1a"; ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-11, -84); ctx.lineTo(10, -66);
      ctx.stroke();
      // Các nốt khâu dọc vết sẹo
      ctx.strokeStyle = whiteSh; ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const sx = -11 + i * 5.25;
        const sy = -84 + i * 4.5;
        ctx.moveTo(sx - 2.5, sy + 3);
        ctx.lineTo(sx + 2.5, sy - 3);
      }
      ctx.stroke();

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

      this.drawHeadZoro(skin, skinSh, green, greenSh, flash, isSerious);
      this.drawFrontArmZoro(swing, skin, skinSh, flash);

      if (isAsura) {
        // Demonic Ashura Aura
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const darkGrad = ctx.createRadialGradient(0, -60, 10, 0, -60, 75);
        darkGrad.addColorStop(0, "rgba(108, 22, 194, 0.75)");
        darkGrad.addColorStop(0.5, "rgba(196, 28, 59, 0.38)");
        darkGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = darkGrad;
        ctx.beginPath(); ctx.arc(0, -60, 75, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // Draw multiple rotating swords (nine-sword style illusion!)
        ctx.save();
        ctx.translate(0, -60);
        const rot = this.animTime * 6; // Xoay chậm và đầm hơn nhiều để nhìn rõ chém ngang xoay
        ctx.rotate(rot);
        
        for (let i = 0; i < 3; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI * 2) / 3);
          
          // Vẽ 1 thanh kiếm xoay phát sáng xanh lục/tím huyền ảo
          ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4.8; ctx.lineCap = "round";
          ctx.shadowColor = "#8e2bbf"; ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.moveTo(15, 0);
          ctx.lineTo(82, 0);
          ctx.stroke();
          
          // Chuôi kiếm
          ctx.strokeStyle = "#a30e0e"; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(15, 0); ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.restore();
        }
        ctx.restore();

        // Vòng chém xoáy tròn lớn bao bọc quanh người
        ctx.strokeStyle = "rgba(142, 43, 191, 0.48)"; ctx.lineWidth = 15;
        ctx.beginPath(); ctx.arc(0, -60, 72, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)"; ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.arc(0, -60, 68, 0, Math.PI * 2); ctx.stroke();
      }

      ctx.restore();
    }

    drawSwords() {
      // 3 thanh bảo kiếm giắt hông: Wado Ichimonji (trắng), Shusui (đen răng cưa đỏ), Sandai Kitetsu (đỏ)
      const swords = [
        { sheath: "#fefefe", wrap: "#ffffff", tsuba: "#ffd700" }, // Wado Ichimonji
        { sheath: "#181716", wrap: "#800000", tsuba: "#caa010" }, // Shusui
        { sheath: "#b81a0e", wrap: "#202020", tsuba: "#caa010" }  // Sandai Kitetsu
      ];
      for (let i = 0; i < 3; i++) {
        const s = swords[i];
        const bx = -13 - i * 5;
        const top = -58 + i * 2.2;
        const angle = 0.22 + i * 0.05;
        ctx.save();
        ctx.translate(bx, top);
        ctx.rotate(angle);
        
        // Kiếm khí Haki xanh Enma tỏa bao quanh vỏ kiếm khi nộ đầy 100% cực kỳ đẹp mắt
        if (this.meter >= 100) {
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          ctx.fillStyle = "rgba(100, 255, 180, 0.16)";
          ctx.beginPath();
          ctx.ellipse(-5, 17, 10, 24, -0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Vỏ kiếm
        ctx.strokeStyle = s.sheath;
        ctx.lineWidth = 5.2; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-11, 35); ctx.stroke();
        
        // Chuôi kiếm
        ctx.strokeStyle = s.wrap;
        ctx.lineWidth = 4.2;
        ctx.beginPath(); ctx.moveTo(3, -9); ctx.lineTo(0, 0); ctx.stroke();
        
        // Tsuba (Kiếm cách vàng)
        ctx.fillStyle = s.tsuba;
        ctx.beginPath(); ctx.arc(1, -1, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    drawHeadZoro(skin, skinSh, green, greenSh, flash, isSerious) {
      // Chuyển động nảy đầu nhẹ nhàng khi đứng thở yên (Idle Head Bobbing)
      const headBob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 0.8 : 0;
      ctx.save();
      ctx.translate(0, headBob);

      // cổ
      ctx.fillStyle = skinSh; roundRect(-4, -98, 8, 10, 2); ctx.fill();
      // mặt
      const fg = ctx.createLinearGradient(-14, -118, 14, -96);
      fg.addColorStop(0, skin); fg.addColorStop(1, skinSh);
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(0, -107, 15, 0, Math.PI * 2); ctx.fill();
      // tai + 3 khuyên vàng bên tai trái khẽ đung đưa nhẹ theo nhịp thở/di chuyển
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(-13, -105, 3, 0, Math.PI * 2); ctx.fill();
      const sway = Math.sin(this.animTime * 4.5) * 1.0;
      ctx.fillStyle = "#f5c518";
      for (let i = 0; i < 3; i++) {
        const ex = -14 + i * 0.5 + sway * 0.45;
        const ey = -100 + i * 4;
        ctx.beginPath(); ctx.arc(ex, ey, 1.6, 0, Math.PI * 2); ctx.fill();
      }

      if (isSerious) {
        // --- BANDANA ĐEN (Trạng thái chiến đấu quấn khăn bandana huyền thoại) ---
        ctx.fillStyle = flash ? "#3d404a" : "#1e1e24";
        // Dome quấn quanh đầu
        ctx.beginPath();
        ctx.arc(0, -107, 15, Math.PI * 1.0, Math.PI * 2.0);
        ctx.closePath(); ctx.fill();
        // Viền thắt băng đô quấn đầu bọc ngang trán
        roundRect(-16, -112, 32, 5.5, 1.8); ctx.fill();
        
        // Đuôi dây thắt nút ruy-băng của khăn bay đung đưa sau gáy
        const bandanaWiggle = Math.sin(this.animTime * 7.5) * 3.5;
        ctx.strokeStyle = flash ? "#3d404a" : "#121216";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-11, -108);
        ctx.quadraticCurveTo(-21, -108 + bandanaWiggle, -27, -101 + bandanaWiggle * 1.4);
        ctx.moveTo(-11, -108);
        ctx.quadraticCurveTo(-19, -102 - bandanaWiggle, -24, -95 - bandanaWiggle * 1.4);
        ctx.stroke();
      } else {
        // --- TÓC XANH LỤC BẢO (Bình thường đầu trần) ---
        const hairCol = flash ? "#7de0a4" : green;
        ctx.fillStyle = hairCol;
        ctx.beginPath();
        ctx.arc(0, -107, 15, Math.PI * 1.03, Math.PI * 1.97);   // nền dome ôm đầu
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-15, -108);
        ctx.lineTo(-13, -121); ctx.lineTo(-7, -111);
        ctx.lineTo(-2, -124); ctx.lineTo(3, -111);
        ctx.lineTo(9, -122); ctx.lineTo(14, -110);
        ctx.lineTo(15, -108);
        ctx.closePath(); ctx.fill();
        // mảng bóng tóc tạo chiều sâu 3D gồ ghề của các gai tóc
        ctx.fillStyle = greenSh;
        ctx.beginPath(); ctx.moveTo(-2, -124); ctx.lineTo(3, -111); ctx.lineTo(-1, -112); ctx.closePath(); ctx.fill();
      }

      // Vẽ chiếc mũi dễ thương kiểu anime nghiêm nghị
      ctx.strokeStyle = skinSh; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(1, -103); ctx.lineTo(3, -102); ctx.stroke();

      // ---- BIỂU CẢM GƯƠNG MẶT DYNAMIC CHO ZORO ----
      if (this.state === "hurt") {
        // 1. Dính đòn (Hurt face)
        // Mắt nhắm chặt nghiến răng nhăn nhó
        ctx.strokeStyle = "#15151c"; ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(3.5, -108); ctx.lineTo(9.5, -104);
        ctx.stroke();
        
        // Miệng mở nghiến răng đau đớn
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#15151c"; ctx.lineWidth = 1.6;
        roundRect(2, -100, 9, 5, 1.5); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(2, -97.5); ctx.lineTo(11, -97.5); ctx.stroke();
      } else if (this.state === "ko") {
        // 2. Bị hạ gục (KO face)
        // Mắt nhắm lịm
        ctx.strokeStyle = "#15151c"; ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(3.5, -106); ctx.lineTo(9.5, -106);
        ctx.stroke();
        
        // Miệng há oval nhỏ kiệt sức
        ctx.fillStyle = "#330a0a";
        ctx.beginPath(); ctx.ellipse(6, -98, 3, 2, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "#15151c"; ctx.lineWidth = 1.2; ctx.stroke();

        // Vệt máu rỉ đỏ chảy dài từ khóe miệng xuống cằm cổ cực kỳ chân thực anh dũng
        ctx.fillStyle = "#a30e0e";
        ctx.beginPath();
        ctx.moveTo(6, -97);
        ctx.lineTo(8, -91);
        ctx.lineTo(9.5, -91);
        ctx.lineTo(7, -97);
        ctx.closePath(); ctx.fill();
      } else {
        // 3. Bình thường / Tấn công (Normal face)
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.ellipse(6, -106, 3, 3.4, 0, 0, Math.PI * 2); ctx.fill();
        
        if (isSerious) {
          // Trạng thái nghiêm túc (<50 hp): Mắt lóe đỏ sát khí quỷ dị (Asura eyes) cực kỳ đáng sợ
          ctx.fillStyle = "#ff2a2a";
          ctx.beginPath(); ctx.arc(6.6, -106, 1.8, 0, Math.PI * 2); ctx.fill();
          
          // Thêm vệt sáng đỏ lóe ngang qua mắt
          ctx.strokeStyle = "rgba(255, 42, 42, 0.4)"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(0, -106); ctx.lineTo(13, -106); ctx.stroke();
        } else {
          // Trạng thái thường: Mống mắt đen nghiêm túc
          ctx.fillStyle = "#15151c";
          ctx.beginPath(); ctx.arc(6.6, -106, 1.7, 0, Math.PI * 2); ctx.fill();
        }

        ctx.strokeStyle = "#20242b"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(2.5, -112); ctx.lineTo(10.5, -111); ctx.stroke();
        
        // miệng ngậm chặt nghiêm túc
        ctx.strokeStyle = "#6a2626"; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(2, -99); ctx.lineTo(10, -99); ctx.stroke();
      }

      // sẹo dọc qua mắt trái (vẫn luôn hiện hữu)
      ctx.strokeStyle = "#b5493a"; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(6, -114); ctx.lineTo(6, -101); ctx.stroke();

      ctx.restore();
    }

    drawFrontArmZoro(swing, skin, skinSh, flash) {
      const attacking = this.state === "attack" && this.attack;
      const ang = attacking ? (-1.2 + swing * 2.0) : -0.42;
      ctx.save();
      ctx.translate(12, -82);
      ctx.rotate(ang);
      // cánh tay (2 đốt cơ bắp)
      ctx.strokeStyle = skin; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.lineWidth = 11;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(12, 3); ctx.lineTo(24, 3); ctx.stroke();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(24, 3, 5.5, 0, Math.PI * 2); ctx.fill();

      // ---- katana bảo kiếm ----
      ctx.translate(24, 3);
      ctx.strokeStyle = "#2c7a3f"; ctx.lineWidth = 6;   // chuôi bọc chỉ xanh lục
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
      ctx.fillStyle = "#d4a017"; ctx.fillRect(6, -4, 3, 8);   // Tsuba vàng hình hoa mai
      
      // Lưỡi kiếm sáng loáng tỏa vầng hào quang nhẹ khi vung đâm
      const bg = ctx.createLinearGradient(9, 0, 66, 0);
      bg.addColorStop(0, "#cfdae4"); bg.addColorStop(0.5, "#ffffff"); bg.addColorStop(1, "#eef4fa");
      
      if (attacking) {
        // Tỏa kiếm khí phát sáng neon màu xanh rồng bao bọc lưỡi kiếm cực ngầu
        ctx.shadowColor = "#39d67e";
        ctx.shadowBlur = 11;
      }
      ctx.strokeStyle = bg; ctx.lineWidth = 5.5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(9, -1); ctx.lineTo(66, -4); ctx.stroke();
      ctx.shadowBlur = 0; // Tắt phát sáng đổ bóng để không ảnh hưởng chi tiết khác

      // Kiếm Enma bùng cháy ngọn lửa quỷ màu xanh lá rực rỡ tỏa khí phách khi nộ đầy 100%
      if (this.meter >= 100) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const fAnim = this.animTime * 15;
        for (let i = 0; i < 5; i++) {
          const fx = 14 + i * 11;
          const fy = -2.5 + Math.sin(fAnim * 0.4 + i) * 3;
          const fr = 4.5 + Math.sin(fAnim * 0.2 + i * 1.5) * 1.8;
          ctx.fillStyle = i % 2 ? "rgba(100, 255, 180, 0.45)" : "rgba(30, 220, 100, 0.28)";
          ctx.beginPath();
          ctx.arc(fx, fy, fr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      
      ctx.strokeStyle = "rgba(120,140,160,.6)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(9, -3); ctx.lineTo(64, -6); ctx.stroke();
      
      // Vệt chém hình bán nguyệt kép (Core trắng ẩn sâu trong luồng khí xanh) tỏa rộng
      if (attacking && this.attack.def.type === "melee" && this.attack.phase !== "startup") {
        ctx.strokeStyle = "rgba(120, 255, 180, 0.6)"; ctx.lineWidth = 15;
        ctx.beginPath(); ctx.arc(-6, 0, 56, -0.85, 0.85); ctx.stroke();
        
        ctx.strokeStyle = "rgba(255, 255, 255, 0.88)"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(-6, 0, 56, -0.65, 0.65); ctx.stroke();
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
