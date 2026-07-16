/**
 * Sabo — Character Skills & Drawing Engine (Tham Mưu Trưởng Quân Cách Mạng · Long Trảo Quyền + Mera Mera)
 * Bộ 6 ô chiêu: Đòn Gậy Sắt (cận), Ryu no Kagizume (↓+cận), Ryu no Ibuki (xa),
 * Hono no Kagizume (↓+xa — tán xạ), Kaen Ryuo Ken (siêu chiêu 1) và Hi no Ryu Ō (siêu chiêu 2 — rồng lửa).
 */
(() => {
  "use strict";

  window.SaboInit = (Fighter, MOVES) => {
    // ---------------------------------------------------------------- Move Set
    MOVES.sabo = {
      close: { key:"close", name:"Đòn Gậy Sắt", type:"melee",
        dmg:8, startup:60, active:95, recovery:165,
        reach:{dx:34,dy:-72,w:78,h:56}, knockback:215, launch:-30, meterGain:9,
        sfx:"punch", color:"#4a90d9" },
      // ↓+cận (miễn phí): móng vuốt rồng bọc lửa, cào một phát nặng
      kagizume: { key:"kagizume", name:"Ryusoken: Ryu no Kagizume — Móng Vuốt Rồng", type:"melee",
        dmg:16, startup:200, active:200, recovery:270,
        reach:{dx:16,dy:-120,w:150,h:120}, knockback:330, launch:-70, meterGain:14,
        sfx:"punch", color:"#ff6b2b" },
      ranged: { key:"ranged", name:"Ryu no Ibuki — Hơi Thở Rồng", type:"projectile",
        dmg:13, startup:120, active:0, recovery:260, meterGain:12,
        sfx:"punch",
        proj:{ kind:"dragon_breath", speed:660, w:74, h:54, dmg:13, knockback:280, launch:-60, life:1200, color:"#ff8c00" } },
      // ↓+xa: mưa vuốt lửa toả nan quạt · FULL Haki -> SIÊU CHIÊU 3 nổ vòng 360°
      clawrain: { key:"clawrain", name:"Hono no Kagizume — Mưa Vuốt Lửa", type:"projectile",
        dmg:6, startup:200, active:0, recovery:390, meterCost:50, meterGain:0,
        sfx:"punch", cry:"Hono no Kagizume!",
        spread: { count: 7, arcDeg: 80, dmg: 6, speed: 650 },
        proj:{ kind:"fire_claw", speed:650, w:56, h:44, dmg:6, knockback:170, launch:-45, life:1400, color:"#ff7a2b" } },
      // skill (50 Haki) -> SIÊU CHIÊU 1: quả đấm long vương bọc lửa bắn thẳng
      special: { key:"special", name:"Kaen Ryuo Ken — Hoả Diễm Long Vương Quyền", type:"projectile",
        dmg:23, startup:230, active:0, recovery:420, meterCost:50, meterGain:0,
        sfx:"special", cry:"Kaen Ryuo Ken!",
        proj:{ kind:"dragon_fist", speed:650, w:120, h:96, dmg:23, knockback:520, launch:-180, life:2200, color:"#ff4500" } },
      // ↓+skill (100 Haki) -> SIÊU CHIÊU 2: nguyên con rồng lửa khổng lồ lao tới
      hiryuo: { key:"hiryuo", name:"Hi no Ryu Ō — Long Vương Hoả Diễm", type:"projectile",
        dmg:26, startup:340, active:0, recovery:480, meterCost:100, meterGain:0,
        sfx:"special", cry:"Hi no Ryu O!",
        proj:{ kind:"fire_dragon", speed:520, w:210, h:130, dmg:26, knockback:620, launch:-200, life:2800, color:"#ff2a00" } },
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

    // ---------------------------------------------------------------- Main Draw Sabo
    Fighter.prototype.drawSabo = function(flash) {
      const swing = this.armSwing();
      const legs = this.legPose();
      const bob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 2.5 : (this.state === "walk" ? Math.abs(Math.sin(this.walkPhase)) * 3.5 : 0);
      const skin   = flash ? "#ffc2ad" : "#f6cfa4";
      const skinSh = flash ? "#f0a48f" : "#e0ac7f";
      // RYUSOKEN LONG HOÁ (biến hình): áo đuôi tôm cháy rực vàng cam như vảy rồng
      const dragon = this.formed;
      const coat   = dragon ? (flash ? "#ffd24a" : "#b34a00") : (flash ? "#5b8fd4" : "#1f4a86");   // Áo đuôi tôm xanh dương
      const coatSh = flash ? "#3f6fb0" : "#143259";
      const pants  = flash ? "#4a4a58" : "#1a1a22";

      const ctx = document.getElementById("game").getContext("2d");
      const attacking = this.state === "attack" && this.attack;
      const atkKey = attacking ? this.attack.def.key : null;
      const isBlaze = this.formed || this.meter >= 100 || atkKey === "special" || atkKey === "hiryuo" || atkKey === "kagizume" || atkKey === "clawrain";

      ctx.save();
      ctx.translate(0, -bob);
      ctx.lineJoin = "round"; ctx.lineCap = "round";

      // ---- LỬA MERA MERA CUỘN QUANH THÂN ----
      if (isBlaze) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const anim = this.animTime * 9;
        for (let i = 0; i < 6; i++) {
          const fy = -((anim * 15 + i * 23) % 125);
          const fx = Math.sin(anim * 0.35 + i * 1.9) * 22;
          const r = 5 + Math.sin(anim * 0.3 + i) * 3;
          const op = clamp(0.5 * (1 + fy / 125), 0, 0.5);
          ctx.fillStyle = i % 2 ? `rgba(255, 140, 0, ${op})` : `rgba(255, 215, 0, ${op * 0.85})`;
          ctx.beginPath();
          ctx.moveTo(fx, fy + r * 1.6);
          ctx.quadraticCurveTo(fx - r, fy, fx, fy - r * 1.8);
          ctx.quadraticCurveTo(fx + r, fy, fx, fy + r * 1.6);
          ctx.fill();
        }
        ctx.restore();
      }

      // ---- ĐUÔI ÁO KHOÁC BAY PHÍA SAU ----
      const tail = Math.sin(this.animTime * 5) * 5;
      ctx.fillStyle = coatSh;
      ctx.beginPath();
      ctx.moveTo(-13, -100);
      ctx.quadraticCurveTo(-26, -70, -22 - tail * 0.6, -30 + tail);
      ctx.quadraticCurveTo(-13, -24, -7, -34);
      ctx.quadraticCurveTo(-11, -70, -9, -100);
      ctx.closePath(); ctx.fill();

      this.drawBackArm(skin, skinSh);

      // ---- ĐÔI CHÂN QUẦN ĐEN + ỦNG ----
      const kneeL = -6 + Math.sin(legs.a) * 16;
      const footL = kneeL + Math.sin(legs.a) * 8 + 4;
      ctx.strokeStyle = "#101015"; ctx.lineWidth = 15;
      ctx.beginPath(); ctx.moveTo(-6, -52); ctx.lineTo(kneeL, -28); ctx.stroke();
      ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(kneeL, -27); ctx.lineTo(footL, -12); ctx.stroke();
      ctx.fillStyle = "#2a1a10"; roundRect(ctx, footL - 8, -14, 22, 12, 4); ctx.fill();

      const kneeR = 6 + Math.sin(legs.b) * 16;
      const footR = kneeR + Math.sin(legs.b) * 8 + 4;
      ctx.strokeStyle = pants; ctx.lineWidth = 15;
      ctx.beginPath(); ctx.moveTo(6, -52); ctx.lineTo(kneeR, -28); ctx.stroke();
      ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(kneeR, -27); ctx.lineTo(footR, -12); ctx.stroke();
      // Ủng da nâu cao cổ
      ctx.fillStyle = "#3b2415"; roundRect(ctx, footR - 8, -15, 23, 13, 4); ctx.fill();
      ctx.strokeStyle = "#6b4526"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(footR - 7, -12); ctx.lineTo(footR + 13, -12); ctx.stroke();

      // ---- ÁO ĐUÔI TÔM XANH + SƠ MI TRẮNG + CRAVAT ----
      ctx.fillStyle = coat;
      ctx.beginPath();
      ctx.moveTo(-14, -106); ctx.quadraticCurveTo(0, -109, 14, -106);
      ctx.lineTo(11, -56); ctx.quadraticCurveTo(0, -53, -11, -56);
      ctx.closePath(); ctx.fill();
      // Ve áo mở rộng để lộ sơ mi trắng
      ctx.fillStyle = "#f3efe4";
      ctx.beginPath();
      ctx.moveTo(-6, -106); ctx.lineTo(6, -106); ctx.lineTo(3, -62); ctx.lineTo(-3, -62);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = coatSh;
      ctx.beginPath(); ctx.moveTo(-6, -106); ctx.lineTo(-1, -86); ctx.lineTo(-12, -96); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(6, -106); ctx.lineTo(1, -86); ctx.lineTo(12, -96); ctx.closePath(); ctx.fill();
      // Cravat trắng xù ở cổ
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.ellipse(0, -101, 5.5, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-3, -99); ctx.lineTo(3, -99); ctx.lineTo(1.5, -88); ctx.lineTo(-1.5, -88); ctx.closePath(); ctx.fill();
      // Thắt lưng
      ctx.fillStyle = "#2a1a10"; roundRect(ctx, -12, -62, 24, 6, 2); ctx.fill();
      ctx.fillStyle = "#d4a017"; roundRect(ctx, -3, -61.5, 6, 5, 1.5); ctx.fill();

      // ---- ĐẦU SABO (mũ chóp cao + kính bảo hộ, tóc vàng, sẹo bỏng mắt trái) ----
      this.drawHeadSabo(skin, skinSh, flash, isBlaze);

      // ---- TAY TRƯỚC: GẬY SẮT / MÓNG VUỐT RỒNG ----
      this.drawFrontArmSabo(swing, skin, skinSh, isBlaze, atkKey);

      ctx.restore();
    };

    // ---------------------------------------------------------------- Head Sabo
    Fighter.prototype.drawHeadSabo = function(skin, skinSh, flash, isBlaze) {
      const ctx = document.getElementById("game").getContext("2d");
      const headBob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 0.8 : 0;
      ctx.save();
      ctx.translate(0, headBob);

      ctx.fillStyle = skinSh; roundRect(ctx, -3, -112, 6, 11, 2); ctx.fill();

      const fg = ctx.createLinearGradient(-11, -132, 11, -110);
      fg.addColorStop(0, skin); fg.addColorStop(1, skinSh);
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(0, -121, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(-11, -120, 2.5, 0, Math.PI * 2); ctx.fill();

      // Tóc vàng gợn sóng bồng bềnh ló ra dưới vành mũ
      const hair = flash ? "#fff3a0" : "#f0c419";
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.arc(0, -123, 12.5, Math.PI * 1.02, Math.PI * 1.98);
      ctx.closePath(); ctx.fill();
      for (let i = 0; i < 4; i++) {
        const hx = -12 + i * 8;
        ctx.beginPath(); ctx.arc(hx, -118 + Math.sin(i * 1.6) * 3, 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(12, -116, 4.2, 0, Math.PI * 2); ctx.fill();

      // BIỂU CẢM
      if (this.state === "hurt") {
        ctx.strokeStyle = "#15151c"; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(2.5, -122); ctx.lineTo(8.5, -118); ctx.stroke();
        ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#15151c"; ctx.lineWidth = 1.6;
        roundRect(ctx, 2, -114, 8, 4.5, 1.5); ctx.fill(); ctx.stroke();
      } else if (this.state === "ko") {
        ctx.strokeStyle = "#15151c"; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(2.5, -120); ctx.lineTo(8.5, -120); ctx.stroke();
        ctx.fillStyle = "#330a0a";
        ctx.beginPath(); ctx.ellipse(5, -112, 2.5, 1.8, 0, 0, Math.PI*2); ctx.fill();
      } else {
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.ellipse(5, -120, 2.8, 3.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = isBlaze ? "#ff7f00" : "#1d3f6b";
        ctx.beginPath(); ctx.arc(5.6, -120, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#8a6a10"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(1.5, -126); ctx.lineTo(9.5, -125); ctx.stroke();
        ctx.strokeStyle = "#8a4a3a"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(2.5, -113); ctx.lineTo(8.5, -113); ctx.stroke();
      }

      // ---- VẾT SẸO BỎNG PHỦ MẮT TRÁI (bên phải theo hướng vẽ) ----
      ctx.fillStyle = "rgba(190, 90, 60, 0.35)";
      ctx.beginPath();
      ctx.moveTo(1, -128); ctx.quadraticCurveTo(10, -130, 11, -122);
      ctx.quadraticCurveTo(10, -114, 2, -115);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(150, 60, 40, 0.5)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(3, -127); ctx.lineTo(9, -117); ctx.stroke();

      ctx.strokeStyle = skinSh; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(1, -117); ctx.lineTo(3, -116); ctx.stroke();

      // ---- MŨ CHÓP CAO ĐEN + KÍNH BẢO HỘ VẮT NGANG VÀNH ----
      ctx.save();
      ctx.translate(0, -133);
      ctx.rotate(-0.08);
      const hatCol = flash ? "#4a4a58" : "#15151b";
      ctx.fillStyle = hatCol;
      // Vành mũ
      ctx.beginPath(); ctx.ellipse(0, 1, 17, 4, 0, 0, Math.PI * 2); ctx.fill();
      // Chóp mũ cao
      ctx.beginPath();
      ctx.moveTo(-9, 1);
      ctx.lineTo(-10, -17); ctx.quadraticCurveTo(0, -20, 10, -17);
      ctx.lineTo(9, 1);
      ctx.closePath(); ctx.fill();
      // Dải băng xanh quanh chóp
      ctx.fillStyle = "#1f4a86"; ctx.fillRect(-9.6, -4, 19.2, 4);
      // Kính bảo hộ vắt trên vành: 2 mắt kính tròn + dây da
      ctx.strokeStyle = "#6b4526"; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(-12, -2); ctx.lineTo(12, -2); ctx.stroke();
      for (const gx of [-7.5, 7.5]) {
        ctx.fillStyle = "#3b2415";
        ctx.beginPath(); ctx.arc(gx, -2, 4.6, 0, Math.PI * 2); ctx.fill();
        const lens = ctx.createRadialGradient(gx - 1.4, -3.4, 0.6, gx, -2, 3.4);
        lens.addColorStop(0, "#dff3ff"); lens.addColorStop(1, "#4a90d9");
        ctx.fillStyle = lens;
        ctx.beginPath(); ctx.arc(gx, -2, 3.3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      ctx.restore();
    };

    // ---------------------------------------------------------------- Front Arm Sabo
    Fighter.prototype.drawFrontArmSabo = function(swing, skin, skinSh, isBlaze, atkKey) {
      const ctx = document.getElementById("game").getContext("2d");
      const attacking = this.state === "attack" && this.attack;
      const active = attacking && this.attack.phase !== "startup";
      const isClaw = atkKey === "kagizume" || atkKey === "clawrain" || atkKey === "special" || atkKey === "hiryuo";
      const ang = attacking ? (-1.15 + swing * 2.0) : -0.3;

      ctx.save();
      ctx.translate(11, -95);
      ctx.rotate(ang);

      // Cánh tay + găng tay đen
      ctx.strokeStyle = skin; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(13, 3); ctx.lineTo(24, 3); ctx.stroke();
      ctx.fillStyle = "#15151b";
      ctx.beginPath(); ctx.arc(24, 3, 5.5, 0, Math.PI * 2); ctx.fill();

      if (isClaw) {
        // ---- MÓNG VUỐT RỒNG BỌC LỬA (Ryusoken) ----
        ctx.save();
        ctx.translate(24, 3);
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createRadialGradient(6, 0, 2, 6, 0, 26);
        g.addColorStop(0, "rgba(255,215,0,0.9)"); g.addColorStop(0.5, "rgba(255,120,20,0.5)"); g.addColorStop(1, "rgba(255,60,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(6, 0, 26, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        // 3 móng vuốt lửa cong vút
        ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 3.4; ctx.lineCap = "round";
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(2, i * 5);
          ctx.quadraticCurveTo(14, i * 8, 22, i * 12 - 2);
          ctx.stroke();
        }
        ctx.restore();

        // Vệt cào bán nguyệt khi ra đòn
        if (active && (atkKey === "kagizume")) {
          ctx.save();
          ctx.translate(24, 3);
          ctx.strokeStyle = "rgba(255, 120, 20, 0.55)"; ctx.lineWidth = 15;
          ctx.beginPath(); ctx.arc(-8, 0, 54, -0.85, 0.85); ctx.stroke();
          ctx.strokeStyle = "rgba(255, 230, 150, 0.9)"; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(-8, 0, 54, -0.6, 0.6); ctx.stroke();
          ctx.restore();
        }
      } else {
        // ---- GẬY SẮT (vũ khí quen thuộc của Sabo) ----
        ctx.save();
        ctx.translate(24, 3);
        const pipe = ctx.createLinearGradient(0, -3, 0, 3);
        pipe.addColorStop(0, "#c9d2dc"); pipe.addColorStop(0.5, "#8a97a6"); pipe.addColorStop(1, "#5b6673");
        ctx.strokeStyle = pipe; ctx.lineWidth = 6.5; ctx.lineCap = "butt";
        ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(52, 0); ctx.stroke();
        // Khớp nối gậy
        ctx.fillStyle = "#5b6673";
        ctx.fillRect(-20, -4.6, 5, 9.2);
        ctx.fillRect(46, -4.6, 7, 9.2);
        ctx.fillRect(16, -4.2, 4, 8.4);
        ctx.restore();

        if (active) {
          ctx.save();
          ctx.translate(24, 3);
          ctx.strokeStyle = "rgba(200, 225, 255, 0.5)"; ctx.lineWidth = 12;
          ctx.beginPath(); ctx.arc(-14, 0, 60, -0.7, 0.7); ctx.stroke();
          ctx.restore();
        }
      }
      ctx.restore();
    };
  };

  // ---------------------------------------------------------------- HOOK INTO GAME MANAGER
  const installHooks = (Game) => {
    // 1. Vệt lửa bám đuôi
    const origProjUpdate = Game.Projectile.prototype.update;
    Game.Projectile.prototype.update = function(dt) {
      origProjUpdate.call(this, dt);
      if (this.d.kind === "dragon_fist") Game.addTrail(this.x - this.dir * 34, this.y + (Math.random()*40 - 20), "#ff4500", "#ffd23f");
      else if (this.d.kind === "fire_dragon") Game.addTrail(this.x - this.dir * 60, this.y + (Math.random()*90 - 45), "#ff2a00", "#ffb300");
    };

    // 2. Đạn riêng của Sabo
    const origProjDraw = Game.Projectile.prototype.draw;
    Game.Projectile.prototype.draw = function() {
      const { kind } = this.d;
      const ctx = document.getElementById("game").getContext("2d");

      if (kind === "dragon_breath") {
        // RYU NO IBUKI: luồng lửa phun ra hình nón, lõi trắng
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.dir < 0) ctx.scale(-1, 1);
        const t = this.t / 70;
        ctx.globalCompositeOperation = "lighter";
        for (let k = 0; k < 3; k++) {
          const grd = ctx.createLinearGradient(-34, 0, 34, 0);
          grd.addColorStop(0, "rgba(255, 60, 0, 0)");
          grd.addColorStop(0.5, k ? "rgba(255, 140, 0, 0.55)" : "rgba(255, 220, 90, 0.75)");
          grd.addColorStop(1, "rgba(255, 245, 200, 0.95)");
          ctx.fillStyle = grd;
          const h = 22 - k * 6;
          ctx.beginPath();
          ctx.moveTo(34, 0);
          ctx.quadraticCurveTo(4, -h - Math.sin(t + k) * 4, -34, -h * 0.5);
          ctx.quadraticCurveTo(-10, 0, -34, h * 0.5);
          ctx.quadraticCurveTo(4, h + Math.cos(t + k) * 4, 34, 0);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        return;
      }

      if (kind === "fire_claw") {
        // HONO NO KAGIZUME: 3 vệt móng vuốt lửa song song
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.dir < 0) ctx.scale(-1, 1);
        for (let i = -1; i <= 1; i++) {
          const grd = ctx.createLinearGradient(-24, 0, 24, 0);
          grd.addColorStop(0, "rgba(255, 60, 0, 0)");
          grd.addColorStop(0.6, "rgba(255, 140, 0, 0.9)");
          grd.addColorStop(1, "#fff3c4");
          ctx.strokeStyle = grd; ctx.lineWidth = 4.5; ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(-24, i * 9 - 3);
          ctx.quadraticCurveTo(4, i * 13, 24, i * 6);
          ctx.stroke();
        }
        ctx.restore();
        return;
      }

      if (kind === "dragon_fist") {
        // KAEN RYUO KEN: quả đấm lửa hình đầu rồng
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.dir < 0) ctx.scale(-1, 1);
        if (this.d.super) ctx.scale(1.5, 1.5);
        const t = this.t / 60;

        ctx.globalCompositeOperation = "screen";
        const halo = ctx.createRadialGradient(-4, 0, 8, -4, 0, 76);
        halo.addColorStop(0, "rgba(255, 200, 40, 0.45)");
        halo.addColorStop(1, "rgba(255, 42, 0, 0)");
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(-4, 0, 76, 0, Math.PI * 2); ctx.fill();
        // đuôi lửa cuộn
        for (let i = 0; i < 6; i++) {
          const px = -34 - i * 17, py = Math.sin(t * 0.8 + i * 1.1) * (8 + i * 3);
          ctx.fillStyle = i % 2 ? "rgba(255, 87, 34, 0.55)" : "rgba(255, 170, 0, 0.4)";
          ctx.beginPath(); ctx.arc(px, py, 22 - i * 2.6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";

        // Nắm đấm lửa
        const fist = (sc, col) => {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(-34 * sc, -16 * sc);
          ctx.lineTo(6 * sc, -28 * sc);
          ctx.quadraticCurveTo(40 * sc, -26 * sc, 42 * sc, 0);
          ctx.quadraticCurveTo(40 * sc, 26 * sc, 6 * sc, 28 * sc);
          ctx.lineTo(-34 * sc, 16 * sc);
          ctx.closePath(); ctx.fill();
        };
        fist(1.3, "#ff2a00");
        fist(1.0, "#ff8c00");
        fist(0.55, "#ffe066");
        // Sừng + râu rồng mọc ra từ nắm đấm
        ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(12, -30); ctx.quadraticCurveTo(26, -46, 44, -44);
        ctx.moveTo(12, 30); ctx.quadraticCurveTo(26, 46, 44, 44);
        ctx.stroke();
        // Mắt rồng đỏ rực
        ctx.fillStyle = "#fff3c4";
        ctx.beginPath(); ctx.ellipse(26, -8, 4, 2.6, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        return;
      }

      if (kind === "fire_dragon") {
        // HI NO RYU O: nguyên con rồng lửa uốn lượn lao tới
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.dir < 0) ctx.scale(-1, 1);
        const t = this.t / 90;

        ctx.globalCompositeOperation = "screen";
        const halo = ctx.createRadialGradient(-10, 0, 12, -10, 0, 120);
        halo.addColorStop(0, "rgba(255, 190, 40, 0.4)");
        halo.addColorStop(1, "rgba(255, 42, 0, 0)");
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(-10, 0, 120, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = "source-over";

        // Thân rồng: chuỗi đốt lửa uốn sóng nhỏ dần về đuôi
        for (let i = 10; i >= 0; i--) {
          const sx = 34 - i * 20;
          const sy = Math.sin(t * 1.3 + i * 0.55) * (10 + i * 2.4);
          const r = 24 - i * 1.7;
          const g2 = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.3, r * 0.15, sx, sy, r);
          g2.addColorStop(0, "#fff3c4"); g2.addColorStop(0.5, "#ff8c00"); g2.addColorStop(1, "#ff2a00");
          ctx.fillStyle = g2;
          ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
          // vây lưng
          if (i % 2 === 0 && i < 9) {
            ctx.fillStyle = "rgba(255, 220, 90, 0.9)";
            ctx.beginPath();
            ctx.moveTo(sx - 6, sy - r * 0.8);
            ctx.lineTo(sx, sy - r - 12);
            ctx.lineTo(sx + 6, sy - r * 0.8);
            ctx.closePath(); ctx.fill();
          }
        }

        // Đầu rồng
        const hy = Math.sin(t * 1.3) * 10;
        ctx.fillStyle = "#ff5722";
        ctx.beginPath();
        ctx.moveTo(28, hy - 26);
        ctx.quadraticCurveTo(76, hy - 20, 96, hy - 2);
        ctx.quadraticCurveTo(74, hy + 6, 88, hy + 16);
        ctx.quadraticCurveTo(58, hy + 12, 28, hy + 26);
        ctx.closePath(); ctx.fill();
        // hàm dưới + răng nanh
        ctx.fillStyle = "#ffd23f";
        ctx.beginPath();
        ctx.moveTo(60, hy + 6); ctx.lineTo(92, hy + 4); ctx.lineTo(66, hy + 20);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#ffffff";
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(70 + i * 8, hy + 2); ctx.lineTo(74 + i * 8, hy + 12); ctx.lineTo(78 + i * 8, hy + 2);
          ctx.closePath(); ctx.fill();
        }
        // sừng rồng
        ctx.strokeStyle = "#ffe066"; ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(44, hy - 22); ctx.quadraticCurveTo(50, hy - 46, 72, hy - 48);
        ctx.moveTo(36, hy - 20); ctx.quadraticCurveTo(34, hy - 40, 50, hy - 44);
        ctx.stroke();
        // mắt rồng
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.ellipse(64, hy - 12, 5, 3.4, -0.25, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#3b0a00";
        ctx.beginPath(); ctx.arc(65, hy - 12, 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        return;
      }
      origProjDraw.call(this);
    };
  };

  // game.js chỉ gán window.OP_GAME ở cuối file -> phải đợi nạp xong mới gắn hook.
  if (typeof window !== "undefined") {
    const tryInstall = () => { if (window.OP_GAME) installHooks(window.OP_GAME); };
    if (window.OP_GAME) tryInstall();
    else if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", tryInstall);
    else tryInstall();
  }
})();
