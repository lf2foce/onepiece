/**
 * Portgas D. Ace — Character Skills & Drawing Engine (Hỏa Quyền Ace / Mera Mera no Mi)
 * Bộ 5 chiêu: Fire Fist Jab (cận), Higan (loạt đạn lửa), Kagerou (↓+skill),
 * Hiken (siêu chiêu 1) và Dai Enkai: Entei (siêu chiêu 2 — quả cầu lửa khổng lồ).
 */
(() => {
  "use strict";

  window.AceInit = (Fighter, MOVES) => {
    // ---------------------------------------------------------------- Move Set
    MOVES.ace = {
      close: { key:"close", name:"Fire Fist Jab", type:"melee",
        dmg:8, startup:60, active:90, recovery:165,
        reach:{dx:34,dy:-60,w:64,h:36}, knockback:220, launch:-32, meterGain:9,
        sfx:"punch", color:"#ff8c00" },
      ranged: { key:"ranged", name:"Higan — Đạn Lửa Ngón Tay", type:"projectile",
        dmg:15, startup:110, active:340, recovery:230, meterGain:12,
        sfx:"punch",
        multiProj: { count: 5, interval: 68, dmg: 3, speed: 720 },
        proj:{ kind:"fire_bullet", speed:720, w:38, h:22, dmg:3, knockback:110, launch:-20, life:1000, color:"#ff8c00" } },
      // SIÊU CHIÊU 2 khi chưa đầy Haki (↓+skill) — quét sóng lửa ảo ảnh tầm trung
      kagerou: { key:"kagerou", name:"Kagerou — Sóng Lửa Ảo Ảnh", type:"melee",
        dmg:16, startup:200, active:220, recovery:260,
        reach:{dx:18,dy:-130,w:250,h:130}, knockback:330, launch:-70, meterGain:14,
        sfx:"punch", color:"#ff5722" },
      special: { key:"special", name:"Hiken — Hỏa Quyền", type:"projectile",
        dmg:23, startup:220, active:0, recovery:420, meterCost:50, meterGain:0,
        sfx:"special", cry:"Hiken!",
        proj:{ kind:"hiken", speed:640, w:170, h:130, dmg:23, knockback:520, launch:-180, life:2200, color:"#ff4500" } },
      // SIÊU CHIÊU 2 khi FULL Haki (↓+skill) — Đại Viêm Giới: Viêm Đế
      // Quả cầu lửa khổng lồ bung nổ ngay quanh thân Ace (đòn cuối đấu Râu Đen), hitbox phủ cả hai phía.
      entei: { key:"entei", name:"Dai Enkai: Entei", type:"melee",
        dmg:26, startup:380, active:300, recovery:520, meterCost:100, meterGain:0,
        reach:{dx:-210,dy:-360,w:420,h:400}, knockback:700, launch:-220,
        sfx:"special", cry:"Dai Enkai! Entei!", color:"#ff2a00" },
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

    // ---------------------------------------------------------------- Main Draw Ace
    Fighter.prototype.drawAce = function(flash) {
      const swing = this.armSwing();
      const legs = this.legPose();
      const bob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 2.5 : (this.state === "walk" ? Math.abs(Math.sin(this.walkPhase)) * 3.5 : 0);
      const skin   = flash ? "#ffc2ad" : "#f6cfa4";
      const skinSh = flash ? "#f0a48f" : "#e0ac7f";
      const shortCol = flash ? "#3a3d47" : "#15151b";   // Quần short đen
      const beltCol  = flash ? "#ffd9a0" : "#e8912a";   // Thắt lưng cam có khóa chữ A

      const ctx = document.getElementById("game").getContext("2d");
      const attacking = this.state === "attack" && this.attack;
      const atkKey = attacking ? this.attack.def.key : null;
      // Logia hoá lửa: khi đầy Haki hoặc đang tung chiêu lửa lớn
      const isBlaze = this.meter >= 100 || atkKey === "special" || atkKey === "entei" || atkKey === "kagerou";

      ctx.save();
      ctx.translate(0, -bob);
      ctx.lineJoin = "round"; ctx.lineCap = "round";

      // ---- HIỆU ỨNG NGỌN LỬA MERA MERA CUỘN QUANH THÂN ----
      if (isBlaze) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const anim = this.animTime * 9;
        for (let i = 0; i < 7; i++) {
          const fy = -((anim * 16 + i * 21) % 125);
          const fx = Math.sin(anim * 0.35 + i * 1.9) * 21;
          const r = 5 + Math.sin(anim * 0.3 + i) * 3.2;
          const op = clamp(0.5 * (1 + fy / 125), 0, 0.55);
          ctx.fillStyle = i % 3 === 0 ? `rgba(255, 215, 0, ${op})`
                        : (i % 3 === 1 ? `rgba(255, 87, 34, ${op})` : `rgba(255, 140, 0, ${op * 0.9})`);
          ctx.beginPath();
          ctx.moveTo(fx, fy + r * 1.6);
          ctx.quadraticCurveTo(fx - r, fy, fx, fy - r * 1.8);
          ctx.quadraticCurveTo(fx + r, fy, fx, fy + r * 1.6);
          ctx.fill();
        }
        ctx.restore();
      }

      this.drawBackArm(skin, skinSh);

      // ---- ĐÔI CHÂN: QUẦN SHORT ĐEN + ỦNG ĐEN CAO CỔ ----
      const kneeL = -6 + Math.sin(legs.a) * 16;
      const footL = kneeL + Math.sin(legs.a) * 8 + 4;
      ctx.strokeStyle = "#0e0e13"; ctx.lineWidth = 16;                    // Đùi sau (short)
      ctx.beginPath(); ctx.moveTo(-6, -52); ctx.lineTo(kneeL, -34); ctx.stroke();
      ctx.strokeStyle = skinSh; ctx.lineWidth = 11;                        // Bắp chân trần
      ctx.beginPath(); ctx.moveTo(kneeL, -33); ctx.lineTo(footL, -16); ctx.stroke();
      ctx.fillStyle = "#101015"; roundRect(ctx, footL - 8, -19, 21, 17, 4); ctx.fill();

      const kneeR = 6 + Math.sin(legs.b) * 16;
      const footR = kneeR + Math.sin(legs.b) * 8 + 4;
      ctx.strokeStyle = shortCol; ctx.lineWidth = 16;
      ctx.beginPath(); ctx.moveTo(6, -52); ctx.lineTo(kneeR, -34); ctx.stroke();
      // Bắp chân trần: hoá lửa vàng cam khi bùng Haki
      const legGrd = ctx.createLinearGradient(kneeR, -33, footR, -16);
      legGrd.addColorStop(0, skin);
      legGrd.addColorStop(1, isBlaze ? "#ff7f00" : skin);
      ctx.strokeStyle = legGrd; ctx.lineWidth = 11;
      ctx.beginPath(); ctx.moveTo(kneeR, -33); ctx.lineTo(footR, -16); ctx.stroke();
      // Ủng đen cao cổ có viền cam
      ctx.fillStyle = "#1a1a22"; roundRect(ctx, footR - 8, -19, 21, 17, 4); ctx.fill();
      ctx.strokeStyle = beltCol; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(footR - 7, -17); ctx.lineTo(footR + 12, -17); ctx.stroke();

      // ---- THÂN TRÊN CỞI TRẦN, CƠ BẮP SĂN CHẮC ----
      const torsoGrd = ctx.createLinearGradient(-13, -105, 13, -56);
      torsoGrd.addColorStop(0, skin); torsoGrd.addColorStop(1, skinSh);
      ctx.fillStyle = torsoGrd;
      ctx.beginPath();
      ctx.moveTo(-14, -105); ctx.quadraticCurveTo(0, -109, 14, -105);
      ctx.lineTo(10, -58); ctx.quadraticCurveTo(0, -55, -10, -58);
      ctx.closePath(); ctx.fill();

      // Cơ ngực + cơ bụng 6 múi
      ctx.strokeStyle = "rgba(150, 95, 55, 0.4)"; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-10, -96); ctx.quadraticCurveTo(0, -90, 10, -96);   // rãnh ngực
      ctx.moveTo(0, -92); ctx.lineTo(0, -66);                         // đường bụng dọc
      ctx.moveTo(-7, -84); ctx.lineTo(7, -84);
      ctx.moveTo(-6, -76); ctx.lineTo(6, -76);
      ctx.stroke();

      // Hình xăm "ASCE" (chữ S bị gạch — tưởng nhớ Sabo) trên bụng bên hông
      ctx.fillStyle = "rgba(20,20,28,0.75)";
      ctx.font = "900 7px Arial, sans-serif"; ctx.textAlign = "center";
      ctx.save(); ctx.scale(-1, 1);   // bù lật ngang để chữ luôn đọc xuôi
      ctx.fillText("ASCE", 0, -70);
      ctx.restore();

      // Thắt lưng cam bản to + khóa chữ "A"
      ctx.fillStyle = beltCol; roundRect(ctx, -12, -62, 24, 7, 2); ctx.fill();
      ctx.fillStyle = "#f7f2e4"; roundRect(ctx, -3.5, -61, 7, 5, 1.5); ctx.fill();
      ctx.fillStyle = "#15151b";
      ctx.font = "900 5px Arial, sans-serif"; ctx.textAlign = "center";
      ctx.save(); ctx.scale(-1, 1); ctx.fillText("A", 0, -56.8); ctx.restore();

      // Dây chuyền hạt đỏ đặc trưng quanh cổ
      ctx.fillStyle = flash ? "#ff8a8a" : "#c02626";
      for (let i = -4; i <= 4; i++) {
        const bx = i * 2.1;
        const by = -104 + Math.abs(i) * 0.55;
        ctx.beginPath(); ctx.arc(bx, by, 1.5, 0, Math.PI * 2); ctx.fill();
      }

      // ---- ĐẦU ACE (tóc đen bù xù, tàn nhang, mũ cam vành rộng) ----
      this.drawHeadAce(skin, skinSh, flash, isBlaze);

      // ---- TAY TRƯỚC: NẮM ĐẤM LỬA HIKEN ----
      this.drawFrontArmAce(swing, skin, skinSh, isBlaze);

      // ---- DAI ENKAI: ENTEI — quả cầu lửa khổng lồ bung nổ trùm kín thân ----
      if (atkKey === "entei") this.drawEnteiSphere();

      ctx.restore();
    };

    // ---------------------------------------------------------------- Dai Enkai: Entei
    Fighter.prototype.drawEnteiSphere = function() {
      const ctx = document.getElementById("game").getContext("2d");
      const a = this.attack; if (!a) return;
      const d = a.def;
      const aEnd = d.startup + d.active;
      // Nở bung cực nhanh rồi giữ, tới pha recovery thì lụi dần
      const grow = clamp(a.elapsed / (d.startup * 0.85), 0, 1);
      const fade = a.elapsed > aEnd ? clamp(1 - (a.elapsed - aEnd) / d.recovery, 0, 1) : 1;
      const R = 26 + Math.pow(grow, 0.55) * 215;
      const t = this.animTime * 16;
      const cy = -72;

      ctx.save();
      ctx.globalAlpha = fade;
      ctx.globalCompositeOperation = "screen";

      // Lưỡi lửa khổng lồ phóng ra tứ phía
      ctx.save();
      ctx.rotate(t * 0.06);
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * Math.PI * 2;
        const len = R * (1.06 + Math.sin(t * 0.35 + i * 1.3) * 0.22);
        ctx.fillStyle = i % 2 ? "rgba(255, 87, 34, 0.85)" : "rgba(255, 180, 0, 0.7)";
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang - 0.13) * R * 0.72, cy + Math.sin(ang - 0.13) * R * 0.72);
        ctx.lineTo(Math.cos(ang) * len, cy + Math.sin(ang) * len);
        ctx.lineTo(Math.cos(ang + 0.13) * R * 0.72, cy + Math.sin(ang + 0.13) * R * 0.72);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();

      // Thân cầu lửa: rìa đỏ rực -> lõi trắng nóng chảy
      const grd = ctx.createRadialGradient(0, cy, R * 0.08, 0, cy, R);
      grd.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      grd.addColorStop(0.28, "rgba(255, 224, 102, 0.9)");
      grd.addColorStop(0.62, "rgba(255, 140, 0, 0.8)");
      grd.addColorStop(0.88, "rgba(255, 42, 0, 0.62)");
      grd.addColorStop(1, "rgba(255, 42, 0, 0)");
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(0, cy, R, 0, Math.PI * 2); ctx.fill();

      // Các dòng lửa xoáy cuộn trên mặt cầu
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, cy, R * 0.62, t * 0.05, t * 0.05 + Math.PI * 1.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, cy, R * 0.4, -t * 0.07, -t * 0.07 + Math.PI * 1.4); ctx.stroke();

      // Tàn lửa văng ra ngoài rìa quả cầu
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * Math.PI * 2 + t * 0.02;
        const rr = R * (1.05 + (i % 3) * 0.09);
        ctx.fillStyle = i % 2 ? "rgba(255, 215, 0, 0.85)" : "rgba(255, 87, 34, 0.8)";
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * rr, cy + Math.sin(ang) * rr, 3 + Math.sin(t * 0.4 + i) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    // ---------------------------------------------------------------- Head Ace
    Fighter.prototype.drawHeadAce = function(skin, skinSh, flash, isBlaze) {
      const ctx = document.getElementById("game").getContext("2d");
      const headBob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 0.8 : 0;
      ctx.save();
      ctx.translate(0, headBob);

      // Cổ
      ctx.fillStyle = skinSh; roundRect(ctx, -3, -112, 6, 11, 2); ctx.fill();

      // Khuôn mặt
      const fg = ctx.createLinearGradient(-11, -132, 11, -110);
      fg.addColorStop(0, skin); fg.addColorStop(1, skinSh);
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(0, -121, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(-11, -120, 2.5, 0, Math.PI * 2); ctx.fill();

      // Tóc đen bù xù lởm chởm rủ xuống trán
      const hairCol = flash ? "#4a4a58" : "#16161c";
      ctx.fillStyle = hairCol;
      ctx.beginPath();
      ctx.arc(0, -122, 12.3, Math.PI * 1.02, Math.PI * 1.98);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-13, -123);
      ctx.lineTo(-9, -131); ctx.lineTo(-5, -124);
      ctx.lineTo(-1, -132); ctx.lineTo(3, -123);
      ctx.lineTo(7, -130); ctx.lineTo(11, -122);
      ctx.lineTo(12, -120);
      ctx.closePath(); ctx.fill();

      // BIỂU CẢM GƯƠNG MẶT
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
        // Mắt xám đen sắc lẹm; cháy rực cam khi bùng Haki
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.ellipse(5, -120, 2.8, 3.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = isBlaze ? "#ff7f00" : "#22222c";
        ctx.beginPath(); ctx.arc(5.6, -120, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#20242b"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(1.5, -126); ctx.lineTo(9.5, -125); ctx.stroke();
        ctx.strokeStyle = "#8a4a3a"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(2.5, -113); ctx.lineTo(8.5, -113); ctx.stroke();
      }

      // Tàn nhang thương hiệu rải hai bên gò má
      ctx.fillStyle = "rgba(150, 80, 50, 0.5)";
      [[1.5,-117],[4,-116],[6.5,-117],[-3,-116],[-5.5,-117]].forEach(([fx, fy]) => {
        ctx.beginPath(); ctx.arc(fx, fy, 0.75, 0, Math.PI * 2); ctx.fill();
      });

      // Mũi anime
      ctx.strokeStyle = skinSh; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(1, -117); ctx.lineTo(3, -116); ctx.stroke();

      // ---- MŨ CAO BỒI CAM VÀNH RỘNG (đội hơi ngửa ra sau) ----
      ctx.save();
      ctx.translate(0, -132);
      ctx.rotate(-0.12);
      const hatCol = flash ? "#ffc46a" : "#e8912a";
      const hatSh  = flash ? "#e09a3a" : "#b96a12";
      // Vành mũ rộng cong lên hai đầu
      ctx.fillStyle = hatCol;
      ctx.beginPath();
      ctx.moveTo(-19, 1);
      ctx.quadraticCurveTo(0, 8, 19, 1);
      ctx.quadraticCurveTo(0, -4, -19, 1);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = hatSh; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-19, 1); ctx.quadraticCurveTo(0, 8, 19, 1); ctx.stroke();
      // Chỏm mũ
      ctx.fillStyle = hatCol;
      ctx.beginPath();
      ctx.moveTo(-10, 1);
      ctx.quadraticCurveTo(-11, -11, 0, -12);
      ctx.quadraticCurveTo(11, -11, 10, 1);
      ctx.closePath(); ctx.fill();
      // Nếp lõm giữa chỏm mũ
      ctx.strokeStyle = hatSh; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, -4); ctx.stroke();
      // Dải băng xanh + 2 hạt mặt cười đỏ/xanh trên vành mũ (chi tiết kinh điển của Ace)
      ctx.strokeStyle = "#1f3f8f"; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(-10, 0.5); ctx.lineTo(10, 0.5); ctx.stroke();
      const smiley = (sx, col) => {
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(sx, 0.5, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#15151b"; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.arc(sx, 0.2, 1.4, 0.15, Math.PI - 0.15); ctx.stroke();
        ctx.fillStyle = "#15151b";
        ctx.beginPath(); ctx.arc(sx - 1, -0.8, 0.45, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + 1, -0.8, 0.45, 0, Math.PI * 2); ctx.fill();
      };
      smiley(-5, "#ff5a3c");
      smiley(5, "#3ba7ff");
      ctx.restore();

      ctx.restore();
    };

    // ---------------------------------------------------------------- Front Arm Ace
    Fighter.prototype.drawFrontArmAce = function(swing, skin, skinSh, isBlaze) {
      const ctx = document.getElementById("game").getContext("2d");
      const attacking = this.state === "attack" && this.attack;
      const key = attacking ? this.attack.def.key : null;
      const active = attacking && this.attack.phase !== "startup";

      // Kagerou: quét cả cánh tay lửa ngang tầm trung
      const ang = attacking ? (-1.15 + swing * 1.85) : -0.3;
      ctx.save();
      ctx.translate(11, -95);
      ctx.rotate(ang);

      const reach = key === "kagerou" ? 34 : 26;
      ctx.strokeStyle = skin; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(reach * 0.5, 3); ctx.lineTo(reach, 3); ctx.stroke();

      // Nắm đấm: bọc lửa khi tung chiêu lửa, da thường khi đấm suông
      const fistFire = isBlaze || key === "special" || key === "entei" || key === "kagerou";
      if (fistFire) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const anim = this.animTime * 18;
        for (let i = 0; i < 5; i++) {
          const r = 7 + Math.sin(anim * 0.5 + i * 1.3) * 3;
          const px = reach + Math.cos(anim * 0.4 + i * 1.7) * 5;
          const py = 3 + Math.sin(anim * 0.5 + i * 2.1) * 5;
          ctx.fillStyle = i % 2 ? "rgba(255, 87, 34, 0.75)" : "rgba(255, 200, 40, 0.6)";
          ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
      ctx.fillStyle = fistFire ? "#ffd23f" : skin;
      ctx.beginPath(); ctx.arc(reach, 3, 5.5, 0, Math.PI * 2); ctx.fill();

      // Vệt quét lửa bán nguyệt của Kagerou
      if (key === "kagerou" && active) {
        ctx.strokeStyle = "rgba(255, 87, 34, 0.6)"; ctx.lineWidth = 20;
        ctx.beginPath(); ctx.arc(-4, 0, 56, -0.85, 0.85); ctx.stroke();
        ctx.strokeStyle = "rgba(255, 215, 0, 0.85)"; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(-4, 0, 56, -0.6, 0.6); ctx.stroke();
      }
      ctx.restore();

      // Higan: 5 tia lửa nhỏ bắn ra từ đầu ngón tay
      if (key === "ranged" && active) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = i % 2 ? "rgba(255,140,0,0.7)" : "rgba(255,215,0,0.55)";
          ctx.beginPath(); ctx.arc(38 + i * 7, -92 + Math.sin(this.animTime * 20 + i) * 4, 3 - i * 0.6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
    };
  };

  // ---------------------------------------------------------------- HOOK INTO GAME MANAGER
  const installHooks = (Game) => {
    // 1. Vệt lửa bám đuôi cho Hiken / Entei
    const origProjUpdate = Game.Projectile.prototype.update;
    Game.Projectile.prototype.update = function(dt) {
      origProjUpdate.call(this, dt);
      if (this.d.kind === "hiken") Game.addTrail(this.x - this.dir * 44, this.y + (Math.random()*54 - 27), "#ff4500", "#ffd23f");
    };

    // 2. Vẽ đạn lửa riêng của Ace
    const origProjDraw = Game.Projectile.prototype.draw;
    Game.Projectile.prototype.draw = function() {
      const { kind } = this.d;
      const ctx = document.getElementById("game").getContext("2d");

      if (kind === "fire_bullet") {
        // HIGAN: viên đạn lửa nhỏ nhọn hoắt, lõi trắng, đuôi khói cam
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.dir < 0) ctx.scale(-1, 1);
        const grd = ctx.createLinearGradient(-20, 0, 14, 0);
        grd.addColorStop(0, "rgba(255, 87, 34, 0)");
        grd.addColorStop(0.6, "rgba(255, 140, 0, 0.9)");
        grd.addColorStop(1, "#fff4c4");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.quadraticCurveTo(0, -7, -20, 0);
        ctx.quadraticCurveTo(0, 7, 14, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.ellipse(7, 0, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        return;
      }

      if (kind === "hiken") {
        // HIKEN: nắm đấm lửa khổng lồ lao tới, khói cuộn phía sau
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.dir < 0) ctx.scale(-1, 1);
        if (this.d.super) ctx.scale(1.5, 1.5);   // bản FULL Haki: nắm đấm phóng to cho đã mắt
        const t = this.t / 60;

        // Quầng nhiệt toả rộng phía sau nắm đấm
        ctx.globalCompositeOperation = "screen";
        const halo = ctx.createRadialGradient(-6, 0, 10, -6, 0, 96);
        halo.addColorStop(0, "rgba(255, 200, 40, 0.45)");
        halo.addColorStop(0.65, "rgba(255, 69, 0, 0.2)");
        halo.addColorStop(1, "rgba(255, 42, 0, 0)");
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(-6, 0, 96, 0, Math.PI * 2); ctx.fill();

        // Cột lửa đuôi cuộn trào dài phía sau
        for (let i = 0; i < 8; i++) {
          const px = -46 - i * 22;
          const py = Math.sin(t * 0.8 + i * 1.1) * (10 + i * 3.4);
          const r = 30 - i * 3.1;
          ctx.fillStyle = i % 2 ? "rgba(255, 87, 34, 0.6)" : "rgba(255, 170, 0, 0.45)";
          ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";

        // Lưỡi lửa liếm quanh nắm đấm (vẽ trước để nằm dưới nắm đấm)
        ctx.fillStyle = "#ff5722";
        for (let i = 0; i < 6; i++) {
          const fx = 34 - i * 22;
          const h = 30 + Math.sin(t + i * 1.6) * 15;
          ctx.beginPath();
          ctx.moveTo(fx - 10, -32);
          ctx.quadraticCurveTo(fx, -32 - h, fx + 10, -32);
          ctx.closePath(); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(fx - 10, 32);
          ctx.quadraticCurveTo(fx, 32 + h * 0.7, fx + 10, 32);
          ctx.closePath(); ctx.fill();
        }

        // Nắm đấm lửa khổng lồ: lớp ngoài đỏ, giữa cam, lõi vàng trắng
        const fist = (sc, col) => {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(-46 * sc, -21 * sc);            // cổ tay phía sau
          ctx.lineTo(10 * sc, -37 * sc);
          ctx.quadraticCurveTo(54 * sc, -37 * sc, 57 * sc, 0);   // mu bàn tay bo tròn phía trước
          ctx.quadraticCurveTo(54 * sc, 37 * sc, 10 * sc, 37 * sc);
          ctx.lineTo(-46 * sc, 21 * sc);
          ctx.closePath(); ctx.fill();
        };
        fist(1.35, "#ff2a00");
        fist(1.05, "#ff8c00");
        fist(0.6, "#ffe066");

        // Khớp 4 ngón tay hằn rõ trên mu bàn tay
        ctx.strokeStyle = "rgba(255, 250, 200, 0.8)"; ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const ky = -25 + i * 25;
          ctx.moveTo(36, ky); ctx.quadraticCurveTo(50, ky + 12, 36, ky + 21);
        }
        ctx.moveTo(7, -39); ctx.lineTo(7, 39);     // ranh giới các đốt ngón
        ctx.stroke();
        ctx.restore();
        return;
      }

      origProjDraw.call(this);
    };

    // 3. Biển lửa bùng nổ khi chiêu lửa của Ace kết nối
    Game.addAceInferno = function(x, y) {
      // 2 vòng xung kích lửa mở rộng
      this.sparks.push({ kind:"ring", x, y, vx:0, vy:0, life:420, life0:420, r:12, rMax:160, color:"#ff8c00" });
      this.sparks.push({ kind:"ring", x, y, vx:0, vy:0, life:320, life0:320, r:12, rMax:120, color:"#fff3c4" });

      // 30 tàn lửa bắn tung bốc lên trời
      for (let i = 0; i < 30; i++) {
        const angle = (i / 30) * Math.PI * 2 + Math.random() * 0.4;
        const spd = 220 + Math.random() * 300;
        this.sparks.push({
          kind: "dot",
          x, y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd - 140,
          life: 420 + Math.random() * 340,
          color: Math.random() < 0.35 ? "#fff3c4" : (Math.random() < 0.65 ? "#ff8c00" : "#ff2a00"),
          r: 2.5 + Math.random() * 4,
        });
      }
    };
  };

  // game.js chỉ gán window.OP_GAME ở cuối file — tức là SAU khi ace.js chạy xong.
  // Vì vậy phải đợi mọi script nạp xong rồi mới gắn hook, nếu không phần vẽ lửa sẽ không bao giờ được cài.
  if (typeof window !== "undefined") {
    const tryInstall = () => { if (window.OP_GAME) installHooks(window.OP_GAME); };
    if (window.OP_GAME) tryInstall();
    else if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", tryInstall);
    else tryInstall();
  }
})();
