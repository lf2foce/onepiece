/**
 * Aokiji (Kuzan) — Character Skills & Drawing Engine (Đô Đốc Xanh / Hie Hie no Mi)
 * Bộ 5 chiêu: Ice Saber (cận), Ice Block: Partisan (loạt thương băng), Ice Time (↓+skill),
 * Ice Block: Pheasant Beak (siêu chiêu 1 — chim băng khổng lồ) và Ice Age (siêu chiêu 2 — đóng băng cả sàn đấu).
 */
(() => {
  "use strict";

  window.AokijiInit = (Fighter, MOVES) => {
    // ---------------------------------------------------------------- Move Set
    MOVES.aokiji = {
      close: { key:"close", name:"Ice Saber — Kiếm Băng", type:"melee",
        dmg:9, startup:70, active:100, recovery:175,
        reach:{dx:32,dy:-66,w:74,h:50}, knockback:210, launch:-30, meterGain:9,
        sfx:"slash", color:"#7fdcff" },
      ranged: { key:"ranged", name:"Ice Block: Partisan", type:"projectile",
        dmg:14, startup:130, active:300, recovery:250, meterGain:12,
        sfx:"slash",
        multiProj: { count: 4, interval: 80, dmg: 4, speed: 680 },
        proj:{ kind:"ice_spear", speed:680, w:56, h:20, dmg:4, knockback:120, launch:-24, life:1000, color:"#7fdcff" } },
      // ↓+skill khi CHƯA đầy Haki: đòn đặc biệt thường, miễn phí Haki (không phải siêu chiêu)
      icetime: { key:"icetime", name:"Ice Time — Băng Thời Gian", type:"melee",
        dmg:16, startup:230, active:200, recovery:280,
        reach:{dx:16,dy:-140,w:190,h:150}, knockback:300, launch:-60, meterGain:14,
        sfx:"slash", color:"#bff0ff" },
      special: { key:"special", name:"Ice Block: Pheasant Beak", type:"projectile",
        dmg:23, startup:240, active:0, recovery:430, meterCost:50, meterGain:0,
        sfx:"special", cry:"Pheasant Beak!",
        proj:{ kind:"pheasant", speed:600, w:170, h:120, dmg:23, knockback:500, launch:-170, life:2400, color:"#7fdcff" } },
      // ↓+skill khi FULL Haki: SIÊU CHIÊU 2 — Ice Age băng hà lan kín cả sàn đấu
      iceage: { key:"iceage", name:"Ice Age — Kỷ Băng Hà", type:"melee",
        dmg:25, startup:400, active:320, recovery:520,
        reach:{dx:10,dy:-260,w:430,h:300}, knockback:560, launch:-150, meterCost:100, meterGain:0,
        sfx:"special", cry:"Ice Age!", color:"#bff0ff" },
      // SIÊU CHIÊU 3 (↓+xa) — mưa thương băng bắn toả ra khắp hướng
      icerain: { key:"icerain", name:"Ice Block: Icicle Rain", type:"projectile",
        dmg:6, startup:210, active:0, recovery:390, meterCost:50, meterGain:0,
        sfx:"slash", cry:"Icicle Rain!",
        spread: { count: 8, arcDeg: 84, dmg: 6, speed: 680 },
        proj:{ kind:"ice_spear", speed:680, w:56, h:20, dmg:6, knockback:170, launch:-45, life:1500, color:"#7fdcff" } },
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

    // ---------------------------------------------------------------- Main Draw Aokiji
    Fighter.prototype.drawAokiji = function(flash) {
      const swing = this.armSwing();
      const legs = this.legPose();
      const bob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 2.5 : (this.state === "walk" ? Math.abs(Math.sin(this.walkPhase)) * 3.5 : 0);
      // HIE HIE (biến hình): toàn thân hoá băng, da trong veo xanh nhạt
      const iceBody = this.formed;
      const skin   = iceBody ? (flash ? "#ffffff" : "#dff6ff") : (flash ? "#ffc2ad" : "#e8b78d");
      const skinSh = iceBody ? (flash ? "#bfeaff" : "#8fd4f0") : (flash ? "#f0a48f" : "#c9925f");
      const pants  = flash ? "#4a5a80" : "#232c46";   // Quần âu xanh navy
      const shirt  = flash ? "#ffffff" : "#efe6cf";   // Áo sơ mi kem
      const coat   = flash ? "#ffffff" : "#e9edf5";   // Áo choàng Hải Quân khoác hờ

      const ctx = document.getElementById("game").getContext("2d");
      const attacking = this.state === "attack" && this.attack;
      const atkKey = attacking ? this.attack.def.key : null;
      // Logia hoá băng: khi đầy Haki hoặc đang tung chiêu băng lớn
      const isFrost = this.formed || this.meter >= 100 || atkKey === "special" || atkKey === "iceage" || atkKey === "icetime";

      ctx.save();
      ctx.translate(0, -bob);
      ctx.lineJoin = "round"; ctx.lineCap = "round";

      // ---- HƠI LẠNH & TINH THỂ BĂNG BAY LƠ LỬNG QUANH THÂN ----
      if (isFrost) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const anim = this.animTime * 6;
        for (let i = 0; i < 8; i++) {
          const fy = -((anim * 11 + i * 17) % 130);
          const fx = Math.sin(anim * 0.4 + i * 2.2) * 24;
          const r = 2.2 + Math.sin(anim * 0.3 + i) * 1.6;
          const op = clamp(0.55 * (1 + fy / 130), 0, 0.6);
          ctx.fillStyle = i % 2 ? `rgba(191, 240, 255, ${op})` : `rgba(127, 220, 255, ${op * 0.8})`;
          // Tinh thể băng 6 cánh lấp lánh
          ctx.save();
          ctx.translate(fx, fy);
          ctx.rotate(anim * 0.1 + i);
          for (let k = 0; k < 3; k++) {
            ctx.rotate(Math.PI / 3);
            ctx.fillRect(-r * 2, -r * 0.28, r * 4, r * 0.56);
          }
          ctx.restore();
        }
        ctx.restore();
      }

      // ---- ÁO CHOÀNG HẢI QUÂN KHOÁC HỜ SAU LƯNG ----
      ctx.fillStyle = coat;
      ctx.beginPath();
      ctx.moveTo(-15, -106);
      ctx.quadraticCurveTo(-27, -70, -23, -24);
      ctx.quadraticCurveTo(-15, -14, -6, -24);
      ctx.quadraticCurveTo(-12, -70, -10, -106);
      ctx.closePath(); ctx.fill();
      // Viền xanh và chữ trên áo choàng công lý
      ctx.strokeStyle = "#2a5b9e"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-23, -26); ctx.quadraticCurveTo(-14, -16, -6, -25); ctx.stroke();

      this.drawBackArm(skin, skinSh);

      // ---- ĐÔI CHÂN QUẦN ÂU NAVY DÀI MIÊN MAN + GIÀY DA ----
      const kneeL = -6 + Math.sin(legs.a) * 17;
      const footL = kneeL + Math.sin(legs.a) * 8 + 4;
      ctx.strokeStyle = "#1a2237"; ctx.lineWidth = 15;
      ctx.beginPath(); ctx.moveTo(-6, -52); ctx.lineTo(kneeL, -28); ctx.stroke();
      ctx.strokeStyle = "#1a2237"; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(kneeL, -27); ctx.lineTo(footL, -10); ctx.stroke();
      ctx.fillStyle = "#12151f"; roundRect(ctx, footL - 7, -11, 22, 9, 4); ctx.fill();

      const kneeR = 6 + Math.sin(legs.b) * 17;
      const footR = kneeR + Math.sin(legs.b) * 8 + 4;
      const legGrd = ctx.createLinearGradient(6, -52, footR, -10);
      legGrd.addColorStop(0, pants);
      legGrd.addColorStop(1, isFrost ? "#7fdcff" : pants);   // Ống quần phủ băng khi bùng Haki
      ctx.strokeStyle = legGrd; ctx.lineWidth = 15;
      ctx.beginPath(); ctx.moveTo(6, -52); ctx.lineTo(kneeR, -28); ctx.stroke();
      ctx.strokeStyle = legGrd; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(kneeR, -27); ctx.lineTo(footR, -10); ctx.stroke();
      ctx.fillStyle = isFrost ? "#bff0ff" : "#1a1e2c";
      roundRect(ctx, footR - 7, -11, 22, 9, 4); ctx.fill();

      // ---- ÁO SƠ MI KEM PHANH CÚC + CÀ VẠT ----
      ctx.fillStyle = shirt;
      ctx.beginPath();
      ctx.moveTo(-13, -106); ctx.quadraticCurveTo(0, -109, 13, -106);
      ctx.lineTo(10, -57); ctx.quadraticCurveTo(0, -54, -10, -57);
      ctx.closePath(); ctx.fill();
      // Cổ áo bẻ + cà vạt tím sẫm buông lơi
      ctx.fillStyle = "#d9cdb0";
      ctx.beginPath(); ctx.moveTo(-6, -106); ctx.lineTo(0, -96); ctx.lineTo(6, -106); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#5b3f8f"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, -99); ctx.lineTo(1, -74); ctx.stroke();
      // Thắt lưng đen
      ctx.fillStyle = "#15151b"; roundRect(ctx, -11, -62, 22, 5, 2); ctx.fill();

      // ---- ĐẦU AOKIJI (tóc đen xoăn, bịt mắt ngủ trên trán, râu lún phún) ----
      this.drawHeadAokiji(skin, skinSh, flash, isFrost);

      // ---- TAY TRƯỚC: LƯỠI KIẾM BĂNG ----
      this.drawFrontArmAokiji(swing, skin, skinSh, isFrost);

      // ---- ICE AGE — băng hà lan kín sàn đấu ----
      if (atkKey === "iceage") this.drawIceAge();

      ctx.restore();
    };

    // ---------------------------------------------------------------- Head Aokiji
    Fighter.prototype.drawHeadAokiji = function(skin, skinSh, flash, isFrost) {
      const ctx = document.getElementById("game").getContext("2d");
      const headBob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 0.8 : 0;
      ctx.save();
      ctx.translate(0, headBob);

      // Cổ cao lêu nghêu đặc trưng của Đô đốc
      ctx.fillStyle = skinSh; roundRect(ctx, -3, -114, 6, 13, 2); ctx.fill();

      // Khuôn mặt dài, hốc hác lười biếng
      const fg = ctx.createLinearGradient(-11, -134, 11, -112);
      fg.addColorStop(0, skin); fg.addColorStop(1, skinSh);
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.ellipse(0, -122, 11.5, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(-11, -121, 2.5, 0, Math.PI * 2); ctx.fill();

      // Bờm tóc đen xoăn bồng bềnh, phủ cao khỏi trán và buông lọn xuống hai bên má
      const hairCol = flash ? "#4a4a58" : "#191922";
      ctx.fillStyle = hairCol;
      // Khối tóc chính trùm đỉnh đầu
      ctx.beginPath();
      ctx.ellipse(0, -132, 13.5, 9, 0, Math.PI, Math.PI * 2);
      ctx.closePath(); ctx.fill();
      // Các búi xoăn lởm chởm bung lên trên
      for (let i = 0; i < 6; i++) {
        const cx = -12 + i * 4.8;
        ctx.beginPath(); ctx.arc(cx, -139 + Math.sin(i * 1.9) * 2.8, 4.6, 0, Math.PI * 2); ctx.fill();
      }
      // Lọn tóc buông dài ôm hai bên thái dương
      ctx.beginPath(); ctx.arc(-12, -130, 4.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-13, -124, 3.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(12.5, -130, 4.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(13, -124, 3.6, 0, Math.PI * 2); ctx.fill();

      // ---- BỊT MẮT NGỦ VẮT NGANG TRÁN, NGAY DƯỚI CHÂN TÓC (thương hiệu ngủ gật của Aokiji) ----
      // Đặt cao sát chân tóc để không che mắt — che mắt thì thành kính lặn, không ra Aokiji.
      const maskGrd = ctx.createLinearGradient(0, -134, 0, -129);
      maskGrd.addColorStop(0, flash ? "#ffffff" : "#5d6b91");
      maskGrd.addColorStop(1, flash ? "#dfe6ff" : "#333c5c");
      ctx.fillStyle = maskGrd;
      roundRect(ctx, -10.5, -133.5, 21, 4.6, 2.2); ctx.fill();
      ctx.strokeStyle = "rgba(190, 205, 240, 0.8)"; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-8.5, -132.2); ctx.lineTo(8.5, -132.2); ctx.stroke();
      // Dây chun vòng ra sau gáy
      ctx.strokeStyle = "#333c5c"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(-10, -131.5); ctx.quadraticCurveTo(-14.5, -128, -11.5, -124); ctx.stroke();

      // BIỂU CẢM GƯƠNG MẶT
      if (this.state === "hurt") {
        ctx.strokeStyle = "#15151c"; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(2.5, -123); ctx.lineTo(8.5, -119); ctx.stroke();
        ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#15151c"; ctx.lineWidth = 1.6;
        roundRect(ctx, 2, -115, 8, 4.5, 1.5); ctx.fill(); ctx.stroke();
      } else if (this.state === "ko") {
        ctx.strokeStyle = "#15151c"; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(2.5, -121); ctx.lineTo(8.5, -121); ctx.stroke();
        ctx.fillStyle = "#330a0a";
        ctx.beginPath(); ctx.ellipse(5, -113, 2.5, 1.8, 0, 0, Math.PI*2); ctx.fill();
      } else {
        // Mắt lim dim uể oải; sáng xanh băng giá khi bùng Haki
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.ellipse(5, -121, 2.7, 2.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = isFrost ? "#7fdcff" : "#20242b";
        ctx.beginPath(); ctx.arc(5.6, -121, 1.5, 0, Math.PI * 2); ctx.fill();
        // Mí mắt sụp xuống lười biếng
        ctx.strokeStyle = "#20242b"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(1.8, -123.5); ctx.lineTo(9.2, -123.5); ctx.stroke();
        ctx.strokeStyle = "#8a6a5a"; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(2.5, -117); ctx.lineTo(8.5, -117); ctx.stroke();
      }

      // Mũi cao
      ctx.strokeStyle = skinSh; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(1, -118); ctx.lineTo(3.5, -117); ctx.stroke();

      // Râu lún phún quanh cằm
      ctx.strokeStyle = "rgba(30,30,40,0.35)"; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-4, -112); ctx.lineTo(5, -112);
      ctx.moveTo(-5, -115); ctx.lineTo(-2, -111);
      ctx.stroke();

      ctx.restore();
    };

    // ---------------------------------------------------------------- Front Arm Aokiji
    Fighter.prototype.drawFrontArmAokiji = function(swing, skin, skinSh, isFrost) {
      const ctx = document.getElementById("game").getContext("2d");
      const attacking = this.state === "attack" && this.attack;
      const key = attacking ? this.attack.def.key : null;
      const active = attacking && this.attack.phase !== "startup";
      const ang = attacking ? (-1.2 + swing * 2.1) : -0.32;

      ctx.save();
      ctx.translate(11, -95);
      ctx.rotate(ang);

      // Cánh tay dài lêu nghêu
      ctx.strokeStyle = skin; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(13, 3); ctx.lineTo(26, 3); ctx.stroke();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(26, 3, 5, 0, Math.PI * 2); ctx.fill();

      // ---- LƯỠI KIẾM BĂNG MỌC RA TỪ CÁNH TAY (Ice Saber) ----
      const showSaber = key === "close" || key === "icetime" || isFrost;
      if (showSaber) {
        ctx.translate(26, 3);
        const len = key === "icetime" ? 78 : 60;
        const bladeGrd = ctx.createLinearGradient(0, 0, len, 0);
        bladeGrd.addColorStop(0, "rgba(191, 240, 255, 0.55)");
        bladeGrd.addColorStop(0.5, "#bff0ff");
        bladeGrd.addColorStop(1, "#ffffff");
        ctx.fillStyle = bladeGrd;
        ctx.shadowColor = "#7fdcff"; ctx.shadowBlur = 10;
        // Lưỡi kiếm băng dạng tinh thể nhọn hoắt
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(len * 0.62, -5.5);
        ctx.lineTo(len, 0);
        ctx.lineTo(len * 0.62, 5.5);
        ctx.lineTo(0, 7);
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
        // Vân băng nứt trên lưỡi kiếm
        ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(4, 0); ctx.lineTo(len * 0.92, 0);
        ctx.moveTo(len * 0.3, -4); ctx.lineTo(len * 0.45, 0);
        ctx.stroke();

        // Vệt chém băng bán nguyệt lạnh buốt
        if (active && (key === "close" || key === "icetime")) {
          ctx.strokeStyle = "rgba(127, 220, 255, 0.55)"; ctx.lineWidth = 16;
          ctx.beginPath(); ctx.arc(-6, 0, len * 0.95, -0.8, 0.8); ctx.stroke();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.9)"; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(-6, 0, len * 0.95, -0.55, 0.55); ctx.stroke();
        }
      }
      ctx.restore();
    };

    // ---------------------------------------------------------------- Ice Age
    Fighter.prototype.drawIceAge = function() {
      const ctx = document.getElementById("game").getContext("2d");
      const a = this.attack; if (!a) return;
      const d = a.def;
      const aEnd = d.startup + d.active;
      const grow = clamp(a.elapsed / (d.startup * 0.9), 0, 1);
      const fade = a.elapsed > aEnd ? clamp(1 - (a.elapsed - aEnd) / d.recovery, 0, 1) : 1;
      const reach = Math.pow(grow, 0.7) * 430;
      const t = this.animTime * 8;

      ctx.save();
      ctx.globalAlpha = fade;

      // Mặt sàn đóng băng lan tới trước
      const floor = ctx.createLinearGradient(0, -10, reach, -10);
      floor.addColorStop(0, "rgba(191, 240, 255, 0.85)");
      floor.addColorStop(0.7, "rgba(127, 220, 255, 0.55)");
      floor.addColorStop(1, "rgba(127, 220, 255, 0)");
      ctx.fillStyle = floor;
      ctx.beginPath();
      ctx.moveTo(-20, -2);
      ctx.lineTo(reach, -2);
      ctx.lineTo(reach, -16);
      ctx.lineTo(-20, -22);
      ctx.closePath(); ctx.fill();

      // Rừng gai băng khổng lồ đâm ngược lên từ mặt sàn
      for (let i = 0; i < 11; i++) {
        const sx = -10 + i * 40;
        if (sx > reach) break;
        const h = (60 + Math.sin(i * 2.3) * 45) * clamp((reach - sx) / 120, 0, 1);
        const w = 11 + Math.sin(i * 1.4) * 4;
        const spikeGrd = ctx.createLinearGradient(sx, -6, sx, -6 - h);
        spikeGrd.addColorStop(0, "rgba(90, 190, 240, 0.95)");
        spikeGrd.addColorStop(0.55, "rgba(191, 240, 255, 0.9)");
        spikeGrd.addColorStop(1, "rgba(255, 255, 255, 0.95)");
        ctx.fillStyle = spikeGrd;
        ctx.beginPath();
        ctx.moveTo(sx - w, -4);
        ctx.lineTo(sx + Math.sin(i) * 6, -6 - h);
        ctx.lineTo(sx + w, -4);
        ctx.closePath(); ctx.fill();
        // Cạnh sáng lấp lánh của gai băng
        ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(sx - w * 0.35, -4); ctx.lineTo(sx + Math.sin(i) * 6, -6 - h);
        ctx.stroke();
      }

      // Hơi lạnh trắng đục cuộn là đà trên mặt băng
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 9; i++) {
        const mx = -10 + i * 46;
        if (mx > reach) break;
        const my = -16 - ((t * 2 + i * 13) % 46);
        ctx.fillStyle = `rgba(220, 245, 255, ${0.28 * (1 + my / 62)})`;
        ctx.beginPath(); ctx.arc(mx, my, 15 + Math.sin(t * 0.3 + i) * 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    };
  };

  // ---------------------------------------------------------------- HOOK INTO GAME MANAGER
  const installHooks = (Game) => {
    // 1. Vệt băng bám đuôi cho chim băng Pheasant Beak
    const origProjUpdate = Game.Projectile.prototype.update;
    Game.Projectile.prototype.update = function(dt) {
      origProjUpdate.call(this, dt);
      if (this.d.kind === "pheasant") Game.addTrail(this.x - this.dir * 44, this.y + (Math.random()*60 - 30), "#7fdcff", "#ffffff");
    };

    // 2. Vẽ đạn băng riêng của Aokiji
    const origProjDraw = Game.Projectile.prototype.draw;
    Game.Projectile.prototype.draw = function() {
      const { kind } = this.d;
      const ctx = document.getElementById("game").getContext("2d");

      if (kind === "ice_spear") {
        // PARTISAN: ngọn thương băng dài nhọn hoắt, lõi trắng trong suốt
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.dir < 0) ctx.scale(-1, 1);
        const grd = ctx.createLinearGradient(-28, 0, 28, 0);
        grd.addColorStop(0, "rgba(127, 220, 255, 0)");
        grd.addColorStop(0.55, "rgba(127, 220, 255, 0.9)");
        grd.addColorStop(1, "#ffffff");
        ctx.fillStyle = grd;
        ctx.shadowColor = "#7fdcff"; ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(28, 0);
        ctx.lineTo(6, -8);
        ctx.lineTo(-28, -3);
        ctx.lineTo(-28, 3);
        ctx.lineTo(6, 8);
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(24, 0); ctx.stroke();
        ctx.restore();
        return;
      }

      if (kind === "pheasant") {
        // ICE BLOCK: PHEASANT BEAK — con chim trĩ băng khổng lồ lao tới
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.dir < 0) ctx.scale(-1, 1);
        if (this.d.super) ctx.scale(1.5, 1.5);
        const t = this.t / 90;
        const flap = Math.sin(t * 1.6);

        // Quầng lạnh trắng xanh toả quanh
        ctx.globalCompositeOperation = "screen";
        const halo = ctx.createRadialGradient(-6, 0, 8, -6, 0, 88);
        halo.addColorStop(0, "rgba(191, 240, 255, 0.4)");
        halo.addColorStop(0.6, "rgba(127, 220, 255, 0.18)");
        halo.addColorStop(1, "rgba(127, 220, 255, 0)");
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(-6, 0, 88, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = "source-over";

        const bodyGrd = ctx.createLinearGradient(0, -34, 0, 34);
        bodyGrd.addColorStop(0, "#ffffff");
        bodyGrd.addColorStop(0.5, "#bff0ff");
        bodyGrd.addColorStop(1, "#5ab4e6");

        // ---- ĐÔI CÁNH BĂNG XOÈ RỘNG NGƯỢC LÊN/XUỐNG, CÓ 3 LÔNG VŨ TÁCH RÕ ----
        // Cánh vươn cao hẳn khỏi thân mới ra dáng chim, không thì thành con cá.
        const spread = 48 + flap * 16;
        for (const s of [-1, 1]) {
          ctx.fillStyle = s < 0 ? bodyGrd : "rgba(140, 215, 245, 0.95)";   // cánh xa mờ hơn cho có chiều sâu
          for (let k = 0; k < 3; k++) {
            const rfx = 6 - k * 7;          // gốc lông phía trước
            const rbx = -16 - k * 7;        // gốc lông phía sau (bản cánh rộng, không phải que băng)
            const tipX = -20 - k * 22;
            const tipY = s * (spread - k * 7);
            ctx.beginPath();
            ctx.moveTo(rfx, s * 2);
            ctx.quadraticCurveTo(rfx - 16, s * (spread * 0.62), tipX, tipY);
            ctx.quadraticCurveTo(rbx - 8, s * (spread * 0.42), rbx, s * 10);
            ctx.closePath(); ctx.fill();
          }
        }

        // Thân chim thon gọn
        ctx.fillStyle = bodyGrd;
        ctx.beginPath();
        ctx.moveTo(-44, 0);
        ctx.quadraticCurveTo(-18, -17, 12, -13);
        ctx.quadraticCurveTo(26, -10, 30, -4);
        ctx.quadraticCurveTo(26, 8, 12, 13);
        ctx.quadraticCurveTo(-18, 17, -44, 0);
        ctx.closePath(); ctx.fill();

        // Cổ vươn dài và đầu chim
        ctx.beginPath();
        ctx.moveTo(6, -11);
        ctx.quadraticCurveTo(24, -20, 36, -16);
        ctx.quadraticCurveTo(44, -12, 42, -4);
        ctx.quadraticCurveTo(30, -2, 10, 4);
        ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.ellipse(38, -12, 9, 8, -0.2, 0, Math.PI * 2); ctx.fill();

        // Mào chim trĩ dựng ngược trên đỉnh đầu
        ctx.fillStyle = "#ffffff";
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(33 + i * 3, -18);
          ctx.lineTo(30 + i * 4, -30 - Math.sin(t + i) * 4);
          ctx.lineTo(37 + i * 3, -19);
          ctx.closePath(); ctx.fill();
        }

        // Mỏ chim trĩ nhọn hoắt xuyên phá
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(44, -17); ctx.lineTo(84, -9); ctx.lineTo(44, -5);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(90, 180, 230, 0.9)"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(46, -11); ctx.lineTo(80, -9); ctx.stroke();

        // Mắt chim lạnh lẽo
        ctx.fillStyle = "#1b3a5c";
        ctx.beginPath(); ctx.arc(39, -14, 2.4, 0, Math.PI * 2); ctx.fill();

        // Đuôi lông băng dài lượt thượt phía sau
        ctx.fillStyle = "rgba(191, 240, 255, 0.85)";
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(-38, i * 4);
          ctx.lineTo(-92, i * 22 + flap * 5);
          ctx.lineTo(-40, i * 9);
          ctx.closePath(); ctx.fill();
        }

        // Vân băng nứt lấp lánh trên thân
        ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-26, -5); ctx.lineTo(-4, -9); ctx.lineTo(12, -5);
        ctx.moveTo(-20, 7); ctx.lineTo(4, 6);
        ctx.stroke();
        ctx.restore();
        return;
      }
      origProjDraw.call(this);
    };

    // 3. Băng vỡ tan tành khi chiêu băng của Aokiji kết nối
    Game.addIceShatter = function(x, y) {
      this.sparks.push({ kind:"ring", x, y, vx:0, vy:0, life:400, life0:400, r:12, rMax:150, color:"#bff0ff" });
      this.sparks.push({ kind:"ring", x, y, vx:0, vy:0, life:300, life0:300, r:12, rMax:105, color:"#ffffff" });

      // 28 mảnh băng vỡ văng tung toé
      for (let i = 0; i < 28; i++) {
        const angle = (i / 28) * Math.PI * 2 + Math.random() * 0.4;
        const spd = 200 + Math.random() * 280;
        this.sparks.push({
          kind: "dot",
          x, y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd - 110,
          life: 420 + Math.random() * 320,
          color: Math.random() < 0.4 ? "#ffffff" : (Math.random() < 0.7 ? "#bff0ff" : "#5ab4e6"),
          r: 2 + Math.random() * 4,
        });
      }
    };
  };

  // game.js chỉ gán window.OP_GAME ở cuối file — phải đợi nạp xong mới gắn hook được.
  if (typeof window !== "undefined") {
    const tryInstall = () => { if (window.OP_GAME) installHooks(window.OP_GAME); };
    if (window.OP_GAME) tryInstall();
    else if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", tryInstall);
    else tryInstall();
  }
})();
