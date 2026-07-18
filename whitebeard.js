/**
 * Râu Trắng — Edward Newgate (Gura Gura no Mi · Chấn Chấn Quả — người mạnh nhất thế giới)
 * Bộ 6 ô: Đại đao Bisento (cận), Shima Yurashi (↓+cận — nắm nứt sàn kéo),
 * Chấn Cầu (xa), Kaishin (↓+xa — nứt khí toả), Gura Chấn Quyền (siêu chiêu 1),
 * Đại Địa Chấn — Seaquake (siêu chiêu 2 — chấn diện rộng giã liên tục).
 */
(() => {
  "use strict";

  window.WhitebeardInit = (Fighter, MOVES) => {
    MOVES.whitebeard = {
      close: { key:"close", name:"Bisento — Đại Đao", type:"melee",
        dmg:11, startup:80, active:120, recovery:190,
        reach:{dx:34,dy:-96,w:96,h:120}, knockback:250, launch:-40, meterGain:8,
        sfx:"slash", color:"#eaffff" },
      // ↓+cận (miễn phí): nắm không khí như nắm kính, giật rung nứt cả vùng quanh mình
      shima: { key:"shima", name:"Shima Yurashi — Nắm Nứt Sàn", type:"melee",
        dmg:16, startup:240, active:240, recovery:300, meterGain:14,
        multiHit: 150,
        reach:{dx:-120,dy:-190,w:280,h:220}, knockback:320, launch:-70,
        sfx:"special", color:"#bfffff" },
      ranged: { key:"ranged", name:"Chấn Cầu", type:"projectile",
        dmg:13, startup:120, active:0, recovery:270, meterGain:12,
        sfx:"punch",
        proj:{ kind:"quakebubble", speed:560, w:66, h:66, dmg:13, knockback:300, launch:-70, life:1600, color:"#cfffff" } },
      // ↓+xa (50 Haki -> ult3): nứt khí toả nan quạt nhiều hướng
      kaishin: { key:"kaishin", name:"Kaishin — Nứt Khí", type:"projectile",
        dmg:8, startup:200, active:0, recovery:400, meterCost:50, meterGain:0,
        sfx:"punch", cry:"Kaishin!",
        spread: { count: 7, arcDeg: 84, dmg: 8, speed: 600 },
        proj:{ kind:"quakebubble", speed:600, w:52, h:52, dmg:8, knockback:230, launch:-55, life:1500, color:"#cfffff" } },
      // skill (50 Haki -> ult1): đấm nứt không gian, sóng chấn khổng lồ
      special: { key:"special", name:"Gura Gura — Chấn Quyền", type:"projectile",
        dmg:24, startup:230, active:0, recovery:430, meterCost:50, meterGain:0,
        sfx:"special", cry:"Gura Gura!",
        proj:{ kind:"quakewave", speed:600, w:120, h:150, dmg:24, knockback:560, launch:-200, life:2200, color:"#dfffff" } },
      // ↓+skill (100 Haki -> ult2): đại địa chấn diện rộng, giã liên tục
      seaquake: { key:"seaquake", name:"Đại Địa Chấn — Seaquake", type:"melee",
        dmg:9, startup:320, active:600, recovery:400, meterCost:100, meterGain:0,
        multiHit: 120,
        reach:{dx:-170,dy:-230,w:360,h:270}, knockback:200, launch:-70,
        sfx:"special", cry:"Seaquake!", color:"#eaffff" },
    };

    const roundRect = (ctx, x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x+r, y); ctx.arcTo(x+w, y, x+w, y+h, r); ctx.arcTo(x+w, y+h, x, y+h, r);
      ctx.arcTo(x, y+h, x, y, r); ctx.arcTo(x, y, x+w, y, r); ctx.closePath();
    };
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    // ---------------------------------------------------------------- Main Draw Râu Trắng
    Fighter.prototype.drawWhitebeard = function(flash) {
      const swing = this.armSwing();
      const legs = this.legPose();
      const bob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 2.2 : (this.state === "walk" ? Math.abs(Math.sin(this.walkPhase)) * 3.2 : 0);
      const skin   = flash ? "#ffc2ad" : "#e8b78d";
      const skinSh = flash ? "#f0a48f" : "#c9925f";
      const coat   = flash ? "#2e6f74" : "#123f45";      // áo choàng xanh cổ vịt
      const pants  = flash ? "#3a4048" : "#20252c";      // quần đen
      const ctx = document.getElementById("game").getContext("2d");
      const atkKey = (this.state === "attack" && this.attack) ? this.attack.def.key : null;
      const quaking = atkKey === "shima" || atkKey === "seaquake";

      ctx.save();
      ctx.translate(0, -bob);
      ctx.lineJoin = "round"; ctx.lineCap = "round";

      // ---- ĐẠI ĐAO BISENTO giắt sau lưng (khi không cầm chém) ----
      if (atkKey !== "close") {
        ctx.strokeStyle = "#5a3a1a"; ctx.lineWidth = 5; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(-16, -118); ctx.lineTo(-24, -40); ctx.stroke();
        ctx.fillStyle = "#dfe8ee"; // lưỡi liềm
        ctx.beginPath(); ctx.moveTo(-16, -120); ctx.quadraticCurveTo(2, -130, 6, -110); ctx.quadraticCurveTo(-6, -118, -16, -114); ctx.closePath(); ctx.fill();
      }

      // ---- ÁO CHOÀNG dài khoác sau lưng ----
      ctx.fillStyle = coat;
      ctx.beginPath();
      ctx.moveTo(-18, -112); ctx.quadraticCurveTo(-34, -66, -27, -14);
      ctx.quadraticCurveTo(-15, -4, -5, -20); ctx.quadraticCurveTo(-14, -66, -11, -112);
      ctx.closePath(); ctx.fill();

      this.drawBackArm(skin, skinSh);

      // ---- ĐÔI CHÂN TO KHOẺ ----
      const kneeL = -8 + Math.sin(legs.a) * 16, footL = kneeL + Math.sin(legs.a) * 8 + 4;
      ctx.strokeStyle = "#161a20"; ctx.lineWidth = 19;
      ctx.beginPath(); ctx.moveTo(-8, -52); ctx.lineTo(kneeL, -28); ctx.lineTo(footL, -11); ctx.stroke();
      ctx.fillStyle = "#0e0f13"; roundRect(ctx, footL - 9, -12, 26, 10, 4); ctx.fill();
      const kneeR = 8 + Math.sin(legs.b) * 16, footR = kneeR + Math.sin(legs.b) * 8 + 4;
      ctx.strokeStyle = pants; ctx.lineWidth = 18;
      ctx.beginPath(); ctx.moveTo(8, -52); ctx.lineTo(kneeR, -28); ctx.lineTo(footR, -11); ctx.stroke();
      ctx.fillStyle = "#15161b"; roundRect(ctx, footR - 9, -12, 26, 10, 4); ctx.fill();
      // đai lưng vàng bản to
      ctx.fillStyle = "#e0b02e"; roundRect(ctx, -18, -58, 36, 9, 3); ctx.fill();
      ctx.fillStyle = "#9c7414"; ctx.fillRect(-4, -57, 8, 7);

      // ---- THÂN TRẦN VẠM VỠ + SẸO CHỮ THẬP ----
      const tg = ctx.createLinearGradient(-20, -106, 20, -56);
      tg.addColorStop(0, skin); tg.addColorStop(1, skinSh);
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.moveTo(-20, -108); ctx.quadraticCurveTo(0, -114, 20, -108);
      ctx.lineTo(15, -56); ctx.quadraticCurveTo(0, -52, -15, -56); ctx.closePath(); ctx.fill();
      // cơ ngực + bụng
      ctx.strokeStyle = "rgba(150,95,60,0.5)"; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, -104); ctx.lineTo(0, -60);
      ctx.moveTo(-13, -96); ctx.quadraticCurveTo(0, -90, 13, -96);
      ctx.moveTo(-11, -82); ctx.lineTo(11, -82); ctx.moveTo(-10, -72); ctx.lineTo(10, -72);
      ctx.stroke();
      // Sẹo chữ thập trứ danh trên ngực
      ctx.strokeStyle = "#b5493a"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-14, -94); ctx.lineTo(15, -70); ctx.moveTo(-14, -70); ctx.lineTo(15, -94); ctx.stroke();

      this.drawHeadWhitebeard(skin, skinSh, flash);
      this.drawFrontArmWhitebeard(swing, skin, skinSh, atkKey);

      // ---- HÀO QUANG CHẤN ĐỘNG: nứt trắng/lam toả quanh khi Shima / Seaquake ----
      if (quaking) {
        const big = atkKey === "seaquake";
        const d = this.attack.def;
        const p = clamp(this.attack.elapsed / (d.startup + d.active), 0, 1);
        const R = (big ? 210 : 130) * (0.28 + p * 0.72);
        const a = this.animTime * 10;
        ctx.save();
        ctx.scale(this.facing, 1);
        ctx.translate(0, -74);
        ctx.globalCompositeOperation = "screen";
        const g = ctx.createRadialGradient(0, 0, 8, 0, 0, R);
        g.addColorStop(0, `rgba(220,255,255,${0.42 * (1 - p * 0.4)})`);
        g.addColorStop(0.55, `rgba(120,220,255,${0.22 * (1 - p * 0.4)})`);
        g.addColorStop(1, "rgba(60,140,220,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
        // các vết NỨT KHÔNG GIAN toả ra (đường gãy khúc trắng)
        const cracks = big ? 9 : 6;
        for (let i = 0; i < cracks; i++) {
          const ang = (i / cracks) * Math.PI * 2 + a * 0.05;
          ctx.strokeStyle = i % 2 ? "rgba(255,255,255,0.92)" : "rgba(160,230,255,0.8)";
          ctx.lineWidth = i % 2 ? 2.6 : 1.6;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * 14, Math.sin(ang) * 14);
          for (let s = 1; s <= 4; s++) {
            const rr = 14 + (R - 14) * (s / 4);
            const jt = Math.sin(a * 0.3 + i * 3 + s) * 14;
            ctx.lineTo(Math.cos(ang) * rr - Math.sin(ang) * jt, Math.sin(ang) * rr + Math.cos(ang) * jt);
          }
          ctx.stroke();
        }
        ctx.strokeStyle = `rgba(255,255,255,${0.75 * (1 - p)})`; ctx.lineWidth = big ? 6 : 4;
        ctx.beginPath(); ctx.arc(0, 0, R * 0.9, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
    };

    // ---------------------------------------------------------------- Đầu Râu Trắng
    Fighter.prototype.drawHeadWhitebeard = function(skin, skinSh, flash) {
      const ctx = document.getElementById("game").getContext("2d");
      const headBob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 0.8 : 0;
      ctx.save(); ctx.translate(0, headBob);
      // cổ bạnh
      ctx.fillStyle = skinSh; roundRect(ctx, -5, -114, 10, 10, 2); ctx.fill();
      // mặt vuông bặm
      const fg = ctx.createLinearGradient(-12, -136, 12, -112);
      fg.addColorStop(0, skin); fg.addColorStop(1, skinSh);
      ctx.fillStyle = fg; roundRect(ctx, -12, -136, 24, 26, 8); ctx.fill();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(-12, -122, 2.6, 0, Math.PI * 2); ctx.fill();
      // Khăn bandana vàng
      ctx.fillStyle = flash ? "#ffe27a" : "#e9c23a";
      ctx.beginPath(); ctx.arc(0, -134, 13, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill();
      roundRect(ctx, -13, -140, 26, 6, 2); ctx.fill();
      ctx.fillStyle = flash ? "#c99a1a" : "#a8830f"; ctx.fillRect(-13, -137, 26, 2);
      // mắt nghiêm
      ctx.strokeStyle = "#20242b"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(2, -126); ctx.lineTo(9, -125); ctx.stroke();
      if (this.state === "hurt" || this.state === "ko") {
        ctx.beginPath(); ctx.moveTo(3, -122); ctx.lineTo(8, -118); ctx.moveTo(8, -122); ctx.lineTo(3, -118); ctx.stroke();
      } else {
        ctx.fillStyle = "#15151c"; ctx.beginPath(); ctx.arc(6, -121, 1.8, 0, Math.PI * 2); ctx.fill();
      }
      // RÂU TRẮNG hình lưỡi liềm trứ danh
      ctx.fillStyle = flash ? "#ffffff" : "#f2f4f5";
      ctx.beginPath();
      ctx.moveTo(-11, -114);
      ctx.quadraticCurveTo(-16, -100, -8, -92);
      ctx.quadraticCurveTo(0, -88, 8, -92);
      ctx.quadraticCurveTo(16, -100, 11, -114);
      ctx.quadraticCurveTo(0, -108, -11, -114);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(180,190,195,0.6)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -112); ctx.lineTo(0, -90); ctx.stroke();
      ctx.restore();
    };

    // ---------------------------------------------------------------- Tay trước Râu Trắng
    Fighter.prototype.drawFrontArmWhitebeard = function(swing, skin, skinSh, atkKey) {
      const ctx = document.getElementById("game").getContext("2d");
      const attacking = this.state === "attack" && this.attack;

      // Vung ĐẠI ĐAO khi chém cận
      if (atkKey === "close") {
        const ang = -1.0 + swing * 1.9;
        ctx.save(); ctx.translate(12, -92); ctx.rotate(ang);
        ctx.strokeStyle = skin; ctx.lineWidth = 13;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(14, 2); ctx.lineTo(26, 2); ctx.stroke();
        ctx.translate(26, 2);
        // cán gỗ dài
        ctx.strokeStyle = "#5a3a1a"; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(70, -4); ctx.stroke();
        // lưỡi liềm to
        ctx.fillStyle = "#eef4f8";
        ctx.beginPath(); ctx.moveTo(66, -4); ctx.quadraticCurveTo(104, -34, 116, 2); ctx.quadraticCurveTo(96, -6, 66, 6); ctx.closePath(); ctx.fill();
        if (this.attack.phase !== "startup") {
          ctx.strokeStyle = "rgba(220,255,255,0.6)"; ctx.lineWidth = 12;
          ctx.beginPath(); ctx.arc(-8, 0, 76, -0.7, 0.7); ctx.stroke();
        }
        ctx.restore();
        return;
      }
      // Nắm đấm nứt không gian (chấn quyền / các chiêu chấn)
      const reach = attacking && (atkKey === "special" || atkKey === "ranged" || atkKey === "kaishin")
        ? 18 + Math.max(0, swing) * 30 : 8;
      ctx.strokeStyle = "#c98a5c"; ctx.lineWidth = 15;
      ctx.beginPath(); ctx.moveTo(11, -94); ctx.lineTo(reach * 0.6, -84); ctx.lineTo(reach, -82); ctx.stroke();
      ctx.strokeStyle = skin; ctx.lineWidth = 12.5;
      ctx.beginPath(); ctx.moveTo(11, -94); ctx.lineTo(reach * 0.6, -84); ctx.lineTo(reach, -82); ctx.stroke();
      ctx.fillStyle = "#c98a5c"; ctx.beginPath(); ctx.arc(reach, -82, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(reach, -82, 8.5, 0, Math.PI * 2); ctx.fill();
    };
  };

  // ---------------------------------------------------------------- HOOK: vẽ đạn chấn + hiệu ứng nứt
  const installHooks = (Game) => {
    const origDraw = Game.Projectile.prototype.draw;
    Game.Projectile.prototype.draw = function() {
      const { kind } = this.d;
      const ctx = document.getElementById("game").getContext("2d");

      if (kind === "quakebubble") {
        const t = this.t / 60;
        ctx.save(); ctx.translate(this.x, this.y);
        ctx.globalCompositeOperation = "screen";
        const R = this.w / 2;
        const g = ctx.createRadialGradient(-R * 0.3, -R * 0.3, 3, 0, 0, R);
        g.addColorStop(0, "rgba(255,255,255,0.95)");
        g.addColorStop(0.5, "rgba(180,235,255,0.55)");
        g.addColorStop(1, "rgba(90,170,235,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
        // nứt trong quả cầu
        ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.6;
        for (let i = 0; i < 5; i++) {
          const ang = i * 1.257 + t * 0.3;
          ctx.beginPath(); ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(ang) * R * 0.6, Math.sin(ang) * R * 0.6);
          ctx.lineTo(Math.cos(ang + 0.3) * R * 0.95, Math.sin(ang + 0.3) * R * 0.95);
          ctx.stroke();
        }
        ctx.restore(); return;
      }

      if (kind === "quakewave") {
        const t = this.t / 55;
        ctx.save(); ctx.translate(this.x, this.y);
        if (this.dir < 0) ctx.scale(-1, 1);
        ctx.globalCompositeOperation = "screen";
        // quả cầu chấn động lõi trắng
        const g = ctx.createRadialGradient(0, 0, 6, 0, 0, this.w * 0.5);
        g.addColorStop(0, "rgba(255,255,255,0.98)");
        g.addColorStop(0.45, "rgba(190,240,255,0.6)");
        g.addColorStop(1, "rgba(80,170,235,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(6, 0, this.w * 0.5, 0, Math.PI * 2); ctx.fill();
        // NỨT KHÔNG GIAN gãy khúc toả ra
        for (let i = 0; i < 9; i++) {
          const ang = (i / 9) * Math.PI * 2;
          ctx.strokeStyle = i % 2 ? "rgba(255,255,255,0.9)" : "rgba(150,225,255,0.75)";
          ctx.lineWidth = i % 2 ? 3 : 1.8;
          ctx.beginPath(); ctx.moveTo(0, 0);
          let r = 10;
          for (let s = 0; s < 3; s++) {
            r += this.h * 0.22;
            const jt = Math.sin(t + i * 2 + s) * 16;
            ctx.lineTo(Math.cos(ang) * r - Math.sin(ang) * jt, Math.sin(ang) * r + Math.cos(ang) * jt);
          }
          ctx.stroke();
        }
        ctx.restore(); return;
      }
      origDraw.call(this);
    };

    // hạt nứt trắng bắn ra khi chấn động trúng
    Game.addQuakeCracks = function(x, y, big) {
      this.sparks.push({ kind: "ring", x, y, life: big ? 320 : 220, life0: big ? 320 : 220, r: 8, rMax: big ? 64 : 40, color: "#ffffff" });
      const n = big ? 16 : 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, spd = 180 + Math.random() * 220;
        this.sparks.push({ kind: "dot", x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 40,
          life: 300 + Math.random() * 220, color: Math.random() < 0.5 ? "#ffffff" : "#bfefff", r: 2 + Math.random() * 3 });
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
