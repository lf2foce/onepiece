/**
 * One Piece Adventure Mode - Side-Scrolling 2.5D Beat 'Em Up Engine (Little Fighter 2 style)
 * Fully modular extension for game.js with 2.5D Z-axis lane movement, Z-sorting render, and lane collision!
 */
(() => {
  "use strict";

  const W = 960;
  const H = 540;
  const GROUND = H - 78;
  const GRAVITY = 2200;
  const FRICTION = 0.82;

  const canvas = document.getElementById("game");
  const ctx = canvas ? canvas.getContext("2d") : null;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rectsOverlap = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const roundRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // ---------------------------------------------------------------- Marine Soldier Enemy Class
  class Enemy {
    constructor(id, x, type = "recruit") {
      this.id = id;
      this.type = type; // "recruit" (lính thường) | "captain" (Mini-Boss Đại uý)
      this.x = x;
      
      // Khởi tạo chiều sâu 2.5D Z-axis [-45 (sâu vào màn hình), 25 (sát ngoài rìa)]
      this.z = Math.random() * 60 - 35;
      this.jumpY = 0; // Tách biệt chiều cao nhảy khỏi chiều sâu Z
      this.y = GROUND + this.z + this.jumpY;
      
      this.vx = 0; this.vy = 0;
      this.facing = -1;
      this.onGround = true;
      this.hp = type === "captain" ? 120 : 45;
      this.maxHp = this.hp;
      this.width = 62;
      this.height = type === "captain" ? 142 : 135;
      this.state = "walk"; // idle | walk | attack | hurt | ko
      this.animTime = 0;
      this.walkPhase = 0;
      this.hurtTimer = 0;
      this.flash = 0;
      
      this.attackTimer = 1000 + Math.random() * 1200; // Giãn cách đòn đánh
      this.attack = null; // {elapsed, phase, hit: Set}
    }

    get body() {
      // Hộp thân co dãn dựa trên vị trí vẽ thực tế của x và y
      return { x: this.x - 25, y: this.y - this.height, w: 50, h: this.height };
    }

    takeHit(dmg, kb, launch, fromDir) {
      if (this.state === "ko") return;
      this.state = "hurt";
      this.hurtTimer = this.type === "captain" ? 380 : 280;
      this.vy = launch;
      this.onGround = launch < 0 ? false : this.onGround;
      this.hp = Math.max(0, this.hp - dmg);
      this.vx = kb * fromDir;
      this.flash = 120;
      
      // Sound & Sparks
      const Sound = window.OP_SOUNDS || { hit: () => {} };
      Sound.hit();
      window.OP_GAME.addHitSpark(this.x, this.y - 70, false, this.type === "captain");
      window.OP_GAME.hitstop = Math.max(window.OP_GAME.hitstop, this.type === "captain" ? 50 : 30);

      if (this.hp <= 0) {
        this.state = "ko";
        this.vy = -180; // Bị bay tung lên nhẹ khi gục ngã hoàn toàn
        this.onGround = false;
        Sound.ko && Sound.ko();
      }
    }

    update(dt, players) {
      this.animTime += dt;
      if (this.flash > 0) this.flash -= dt * 1000;

      // Vật lý bay nhảy / tung lên không trung
      if (!this.onGround) {
        this.vy += GRAVITY * dt;
        this.jumpY += this.vy * dt;
        if (this.jumpY >= 0) {
          this.jumpY = 0;
          this.vy = 0;
          this.onGround = true;
          if (this.state === "ko") {
            this.vx = 0;
          }
        }
      }

      this.y = GROUND + this.z + this.jumpY;

      if (this.state === "ko") {
        this.x += this.vx * dt;
        this.vx *= 0.9;
        return;
      }

      if (this.state === "hurt") {
        this.hurtTimer -= dt * 1000;
        if (this.hurtTimer <= 0 && this.onGround) this.state = "idle";
      }

      // ---- AI ĐI BÀI 2.5D CỰC HAY (Tìm mục tiêu, dạt lùi / dạt lên cùng làn Z để đấm) ----
      if (this.state !== "hurt" && this.state !== "attack") {
        // Tìm mục tiêu người chơi gần nhất
        let target = players[0];
        let minDist = Math.abs(players[0].x - this.x);
        for (let i = 1; i < players.length; i++) {
          const d = Math.abs(players[i].x - this.x);
          if (d < minDist) {
            minDist = d;
            target = players[i];
          }
        }

        const dist = target.x - this.x;
        this.facing = dist >= 0 ? 1 : -1;

        // Căn chỉnh làn Z (Z-axis Alignment)
        const zDiff = target.z - this.z;
        const zSameLane = Math.abs(zDiff) <= 12;

        if (!zSameLane) {
          // Di chuyển theo trục dọc Z dạt lên/dạt xuống để cùng làn
          this.state = "walk";
          this.z = clamp(this.z + Math.sign(zDiff) * 85 * dt, -45, 25);
          this.vx = this.facing * 50; // Hơi nhích nhẹ trục hoành
        } else if (Math.abs(dist) > (this.type === "captain" ? 80 : 60)) {
          // Nếu đã cùng làn nhưng còn cách xa, đi thẳng tới mục tiêu
          this.state = "walk";
          this.vx = this.facing * (this.type === "captain" ? 140 : 110);
        } else {
          // Đã tiếp cận cực gần cả về làn Z lẫn trục hoành X -> ĐẤM!
          this.state = "idle";
          this.vx = 0;
          this.attackTimer -= dt * 1000;
          if (this.attackTimer <= 0) {
            this.state = "attack";
            this.attack = { elapsed: 0, phase: "startup", hit: new Set() };
            this.attackTimer = 1000 + Math.random() * 1200;
          }
        }
      }

      // Tiến trình vung đòn của quân lính
      if (this.state === "attack" && this.attack) {
        const a = this.attack;
        a.elapsed += dt * 1000;
        const startup = this.type === "captain" ? 220 : 180;
        const active = this.type === "captain" ? 150 : 100;
        const recovery = this.type === "captain" ? 250 : 180;

        if (a.elapsed < startup) a.phase = "startup";
        else if (a.elapsed < startup + active) {
          a.phase = "active";
          // Kiểm tra va chạm hộp đấm (chỉ trúng khi cùng làn Z!)
          const reachW = this.type === "captain" ? 64 : 45;
          const reachH = 30;
          const rx = this.facing > 0 ? this.x + 10 : this.x - 10 - reachW;
          const ry = this.y - 75;
          const hitbox = { x: rx, y: ry, w: reachW, h: reachH };

          for (const p of players) {
            const sameLane = Math.abs(this.z - p.z) < 18;
            if (p.state !== "ko" && sameLane && !a.hit.has(p) && rectsOverlap(hitbox, p.body)) {
              a.hit.add(p);
              p.takeHit(this.type === "captain" ? 12 : 6, 180, -30, this.facing, false, null);
            }
          }
        } else a.phase = "recovery";

        if (a.elapsed >= startup + active + recovery) {
          this.state = "idle";
          this.attack = null;
        }
      }

      this.x += this.vx * dt;
      this.walkPhase += Math.abs(this.vx) * dt * 0.05;
    }

    draw(ctx) {
      const bob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 2.0 : (this.state === "walk" ? Math.abs(Math.sin(this.walkPhase)) * 2.5 : 0);
      const isHurt = this.state === "hurt";
      const isKo = this.state === "ko";
      const flash = this.flash > 0 && Math.floor(this.flash / 40) % 2 === 0;

      // Màu sắc lính Hải quân vẽ khối phẳng vector trơn bóng bẩy cực đẹp
      const skin = flash ? "#ffc2ad" : "#f0c49a";
      const pants = this.type === "captain" ? "#4a148c" : "#2f4f4f"; // Quần tím sang trọng, lính thường quần sẫm
      const shirt = this.type === "captain" ? "#ffeb3b" : "#ffffff"; // Đại uý áo vàng oai nghiêm, lính áo trắng
      const shadowCol = "rgba(0,0,0,0.22)";

      ctx.save();
      
      // Bóng đổ dẹt dưới chân
      ctx.fillStyle = shadowCol;
      ctx.beginPath();
      const shW = this.onGround ? 32 : 18;
      ctx.ellipse(this.x, this.y + 6, shW, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(this.x, this.y - bob);
      ctx.scale(this.facing, 1);
      ctx.lineCap = "round"; ctx.lineJoin = "round";

      if (isKo) {
        ctx.rotate(Math.PI * 0.45); // Nằm ngã rạp
      }

      // 1. Chân dứt khoát mượt mà
      const legA = Math.sin(this.walkPhase) * 0.4;
      const legB = -Math.sin(this.walkPhase) * 0.4;
      // Chân sau
      ctx.strokeStyle = "#102020"; ctx.lineWidth = 14;
      ctx.beginPath(); ctx.moveTo(-5, -50); ctx.lineTo(-10 + Math.sin(legA)*12, -26); ctx.lineTo(-8 + Math.sin(legA)*14, -8); ctx.stroke();
      // Chân trước
      ctx.strokeStyle = pants; ctx.lineWidth = 14;
      ctx.beginPath(); ctx.moveTo(5, -50); ctx.lineTo(10 + Math.sin(legB)*12, -26); ctx.lineTo(8 + Math.sin(legB)*14, -8); ctx.stroke();

      // 2. Thân áo thon dẹt
      ctx.fillStyle = shirt;
      roundRect(ctx, -12, -98, 24, 48, 5); ctx.fill();
      
      ctx.fillStyle = "#111115";
      ctx.fillRect(-12, -54, 24, 5); // Thắt lưng

      // Caravat / Huy chương lấp lánh
      ctx.fillStyle = this.type === "captain" ? "#cf2a2a" : "#2b4c8f";
      ctx.beginPath();
      ctx.moveTo(-3, -98); ctx.lineTo(3, -98); ctx.lineTo(4, -80); ctx.lineTo(0, -70); ctx.lineTo(-4, -80);
      ctx.closePath(); ctx.fill();

      // 3. Đầu thon nhỏ tỷ lệ 1:7 cực kỳ nam tính
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(0, -112, 11, 0, Math.PI * 2); ctx.fill();
      
      // Mặt mũi sắc sảo
      ctx.strokeStyle = "#1a1a20"; ctx.lineWidth = 1.5;
      if (isHurt || isKo) {
        ctx.beginPath(); ctx.moveTo(2, -114); ctx.lineTo(7, -111); ctx.moveTo(2, -111); ctx.lineTo(7, -114); ctx.stroke();
      } else {
        ctx.fillStyle = "#1a1a20";
        ctx.beginPath(); ctx.arc(5, -114, 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(2, -119); ctx.lineTo(8, -117); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(2, -107); ctx.lineTo(8, -107); ctx.stroke();

      // Mũ Hải quân Sailor Cap rực rỡ
      ctx.fillStyle = this.type === "captain" ? "#ffd700" : "#ffffff";
      ctx.beginPath(); ctx.arc(0, -118, 12, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = "#2b4c8f"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, -118, 12, Math.PI, 0); ctx.stroke();
      // Phù hiệu mỏ neo trên mũ (thay chữ NAVY dễ bị lật ngược)
      ctx.fillStyle = this.type === "captain" ? "#cf2a2a" : "#2b4c8f";
      ctx.beginPath(); ctx.arc(0, -120, 2.4, 0, Math.PI * 2); ctx.fill();

      // 4. Tay chém
      const swing = this.state === "attack" && this.attack ? Math.sin((this.attack.elapsed / 450) * Math.PI) * 45 : 0;
      ctx.strokeStyle = skin; ctx.lineWidth = 9.5;
      ctx.beginPath();
      ctx.moveTo(10, -90);
      ctx.lineTo(20 + swing, -80);
      ctx.stroke();
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(20 + swing, -80, 4.5, 0, Math.PI * 2); ctx.fill();

      ctx.restore();
    }
  }

  window.OP_ENEMY = Enemy;

  // ---------------------------------------------------------------- HOOK INTO GAME MANAGER
  if (typeof window !== "undefined" && window.OP_GAME) {
    const Game = window.OP_GAME;
    window.OP_SOUNDS = window.OP_SOUNDS || {};

    const origStartMatch = Game.startMatch;
    Game.startMatch = function(mode) {
      if (mode === "adventure") {
        this.mode = mode;
        this.state = "playing";
        this.cameraX = 0;
        this.stageWidth = 3200; // Chiều rộng bản đồ ải Going Merry dài lướt
        this.luffy.wins = 0; this.zoro.wins = 0;
        this.round = 1;
        this.ai = null;

        // Gán nhân vật đã chọn từ sảnh chờ cho cả chế độ đi bài (MOVES lấy từ window an toàn)
        const MOVES = window.OP_MOVES || {};
        this.luffy.id = this.p1CharId || "luffy";
        if (MOVES[this.luffy.id]) this.luffy.moves = MOVES[this.luffy.id];
        this.zoro.id = this.p2CharId || "zoro";
        if (MOVES[this.zoro.id]) this.zoro.moves = MOVES[this.zoro.id];

        // Reset cả 2 người chơi Luffy (P1) và Zoro (P2)
        this.luffy.reset(150, 1);
        this.zoro.reset(220, 1);
        const maxHp = window.OP_MAXHP || 100;
        this.luffy.hp = maxHp; this.zoro.hp = maxHp;
        this.luffy.meter = 0; this.zoro.meter = 0;
        
        // Cấu hình Z-axis chiều sâu 2.5D khởi tạo ban đầu cho cả 2 đấu sĩ
        this.luffy.z = -10;
        this.zoro.z = 10;
        this.luffy.y = GROUND + this.luffy.z;
        this.zoro.y = GROUND + this.zoro.z;

        this.projectiles = [];
        this.sparks = [];
        this.enemies = [];
        this.waveIndex = 0;
        
        this.hitstop = 0; this.flashScreen = 0;
        this.superFreeze = 0; this.superFocus = null;
        this.timeLeft = 180; // 3 phút vượt ải
        this.announce = { text: "ẢI HẢI QUÂN", sub: "VẬN DỤNG Z-AXIS LÁCH LÀN VƯỢT ẢI!", t: 2000 };

        // Danh sách các cột khóa màn hình và spawn lính Hải Quân (Wave)
        this.waves = [
          { lockX: 900,  recruits: 3, captains: 0, spawned: false, cleared: false },
          { lockX: 1800, recruits: 4, captains: 1, spawned: false, cleared: false },
          { lockX: 2700, recruits: 4, captains: 2, spawned: false, cleared: false } // Đợt Boss cuối!
        ];

        this.hide("menu"); this.hide("result");
        this.show("pauseHint");
        window.OP_SOUNDS.round && window.OP_SOUNDS.round();
        return;
      }
      // Các chế độ 1v1 (1p / 2p / sandbox): gọi thẳng hàm gốc của game.js.
      // Không tự dựng lại AI ở đây — class AI nằm trong scope riêng của game.js, còn Game.ai
      // lúc ở menu vẫn là null nên đọc Game.ai.constructor sẽ văng lỗi và chết cả chế độ 1p/sandbox.
      return origStartMatch.call(this, mode);
    };

    // Móc lách vào Game.update
    const origUpdate = Game.update;
    Game.update = function(dt) {
      if (this.state === "paused") return;
      if (this.mode === "adventure" && this.state === "playing") {
        if (this.hitstop > 0) {
          this.hitstop -= dt * 1000;
          return;
        }
        if (this.flashScreen > 0) this.flashScreen = Math.max(0, this.flashScreen - dt * 6);

        // Đồng hồ đếm ngược
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.endRound(); // Hết giờ tự động thua cuộc
        }

        // Đọc phím điều khiển độc lập cho 2 người chơi cùng bàn phím (Clone lại đối tượng để tránh can thiệp trực tiếp)
        const i1 = Object.assign({}, this.humanIntents("p1"));
        const i2 = Object.assign({}, this.humanIntents("p2"));

        // ---- ĐIỀU KHIỂN CHIỀU SÂU Z-AXIS LÁCH LÀN (W/S cho Luffy P1, Up/Down cho Zoro P2) ----
        for (const p of [this.luffy, this.zoro]) {
          if (p.z === undefined) p.z = 0;
          const intents = p === this.luffy ? i1 : i2;
          
          // Khi bấm nhảy (Up/W) -> Di chuyển dạt sâu vào trong màn hình
          if (intents.jump) {
            p.z = clamp(p.z - 130 * dt, -45, 25);
          }
          // Khi bấm đỡ (Down/S) -> Di chuyển dạt lùi sát ra mép ngoài màn hình
          else if (intents.block) {
            p.z = clamp(p.z + 130 * dt, -45, 25);
          }
          
          p.y = GROUND + p.z; // Đồng bộ vị trí vẽ Y dập dềnh theo trục Z

          // Hướng nhìn co-op: theo phím X; đứng yên thì quay về lính gần nhất (mặc định nhìn phải)
          if (intents.left) p._faceWant = -1;
          else if (intents.right) p._faceWant = 1;
          else {
            let nd = Infinity, nf = p._faceWant;
            for (const e of this.enemies) {
              if (e.state === "ko") continue;
              const d = Math.abs(e.x - p.x);
              if (d < nd) { nd = d; nf = e.x >= p.x ? 1 : -1; }
            }
            p._faceWant = (nf === undefined) ? 1 : nf;
          }
          // Áp hướng nhìn ngay (khoá khi đang ra đòn để đòn tung đúng hướng, không xoay về đối thủ)
          if (p.state !== "attack") p.facing = p._faceWant;

          // XOÁ PHÍM JUMP/BLOCK ĐỂ TRÁNH TRÙNG LẬP HÀNH ĐỘNG CỦA GAME GỐC
          intents.jump = false;
          intents.block = false;
        }

        // Đẩy nhau 2D
        this.separate();

        // Cập nhật hoạt ảnh/vật lý thông thường cho Luffy & Zoro
        this.luffy.update(dt, this.zoro, i1);
        this.zoro.update(dt, this.luffy, i2);

        // Giữ đúng làn sâu Z (Fighter.update kéo y về mặt đất)
        for (const p of [this.luffy, this.zoro]) {
          p.y = GROUND + p.z;
        }

        // KHÓA CAMERA KHI CÓ WAVE LÍNH ĐANG ĐẤU TẬP
        let activeLockX = -1;
        for (const w of this.waves) {
          if (!w.cleared) {
            const leadX = Math.max(this.luffy.x, this.zoro.x);
            if (leadX >= w.lockX - 100) {
              activeLockX = w.lockX;
              if (!w.spawned) {
                w.spawned = true;
                this.announce = { text: `ĐỢT LÍNH ${this.waves.indexOf(w) + 1}`, sub: "TIÊU DIỆT TOÀN BỘ!", t: 1500 };
                // Spawn lính thường
                for (let k = 0; k < w.recruits; k++) {
                  this.enemies.push(new Enemy(`rec_${this.waves.indexOf(w)}_${k}`, w.lockX + 150 + k * 60, "recruit"));
                }
                // Spawn Hải quân đại uý (Mini-boss)
                for (let k = 0; k < w.captains; k++) {
                  this.enemies.push(new Enemy(`capt_${this.waves.indexOf(w)}_${k}`, w.lockX + 320 + k * 80, "captain"));
                }
              }
            }
            break;
          }
        }

        // Camera thong thả bám theo trung bình cộng 2 người chơi
        const avgPlayerX = (this.luffy.x + this.zoro.x) / 2;
        let targetCamX = avgPlayerX - W / 2;

        if (activeLockX !== -1) {
          targetCamX = clamp(targetCamX, 0, activeLockX - W / 2 - 20);
          
          // Giới hạn người chơi không bứt phá quá ranh giới khoá wave lính
          this.luffy.x = clamp(this.luffy.x, this.cameraX + 40, activeLockX - 20);
          this.zoro.x = clamp(this.zoro.x, this.cameraX + 40, activeLockX - 20);
          
          // Kiểm tra xem đã dọn dẹp sạch sẽ lính Hải Quân chưa
          const aliveEnemies = this.enemies.filter(e => e.state !== "ko");
          if (aliveEnemies.length === 0) {
            for (const w of this.waves) {
              if (!w.cleared) {
                w.cleared = true;
                this.announce = { text: "TIẾP TỤC ĐI ➔", sub: "TIẾN LÊN PHÍA TRƯỚC!", t: 1500 };
                break;
              }
            }
          }
        } else {
          this.luffy.x = clamp(this.luffy.x, this.cameraX + 40, this.stageWidth - 40);
          this.zoro.x = clamp(this.zoro.x, this.cameraX + 40, this.stageWidth - 40);
        }

        this.cameraX = clamp(targetCamX, 0, this.stageWidth - W);

        // Cập nhật tất cả quân lính Hải quân
        const alivePlayers = [this.luffy, this.zoro].filter(p => p.state !== "ko");
        for (const e of this.enemies) {
          if (alivePlayers.length > 0) {
            e.update(dt, alivePlayers);
          } else {
            e.vx = 0; e.state = "idle";
          }
        }

        // Dọn xác lính sau 2 giây ngã KO (animTime tính bằng GIÂY, không phải ms)
        this.enemies = this.enemies.filter(e => {
          if (e.state === "ko" && e.koTime !== undefined && e.animTime - e.koTime > 2) return false;
          if (e.state === "ko" && e.koTime === undefined) e.koTime = e.animTime;
          return true;
        });

        // ---- VA CHẠM CHIỀU SÂU Z (Lane Collision): Chỉ trúng đòn khi cùng làn Z chênh lệch nhỏ hơn 18px! ----
        for (const p of [this.luffy, this.zoro]) {
          const hb = p.getHitbox();
          if (hb && p.attack) {
            for (const e of this.enemies) {
              const sameLane = Math.abs(p.z - e.z) < 18;
              if (e.state !== "ko" && sameLane && !p.attack.hit.has(e) && rectsOverlap(hb, e.body)) {
                p.attack.hit.add(e);
                const d = p.attack.def;
                e.takeHit(d.dmg, d.knockback, d.launch, p.facing);
                p.gainMeter(d.meterGain || 0);
              }
            }
          }
        }

        // Cập nhật projectile chưởng & va chạm làn Z quân lính
        for (const p of this.projectiles) {
          p.update(dt);
          if (!p.dead) {
            for (const e of this.enemies) {
              const sameLane = Math.abs(p.owner.z - e.z) < 18; // Projectile thừa hưởng làn Z của chủ nhân bắn ra!
              if (e.state !== "ko" && sameLane && rectsOverlap(p.rect, e.body)) {
                const dir = Math.sign(p.vx) || e.facing * -1;
                e.takeHit(p.d.dmg, p.d.knockback, p.d.launch, dir);
                p.owner.gainMeter(6);
                p.dead = true;
                break;
              }
            }
          }
        }
        this.projectiles = this.projectiles.filter(p => !p.dead);

        // Cập nhật hiệu ứng hoa lửa spark
        for (const s of this.sparks) {
          if (s.kind === "ring" || s.kind === "lightning") { s.life -= dt * 1000; continue; }
          s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt * 1000;
        }
        this.sparks = this.sparks.filter(s => s.life > 0);

        // Thắng/thua vượt ải
        const playersDefeated = this.luffy.hp <= 0 && this.zoro.hp <= 0;
        const bossCleared = this.waves[this.waves.length - 1].cleared;

        if (playersDefeated || bossCleared) {
          this.state = "roundover";
          setTimeout(() => {
            this.state = "matchover";
            const rt = document.getElementById("resultTitle");
            const tx = document.getElementById("resultText");
            const btn = document.getElementById("resultBtn");

            if (bossCleared) {
              rt.textContent = "🏆 VƯỢT ẢI THÀNH CÔNG!";
              tx.innerHTML = `Chúc mừng! <b>Luffy👒 & Zoro⚔️</b> đã quét sạch toàn bộ Hải quân đại uý!<br>Cứu nguy sảnh Going Merry hoàn hảo!`;
              btn.textContent = "CHƠI LẠI";
            } else {
              rt.textContent = "☠️ BẠI TRẬN!";
              tx.innerHTML = `Toàn bộ thành viên băng Mũ Rơm đã kiệt sức trước đợt lính của tổng bộ Hải quân!`;
              btn.textContent = "THỬ LẠI";
            }
            this.show("result");
          }, 800);
        }
        return;
      }
      origUpdate.call(this, dt);
    };

    // Override Game.render để thực thi dọn dẹp bản đồ 2.5D dạt dải màu cuộn
    const origRender = Game.render;
    Game.render = function() {
      if (this.mode === "adventure" && this.state !== "menu") {
        ctx.save();
        
        // ------------------------------------------------------------ VẼ BẢN ĐỒ BIỂN & SÀN TÀU CUỘN THEO CAMERA
        ctx.save();
        ctx.translate(-this.cameraX, 0);
        
        // Nền trời hoàng hôn
        const sky = ctx.createLinearGradient(0,0,0,GROUND);
        sky.addColorStop(0,"#141f45");
        sky.addColorStop(0.45,"#253e85");
        sky.addColorStop(0.85,"#c26857");
        sky.addColorStop(1,"#e8a86a");
        ctx.fillStyle = sky;
        ctx.fillRect(this.cameraX, 0, W, GROUND + 40);

        // Sunbeams lấp lánh
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = "rgba(255, 230, 180, 0.04)";
        const sunX = this.cameraX + W * 0.5, sunY = GROUND - 40;
        for (let i = 0; i < 6; i++) {
          const angle = 0.22 + i * 0.52 + Math.sin(this.animT * 0.012) * 0.12;
          ctx.beginPath(); ctx.moveTo(sunX, sunY);
          ctx.arc(sunX, sunY, 450, angle - 0.14, angle + 0.14); ctx.closePath(); ctx.fill();
        }
        ctx.restore();

        ctx.fillStyle = "rgba(255,220,140,.92)";
        ctx.beginPath(); ctx.arc(sunX, sunY, 60, 0, Math.PI*2); ctx.fill();

        ctx.fillStyle = "#2274b4";
        ctx.fillRect(this.cameraX, GROUND - 70, W, 70); // Biển xanh

        // ---- SÀN ĐẤU BOONG TÀU GỖ GOING MERRY DÀI VÔ TẬN VẼ ĐỘ SÂU 2.5D CỰC RỘNG ----
        ctx.fillStyle = "#633816";
        ctx.fillRect(this.cameraX, GROUND - 50, W, H - (GROUND - 50)); // Mở rộng mặt gỗ lên phía sâu trên trần
        
        // Các lằn ván gỗ ngang dọc cuộn dài
        ctx.strokeStyle = "#49260c"; ctx.lineWidth = 2.5;
        for (let y = GROUND - 45; y < H; y += 18) {
          ctx.beginPath(); ctx.moveTo(this.cameraX, y); ctx.lineTo(this.cameraX + W, y); ctx.stroke();
        }
        // Đổ bóng tối nhạt cho phần Boong tàu sâu bên trong màn hình tạo chiều sâu 3D chân thực!
        const deepShadow = ctx.createLinearGradient(0, GROUND - 50, 0, H);
        deepShadow.addColorStop(0, "rgba(0, 0, 0, 0.42)");
        deepShadow.addColorStop(0.3, "rgba(0, 0, 0, 0.12)");
        deepShadow.addColorStop(0.7, "rgba(0, 0, 0, 0)");
        deepShadow.addColorStop(1, "rgba(0, 0, 0, 0.15)");
        ctx.fillStyle = deepShadow;
        ctx.fillRect(this.cameraX, GROUND - 50, W, H - (GROUND - 50));

        // Vẽ các khớp mối ván và đinh tán đồng gia cố
        ctx.strokeStyle = "#49260c"; ctx.lineWidth = 1.5;
        const startTile = Math.floor(this.cameraX / 110) * 110 - 110;
        for (let x = startTile; x < this.cameraX + W + 110; x += 110) {
          const offset = (Math.floor(x / 110) % 2) * 55;
          for (let y = GROUND - 45; y < H; y += 18) {
            ctx.beginPath(); ctx.moveTo(x + offset, y); ctx.lineTo(x + offset, y + 18); ctx.stroke();
            ctx.fillStyle = "#2c1505";
            ctx.beginPath(); ctx.arc(x + offset - 4, y + 9, 1.5, 0, Math.PI*2); ctx.arc(x + offset + 4, y + 9, 1.5, 0, Math.PI*2); ctx.fill();
          }
        }

        // Vẽ mốc báo hiệu làn wave lính dưới mặt sàn gỗ
        for (const w of this.waves) {
          if (!w.cleared) {
            ctx.fillStyle = "rgba(255, 100, 100, 0.12)";
            ctx.fillRect(w.lockX - 120, GROUND - 45, 240, H - (GROUND - 45));
            ctx.strokeStyle = "rgba(255, 100, 100, 0.3)"; ctx.lineWidth = 3;
            ctx.beginPath(); 
            ctx.moveTo(w.lockX - 120, GROUND - 45); ctx.lineTo(w.lockX - 120, H); 
            ctx.moveTo(w.lockX + 120, GROUND - 45); ctx.lineTo(w.lockX + 120, H); 
            ctx.stroke();
            ctx.fillStyle = "rgba(255, 255, 255, 0.55)"; ctx.font = "900 12px Arial"; ctx.textAlign = "center";
            ctx.fillText("HẢI QUÂN VƯỢT ẢI " + (this.waves.indexOf(w)+1), w.lockX, GROUND - 20);
          }
        }

        this.animT = (this.animT || 0) + 0.6;
        ctx.restore();

        // ------------------------------------------------------------ VẼ CÁC ĐỐI TƯỢNG PHẬP PHỒNG THEO CAMERA
        ctx.translate(-this.cameraX, 0);

        // ---- XẾP LỚP CHIỀU SÂU Z-SORTING (CỰC KỲ QUAN TRỌNG: Thể hiện đúng ai đứng trước, đứng sau che khuất nhau!) ----
        const drawQueue = [this.luffy, this.zoro, ...this.enemies];
        drawQueue.sort((a, b) => (a.z || 0) - (b.z || 0)); // Sắp xếp thứ tự Z tăng dần (từ sâu trong màn hình ra ngoài)

        // Vẽ theo thứ tự lớp Z đã sắp xếp! (Enemy.draw cần ctx; Fighter.draw bỏ qua tham số)
        for (const obj of drawQueue) {
          obj.draw(ctx);
        }

        // Vẽ projectile đạn
        for (const p of this.projectiles) p.draw();

        // Vẽ các tia sét, khói bụi spark hạt nộ
        this.drawSparks();

        ctx.restore();

        // ------------------------------------------------------------ HIỆU ỨNG CHỚP LÓE TRƯỚC SÀN CAMERA
        if (this.flashScreen > 0) {
          ctx.fillStyle = `rgba(255,255,255,${clamp(this.flashScreen, 0, 1) * 0.45})`;
          ctx.fillRect(0, 0, W, H);
        }

        // Vẽ HUD thanh HP/Haki cố định trên màn hình
        this.drawHUD();
        this.drawCombos();
        this.drawAnnounce();
        return;
      }
      origRender.call(this);
    };
  }
})();
