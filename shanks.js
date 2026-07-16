/**
 * Shanks - Character Skills & Drawing Engine (Tóc Đỏ Shanks)
 * Fully modular extension with custom Kamusari (Divine Departure) red-black slash projectile, Haki Wave, and a massive Conqueror's Haki Storm on impact!
 */
(() => {
  "use strict";

  window.ShanksInit = (Fighter, MOVES) => {
    // ---------------------------------------------------------------- Move Set
    MOVES.shanks = {
      // 1. Cận chiến: chém kiếm Gryphon
      close: { key:"close", name:"Gryphon Strike", type:"melee",
        dmg:9, startup:58, active:100, recovery:165,
        reach:{dx:34,dy:-66,w:74,h:58}, knockback:220, launch:-30, meterGain:9,
        sfx:"slash", color:"#ffd700" },
      // 2. Tầm xa: lưỡi kiếm khí bọc Haki
      ranged: { key:"ranged", name:"Kiếm Khí Haki", type:"projectile",
        dmg:12, startup:120, active:0, recovery:270, meterGain:11,
        sfx:"slash",
        proj:{ kind:"haki_wave", speed:640, w:48, h:88, dmg:12, knockback:300, launch:-70, life:2000, color:"#c77bff" } },
      // 3. ↓+skill (miễn phí): Bá Vương Sắc áp chế quanh mình
      haoshoku: { key:"haoshoku", name:"Haoshoku: Áp Chế", type:"melee",
        dmg:14, startup:240, active:220, recovery:280, meterGain:14,
        reach:{dx:-95,dy:-165,w:215,h:195}, knockback:400, launch:-90,
        sfx:"special", color:"#a020f0" },
      // 4. SIÊU CHIÊU 1: nhát chém thần thánh đỏ-đen
      special: { key:"special", name:"Kamusari — Divine Departure", type:"projectile",
        dmg:24, startup:210, active:0, recovery:420, meterCost:50, meterGain:0,
        sfx:"special", cry:"Kamusari!",
        proj:{ kind:"kamusari", speed:740, w:120, h:70, dmg:24, knockback:540, launch:-200, life:1600, color:"#e60000" } },
      // 5. SIÊU CHIÊU 2 (↓+skill khi full Haki): bão Bá Vương Sắc GIÃ LIÊN TỤC diện rộng
      storm: { key:"storm", name:"Bá Vương Sắc: Bão Chinh Phục", type:"melee",
        dmg:9, startup:330, active:560, recovery:380, meterCost:100, meterGain:0,
        multiHit: 130,                               // giã ~5 nhịp trong vùng bão
        reach:{dx:-150,dy:-215,w:330,h:255}, knockback:170, launch:-55,
        sfx:"special", cry:"Haoshoku Haki!", color:"#8a2be2" },
      // 6. SIÊU CHIÊU 3 (↓+xa): quạt kiếm khí Haki chém toả ra nhiều hướng
      hakoku: { key:"hakoku", name:"Hakoku Sovereignty — Bá Quốc", type:"projectile",
        dmg:7, startup:220, active:0, recovery:400, meterCost:50, meterGain:0,
        sfx:"slash", cry:"Hakoku Sovereignty!",
        spread: { count: 7, arcDeg: 80, dmg: 7, speed: 640 },
        proj:{ kind:"haki_wave", speed:640, w:48, h:88, dmg:7, knockback:210, launch:-55, life:1500, color:"#c77bff" } },
    };

    // Helper draw round rect
    const roundRect = (ctx, x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x+r, y);
      ctx.arcTo(x+w, y, x+w, y+h, r);
      ctx.arcTo(x+w, y+h, x, y+h, r);
      ctx.arcTo(x, y+h, x, y, r);
      ctx.arcTo(x, y, x+w, y, r);
      ctx.closePath();
    };

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    // ---------------------------------------------------------------- Main Draw Shanks Method
    Fighter.prototype.drawShanks = function(flash) {
      const swing = this.armSwing();
      const legs = this.legPose();
      const bob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 2.5 : (this.state === "walk" ? Math.abs(Math.sin(this.walkPhase)) * 3.5 : 0);
      const skin    = flash ? "#ffc2ad" : "#f6cfa4";
      const skinSh  = flash ? "#f0a48f" : "#e0ac7f";
      // HAOSHOKU (biến hình): Haki Bá Vương đỏ đen phủ kín áo choàng
      const hao = this.formed;
      const cloakCol = hao ? (flash ? "#6a1020" : "#1a0308") : (flash ? "#3a3d47" : "#121216"); // Áo choàng đen khoác hờ sau vai
      const shirtCol = hao ? (flash ? "#ffd0d0" : "#e8bcbc") : (flash ? "#ffffff" : "#f2f2f0"); // Áo sơ mi trắng phanh ngực

      const ctx = document.getElementById("game").getContext("2d");

      ctx.save();
      ctx.translate(0, -bob);
      ctx.lineJoin = "round"; ctx.lineCap = "round";

      // ---- ÁO CHOÀNG ĐEN PHÍA SAU LƯNG (Khoác vai dũng mãnh bốc hơi Haki) ----
      ctx.fillStyle = cloakCol;
      ctx.beginPath();
      ctx.moveTo(-16, -104);
      ctx.quadraticCurveTo(-26, -70, -22, -25);
      ctx.quadraticCurveTo(-15, -15, -6, -25);
      ctx.quadraticCurveTo(-12, -70, -10, -104);
      ctx.closePath(); ctx.fill();

      this.drawBackArm(skin, skinSh);

      // ---- ĐÔI CHÂN QUẦN NÂU CÓ HOA VĂN ----
      const pantsCol = flash ? "#dfb0a0" : "#b08560";
      // Chân sau (Trái)
      const kneeL = -6 + Math.sin(legs.a) * 16;
      const footL = kneeL + Math.sin(legs.a) * 8 + 4;
      ctx.strokeStyle = "#805c38"; ctx.lineWidth = 15;
      ctx.beginPath(); ctx.moveTo(-6, -52); ctx.lineTo(kneeL, -28); ctx.stroke();
      ctx.strokeStyle = "#805c38"; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(kneeL, -27); ctx.lineTo(footL, -10); ctx.stroke();
      ctx.fillStyle = "#1e1f26"; roundRect(ctx, footL - 7, -11, 22, 9, 4); ctx.fill();

      // Chân trước (Phải)
      const kneeR = 6 + Math.sin(legs.b) * 16;
      const footR = kneeR + Math.sin(legs.b) * 8 + 4;
      ctx.strokeStyle = pantsCol; ctx.lineWidth = 15;
      ctx.beginPath(); ctx.moveTo(6, -52); ctx.lineTo(kneeR, -28); ctx.stroke();
      ctx.strokeStyle = pantsCol; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(kneeR, -27); ctx.lineTo(footR, -10); ctx.stroke();
      ctx.fillStyle = "#262830"; roundRect(ctx, footR - 7, -11, 22, 9, 4); ctx.fill();

      // ---- ÁO SƠ MI TRẮNG PHANH NGỰC DŨNG MÃNH ----
      ctx.fillStyle = shirtCol;
      ctx.beginPath();
      ctx.moveTo(-13, -105); ctx.quadraticCurveTo(0, -108, 13, -105);
      ctx.lineTo(10, -56); ctx.quadraticCurveTo(0, -53, -10, -56);
      ctx.closePath(); ctx.fill();

      // Ngực trần để lộ cơ bắp dũng mãnh và sẹo mờ
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.moveTo(-6, -105); ctx.lineTo(6, -105); ctx.lineTo(0, -78); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(100,50,40,0.25)"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-6, -105); ctx.lineTo(0, -78); ctx.lineTo(6, -105); ctx.stroke();

      // ---- ĐẦU SHANKS (Tóc đỏ rực rỡ dũng mãnh & 3 sẹo mắt trái) ----
      this.drawHeadShanks(skin, skinSh, flash);

      // ---- TAY PHẢI VUNG KIẾM GRYPHON HOÀNH TRÁNG ----
      this.drawFrontArmShanks(swing, skin, skinSh, flash);

      // ---- BÁ VƯƠNG SẮC: bão Haki tím-đen khi tung Áp Chế / Bão Chinh Phục ----
      const hk = this.state === "attack" && this.attack && (this.attack.def.key === "haoshoku" || this.attack.def.key === "storm");
      if (hk) {
        const big = this.attack.def.key === "storm";
        const d = this.attack.def;
        const p = clamp(this.attack.elapsed / (d.startup + d.active), 0, 1);
        const R = (big ? 200 : 120) * (0.25 + p * 0.75);
        const a = this.animTime * 9;
        ctx.save();
        ctx.scale(this.facing, 1);            // huỷ lật để bão đối xứng quanh người
        ctx.translate(0, -70);
        ctx.globalCompositeOperation = "screen";
        // quầng tím lan toả
        const g = ctx.createRadialGradient(0, 0, 8, 0, 0, R);
        g.addColorStop(0, `rgba(190,120,255,${0.5 * (1 - p * 0.4)})`);
        g.addColorStop(0.5, `rgba(120,0,190,${0.32 * (1 - p * 0.4)})`);
        g.addColorStop(1, "rgba(60,0,110,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
        // vòng xung kích nở
        ctx.strokeStyle = `rgba(220,180,255,${0.8 * (1 - p)})`;
        ctx.lineWidth = big ? 7 : 4;
        ctx.beginPath(); ctx.arc(0, 0, R * 0.92, 0, Math.PI * 2); ctx.stroke();
        // tia sét Haki đen-tím toả ra
        const bolts = big ? 10 : 6;
        for (let i = 0; i < bolts; i++) {
          const ang = (i / bolts) * Math.PI * 2 + a * 0.15;
          ctx.strokeStyle = i % 2 ? "rgba(35,0,60,0.85)" : "rgba(215,170,255,0.9)";
          ctx.lineWidth = i % 2 ? 4 : 2.4;
          ctx.beginPath();
          let px = Math.cos(ang) * 12, py = Math.sin(ang) * 12;
          ctx.moveTo(px, py);
          for (let s = 1; s <= 4; s++) {
            const rr = 12 + (R - 12) * (s / 4);
            const jt = Math.sin(a + i * 2 + s) * 12;
            ctx.lineTo(Math.cos(ang) * rr - Math.sin(ang) * jt, Math.sin(ang) * rr + Math.cos(ang) * jt);
          }
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.restore();
    };

    // ---------------------------------------------------------------- Head Shanks
    Fighter.prototype.drawHeadShanks = function(skin, skinSh, flash) {
      const ctx = document.getElementById("game").getContext("2d");
      const headBob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 0.8 : 0;
      ctx.save();
      ctx.translate(0, headBob);

      // Cổ thon cao
      ctx.fillStyle = skinSh; roundRect(ctx, -3, -112, 6, 11, 2); ctx.fill();
      
      // Mặt thon nhỏ dũng mãnh dứt khoát
      const fg = ctx.createLinearGradient(-11, -132, 11, -110);
      fg.addColorStop(0, skin); fg.addColorStop(1, skinSh);
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(0, -121, 12, 0, Math.PI * 2); ctx.fill();
      
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(-11, -120, 2.5, 0, Math.PI * 2); ctx.fill();

      // Mái tóc đỏ rực rỡ lãng tử bờ vai
      const hairCol = flash ? "#ff6b6b" : "#cf2a2a";
      const hairSh  = "#901010";
      ctx.fillStyle = hairCol;
      ctx.beginPath();
      ctx.arc(0, -121, 12, Math.PI * 1.03, Math.PI * 1.97);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-13, -122);
      ctx.lineTo(-11, -134); ctx.lineTo(-6, -125);
      ctx.lineTo(-2, -137); ctx.lineTo(2, -125);
      ctx.lineTo(6, -134); ctx.lineTo(10, -124);
      ctx.lineTo(12, -122);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = hairSh;
      ctx.beginPath(); ctx.moveTo(-2, -137); ctx.lineTo(2, -125); ctx.lineTo(-1, -126); ctx.closePath(); ctx.fill();

      // Râu quai nón mờ rậm rạp cực ngầu của Tứ Hoàng
      ctx.strokeStyle = "rgba(40,30,20,0.3)"; ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-5, -111); ctx.lineTo(5, -111);
      ctx.moveTo(-6, -114); ctx.lineTo(-2, -110);
      ctx.moveTo(6, -114); ctx.lineTo(2, -110);
      ctx.stroke();

      // Vẽ chiếc mũi kiểu anime
      ctx.strokeStyle = skinSh; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(1, -117); ctx.lineTo(3, -116); ctx.stroke();

      // BIỂU CẢM GƯƠNG MẶT
      if (this.state === "hurt") {
        ctx.strokeStyle = "#15151c"; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(2.5, -122); ctx.lineTo(8.5, -118); ctx.stroke();
        ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#15151c"; ctx.lineWidth = 1.6;
        roundRect(ctx, 2, -114, 8, 4.5, 1.5); ctx.fill(); ctx.stroke();
      } else if (this.state === "ko") {
        ctx.strokeStyle = "#15151c"; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(2.5, -120); ctx.lineTo(8.5, -120);
        ctx.stroke();
        ctx.fillStyle = "#330a0a";
        ctx.beginPath(); ctx.ellipse(5, -112, 2.5, 1.8, 0, 0, Math.PI*2); ctx.fill();
      } else {
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.ellipse(5, -120, 2.8, 3.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#15151c";
        ctx.beginPath(); ctx.arc(5.6, -120, 1.6, 0, Math.PI * 2); ctx.fill();

        ctx.strokeStyle = "#20242b"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(1.5, -126); ctx.lineTo(9.5, -125); ctx.stroke();
        ctx.strokeStyle = "#6a2626"; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(2, -113); ctx.lineTo(9, -113); ctx.stroke();
      }

      // ---- 3 VẾT SẸO HUYỀN THOẠI TRÊN MẮT TRÁI (Bên phải theo hướng vẽ) ----
      ctx.strokeStyle = "#a30e0e"; ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(4, -125); ctx.lineTo(4, -116);
      ctx.moveTo(5.5, -125); ctx.lineTo(5.5, -116);
      ctx.moveTo(7, -125); ctx.lineTo(7, -116);
      ctx.stroke();

      ctx.restore();
    };

    // ---------------------------------------------------------------- Front Arm Shanks
    Fighter.prototype.drawFrontArmShanks = function(swing, skin, skinSh, flash) {
      const ctx = document.getElementById("game").getContext("2d");
      const attacking = this.state === "attack" && this.attack;
      const ang = attacking ? (-1.2 + swing * 2.2) : -0.35;
      const y = -86;
      ctx.save();
      ctx.translate(11, -93);
      ctx.rotate(ang);
      
      // cánh tay thon dài cơ bắp
      ctx.strokeStyle = skin; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(12, 3); ctx.lineTo(24, 3); ctx.stroke();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(24, 3, 5, 0, Math.PI * 2); ctx.fill();

      // ---- KIẾM GRYPHON HUYỀN THOẠI ----
      ctx.translate(24, 3);
      ctx.strokeStyle = "#604010"; ctx.lineWidth = 5.5; // Chuôi kiếm bằng gỗ sẫm màu
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
      ctx.fillStyle = "#ffd700"; ctx.fillRect(6, -4, 4, 8); // Tsuba vàng lấp lánh bảo vệ
      
      const bg = ctx.createLinearGradient(10, 0, 72, 0);
      bg.addColorStop(0, "#cbd3e0"); bg.addColorStop(0.5, "#ffffff"); bg.addColorStop(1, "#cfdae4");
      
      if (attacking) {
        // Haki Bá Vương rực sắc đỏ đen giận dữ bao quanh kiếm!
        ctx.shadowColor = "#ff1a1a";
        ctx.shadowBlur = 13;
      }
      ctx.strokeStyle = bg; ctx.lineWidth = 5.2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(10, -1); ctx.lineTo(72, -3); ctx.stroke();
      ctx.shadowBlur = 0;
      
      // Sống kiếm sẫm màu
      ctx.strokeStyle = "rgba(100,110,120,.55)"; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(10, -2.5); ctx.lineTo(70, -4.5); ctx.stroke();
      
      // Vệt chém bán nguyệt rực lửa chém Haki Bá Vương đỏ đen cực mạnh!
      if (attacking && this.attack.def.type === "melee" && this.attack.phase !== "startup") {
        ctx.strokeStyle = "rgba(230, 20, 20, 0.65)"; ctx.lineWidth = 17;
        ctx.beginPath(); ctx.arc(-6, 0, 62, -0.9, 0.9); ctx.stroke();
        
        ctx.strokeStyle = "rgba(0, 0, 0, 0.85)"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(-6, 0, 62, -0.7, 0.7); ctx.stroke();
      }
      ctx.restore();
    };
  };

  // ---------------------------------------------------------------- HOOK INTO GAME MANAGER
  // shanks.js nạp TRƯỚC game.js -> game.js sẽ gọi hook này khi Game/Projectile sẵn sàng.
  window.ShanksHook = (Game) => {
    {

    // 1. Hook/Override Projectile.prototype.draw để vẽ đạn Haki Bá Vương & Kamusari chém ngang cực kỳ ngầu!
    const origProjDraw = Game.Projectile.prototype.draw;
    Game.Projectile.prototype.draw = function() {
      const { kind, color } = this.d;
      const ctx = document.getElementById("game").getContext("2d");
      
      if (kind === "haki_wave") {
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.dir < 0) ctx.scale(-1, 1);
        
        // Chưởng lực Haki Bá Vương: dải chớp đỏ đen hỗn loạn cuộn trào rộng lớn
        const waveGrd = ctx.createLinearGradient(-30, 0, 30, 0);
        waveGrd.addColorStop(0, "rgba(230, 0, 0, 0)");
        waveGrd.addColorStop(0.5, "#ff0000");
        waveGrd.addColorStop(1, "#121216");
        
        ctx.strokeStyle = waveGrd;
        ctx.lineWidth = 14;
        ctx.lineCap = "round";
        ctx.shadowColor = "#ff0000";
        ctx.shadowBlur = 10;
        
        // Vẽ sóng chớp giật xéo dọc
        ctx.beginPath();
        ctx.moveTo(-15, -35);
        ctx.quadraticCurveTo(15, -10, -5, 10);
        ctx.quadraticCurveTo(20, 30, 0, 45);
        ctx.stroke();

        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-13, -30);
        ctx.quadraticCurveTo(13, -8, -4, 8);
        ctx.quadraticCurveTo(17, 27, -1, 38);
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.restore();
        return;
      }

      if (kind === "kamusari") {
        // ---- KAMUSARI (THẦN TRÁNH): nhát chém chéo đỏ đen xé toạc màn hình ----
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.dir < 0) ctx.scale(-1, 1);

        ctx.rotate(-0.15); // Góc nghiêng dứt khoát
        
        // Cung chém rực sắc đỏ đen tà ác
        ctx.strokeStyle = "rgba(0, 0, 0, 0.95)";
        ctx.lineWidth = 18;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(-20, 0, 48, -Math.PI * 0.42, Math.PI * 0.42);
        ctx.stroke();

        ctx.strokeStyle = "#ff0000";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(-16, 0, 47, -Math.PI * 0.38, Math.PI * 0.38);
        ctx.stroke();

        // Lõi chém trắng nhức nhối cực nét
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(-12, 0, 46, -Math.PI * 0.32, Math.PI * 0.32);
        ctx.stroke();

        // 3 tia sét Haki đỏ đen giật toé ra từ tâm chém Kamusari
        ctx.strokeStyle = "#ff1a1a"; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(15, -10); ctx.lineTo(35, -28); ctx.lineTo(48, -25);
        ctx.moveTo(25, 5); ctx.lineTo(52, 12); ctx.lineTo(65, 5);
        ctx.moveTo(10, 18); ctx.lineTo(28, 38); ctx.lineTo(40, 36);
        ctx.stroke();

        ctx.restore();
        return;
      }
      origProjDraw.call(this);
    };

    // 2. Định nghĩa bão sét Haki Bá Vương đỏ đen khổng lồ rầm trời khi tuyệt chiêu Kamusari kết nối!
    Game.addHakiStorm = function(x, y) {
      // Vòng tròn xung kích đen tuyền viền đỏ rộng lớn
      this.sparks.push({
        kind: "ring",
        x, y,
        vx: 0, vy: 0,
        life: 420, life0: 420,
        r: 10, rMax: 145,
        color: "#111116"
      });
      this.sparks.push({
        kind: "ring",
        x, y,
        vx: 0, vy: 0,
        life: 350, life0: 350,
        r: 10, rMax: 125,
        color: "#ff1a1a"
      });

      // Tạo 12 tia sét Haki đỏ đen khổng lồ đan xen chằng chịt nện xuống sàn boong tàu!
      const generateJaggedLine = (x1, y1, x2, y2, segments = 3, offset = 6) => {
        const pts = [];
        const dx = x2 - x1;
        const dy = y2 - y1;
        for (let i = 1; i < segments; i++) {
          const t = i / segments;
          const px = x1 + dx * t + (Math.random() * 2 - 1) * offset;
          const py = y1 + dy * t + (Math.random() * 2 - 1) * offset;
          pts.push({ x: px, y: py });
        }
        pts.push({ x: x2, y: y2 });
        return pts;
      };

      for (let i = 0; i < 12; i++) {
        const tx = x + (Math.random() * 120 - 60);
        const ty = y + (Math.random() * 120 - 60);
        this.sparks.push({
          kind: "lightning",
          x: tx,
          y: ty,
          points: generateJaggedLine(0, 0, Math.random() * 100 - 50, Math.random() * -100 - 30),
          life: 300, life0: 300,
          color1: Math.random() < 0.55 ? "#ff1a1a" : "#000000",
          color2: "#ff0000",
          width: 3.5 + Math.random() * 2.5
        });
      }
    };
    }
  };
})();
