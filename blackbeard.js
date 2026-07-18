/**
 * Râu Đen — Marshall D. Teach (Yami Yami no Mi · Ám Ám Quả — bóng tối hút mọi thứ)
 * Bộ 6 ô: Đấm Nặng (cận), Kurouzu (↓+cận — hố bóng tối hút quanh mình),
 * Cầu Bóng Tối (xa), Dark Grip (↓+xa — tay bóng toả), Liberation (siêu chiêu 1),
 * Kurouzu Đại — Hố Đen (siêu chiêu 2 — hố đen khổng lồ nuốt chửng).
 */
(() => {
  "use strict";

  window.BlackbeardInit = (Fighter, MOVES) => {
    MOVES.blackbeard = {
      close: { key:"close", name:"Đấm Nặng", type:"melee",
        dmg:10, startup:80, active:110, recovery:190,
        reach:{dx:34,dy:-70,w:78,h:58}, knockback:250, launch:-35, meterGain:9,
        sfx:"punch", color:"#a24bd6" },
      // ↓+cận (miễn phí): hố bóng tối hút quanh mình, giã liên tục
      kurouzu: { key:"kurouzu", name:"Kurouzu — Hố Bóng Tối", type:"melee",
        dmg:15, startup:240, active:260, recovery:300, meterGain:14,
        multiHit: 150,
        reach:{dx:-110,dy:-180,w:250,h:210}, knockback:300, launch:-60,
        sfx:"special", color:"#7a1fb0" },
      ranged: { key:"ranged", name:"Cầu Bóng Tối", type:"projectile",
        dmg:13, startup:120, active:0, recovery:270, meterGain:12,
        sfx:"punch",
        proj:{ kind:"darkorb", speed:560, w:62, h:62, dmg:13, knockback:290, launch:-65, life:1600, color:"#8a2be2" } },
      // ↓+xa (50 Haki -> ult3): nhiều tay bóng tối toả nan quạt
      darkgrip: { key:"darkgrip", name:"Dark Grip — Bàn Tay Bóng", type:"projectile",
        dmg:8, startup:200, active:0, recovery:400, meterCost:50, meterGain:0,
        sfx:"punch", cry:"Dark Grip!",
        spread: { count: 7, arcDeg: 82, dmg: 8, speed: 590 },
        proj:{ kind:"darkorb", speed:590, w:48, h:48, dmg:8, knockback:220, launch:-50, life:1500, color:"#8a2be2" } },
      // skill (50 Haki -> ult1): nổ bóng tối giải phóng
      special: { key:"special", name:"Liberation — Giải Phóng", type:"projectile",
        dmg:24, startup:230, active:0, recovery:430, meterCost:50, meterGain:0,
        sfx:"special", cry:"Kurouzu! Liberation!",
        proj:{ kind:"liberation", speed:580, w:120, h:120, dmg:24, knockback:560, launch:-180, life:2200, color:"#6a0dad" } },
      // ↓+skill (100 Haki -> ult2): hố đen khổng lồ nuốt chửng
      blackhole: { key:"blackhole", name:"Kurouzu Đại — Hố Đen", type:"projectile",
        dmg:27, startup:340, active:0, recovery:470, meterCost:100, meterGain:0,
        sfx:"special", cry:"Yami Yami! Kurouzu!",
        proj:{ kind:"blackhole", speed:440, w:180, h:180, dmg:27, knockback:600, launch:-200, life:2800, color:"#4b0082" } },
    };

    const roundRect = (ctx, x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x+r, y); ctx.arcTo(x+w, y, x+w, y+h, r); ctx.arcTo(x+w, y+h, x, y+h, r);
      ctx.arcTo(x, y+h, x, y, r); ctx.arcTo(x, y, x+w, y, r); ctx.closePath();
    };
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    // ---------------------------------------------------------------- Main Draw Râu Đen
    Fighter.prototype.drawBlackbeard = function(flash) {
      const swing = this.armSwing();
      const legs = this.legPose();
      const bob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 2.4 : (this.state === "walk" ? Math.abs(Math.sin(this.walkPhase)) * 3.4 : 0);
      const skin   = flash ? "#ffc2ad" : "#dca27a";
      const skinSh = flash ? "#f0a48f" : "#b57e52";
      const coat   = flash ? "#3a2440" : "#1c1020";      // áo choàng tím-đen
      const shirt  = flash ? "#7a5a2a" : "#4a3418";      // áo vàng nâu hở ngực
      const ctx = document.getElementById("game").getContext("2d");
      const atkKey = (this.state === "attack" && this.attack) ? this.attack.def.key : null;
      const voiding = atkKey === "kurouzu";

      ctx.save();
      ctx.translate(0, -bob);
      ctx.lineJoin = "round"; ctx.lineCap = "round";

      // ---- KHÍ BÓNG TỐI bốc lên (luôn có, đậm khi full Haki) ----
      if (this.meter >= 100 || this.hp < 50 || voiding) {
        ctx.save(); ctx.globalCompositeOperation = "source-over";
        const anim = this.animTime * 6;
        for (let i = 0; i < 6; i++) {
          const sy = -((anim * 13 + i * 21) % 118);
          const sx = Math.sin(anim * 0.2 + i * 2.1) * 20;
          const r = 5 + Math.sin(anim * 0.15 + i) * 3;
          const op = clamp(0.34 * (1 + sy / 118), 0, 0.4);
          ctx.fillStyle = i % 2 ? `rgba(60,10,90,${op})` : `rgba(20,0,35,${op})`;
          ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }

      // ---- ÁO CHOÀNG tím-đen khoác sau ----
      ctx.fillStyle = coat;
      ctx.beginPath();
      ctx.moveTo(-18, -110); ctx.quadraticCurveTo(-34, -64, -27, -14);
      ctx.quadraticCurveTo(-15, -4, -5, -20); ctx.quadraticCurveTo(-14, -64, -10, -110);
      ctx.closePath(); ctx.fill();

      this.drawBackArm(skin, skinSh);

      // ---- ĐÔI CHÂN TO (quần đen thùng) ----
      const kneeL = -8 + Math.sin(legs.a) * 16, footL = kneeL + Math.sin(legs.a) * 8 + 4;
      ctx.strokeStyle = "#14121a"; ctx.lineWidth = 19;
      ctx.beginPath(); ctx.moveTo(-8, -52); ctx.lineTo(kneeL, -28); ctx.lineTo(footL, -11); ctx.stroke();
      ctx.fillStyle = "#0c0a10"; roundRect(ctx, footL - 9, -12, 26, 10, 4); ctx.fill();
      const kneeR = 8 + Math.sin(legs.b) * 16, footR = kneeR + Math.sin(legs.b) * 8 + 4;
      ctx.strokeStyle = "#1e1a26"; ctx.lineWidth = 18;
      ctx.beginPath(); ctx.moveTo(8, -52); ctx.lineTo(kneeR, -28); ctx.lineTo(footR, -11); ctx.stroke();
      ctx.fillStyle = "#100e16"; roundRect(ctx, footR - 9, -12, 26, 10, 4); ctx.fill();

      // ---- THÂN TO BÉO: áo hở ngực + đai ----
      ctx.fillStyle = coat;
      ctx.beginPath();
      ctx.moveTo(-21, -107); ctx.quadraticCurveTo(0, -112, 21, -107);
      ctx.lineTo(17, -54); ctx.quadraticCurveTo(0, -50, -17, -54); ctx.closePath(); ctx.fill();
      // áo lót vàng nâu hở giữa
      ctx.fillStyle = shirt;
      ctx.beginPath(); ctx.moveTo(-9, -107); ctx.lineTo(9, -107); ctx.lineTo(6, -56); ctx.lineTo(-6, -56); ctx.closePath(); ctx.fill();
      // ngực trần + lông ngực
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.moveTo(-7, -107); ctx.lineTo(7, -107); ctx.lineTo(0, -84); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(40,20,10,0.5)"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-3, -100); ctx.lineTo(-3, -90); ctx.moveTo(0, -100); ctx.lineTo(0, -88); ctx.moveTo(3, -100); ctx.lineTo(3, -90); ctx.stroke();
      // đai lưng
      ctx.fillStyle = "#2a2030"; roundRect(ctx, -19, -58, 38, 8, 3); ctx.fill();

      this.drawHeadBlackbeard(skin, skinSh, flash);
      this.drawFrontArmBlackbeard(swing, skin, skinSh, atkKey);

      // ---- HỐ BÓNG TỐI quanh mình khi Kurouzu ----
      if (voiding) {
        const d = this.attack.def;
        const p = clamp(this.attack.elapsed / (d.startup + d.active), 0, 1);
        const R = 150 * (0.3 + p * 0.7);
        const a = this.animTime * 7;
        ctx.save();
        ctx.scale(this.facing, 1);
        ctx.translate(0, -70);
        // đĩa tối hút (không dùng screen — bóng tối phải TỐI)
        const g = ctx.createRadialGradient(0, 0, R * 0.15, 0, 0, R);
        g.addColorStop(0, "rgba(10,0,18,0.9)");
        g.addColorStop(0.5, `rgba(50,10,80,${0.5 * (1 - p * 0.3)})`);
        g.addColorStop(1, "rgba(60,20,110,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
        // xoáy hút vào
        ctx.strokeStyle = "rgba(150,80,220,0.55)"; ctx.lineWidth = 3;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          for (let s = 0; s <= 26; s++) {
            const ah = a * 0.6 + i * Math.PI / 2 + s * 0.28;
            const rr = R * (1 - s / 28);
            const px = Math.cos(ah) * rr, py = Math.sin(ah) * rr;
            s === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.restore();
    };

    // ---------------------------------------------------------------- Đầu Râu Đen
    Fighter.prototype.drawHeadBlackbeard = function(skin, skinSh, flash) {
      const ctx = document.getElementById("game").getContext("2d");
      const headBob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 0.8 : 0;
      ctx.save(); ctx.translate(0, headBob);
      ctx.fillStyle = skinSh; roundRect(ctx, -5, -113, 10, 10, 2); ctx.fill();
      // mặt to bè
      const fg = ctx.createLinearGradient(-13, -135, 13, -110);
      fg.addColorStop(0, skin); fg.addColorStop(1, skinSh);
      ctx.fillStyle = fg; roundRect(ctx, -13, -134, 26, 26, 9); ctx.fill();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(-13, -120, 2.6, 0, Math.PI * 2); ctx.fill();
      // tóc đen bù xù rối
      ctx.fillStyle = flash ? "#3a3340" : "#12121a";
      ctx.beginPath();
      ctx.moveTo(-13, -122);
      ctx.quadraticCurveTo(-17, -140, -6, -140);
      ctx.quadraticCurveTo(-2, -146, 3, -139);
      ctx.quadraticCurveTo(10, -145, 13, -134);
      ctx.quadraticCurveTo(16, -128, 13, -122);
      ctx.quadraticCurveTo(4, -130, -3, -128);
      ctx.quadraticCurveTo(-9, -129, -13, -122);
      ctx.closePath(); ctx.fill();
      // mắt gian
      if (this.state === "hurt" || this.state === "ko") {
        ctx.strokeStyle = "#20242b"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(3, -124); ctx.lineTo(8, -120); ctx.moveTo(8, -124); ctx.lineTo(3, -120); ctx.stroke();
      } else {
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(6, -122, 2.6, 2.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#15151c"; ctx.beginPath(); ctx.arc(6.6, -122, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#20242b"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(2, -127); ctx.lineTo(9.5, -126); ctx.stroke();
      }
      // RÂU ĐEN rậm rạp phủ nửa mặt dưới
      ctx.fillStyle = flash ? "#3a3340" : "#12121a";
      ctx.beginPath();
      ctx.moveTo(-13, -118);
      ctx.quadraticCurveTo(-14, -104, -8, -98);
      ctx.quadraticCurveTo(0, -92, 8, -98);
      ctx.quadraticCurveTo(14, -104, 13, -118);
      ctx.quadraticCurveTo(6, -114, 0, -115);
      ctx.quadraticCurveTo(-6, -114, -13, -118);
      ctx.closePath(); ctx.fill();
      // miệng cười nhe răng sún
      if (this.state !== "hurt" && this.state !== "ko") {
        ctx.fillStyle = "#e8e0d0";
        roundRect(ctx, 0, -110, 9, 3.4, 1); ctx.fill();
        ctx.strokeStyle = "#8a1a1a"; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(4, -110); ctx.lineTo(4, -106.6); ctx.stroke();
      }
      ctx.restore();
    };

    // ---------------------------------------------------------------- Tay trước Râu Đen
    Fighter.prototype.drawFrontArmBlackbeard = function(swing, skin, skinSh, atkKey) {
      const ctx = document.getElementById("game").getContext("2d");
      const attacking = this.state === "attack" && this.attack;
      const isMelee = attacking && (atkKey === "close");
      const reach = isMelee ? 20 + swing * 46 : (attacking && (atkKey === "special" || atkKey === "ranged" || atkKey === "darkgrip") ? 18 + Math.max(0, swing) * 28 : 8);
      const y = -84;
      if (isMelee && this.attack.phase !== "startup") {
        ctx.strokeStyle = "rgba(150,60,220,0.4)"; ctx.lineWidth = 14;
        ctx.beginPath(); ctx.moveTo(14, y); ctx.lineTo(reach - 6, y); ctx.stroke();
      }
      ctx.strokeStyle = "#b57e52"; ctx.lineWidth = 14;
      ctx.beginPath(); ctx.moveTo(12, -94); ctx.lineTo(reach * 0.55, y + 1); ctx.lineTo(reach, y); ctx.stroke();
      ctx.strokeStyle = skin; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(12, -94); ctx.lineTo(reach * 0.55, y + 1); ctx.lineTo(reach, y); ctx.stroke();
      ctx.fillStyle = "#b57e52"; ctx.beginPath(); ctx.arc(reach, y, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(reach, y, 8.5, 0, Math.PI * 2); ctx.fill();
      // khí đen quanh nắm đấm khi ra chiêu bóng tối
      if (attacking && (atkKey === "special" || atkKey === "ranged" || atkKey === "darkgrip")) {
        ctx.fillStyle = "rgba(60,10,100,0.5)";
        ctx.beginPath(); ctx.arc(reach + 3, y, 13, 0, Math.PI * 2); ctx.fill();
      }
    };
  };

  // ---------------------------------------------------------------- HOOK: vẽ đạn bóng tối
  const installHooks = (Game) => {
    const origDraw = Game.Projectile.prototype.draw;
    Game.Projectile.prototype.draw = function() {
      const { kind } = this.d;
      const ctx = document.getElementById("game").getContext("2d");
      const spin = this.t / 60;

      if (kind === "darkorb") {
        ctx.save(); ctx.translate(this.x, this.y);
        const R = this.w / 2;
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, R);
        g.addColorStop(0, "rgba(20,0,35,1)");
        g.addColorStop(0.6, "rgba(90,20,150,0.9)");
        g.addColorStop(1, "rgba(140,60,220,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
        // xoáy tím
        ctx.strokeStyle = "rgba(180,110,240,0.7)"; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let s = 0; s <= 20; s++) { const a = spin + s * 0.4, rr = R * (1 - s / 22); const px = Math.cos(a) * rr, py = Math.sin(a) * rr; s ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.stroke();
        ctx.restore(); return;
      }

      if (kind === "liberation") {
        const t = this.t / 50;
        ctx.save(); ctx.translate(this.x, this.y);
        const R = this.w / 2;
        // nhân tối
        const g = ctx.createRadialGradient(0, 0, 3, 0, 0, R);
        g.addColorStop(0, "rgba(10,0,20,1)");
        g.addColorStop(0.45, "rgba(80,15,140,0.85)");
        g.addColorStop(1, "rgba(120,40,200,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
        // tia bóng tối gãy khúc toả (giải phóng)
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * Math.PI * 2 + t * 0.1;
          ctx.strokeStyle = i % 2 ? "rgba(170,90,240,0.85)" : "rgba(60,10,110,0.9)";
          ctx.lineWidth = i % 2 ? 3 : 4.5;
          ctx.beginPath(); ctx.moveTo(0, 0);
          let r = 8;
          for (let s = 0; s < 3; s++) { r += R * 0.5; const jt = Math.sin(t + i * 2 + s) * 14; ctx.lineTo(Math.cos(ang) * r - Math.sin(ang) * jt, Math.sin(ang) * r + Math.cos(ang) * jt); }
          ctx.stroke();
        }
        ctx.restore(); return;
      }

      if (kind === "blackhole") {
        const t = this.t / 70;
        ctx.save(); ctx.translate(this.x, this.y);
        const R = this.w / 2;
        // quầng tím hút bên ngoài
        const halo = ctx.createRadialGradient(0, 0, R * 0.4, 0, 0, R * 1.15);
        halo.addColorStop(0, "rgba(90,30,160,0)");
        halo.addColorStop(0.7, "rgba(120,50,200,0.35)");
        halo.addColorStop(1, "rgba(150,80,230,0)");
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, R * 1.15, 0, Math.PI * 2); ctx.fill();
        // đĩa xoáy hút vào tâm đen kịt
        ctx.strokeStyle = "rgba(160,90,230,0.6)"; ctx.lineWidth = 3;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          for (let s = 0; s <= 30; s++) { const a = t * 0.8 + i * (Math.PI * 0.4) + s * 0.26; const rr = R * (1 - s / 32); const px = Math.cos(a) * rr, py = Math.sin(a) * rr; s ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
          ctx.stroke();
        }
        const core = ctx.createRadialGradient(0, 0, 2, 0, 0, R * 0.55);
        core.addColorStop(0, "#000000"); core.addColorStop(0.8, "rgba(20,0,40,0.95)"); core.addColorStop(1, "rgba(40,10,80,0)");
        ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, R * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.restore(); return;
      }
      origDraw.call(this);
    };

    Game.addDarkBurst = function(x, y, big) {
      this.sparks.push({ kind: "ring", x, y, life: big ? 320 : 220, life0: big ? 320 : 220, r: 8, rMax: big ? 66 : 40, color: "#a24bd6" });
      const n = big ? 16 : 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, spd = 170 + Math.random() * 210;
        this.sparks.push({ kind: "dot", x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 30,
          life: 320 + Math.random() * 220, color: Math.random() < 0.5 ? "#8a2be2" : "#3a0d5a", r: 2 + Math.random() * 3.5 });
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
