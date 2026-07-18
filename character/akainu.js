/**
 * Akainu (Sakazuki) — Character Skills & Drawing Engine (Đô Đốc Dung Nham · Magu Magu no Mi)
 * Bộ 6 ô chiêu: Đấm Dung Nham (cận), Meigō (↓+cận), Nham Thạch Đạn (xa),
 * Ryūsei Kazan (↓+xa — mưa thiên thạch), Dai Funka (siêu chiêu 1) và Inugami Guren (siêu chiêu 2 — chó lửa khổng lồ).
 */
(() => {
  "use strict";

  window.AkainuInit = (Fighter, MOVES) => {
    // ---------------------------------------------------------------- Move Set
    MOVES.akainu = {
      close: { key:"close", name:"Đấm Dung Nham", type:"melee",
        dmg:9, startup:70, active:100, recovery:180,
        reach:{dx:34,dy:-64,w:70,h:52}, knockback:230, launch:-30, meterGain:9,
        sfx:"punch", color:"#ff3300" },
      // ↓+cận (miễn phí): quả đấm hoá đầu chó dung nham đớp thẳng vào mặt
      meigo: { key:"meigo", name:"Meigō — Minh Cẩu", type:"melee",
        dmg:17, startup:220, active:210, recovery:280,
        reach:{dx:14,dy:-118,w:170,h:118}, knockback:350, launch:-75, meterGain:14,
        sfx:"punch", color:"#e03a00" },
      ranged: { key:"ranged", name:"Nham Thạch Đạn", type:"projectile",
        dmg:14, startup:130, active:0, recovery:270, meterGain:12,
        sfx:"punch",
        proj:{ kind:"magma_ball", speed:600, w:62, h:62, dmg:14, knockback:290, launch:-70, life:1400, color:"#ff3300" } },
      // ↓+xa: mưa thiên thạch dung nham · FULL Haki -> SIÊU CHIÊU 3 nổ vòng 360°
      ryusei: { key:"ryusei", name:"Ryūsei Kazan — Mưa Thiên Thạch", type:"projectile",
        dmg:7, startup:220, active:0, recovery:400, meterCost:50, meterGain:0,
        sfx:"punch", cry:"Ryusei Kazan!",
        spread: { count: 7, arcDeg: 84, dmg: 7, speed: 600 },
        proj:{ kind:"meteor", speed:600, w:52, h:52, dmg:7, knockback:180, launch:-50, life:1500, color:"#ff3300" } },
      // skill (50 Haki) -> SIÊU CHIÊU 1: nắm đấm dung nham khổng lồ phun trào
      special: { key:"special", name:"Dai Funka — Đại Phún Hoả", type:"projectile",
        dmg:24, startup:240, active:0, recovery:430, meterCost:50, meterGain:0,
        sfx:"special", cry:"Dai Funka!",
        proj:{ kind:"funka", speed:620, w:130, h:110, dmg:24, knockback:540, launch:-190, life:2200, color:"#ff2a00" } },
      // ↓+skill (100 Haki) -> SIÊU CHIÊU 2: chó ngao dung nham khổng lồ lao tới ngoạm
      inugami: { key:"inugami", name:"Inugami Guren — Khuyển Thần Hồng Liên", type:"projectile",
        dmg:27, startup:350, active:0, recovery:480, meterCost:100, meterGain:0,
        sfx:"special", cry:"Inugami Guren!",
        proj:{ kind:"magma_hound", speed:500, w:200, h:140, dmg:27, knockback:640, launch:-210, life:2800, color:"#e03a00" } },
    };

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

    // ---------------------------------------------------------------- Main Draw Akainu
    Fighter.prototype.drawAkainu = function(flash) {
      const swing = this.armSwing();
      const legs = this.legPose();
      const bob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 2.5 : (this.state === "walk" ? Math.abs(Math.sin(this.walkPhase)) * 3.5 : 0);
      // MAGU MAGU (biến hình): da hoá nham thạch đen sì, khe nứt đỏ rực
      const lava = this.formed;
      const skin   = lava ? (flash ? "#ff8a3a" : "#4a1e12") : (flash ? "#ffc2ad" : "#e8b78d");
      const skinSh = lava ? (flash ? "#ff5a20" : "#2a0e08") : (flash ? "#f0a48f" : "#c9925f");
      const suit   = flash ? "#6a3030" : "#3a1414";   // Bộ vest đỏ sẫm
      const coat   = flash ? "#ffffff" : "#eceff3";   // Áo choàng Hải Quân khoác vai

      const ctx = document.getElementById("game").getContext("2d");
      const attacking = this.state === "attack" && this.attack;
      const atkKey = attacking ? this.attack.def.key : null;
      const isMagma = this.formed || this.meter >= 100 || atkKey === "special" || atkKey === "inugami" || atkKey === "meigo" || atkKey === "ryusei";

      ctx.save();
      ctx.translate(0, -bob);
      ctx.lineJoin = "round"; ctx.lineCap = "round";

      // ---- HƠI NÓNG & TÀN TRO BỐC LÊN, MẶT ĐẤT NỨT ĐỎ ----
      if (isMagma) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const anim = this.animTime * 8;
        for (let i = 0; i < 7; i++) {
          const fy = -((anim * 14 + i * 20) % 130);
          const fx = Math.sin(anim * 0.3 + i * 1.8) * 24;
          const r = 4 + Math.sin(anim * 0.25 + i) * 2.6;
          const op = clamp(0.45 * (1 + fy / 130), 0, 0.5);
          ctx.fillStyle = i % 3 === 0 ? `rgba(255, 60, 0, ${op})` : `rgba(120, 40, 30, ${op * 0.9})`;
          ctx.beginPath(); ctx.arc(fx, fy, r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        // vũng dung nham đỏ rực dưới chân
        const pool = ctx.createRadialGradient(0, -4, 2, 0, -4, 40);
        pool.addColorStop(0, "rgba(255, 90, 0, 0.55)");
        pool.addColorStop(1, "rgba(255, 40, 0, 0)");
        ctx.fillStyle = pool;
        ctx.beginPath(); ctx.ellipse(0, -4, 40, 9, 0, 0, Math.PI * 2); ctx.fill();
      }

      // ---- ÁO CHOÀNG HẢI QUÂN KHOÁC HỜ SAU LƯNG ----
      ctx.fillStyle = coat;
      ctx.beginPath();
      ctx.moveTo(-16, -108);
      ctx.quadraticCurveTo(-30, -70, -25, -22);
      ctx.quadraticCurveTo(-15, -12, -6, -24);
      ctx.quadraticCurveTo(-13, -70, -10, -108);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#b22222"; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(-25, -24); ctx.quadraticCurveTo(-15, -14, -6, -25); ctx.stroke();

      this.drawBackArm(skin, skinSh);

      // ---- ĐÔI CHÂN TO KHOẺ, QUẦN VEST ĐỎ SẪM ----
      const kneeL = -7 + Math.sin(legs.a) * 16;
      const footL = kneeL + Math.sin(legs.a) * 8 + 4;
      ctx.strokeStyle = "#2a0e0e"; ctx.lineWidth = 17;
      ctx.beginPath(); ctx.moveTo(-7, -52); ctx.lineTo(kneeL, -28); ctx.stroke();
      ctx.lineWidth = 14;
      ctx.beginPath(); ctx.moveTo(kneeL, -27); ctx.lineTo(footL, -11); ctx.stroke();
      ctx.fillStyle = "#141418"; roundRect(ctx, footL - 8, -12, 24, 10, 4); ctx.fill();

      const kneeR = 7 + Math.sin(legs.b) * 16;
      const footR = kneeR + Math.sin(legs.b) * 8 + 4;
      const legGrd = ctx.createLinearGradient(7, -52, footR, -11);
      legGrd.addColorStop(0, suit);
      legGrd.addColorStop(1, isMagma ? "#ff4500" : suit);
      ctx.strokeStyle = legGrd; ctx.lineWidth = 17;
      ctx.beginPath(); ctx.moveTo(7, -52); ctx.lineTo(kneeR, -28); ctx.stroke();
      ctx.lineWidth = 14;
      ctx.beginPath(); ctx.moveTo(kneeR, -27); ctx.lineTo(footR, -11); ctx.stroke();
      ctx.fillStyle = isMagma ? "#ff6a00" : "#1a1a1f";
      roundRect(ctx, footR - 8, -12, 24, 10, 4); ctx.fill();

      // ---- THÂN HÌNH ĐỒ SỘ: VEST ĐỎ SẪM + SƠ MI + CÀ VẠT ----
      ctx.fillStyle = suit;
      ctx.beginPath();
      ctx.moveTo(-17, -107); ctx.quadraticCurveTo(0, -111, 17, -107);
      ctx.lineTo(12, -55); ctx.quadraticCurveTo(0, -52, -12, -55);
      ctx.closePath(); ctx.fill();
      // sơ mi hồng nhạt + cà vạt sẫm
      ctx.fillStyle = flash ? "#ffffff" : "#e8d7cf";
      ctx.beginPath(); ctx.moveTo(-6, -107); ctx.lineTo(6, -107); ctx.lineTo(3, -66); ctx.lineTo(-3, -66); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#5a1010"; ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.moveTo(0, -104); ctx.lineTo(0.5, -74); ctx.stroke();

      // Vết nứt dung nham đỏ rực chạy trên thân khi hoá Logia
      if (isMagma) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "rgba(255, 90, 0, 0.75)"; ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-12, -100); ctx.lineTo(-6, -88); ctx.lineTo(-11, -76); ctx.lineTo(-5, -64);
        ctx.moveTo(13, -98); ctx.lineTo(7, -86); ctx.lineTo(12, -72);
        ctx.stroke();
        ctx.restore();
      }

      // ---- ĐẦU AKAINU (tóc đen chải ngược, râu quai nón rậm, mũ Hải Quân) ----
      this.drawHeadAkainu(skin, skinSh, flash, isMagma);

      // ---- TAY TRƯỚC: NẮM ĐẤM DUNG NHAM / ĐẦU CHÓ MINH CẨU ----
      this.drawFrontArmAkainu(swing, skin, skinSh, isMagma, atkKey);

      ctx.restore();
    };

    // ---------------------------------------------------------------- Head Akainu
    Fighter.prototype.drawHeadAkainu = function(skin, skinSh, flash, isMagma) {
      const ctx = document.getElementById("game").getContext("2d");
      const headBob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 0.8 : 0;
      ctx.save();
      ctx.translate(0, headBob);

      // Cổ bạnh vạm vỡ
      ctx.fillStyle = skinSh; roundRect(ctx, -5, -111, 10, 10, 2); ctx.fill();

      // Mặt vuông chữ điền bặm trợn
      const fg = ctx.createLinearGradient(-12, -132, 12, -110);
      fg.addColorStop(0, skin); fg.addColorStop(1, skinSh);
      ctx.fillStyle = fg;
      roundRect(ctx, -12, -133, 24, 25, 8); ctx.fill();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(-12, -120, 2.5, 0, Math.PI * 2); ctx.fill();

      // Tóc đen chải ngược sát đầu
      ctx.fillStyle = flash ? "#4a4a58" : "#14141a";
      ctx.beginPath();
      ctx.moveTo(-12, -126);
      ctx.quadraticCurveTo(-13, -136, 0, -137);
      ctx.quadraticCurveTo(13, -136, 12, -126);
      ctx.quadraticCurveTo(4, -131, -12, -126);
      ctx.closePath(); ctx.fill();

      // Râu quai nón rậm rịt phủ kín cằm
      ctx.fillStyle = "rgba(20, 20, 26, 0.5)";
      ctx.beginPath();
      ctx.moveTo(-11, -117);
      ctx.quadraticCurveTo(-12, -106, 0, -105);
      ctx.quadraticCurveTo(12, -106, 11, -117);
      ctx.quadraticCurveTo(6, -112, 0, -113);
      ctx.quadraticCurveTo(-6, -112, -11, -117);
      ctx.closePath(); ctx.fill();

      // BIỂU CẢM: luôn cau có dữ tợn
      if (this.state === "hurt") {
        ctx.strokeStyle = "#15151c"; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(2, -123); ctx.lineTo(9, -119); ctx.stroke();
        ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#15151c"; ctx.lineWidth = 1.6;
        roundRect(ctx, 2, -115, 8, 4.5, 1.5); ctx.fill(); ctx.stroke();
      } else if (this.state === "ko") {
        ctx.strokeStyle = "#15151c"; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(2, -121); ctx.lineTo(9, -121); ctx.stroke();
        ctx.fillStyle = "#330a0a";
        ctx.beginPath(); ctx.ellipse(5, -112, 2.5, 1.8, 0, 0, Math.PI*2); ctx.fill();
      } else {
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.ellipse(5, -120, 2.6, 2.8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = isMagma ? "#ff3300" : "#20242b";
        ctx.beginPath(); ctx.arc(5.6, -120, 1.5, 0, Math.PI * 2); ctx.fill();
        // lông mày chau xuống hung tợn
        ctx.strokeStyle = "#14141a"; ctx.lineWidth = 2.8;
        ctx.beginPath(); ctx.moveTo(1, -127); ctx.lineTo(10, -123); ctx.stroke();
        // miệng mím chặt
        ctx.strokeStyle = "#6a3020"; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(1, -110); ctx.lineTo(9, -111); ctx.stroke();
      }

      ctx.strokeStyle = skinSh; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(1, -117); ctx.lineTo(3.5, -116); ctx.stroke();

      // ---- MŨ HẢI QUÂN CHÓP CAO ----
      ctx.save();
      ctx.translate(0, -134);
      ctx.fillStyle = flash ? "#ffffff" : "#e8ecf2";
      ctx.beginPath(); ctx.ellipse(2, 1, 16, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-9, 1); ctx.quadraticCurveTo(-10, -11, 0, -12);
      ctx.quadraticCurveTo(11, -11, 10, 1);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#1a2a4a"; ctx.fillRect(-9.4, -3, 19.4, 4);   // dải băng xanh
      ctx.fillStyle = "#d4a017";                                     // huy hiệu mỏ neo
      ctx.beginPath(); ctx.arc(1, -6, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      ctx.restore();
    };

    // ---------------------------------------------------------------- Front Arm Akainu
    Fighter.prototype.drawFrontArmAkainu = function(swing, skin, skinSh, isMagma, atkKey) {
      const ctx = document.getElementById("game").getContext("2d");
      const attacking = this.state === "attack" && this.attack;
      const active = attacking && this.attack.phase !== "startup";
      const isHound = atkKey === "meigo";
      const ang = attacking ? (-1.1 + swing * 1.95) : -0.28;

      ctx.save();
      ctx.translate(12, -96);
      ctx.rotate(ang);

      // Cánh tay lực lưỡng
      ctx.strokeStyle = skin; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(13, 3); ctx.lineTo(25, 3); ctx.stroke();

      if (isHound) {
        // ---- MEIGŌ: cả nắm đấm hoá thành ĐẦU CHÓ NGAO DUNG NHAM ----
        ctx.save();
        ctx.translate(25, 3);
        const sc = 1 + Math.max(0, swing) * 0.5;
        ctx.scale(sc, sc);
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createRadialGradient(10, 0, 3, 10, 0, 34);
        g.addColorStop(0, "rgba(255,150,0,0.9)"); g.addColorStop(0.5, "rgba(255,60,0,0.45)"); g.addColorStop(1, "rgba(200,20,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(10, 0, 34, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        // sọ chó
        const hg = ctx.createLinearGradient(0, -18, 0, 18);
        hg.addColorStop(0, "#ffb300"); hg.addColorStop(0.45, "#ff3300"); hg.addColorStop(1, "#8b1a00");
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.moveTo(-8, -14);
        ctx.quadraticCurveTo(18, -18, 30, -6);
        ctx.quadraticCurveTo(20, 0, 28, 8);
        ctx.quadraticCurveTo(14, 16, -8, 14);
        ctx.closePath(); ctx.fill();
        // tai dựng
        ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(-2, -26); ctx.lineTo(9, -15); ctx.closePath(); ctx.fill();
        // răng nanh
        ctx.fillStyle = "#fff3c4";
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(12 + i * 6, -5); ctx.lineTo(15 + i * 6, 4); ctx.lineTo(18 + i * 6, -5);
          ctx.closePath(); ctx.fill();
        }
        // mắt chó rực lửa
        ctx.fillStyle = "#ffe066";
        ctx.beginPath(); ctx.ellipse(6, -7, 3, 2, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        if (active) {
          ctx.save();
          ctx.translate(25, 3);
          ctx.strokeStyle = "rgba(255, 60, 0, 0.5)"; ctx.lineWidth = 16;
          ctx.beginPath(); ctx.arc(-10, 0, 56, -0.8, 0.8); ctx.stroke();
          ctx.restore();
        }
      } else {
        // ---- NẮM ĐẤM DUNG NHAM SÙNG SỤC ----
        if (isMagma) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          const anim = this.animTime * 16;
          for (let i = 0; i < 4; i++) {
            const r = 7 + Math.sin(anim * 0.5 + i * 1.4) * 3;
            ctx.fillStyle = i % 2 ? "rgba(255, 60, 0, 0.7)" : "rgba(255, 170, 30, 0.55)";
            ctx.beginPath();
            ctx.arc(25 + Math.cos(anim * 0.4 + i * 1.7) * 5, 3 + Math.sin(anim * 0.5 + i * 2) * 5, r, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
        const fg = ctx.createRadialGradient(23, 1, 1.5, 25, 3, 8);
        fg.addColorStop(0, isMagma ? "#ffe066" : skin);
        fg.addColorStop(1, isMagma ? "#ff3300" : skinSh);
        ctx.fillStyle = fg;
        ctx.beginPath(); ctx.arc(25, 3, 6.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    };
  };

  // ---------------------------------------------------------------- HOOK INTO GAME MANAGER
  const installHooks = (Game) => {
    const origProjUpdate = Game.Projectile.prototype.update;
    Game.Projectile.prototype.update = function(dt) {
      origProjUpdate.call(this, dt);
      if (this.d.kind === "funka") Game.addTrail(this.x - this.dir * 36, this.y + (Math.random()*44 - 22), "#ff2a00", "#ffb300");
      else if (this.d.kind === "magma_hound") Game.addTrail(this.x - this.dir * 56, this.y + (Math.random()*90 - 45), "#8b1a00", "#ff6a00");
      else if (this.d.kind === "meteor") Game.addTrail(this.x - this.dir * 16, this.y, "#ff3300", "#ffd23f");
    };

    // Vẽ khối dung nham sần sùi có vân nứt đỏ rực — dùng chung cho đạn/thiên thạch
    const magmaBlob = (ctx, r, t) => {
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.15, 0, 0, r);
      g.addColorStop(0, "#ffe066"); g.addColorStop(0.4, "#ff6a00");
      g.addColorStop(0.75, "#c81e00"); g.addColorStop(1, "#3a0d05");
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const rr = r * (0.86 + Math.sin(a * 3 + t) * 0.14);
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      // vân nứt nham thạch
      ctx.strokeStyle = "rgba(60, 15, 5, 0.75)"; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.2); ctx.lineTo(-r * 0.1, r * 0.1); ctx.lineTo(r * 0.45, -r * 0.15);
      ctx.moveTo(-r * 0.15, r * 0.6); ctx.lineTo(r * 0.05, r * 0.05);
      ctx.stroke();
    };

    const origProjDraw = Game.Projectile.prototype.draw;
    Game.Projectile.prototype.draw = function() {
      const { kind } = this.d;
      const ctx = document.getElementById("game").getContext("2d");

      if (kind === "magma_ball" || kind === "meteor") {
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.dir < 0) ctx.scale(-1, 1);
        const t = this.t / 90;
        const r = kind === "meteor" ? 17 : 22;
        // đuôi lửa kéo dài phía sau
        ctx.globalCompositeOperation = "lighter";
        const tail = ctx.createLinearGradient(-r * 3.4, 0, 0, 0);
        tail.addColorStop(0, "rgba(255, 60, 0, 0)");
        tail.addColorStop(1, "rgba(255, 150, 20, 0.75)");
        ctx.fillStyle = tail;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.75);
        ctx.quadraticCurveTo(-r * 2, -r * 0.3 + Math.sin(t) * 3, -r * 3.4, 0);
        ctx.quadraticCurveTo(-r * 2, r * 0.3 + Math.cos(t) * 3, 0, r * 0.75);
        ctx.closePath(); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        magmaBlob(ctx, r, t);
        // giọt dung nham nhỏ giọt xuống
        ctx.fillStyle = "rgba(255, 90, 0, 0.8)";
        ctx.beginPath(); ctx.arc(-r * 0.2, r + 4 + Math.sin(t * 2) * 2, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        return;
      }

      if (kind === "funka") {
        // DAI FUNKA: nắm đấm dung nham khổng lồ phun trào
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.dir < 0) ctx.scale(-1, 1);
        if (this.d.super) ctx.scale(1.5, 1.5);
        const t = this.t / 60;

        ctx.globalCompositeOperation = "screen";
        const halo = ctx.createRadialGradient(-6, 0, 8, -6, 0, 84);
        halo.addColorStop(0, "rgba(255, 120, 0, 0.5)");
        halo.addColorStop(1, "rgba(200, 20, 0, 0)");
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(-6, 0, 84, 0, Math.PI * 2); ctx.fill();
        // khói đen cuộn phía sau
        ctx.globalCompositeOperation = "source-over";
        for (let i = 0; i < 6; i++) {
          const px = -40 - i * 18, py = Math.sin(t * 0.7 + i) * (9 + i * 3);
          ctx.fillStyle = `rgba(50, 22, 16, ${0.5 - i * 0.06})`;
          ctx.beginPath(); ctx.arc(px, py, 24 - i * 2.4, 0, Math.PI * 2); ctx.fill();
        }

        // Nắm đấm nham thạch: lớp vỏ đen nứt đỏ, lõi vàng chảy
        const fist = (sc, col) => {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(-40 * sc, -20 * sc);
          ctx.lineTo(8 * sc, -34 * sc);
          ctx.quadraticCurveTo(48 * sc, -32 * sc, 50 * sc, 0);
          ctx.quadraticCurveTo(48 * sc, 32 * sc, 8 * sc, 34 * sc);
          ctx.lineTo(-40 * sc, 20 * sc);
          ctx.closePath(); ctx.fill();
        };
        fist(1.3, "#3a0d05");
        fist(1.08, "#c81e00");
        fist(0.8, "#ff6a00");
        fist(0.4, "#ffe066");
        // vân nứt dung nham trên mu bàn tay
        ctx.strokeStyle = "rgba(255, 200, 60, 0.9)"; ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-20, -18); ctx.lineTo(4, -8); ctx.lineTo(-8, 6); ctx.lineTo(18, 16);
        ctx.moveTo(24, -20); ctx.lineTo(30, -2); ctx.lineTo(22, 18);
        ctx.stroke();
        ctx.restore();
        return;
      }

      if (kind === "magma_hound") {
        // INUGAMI GUREN: chó ngao dung nham khổng lồ lao tới ngoạm
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.dir < 0) ctx.scale(-1, 1);
        const t = this.t / 90;

        ctx.globalCompositeOperation = "screen";
        const halo = ctx.createRadialGradient(-10, 0, 12, -10, 0, 118);
        halo.addColorStop(0, "rgba(255, 120, 0, 0.45)");
        halo.addColorStop(1, "rgba(180, 20, 0, 0)");
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(-10, 0, 118, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = "source-over";

        // thân sau tan thành dòng dung nham cuộn
        for (let i = 8; i >= 0; i--) {
          const sx = -14 - i * 19;
          const sy = Math.sin(t * 1.2 + i * 0.6) * (8 + i * 2.6);
          const r = 26 - i * 2.2;
          const g2 = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.3, r * 0.15, sx, sy, r);
          g2.addColorStop(0, "#ffb300"); g2.addColorStop(0.5, "#ff3300"); g2.addColorStop(1, "#5a1200");
          ctx.fillStyle = g2;
          ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
        }

        // ĐẦU CHÓ NGAO
        const hy = Math.sin(t * 1.2) * 8;
        const hg = ctx.createLinearGradient(0, hy - 40, 0, hy + 40);
        hg.addColorStop(0, "#ffb300"); hg.addColorStop(0.4, "#ff3300"); hg.addColorStop(1, "#6a1400");
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.moveTo(-30, hy - 34);
        ctx.quadraticCurveTo(44, hy - 42, 78, hy - 14);   // sống mũi vươn dài
        ctx.quadraticCurveTo(56, hy - 2, 74, hy + 10);
        ctx.quadraticCurveTo(30, hy + 34, -30, hy + 34);
        ctx.closePath(); ctx.fill();
        // hai tai dựng đứng
        ctx.beginPath(); ctx.moveTo(-16, hy - 30); ctx.lineTo(-26, hy - 62); ctx.lineTo(4, hy - 34); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(10, hy - 32); ctx.lineTo(8, hy - 60); ctx.lineTo(30, hy - 28); ctx.closePath(); ctx.fill();
        // hàm dưới há rộng
        ctx.fillStyle = "#8b1a00";
        ctx.beginPath();
        ctx.moveTo(20, hy + 10); ctx.quadraticCurveTo(58, hy + 12, 72, hy + 12);
        ctx.quadraticCurveTo(50, hy + 34, 18, hy + 30);
        ctx.closePath(); ctx.fill();
        // răng nanh nhọn hoắt
        ctx.fillStyle = "#fff3c4";
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(30 + i * 12, hy - 2); ctx.lineTo(34 + i * 12, hy + 12); ctx.lineTo(38 + i * 12, hy - 2);
          ctx.closePath(); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(30 + i * 11, hy + 18); ctx.lineTo(34 + i * 11, hy + 6); ctx.lineTo(38 + i * 11, hy + 18);
          ctx.closePath(); ctx.fill();
        }
        // mắt chó điên dại
        ctx.fillStyle = "#ffe066";
        ctx.beginPath(); ctx.ellipse(24, hy - 18, 6, 4, -0.25, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#2a0a00";
        ctx.beginPath(); ctx.arc(26, hy - 18, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        return;
      }
      origProjDraw.call(this);
    };

    // Vụ nổ dung nham: đá nóng chảy văng tứ tung + khói đen
    Game.addMagmaBurst = function(x, y) {
      this.sparks.push({ kind:"ring", x, y, vx:0, vy:0, life:420, life0:420, r:12, rMax:155, color:"#ff3300" });
      this.sparks.push({ kind:"ring", x, y, vx:0, vy:0, life:320, life0:320, r:12, rMax:110, color:"#ffb300" });
      for (let i = 0; i < 30; i++) {
        const angle = (i / 30) * Math.PI * 2 + Math.random() * 0.4;
        const spd = 190 + Math.random() * 300;
        this.sparks.push({
          kind: "dot",
          x, y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd - 130,
          life: 430 + Math.random() * 340,
          color: Math.random() < 0.3 ? "#3a0d05" : (Math.random() < 0.6 ? "#ff6a00" : "#ffb300"),
          r: 2.5 + Math.random() * 4.5,
        });
      }
    };
  };

  if (typeof window !== "undefined") {
    const tryInstall = () => { if (window.OP_GAME) installHooks(window.OP_GAME); };
    if (window.OP_GAME) tryInstall();
    else if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", tryInstall);
    else tryInstall();
  }
})();
