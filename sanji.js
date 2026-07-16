/**
 * Sanji - Character Skills & Drawing Engine (Hắc Cước Sanji)
 * Fully modular extension with multi-projectile Poêle à Frire — Spectre fire-kicks and epic Diable Jambe — Flambage Shot fire explosion!
 */
(() => {
  "use strict";

  window.SanjiInit = (Fighter, MOVES) => {
    // ---------------------------------------------------------------- Move Set
    MOVES.sanji = {
      // 1. Cận chiến: đá liên hoàn nhanh
      close: { key:"close", name:"Collier Shoot", type:"melee",
        dmg:8, startup:55, active:85, recovery:150,
        reach:{dx:34,dy:-58,w:66,h:38}, knockback:215, launch:-30, meterGain:9,
        sfx:"punch", color:"#ff5a2b" },
      // 2. Tầm xa: loạt 5 lưỡi lửa hình bán nguyệt
      ranged: { key:"ranged", name:"Poêle à Frire: Spectre", type:"projectile",
        dmg:16, startup:110, active:320, recovery:230, meterGain:12,
        sfx:"punch",
        multiProj: { count: 5, interval: 58, dmg: 3, speed: 690 },
        proj:{ kind:"fire_kick", speed:690, w:52, h:34, dmg:3, knockback:120, launch:-25, life:1000, color:"#ff7f00" } },
      // 3. ↓+cận (miễn phí): xoay tròn như chong chóng, vừa xoay vừa lao tới giã liên tục
      partytable: { key:"partytable", name:"Party Table Kick Course — Đá Xoay", type:"melee",
        dmg:6, startup:150, active:430, recovery:280, meterGain:5,
        dash: 720,          // vừa xoay vừa lao thẳng tới trước
        multiHit: 110,      // xoay tới đâu giã tới đó (~4 nhịp trong pha ra đòn)
        // Vùng đánh bao QUANH người (dx âm) vì đang xoay tròn: xoay lao vượt qua đối thủ
        // thì phía sau vẫn phải trúng. Lực đẩy nhẹ để giã được nhiều nhịp.
        reach:{dx:-58,dy:-112,w:116,h:112}, knockback:80, launch:-22,
        sfx:"punch", color:"#ff6b2b" },
      // 4. SIÊU CHIÊU 1: chân bốc lửa ĐỎ rồi LAO THẲNG tới đối phương đá
      special: { key:"special", name:"Diable Jambe: Flambage Shot", type:"melee",
        dmg:24, startup:230, active:280, recovery:380, meterCost:50, meterGain:0,
        dash: 920,                                   // tự phi tới trước
        reach:{dx:18,dy:-108,w:98,h:86}, knockback:520, launch:-175,
        sfx:"special", cry:"Diable Jambe! Flambage Shot!", color:"#ff3a1a" },
      // 5. SIÊU CHIÊU 2 (↓+skill khi full Haki): lửa XANH Ifrit, lao nhanh & mạnh hơn
      ifrit: { key:"ifrit", name:"Ifrit Jambe: Bien Cuit", type:"melee",
        dmg:27, startup:560, active:340, recovery:420, meterCost:100, meterGain:0,
        // Sky Walk 2 bước lên không trung -> khoá ngay trên đầu đối thủ -> bổ thẳng xuống đá. LUÔN TRÚNG.
        skywalkDive: { steps: 2, height: 215 },
        reach:{dx:18,dy:-124,w:114,h:104}, knockback:600, launch:-210,
        sfx:"special", cry:"Ifrit Jambe!", color:"#3aa0ff" },
      // 6. SIÊU CHIÊU 3 (↓+xa): quạt lửa nhiều lưỡi đá toả ra khắp hướng
      grill: { key:"grill", name:"Diable Jambe: Grill Shot", type:"projectile",
        dmg:6, startup:200, active:0, recovery:390, meterCost:50, meterGain:0,
        sfx:"punch", cry:"Grill Shot!",
        spread: { count: 7, arcDeg: 76, dmg: 6, speed: 690 },
        proj:{ kind:"fire_kick", speed:690, w:52, h:34, dmg:6, knockback:170, launch:-45, life:1400, color:"#ff7f00" } },
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

    // ---------------------------------------------------------------- Main Draw Sanji Method
    Fighter.prototype.drawSanji = function(flash) {
      const swing = this.armSwing();
      const legs = this.legPose();
      const bob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 2.5 : (this.state === "walk" ? Math.abs(Math.sin(this.walkPhase)) * 3.5 : 0);
      const skin    = flash ? "#ffc2ad" : "#f6cfa4";
      const skinSh  = flash ? "#f0a48f" : "#e0ac7f";
      const suitCol = flash ? "#3a3d47" : "#1a1a24"; // Bộ comple đen
      const shirtCol = flash ? "#ffeed0" : "#305080"; // Áo sơ mi xanh dương bên trong

      const ctx = document.getElementById("game").getContext("2d");

      ctx.save();
      ctx.translate(0, -bob);
      ctx.lineJoin = "round"; ctx.lineCap = "round";

      // ---- HIỆU ỨNG CHÂN LỬA DIABLE JAMBE (Khi nộ đầy 100% hoặc khi tung tuyệt chiêu) ----
      const atkKey = (this.state === "attack" && this.attack) ? this.attack.def.key : null;
      const attackingNow = this.state === "attack" && this.attack;

      // ---- PARTY TABLE KICK COURSE: cả người xoay tròn như chong chóng ----
      // Xoay quanh eo, hai chân duỗi thẳng thành hình kéo -> nhìn như bánh xe lăn tới.
      const isSpin = attackingNow && atkKey === "partytable";
      let spinAng = 0, spinLift = 0;
      if (isSpin) {
        const a = this.attack, d = a.def;
        const aEnd = d.startup + d.active;
        if (a.elapsed < d.startup) {
          spinAng = -0.5 * (a.elapsed / d.startup);          // ghìm người lấy đà
        } else {
          spinAng = (a.elapsed - d.startup) / 1000 * 19;      // ~3 vòng/giây
          // Nhấc bổng khỏi mặt sàn: xoay như bánh xe mà vẫn dính đất thì đầu chúi lút sàn
          spinLift = a.elapsed < aEnd
            ? 40 * clamp((a.elapsed - d.startup) / 110, 0, 1)
            : 40 * clamp(1 - (a.elapsed - aEnd) / d.recovery, 0, 1);
        }
        ctx.save();
        ctx.translate(0, -62 - spinLift); ctx.rotate(spinAng); ctx.translate(0, 62);
      }
      const isIfrit = atkKey === "ifrit";                       // lửa XANH (siêu chiêu 2)
      const isDiable = this.meter >= 100 || atkKey === "special" || isIfrit;
      if (isDiable) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const anim = this.animTime * 15;
        // Lửa bốc cuộn quanh chân trước
        const kneeR = 6 + Math.sin(legs.b) * 16;
        const footR = kneeR + Math.sin(legs.b) * 8 + 4;
        const fx = footR, fy = -10;
        for (let i = 0; i < 5; i++) {
          const rx = fx + Math.sin(anim * 0.4 + i) * 8;
          const ry = fy - i * 8 - (anim % 12);
          const r = 5 + Math.sin(anim * 0.2 + i) * 2.5;
          ctx.fillStyle = i % 2 ? "rgba(255, 69, 0, 0.7)" : "rgba(255, 165, 0, 0.5)";
          ctx.beginPath(); ctx.arc(rx, ry, r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }

      // Draw Back Arm (đút túi quần thong thả chuẩn quý ông!)
      ctx.strokeStyle = suitCol; ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(-11, -85);
      ctx.lineTo(-17, -70);
      ctx.lineTo(-10, -56); // Tay đút túi quần
      ctx.stroke();

      // ĐÔI CHÂN TÂY ĐEN DÀI THON GỌN (Lãng tử tỷ lệ chân dài miên man)
      // Chân sau (Trái) — lúc xoay thì duỗi thẳng ngược ra sau cho thành hình kéo
      const kneeL = -6 + Math.sin(legs.a) * 16;
      const footL = kneeL + Math.sin(legs.a) * 8 + 4;
      if (isSpin) {
        ctx.strokeStyle = "#0f1013"; ctx.lineWidth = 14;
        ctx.beginPath(); ctx.moveTo(-4, -56); ctx.lineTo(-30, -60); ctx.stroke();
        ctx.strokeStyle = "#0f1013"; ctx.lineWidth = 11;
        ctx.beginPath(); ctx.moveTo(-30, -60); ctx.lineTo(-58, -64); ctx.stroke();
        ctx.save(); ctx.translate(-58, -64); ctx.rotate(Math.PI);
        ctx.fillStyle = "#1e1f26"; roundRect(ctx, -5, -5, 23, 10, 4); ctx.fill();
        ctx.restore();
      } else {
        ctx.strokeStyle = "#0f1013"; ctx.lineWidth = 14;
        ctx.beginPath(); ctx.moveTo(-6, -52); ctx.lineTo(kneeL, -28); ctx.stroke();
        ctx.strokeStyle = "#0f1013"; ctx.lineWidth = 11;
        ctx.beginPath(); ctx.moveTo(kneeL, -27); ctx.lineTo(footL, -10); ctx.stroke();
        ctx.fillStyle = "#1e1f26"; roundRect(ctx, footL - 7, -11, 22, 9, 4); ctx.fill();
      }

      // ---- LAO TỚI ĐÁ CHÂN LỬA (Diable Jambe đỏ / Ifrit Jambe xanh) ----
      const isDashKick = atkKey === "special" || atkKey === "ifrit";
      if (isDashKick) {
        const F = isIfrit
          ? { c1: "#eaf6ff", c2: "#3aa0ff", c3: "#0b3fa8", glow: "rgba(90,190,255,", spark: "#9fe0ff" }
          : { c1: "#fff4cc", c2: "#ff8a2b", c3: "#d1330f", glow: "rgba(255,140,20,",  spark: "#ffd23f" };
        const t = this.animTime * 14;
        const ext = 26 + Math.max(0, swing) * 66;      // chân duỗi thẳng ra trước
        const ky = -96;
        ctx.save();
        ctx.lineCap = "round"; ctx.lineJoin = "round";

        // vệt lửa kéo dài phía sau (cảm giác phi tới)
        ctx.globalCompositeOperation = "lighter";
        for (let k = 0; k < 3; k++) {
          const w = 26 - k * 7, L = 100 - k * 26;
          ctx.fillStyle = `${F.glow}${0.16 + k * 0.1})`;
          ctx.beginPath();
          ctx.moveTo(8, -70 - w * 0.4);
          ctx.quadraticCurveTo(-L * 0.5, -70 + Math.sin(t + k) * 6, -L, -66);
          ctx.quadraticCurveTo(-L * 0.5, -70 + w * 0.8, 8, -70 + w * 0.4);
          ctx.closePath(); ctx.fill();
        }
        // quầng lửa quanh chân đá
        const g = ctx.createRadialGradient(ext, ky, 4, ext, ky, 40);
        g.addColorStop(0, `${F.glow}0.95)`); g.addColorStop(0.45, `${F.glow}0.5)`); g.addColorStop(1, `${F.glow}0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(ext, ky, 40, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = "source-over";

        // chân trụ (sau)
        ctx.strokeStyle = "#0f1013"; ctx.lineWidth = 13;
        ctx.beginPath(); ctx.moveTo(-4, -52); ctx.lineTo(-12, -28); ctx.lineTo(-10, -9); ctx.stroke();
        ctx.fillStyle = "#1e1f26"; roundRect(ctx, -17, -11, 22, 9, 4); ctx.fill();

        // CHÂN ĐÁ vươn thẳng tới trước, ống quần đen -> lửa
        const legGrd = ctx.createLinearGradient(6, -60, ext, ky);
        legGrd.addColorStop(0, "#15151c"); legGrd.addColorStop(0.45, F.c3); legGrd.addColorStop(1, F.c2);
        ctx.strokeStyle = legGrd; ctx.lineWidth = 15;
        ctx.beginPath(); ctx.moveTo(4, -58); ctx.lineTo(ext * 0.55, ky + 6); ctx.lineTo(ext, ky); ctx.stroke();
        // giày rực lửa + mũi nhọn
        const bg = ctx.createRadialGradient(ext - 4, ky - 4, 2, ext, ky, 15);
        bg.addColorStop(0, F.c1); bg.addColorStop(0.5, F.c2); bg.addColorStop(1, F.c3);
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.ellipse(ext, ky, 14, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(ext + 9, ky - 8); ctx.lineTo(ext + 22, ky); ctx.lineTo(ext + 9, ky + 8); ctx.closePath(); ctx.fill();
        // đốm lửa bắn ra
        ctx.fillStyle = F.spark;
        for (let i = 0; i < 3; i++) {
          const a2 = t * 0.6 + i * 2.1;
          ctx.beginPath(); ctx.arc(ext - 16 - i * 12, ky + Math.sin(a2) * 12, 2.6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }

      // Chân trước (Phải) - Có thể hóa chân lửa đỏ rực
      const kneeR = 6 + Math.sin(legs.b) * 16;
      const footR = kneeR + Math.sin(legs.b) * 8 + 4;

      const fireLegGrd = ctx.createLinearGradient(6, -52, footR, -10);
      if (isDiable) {
        fireLegGrd.addColorStop(0, suitCol);
        fireLegGrd.addColorStop(0.5, "#ff4500"); // Chân chuyển lửa đỏ rực
        fireLegGrd.addColorStop(1, "#ffd700"); // Gót chân nóng chảy màu vàng
      } else {
        fireLegGrd.addColorStop(0, suitCol);
        fireLegGrd.addColorStop(1, "#15151c");
      }
      // ---- SANJI KHÔNG BAO GIỜ ĐÁNH BẰNG TAY: mọi đòn đều tung chân ----
      // Mỗi chiêu một quỹ đạo bàn chân riêng, bám sát đúng vùng sát thương của chiêu đó.
      const kickPose = () => {
        if (isDashKick || !attackingNow) return null;
        const sw = Math.max(0, swing);
        const a = this.attack, d = a.def;
        if (atkKey === "close") {
          // Collier Shoot: đá tống ngang cực nhanh
          return { fx: 24 + sw * 56, fy: -48 - sw * 8, bend: 12, fire: isDiable, arc: sw };
        }
        if (atkKey === "ranged" || atkKey === "grill") {
          // Spectre / Grill Shot: quét chân bắn lưỡi lửa, đá liên tục trong pha ra đòn
          const rep = Math.sin(this.animTime * 26) * 0.5 + 0.5;
          const e = a.phase === "startup" ? sw : 0.55 + rep * 0.45;
          return { fx: 20 + e * 60, fy: -84 + Math.cos(this.animTime * 26) * 12, bend: 16, fire: true, arc: e };
        }
        if (atkKey === "partytable") {
          // Party Table: chân trước duỗi thẳng căng ra trước, cả người xoay quanh nó
          const p = a.phase === "startup" ? clamp(a.elapsed / d.startup, 0, 1) : 1;
          return { fx: 26 + p * 36, fy: -60 - p * 4, bend: 14 - p * 16, fire: isDiable, arc: 0 };
        }
        return null;
      };

      // Vẽ chân đá: hông -> gối -> bàn chân, giày xoay theo đúng hướng đá
      const drawKickLeg = (k) => {
        const hipX = 5, hipY = -57;
        const mx = hipX + (k.fx - hipX) * 0.55;
        const my = hipY + (k.fy - hipY) * 0.55 - (k.bend || 12);

        // Vệt quét của cú đá
        if (k.arc > 0.15) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = isIfrit ? "rgba(90,190,255,0.35)" : (k.fire ? "rgba(255,140,20,0.35)" : "rgba(255,255,255,0.18)");
          ctx.lineWidth = 13;
          ctx.beginPath();
          ctx.moveTo(hipX, hipY);
          ctx.quadraticCurveTo(mx + 10, my + 16, k.fx - 6, k.fy + 8);
          ctx.stroke();
          ctx.restore();
        }

        // Quầng lửa quanh bàn chân (chân lửa)
        if (k.fire) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          const g = ctx.createRadialGradient(k.fx, k.fy, 3, k.fx, k.fy, 30);
          const glow = isDiable ? "rgba(255,140,20," : "rgba(255,90,20,";
          g.addColorStop(0, `${glow}0.85)`); g.addColorStop(0.5, `${glow}0.35)`); g.addColorStop(1, `${glow}0)`);
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(k.fx, k.fy, 30, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }

        const legGrd = ctx.createLinearGradient(hipX, hipY, k.fx, k.fy);
        legGrd.addColorStop(0, suitCol);
        if (k.fire && isDiable) { legGrd.addColorStop(0.5, "#ff4500"); legGrd.addColorStop(1, "#ffd700"); }
        else if (k.fire) { legGrd.addColorStop(0.6, "#2a2a34"); legGrd.addColorStop(1, "#ff7a2b"); }
        else legGrd.addColorStop(1, "#15151c");

        ctx.strokeStyle = legGrd; ctx.lineWidth = 15;
        ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(mx, my); ctx.stroke();
        ctx.lineWidth = 12;
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(k.fx, k.fy); ctx.stroke();

        // Giày da bóng loáng, xoay theo trục cẳng chân
        ctx.save();
        ctx.translate(k.fx, k.fy);
        ctx.rotate(Math.atan2(k.fy - my, k.fx - mx));
        ctx.fillStyle = k.fire && isDiable ? "#ffd700" : "#262830";
        roundRect(ctx, -5, -5, 23, 10, 4); ctx.fill();
        ctx.restore();

        // Concassé nện gót xuống: bụi lửa toé lên khỏi mặt sàn
        if (k.slam !== undefined && k.slam > 0.75) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = "rgba(255,190,60,0.6)";
          for (let i = 0; i < 5; i++) {
            const sx = k.fx - 10 + i * 9;
            const sy = -8 - Math.abs(Math.sin(i * 1.7 + this.animTime * 12)) * 22;
            ctx.beginPath(); ctx.arc(sx, sy, 3.5 - i * 0.4, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        }
      };

      const kick = kickPose();
      if (kick) drawKickLeg(kick);
      else if (!isDashKick) {   // khi lao đá thì đã vẽ tư thế đá riêng ở trên
        ctx.strokeStyle = fireLegGrd; ctx.lineWidth = 14;
        ctx.beginPath(); ctx.moveTo(6, -52); ctx.lineTo(kneeR, -28); ctx.stroke();
        ctx.strokeStyle = fireLegGrd; ctx.lineWidth = 11;
        ctx.beginPath(); ctx.moveTo(kneeR, -27); ctx.lineTo(footR, -10); ctx.stroke();

        // Giày da bóng loáng
        ctx.fillStyle = isDiable ? "#ffd700" : "#262830";
        roundRect(ctx, footR - 7, -11, 22, 9, 4); ctx.fill();
      }

      // ---- ÁO VEST ĐEN SLIM-FIT ----
      ctx.fillStyle = suitCol;
      ctx.beginPath();
      ctx.moveTo(-13, -105); ctx.quadraticCurveTo(0, -108, 13, -105);
      ctx.lineTo(10, -56); ctx.quadraticCurveTo(0, -53, -10, -56);
      ctx.closePath(); ctx.fill();

      // Áo sơ mi xanh dương và cà vạt đen bên trong
      ctx.fillStyle = shirtCol;
      ctx.beginPath(); ctx.moveTo(-5, -105); ctx.lineTo(5, -105); ctx.lineTo(0, -84); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#101015"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -105); ctx.lineTo(0, -86); ctx.stroke(); // Cà vạt đen

      // ---- ĐẦU SANJI (Mái tóc vàng lãng tử che một bên mắt) ----
      this.drawHeadSanji(skin, skinSh, flash);

      // ---- TAY TRƯỚC: LUÔN ĐÚT TÚI QUẦN ----
      // Sanji tuyệt đối không đánh bằng tay (tay là để nấu ăn) -> kể cả lúc ra đòn vẫn đút túi,
      // chỉ hơi rung theo nhịp đá cho có lực.
      const kickShake = kick ? Math.sin(this.animTime * 30) * 1.6 : 0;
      ctx.strokeStyle = suitCol; ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(11, -85 + kickShake);
      ctx.lineTo(17, -70 + kickShake);
      ctx.lineTo(10, -56);
      ctx.stroke();

      // Đóng phép xoay của Party Table, rồi vẽ vòng khí xoáy (vẽ ở hệ toạ độ KHÔNG xoay
      // để vòng xoáy đứng yên còn người quay tít bên trong)
      if (isSpin) {
        ctx.restore();
        if (this.attack && this.attack.phase !== "startup") {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          const t = this.animTime * 20;
          for (let i = 0; i < 3; i++) {
            const r = 52 + i * 9;
            const a0 = t * 1.4 + i * 2.1;
            ctx.strokeStyle = isDiable ? `rgba(255,150,40,${0.4 - i * 0.1})` : `rgba(220,235,255,${0.32 - i * 0.09})`;
            ctx.lineWidth = 6 - i * 1.4;
            ctx.beginPath(); ctx.arc(0, -62 - spinLift, r, a0, a0 + Math.PI * 1.15); ctx.stroke();
          }
          // bụi cuốn dưới chân do lao tới
          ctx.fillStyle = "rgba(255,220,170,0.45)";
          for (let i = 0; i < 4; i++) {
            const dx = -18 - i * 14 - (t * 3 % 20);
            ctx.beginPath(); ctx.arc(dx, -10 - Math.sin(t + i) * 5, 3.5 - i * 0.5, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        }
      }

      ctx.restore();
    };

    // ---------------------------------------------------------------- Head Sanji
    Fighter.prototype.drawHeadSanji = function(skin, skinSh, flash) {
      const ctx = document.getElementById("game").getContext("2d");
      const headBob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 0.8 : 0;
      ctx.save();
      ctx.translate(0, headBob);

      // Cổ thon cao
      ctx.fillStyle = skinSh; roundRect(ctx, -3, -112, 6, 11, 2); ctx.fill();
      
      // Mặt thon nhỏ 1:7 dũng mãnh lãng tử
      const fg = ctx.createLinearGradient(-11, -132, 11, -110);
      fg.addColorStop(0, skin); fg.addColorStop(1, skinSh);
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(0, -121, 12, 0, Math.PI * 2); ctx.fill();

      // Tai thon gọn
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(-11, -120, 2.5, 0, Math.PI * 2); ctx.fill();

      // Mái tóc vàng lãng tử che khuất mắt trái (bên phải theo hướng vẽ)
      ctx.fillStyle = flash ? "#fff3a0" : "#ffd700";
      ctx.beginPath();
      ctx.moveTo(-13, -122);
      ctx.quadraticCurveTo(-15, -134, -4, -136);
      ctx.quadraticCurveTo(0, -141, 6, -135);
      ctx.quadraticCurveTo(12, -138, 14, -130);
      ctx.quadraticCurveTo(15, -122, 11, -114); // Tóc rủ che mắt
      ctx.quadraticCurveTo(4, -126, -3, -124);
      ctx.quadraticCurveTo(-9, -126, -13, -122);
      ctx.closePath(); ctx.fill();

      // Râu cằm mỏng dê cụ cực ngầu của Sanji
      ctx.strokeStyle = "rgba(100,80,10,0.45)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-3, -110); ctx.lineTo(3, -110); ctx.stroke();

      // Chân mày xoắn ốc thương hiệu đặc trưng (chỉ vẽ chân mày mắt phải lộ ra)
      ctx.strokeStyle = "#403000"; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(-4, -126, 1.8, 0, Math.PI * 1.5); ctx.stroke();

      // Mắt phải thon gọn (Mắt trái bị tóc vàng che phủ)
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.ellipse(-4, -121, 2.5, 3.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#2c1f10";
      ctx.beginPath(); ctx.arc(-3.5, -120, 1.5, 0, Math.PI * 2); ctx.fill();

      // ---- ĐIẾU THUỐC LÁ LẤP LÁNH KHÓI BAY (Thương hiệu của Sanji!) ----
      const cigX = 4, cigY = -113;
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cigX, cigY); ctx.lineTo(cigX + 7, cigY + 1.5); ctx.stroke(); // Thân thuốc lá trắng
      
      // Đầu đỏ lửa lấp lánh dập dềnh
      ctx.fillStyle = "#ff5722";
      ctx.beginPath(); ctx.arc(cigX + 7, cigY + 1.5, 1.1, 0, Math.PI * 2); ctx.fill();

      // Khói thuốc bay cuộn tròn mờ ảo bốc lên
      const sAnim = this.animTime * 4;
      const smokeX = cigX + 9 + Math.sin(sAnim) * 5;
      const smokeY = cigY - 8 - (sAnim % 15);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.35 * (1 - (smokeY - (cigY-25))/-25)})`;
      ctx.beginPath(); ctx.arc(smokeX, smokeY, 2 + Math.sin(sAnim)*1.1, 0, Math.PI * 2); ctx.fill();

      ctx.restore();
    };
  };

  // ---------------------------------------------------------------- HOOK INTO GAME MANAGER
  // sanji.js nạp TRƯỚC game.js -> không dùng window.OP_GAME lúc load được.
  // game.js sẽ gọi hook này sau khi Game/Projectile đã sẵn sàng.
  window.SanjiHook = (Game) => {
    {

    // 1. Hook/Override Projectile.prototype.draw để vẽ đạn chân lửa Spectre cực kỳ sắc nét hoành tráng!
    const origProjDraw = Game.Projectile.prototype.draw;
    Game.Projectile.prototype.draw = function() {
      const { kind, color } = this.d;
      const ctx = document.getElementById("game").getContext("2d");
      
      // ---- SIÊU CHIÊU: cú đá bọc lửa (đỏ = Diable Jambe / xanh = Ifrit Jambe) ----
      if (kind === "flambage" || kind === "ifrit") {
        const blue = kind === "ifrit";
        const t = this.t / 55;
        const C = blue
          ? { tail: ["rgba(20,80,220,0.45)", "rgba(60,160,255,0.55)", "rgba(140,220,255,0.72)", "rgba(230,250,255,0.92)"],
              h1: "rgba(210,242,255,0.95)", h2: "rgba(60,160,255,0.6)", h3: "rgba(20,90,220,0)",
              boot: ["#eaf6ff", "#3aa0ff", "#0b3fa8"] }
          : { tail: ["rgba(190,25,0,0.45)", "rgba(255,80,0,0.55)", "rgba(255,160,30,0.72)", "rgba(255,232,150,0.92)"],
              h1: "rgba(255,245,200,0.95)", h2: "rgba(255,120,20,0.6)", h3: "rgba(255,60,0,0)",
              boot: ["#fff4cc", "#ff8a2b", "#d1330f"] };
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.dir < 0) ctx.scale(-1, 1);

        // Đuôi lửa comet nhiều lớp
        ctx.globalCompositeOperation = "lighter";
        const L = [88, 70, 54, 38], Wd = [29, 21, 14, 8];
        for (let k = 0; k < 4; k++) {
          const wob = Math.sin(t + k * 0.7) * 4;
          ctx.fillStyle = C.tail[k];
          ctx.beginPath();
          ctx.moveTo(16, -Wd[k]);
          ctx.quadraticCurveTo(-L[k] * 0.35, -Wd[k] - 3 + wob, -L[k], wob);
          ctx.quadraticCurveTo(-L[k] * 0.35, Wd[k] + 3 + wob, 16, Wd[k]);
          ctx.quadraticCurveTo(26, 0, 16, -Wd[k]);
          ctx.closePath(); ctx.fill();
        }
        // Lưỡi lửa lắt lay
        for (let i = 0; i < 4; i++) {
          const f = i / 4, bx = 12 - f * 62;
          const fy = Math.sin(t * 1.6 + i * 1.4) * (8 + f * 13);
          ctx.fillStyle = blue ? "rgba(90,190,255,0.5)" : "rgba(255,150,0,0.5)";
          ctx.beginPath();
          ctx.moveTo(bx, 0);
          ctx.quadraticCurveTo(bx - 7, fy, bx - 15, fy * 1.25);
          ctx.quadraticCurveTo(bx - 5, fy * 0.4, bx, 0);
          ctx.closePath(); ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";

        // Quầng nhiệt quanh giày
        const halo = ctx.createRadialGradient(22, 0, 3, 22, 0, 34);
        halo.addColorStop(0, C.h1); halo.addColorStop(0.5, C.h2); halo.addColorStop(1, C.h3);
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(22, 0, 34, 0, Math.PI * 2); ctx.fill();

        // Ống quần đen (Hắc Cước) + giày da bóng mũi nhọn
        ctx.lineCap = "round";
        ctx.strokeStyle = "#15151c"; ctx.lineWidth = 15;
        ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(6, 0); ctx.stroke();
        const bg = ctx.createRadialGradient(18, -5, 3, 23, 4, 20);
        bg.addColorStop(0, C.boot[0]); bg.addColorStop(0.45, C.boot[1]); bg.addColorStop(1, C.boot[2]);
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.ellipse(22, 0, 17, 12.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(33, -9.5); ctx.lineTo(48, 0); ctx.lineTo(33, 9.5); ctx.closePath(); ctx.fill();
        // đế giày + ánh sáng
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.beginPath(); ctx.ellipse(22, 9, 15, 3.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.beginPath(); ctx.arc(16, -5, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        return;
      }

      if (kind === "fire_kick") {
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.dir < 0) ctx.scale(-1, 1);
        
        // Sóng lửa hình bán nguyệt dẹt rực cháy cuộn khói
        const grd = ctx.createLinearGradient(-25, 0, 25, 0);
        grd.addColorStop(0, "rgba(255, 69, 0, 0)");
        grd.addColorStop(0.5, "rgba(255, 127, 0, 0.85)");
        grd.addColorStop(1, "#ffd700");
        ctx.strokeStyle = grd;
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        
        ctx.beginPath();
        ctx.arc(0, 0, 16, -Math.PI * 0.45, Math.PI * 0.45);
        ctx.stroke();

        // Lõi lửa trắng trung tâm
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(2, 0, 15, -Math.PI * 0.35, Math.PI * 0.35);
        ctx.stroke();

        // Các tia lửa tàn lấp lánh bốc ra phía sau
        ctx.fillStyle = "#ff4500";
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(-15 - i * 6, -6 + i * 6, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        return;
      }
      origProjDraw.call(this);
    };

    // 2. Định nghĩa vụ nổ lửa Diable Jambe khổng lồ cực ngầu cho tuyệt chiêu Flambage Shot của Sanji!
    Game.addFireExplosion = function(x, y) {
      // Vòng tròn lửa đỏ mở rộng
      this.sparks.push({
        kind: "ring",
        x, y,
        vx: 0, vy: 0,
        life: 380, life0: 380,
        r: 10, rMax: 130,
        color: "#ff4500"
      });
      // 24 hạt lửa bùng cháy dữ dội tóe ra bốn phương tám hướng
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2 + Math.random() * 0.5;
        const spd = 200 + Math.random() * 250;
        this.sparks.push({
          kind: "dot",
          x, y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd - 80, // Hơi bốc bay lên trời cao
          life: 400 + Math.random() * 300,
          color: Math.random() < 0.4 ? "#ffd700" : (Math.random() < 0.7 ? "#ff7f00" : "#ff2a00"),
          r: 3 + Math.random() * 4
        });
      }
    };
    }
  };
})();
