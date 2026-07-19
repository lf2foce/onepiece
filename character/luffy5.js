/**
 * Monkey D. Luffy — Gear 5 / Sun God Nika
 * Nhân vật độc lập: bộ chiêu, hình vẽ và projectile không dùng lại Luffy thường.
 */
(() => {
  "use strict";

  const roundRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  window.Luffy5Init = (Fighter, MOVES) => {
    MOVES.luffy5 = {
      close: {
        key: "close", name: "Dawn Whip", type: "melee",
        dmg: 10, startup: 55, active: 105, recovery: 145,
        dash: 310, reach: { dx: 28, dy: -82, w: 92, h: 70 },
        knockback: 245, launch: -45, meterGain: 10,
        sfx: "punch", color: "#fff4d6",
      },
      ranged: {
        key: "ranged", name: "Kaminari — Lightning Grab", type: "projectile",
        dmg: 13, startup: 135, active: 0, recovery: 245, meterGain: 12,
        sfx: "shoot",
        proj: { kind: "nika_lightning", speed: 720, w: 72, h: 38, dmg: 13,
          knockback: 320, launch: -90, life: 1650, color: "#fff27a" },
      },
      mogura: {
        key: "mogura", name: "Gomu Gomu no Mogura Pistol", type: "melee",
        dmg: 17, startup: 205, active: 175, recovery: 245,
        reach: { dx: -48, dy: -170, w: 245, h: 185 },
        knockback: 390, launch: -155, meterGain: 15,
        sfx: "punch", color: "#ffffff",
      },
      special: {
        key: "special", name: "Gomu Gomu no Dawn Rocket", type: "projectile",
        dmg: 24, startup: 205, active: 0, recovery: 365,
        meterCost: 50, meterGain: 0, sfx: "special", cry: "Dawn Rocket!",
        proj: { kind: "nika_fist", speed: 790, w: 92, h: 64, dmg: 24,
          knockback: 560, launch: -190, life: 1750, color: "#fff7e8" },
      },
      bajrang: {
        key: "bajrang", name: "Gomu Gomu no Bajrang Gun", type: "melee",
        dmg: 29, startup: 480, active: 260, recovery: 520,
        meterCost: 100, meterGain: 0,
        reach: { dx: 5, dy: -280, w: 500, h: 330 },
        knockback: 760, launch: -260,
        sfx: "special", cry: "Bajrang Gun!", color: "#fff8db",
      },
      dawnstorm: {
        key: "dawnstorm", name: "Dawn Gatling — Nika Storm", type: "projectile",
        dmg: 6, startup: 190, active: 0, recovery: 390,
        meterCost: 50, meterGain: 0, sfx: "punch", cry: "Dawn Gatling!",
        spread: { count: 8, arcDeg: 92, superCount: 15, superArcDeg: 360, dmg: 6, speed: 760 },
        proj: { kind: "nika_fist", speed: 760, w: 56, h: 42, dmg: 6,
          knockback: 175, launch: -55, life: 1450, color: "#fff7e8" },
      },
    };

    Fighter.prototype.drawLuffy5 = function(flash) {
      const ctx = document.getElementById("game").getContext("2d");
      const swing = this.armSwing();
      const legs = this.legPose();
      const pulse = this.animTime * 5.4;
      const bob = this.state === "idle"
        ? Math.sin(pulse) * 4.2
        : (this.state === "walk" ? Math.abs(Math.sin(this.walkPhase)) * 4 : 0);
      const attacking = this.state === "attack" && this.attack;
      const attackKey = attacking ? this.attack.def.key : "";
      const skin = flash ? "#ffffff" : "#fff0dc";
      const skinShadow = flash ? "#ffe8d7" : "#e8c5aa";
      const white = flash ? "#ffffff" : "#f8f8f5";
      const whiteShadow = flash ? "#eeeeee" : "#d8d9df";
      const purple = flash ? "#cba5ff" : "#7450b8";
      const awakened = this.formed;

      ctx.save();
      ctx.translate(0, -bob);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Vòng mây Nika luôn chuyển động quanh vai, tách Gear 5 khỏi Luffy thường.
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.strokeStyle = awakened ? "rgba(255,235,125,.9)" : "rgba(255,255,255,.78)";
      ctx.lineWidth = awakened ? 10 : 8;
      ctx.shadowColor = awakened ? "#ffe66d" : "#ffffff";
      ctx.shadowBlur = 13;
      ctx.beginPath();
      ctx.moveTo(-18, -108);
      ctx.bezierCurveTo(-46, -126, -47, -84, -24, -81);
      ctx.bezierCurveTo(-42, -64, -20, -44, -8, -62);
      ctx.moveTo(18, -108);
      ctx.bezierCurveTo(47, -125, 47, -84, 24, -80);
      ctx.bezierCurveTo(43, -62, 20, -43, 8, -62);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();

      // Trống Giải Phóng: các nhịp tròn vàng rung sau lưng khi thức tỉnh.
      if (awakened || this.meter >= 100) {
        ctx.save();
        ctx.globalAlpha = awakened ? 0.72 : 0.38;
        ctx.strokeStyle = awakened ? "#ffe878" : "#ffffff";
        for (let i = 0; i < 3; i++) {
          const radius = 36 + i * 14 + Math.sin(pulse + i) * 3;
          ctx.lineWidth = 3 - i * 0.55;
          ctx.beginPath(); ctx.arc(0, -79, radius, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
      }

      // Tay sau mềm như cao su.
      const backWave = Math.sin(pulse * 1.25) * 5;
      ctx.strokeStyle = skinShadow; ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.moveTo(-12, -98); ctx.quadraticCurveTo(-26, -79 + backWave, -17, -55); ctx.stroke();
      ctx.fillStyle = skinShadow; ctx.beginPath(); ctx.arc(-17, -54, 7, 0, Math.PI * 2); ctx.fill();

      // Hai chân trắng, mềm và hơi cong như hoạt hình rubber-hose.
      const drawLeg = (hipX, angle, back) => {
        const kneeX = hipX + Math.sin(angle) * 17;
        const footX = kneeX + Math.sin(angle) * 10 + 4;
        ctx.strokeStyle = back ? "#4c357c" : purple; ctx.lineWidth = 19;
        ctx.beginPath(); ctx.moveTo(hipX, -51); ctx.lineTo(kneeX, -29); ctx.stroke();
        ctx.strokeStyle = back ? skinShadow : skin; ctx.lineWidth = 12;
        ctx.beginPath(); ctx.moveTo(kneeX, -27); ctx.quadraticCurveTo(footX - 5, -16, footX, -9); ctx.stroke();
        ctx.fillStyle = back ? "#d7d7d2" : white;
        roundRect(ctx, kneeX - 10, -33, 20, 8, 4); ctx.fill();
        ctx.fillStyle = "#eee3c8"; roundRect(ctx, footX - 8, -12, 24, 9, 5); ctx.fill();
        ctx.fillStyle = "#8e6d45"; roundRect(ctx, footX - 8, -5, 24, 4, 2); ctx.fill();
      };
      drawLeg(-7, legs.a, true);
      drawLeg(7, legs.b, false);

      // Quần tím và dải mây trắng ở hông.
      const pants = ctx.createLinearGradient(-16, -59, 16, -41);
      pants.addColorStop(0, "#9b75dd"); pants.addColorStop(1, "#4d337f");
      ctx.fillStyle = pants;
      roundRect(ctx, -17, -63, 34, 26, 10); ctx.fill();
      ctx.strokeStyle = "#38215f"; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = white; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(-17, -59); ctx.quadraticCurveTo(0, -52, 17, -59); ctx.stroke();

      // Thân áo trắng mở ngực.
      const coat = ctx.createLinearGradient(-17, -108, 17, -57);
      coat.addColorStop(0, white); coat.addColorStop(1, whiteShadow);
      ctx.fillStyle = coat;
      ctx.beginPath();
      ctx.moveTo(-16, -106); ctx.quadraticCurveTo(-22, -80, -15, -57);
      ctx.lineTo(-3, -61); ctx.lineTo(0, -79); ctx.lineTo(3, -61);
      ctx.lineTo(15, -57); ctx.quadraticCurveTo(22, -80, 16, -106);
      ctx.quadraticCurveTo(0, -111, -16, -106); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#bfc0ca"; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.moveTo(-6, -106); ctx.lineTo(6, -106); ctx.lineTo(0, -67); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#d26658"; ctx.lineWidth = 2.7;
      ctx.beginPath(); ctx.moveTo(-5, -96); ctx.lineTo(5, -78); ctx.moveTo(5, -96); ctx.lineTo(-5, -78); ctx.stroke();

      // Tóc mây trắng đặc trưng, từng lọn tròn nảy theo nhịp trống.
      const hairLift = Math.sin(pulse * 1.15) * 2;
      ctx.fillStyle = whiteShadow;
      ctx.beginPath(); ctx.arc(0, -119, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = white;
      const curls = [
        [-14,-132,10],[-5,-140,11],[7,-140,11],[16,-130,10],
        [11,-120,9],[-12,-119,9],[0,-130,12],[-19,-124,7],[20,-122,7],
      ];
      for (const [x, y, radius] of curls) {
        ctx.beginPath(); ctx.arc(x, y + hairLift, radius, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = "#c9cad1"; ctx.lineWidth = 1.2;
      for (const [x, y, radius] of curls.slice(0, 7)) {
        ctx.beginPath(); ctx.arc(x, y + hairLift, radius, Math.PI * .15, Math.PI * 1.55); ctx.stroke();
      }

      // Mặt Nika: chân mày xoắn, mắt đỏ và nụ cười lớn.
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.ellipse(0, -118, 14, 15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#f4f4f2"; ctx.lineWidth = 3.2;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(side * 6, -127, 5.2, side > 0 ? Math.PI : 0, side > 0 ? Math.PI * 2.3 : -Math.PI * 1.3);
        ctx.stroke();
      }
      if (this.state === "hurt" || this.state === "ko") {
        ctx.strokeStyle = "#5d4050"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-8,-122); ctx.lineTo(-3,-117); ctx.moveTo(-3,-122); ctx.lineTo(-8,-117);
        ctx.moveTo(3,-122); ctx.lineTo(8,-117); ctx.moveTo(8,-122); ctx.lineTo(3,-117); ctx.stroke();
      } else {
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.ellipse(-5, -121, 4, 5.2, -.15, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(5, -121, 4, 5.2, .15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = awakened ? "#ffd84d" : "#e04d69";
        ctx.beginPath(); ctx.arc(-4.5, -120.5, 2, 0, Math.PI * 2); ctx.arc(4.5, -120.5, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = "#8d3443";
      ctx.beginPath(); ctx.ellipse(0, -111, 8.5, 5.8, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = "#fff"; roundRect(ctx, -6.5, -113, 13, 3.2, 1.5); ctx.fill();

      // Tay trước; Bajrang Gun có nắm đấm phủ gần nửa màn hình.
      const armY = -83;
      if (attackKey === "bajrang") {
        const progress = this.attack ? clamp(this.attack.elapsed / this.attack.def.startup, 0, 1) : 0;
        const active = this.attack && this.attack.phase === "active" ? 1 : progress;
        const reach = 34 + active * 205;
        const radius = 20 + active * 64;
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const halo = ctx.createRadialGradient(reach, armY - 32, 8, reach, armY - 32, radius * 1.35);
        halo.addColorStop(0, "rgba(255,255,255,.75)");
        halo.addColorStop(.55, "rgba(255,226,105,.28)");
        halo.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(reach, armY - 32, radius * 1.35, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = skin; ctx.lineWidth = 16 + active * 18;
        ctx.beginPath(); ctx.moveTo(12, -98); ctx.quadraticCurveTo(reach * .45, -132, reach - radius * .35, armY - 28); ctx.stroke();
        ctx.fillStyle = "#25182d"; ctx.beginPath(); ctx.arc(reach, armY - 30, radius + 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(reach, armY - 32, radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#bf8c67"; ctx.lineWidth = 3;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath(); ctx.arc(reach + radius * .28, armY - 32 + i * radius * .24, radius * .3, -1.1, 1.1); ctx.stroke();
        }
      } else {
        const melee = attacking && this.attack.def.type === "melee";
        const reach = melee ? 22 + Math.max(0, swing) * 72 : 20 + Math.max(0, swing) * 22;
        const wave = attackKey === "mogura" ? Math.sin(clamp(swing, 0, 1) * Math.PI) * 30 : 0;
        ctx.strokeStyle = skinShadow; ctx.lineWidth = 14;
        ctx.beginPath(); ctx.moveTo(12, -98); ctx.quadraticCurveTo(reach * .5, armY - wave, reach, armY + wave * .25); ctx.stroke();
        ctx.strokeStyle = skin; ctx.lineWidth = 11;
        ctx.beginPath(); ctx.moveTo(12, -99); ctx.quadraticCurveTo(reach * .5, armY - wave, reach, armY + wave * .25); ctx.stroke();
        ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(reach, armY + wave * .25, 10, 0, Math.PI * 2); ctx.fill();
        if (melee && this.attack.phase === "active") {
          ctx.strokeStyle = "rgba(255,255,255,.65)"; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(reach - 8, armY, 28, -1.1, 1.1); ctx.stroke();
        }
      }

      ctx.restore();
    };
  };

  window.Luffy5Hook = (Game) => {
    const originalProjectileDraw = Game.Projectile.prototype.draw;
    Game.Projectile.prototype.draw = function() {
      const kind = this.d.kind;
      if (kind !== "nika_fist" && kind !== "nika_lightning") {
        originalProjectileDraw.call(this);
        return;
      }

      const ctx = document.getElementById("game").getContext("2d");
      ctx.save();
      ctx.translate(this.x, this.y);
      if (this.dir < 0) ctx.scale(-1, 1);

      if (kind === "nika_lightning") {
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowColor = "#fff36a"; ctx.shadowBlur = 16;
        ctx.strokeStyle = "#fff36a"; ctx.lineWidth = 12; ctx.lineJoin = "miter";
        ctx.beginPath(); ctx.moveTo(-42,-22); ctx.lineTo(-9,-7); ctx.lineTo(-24,7); ctx.lineTo(34,26); ctx.lineTo(10,4); ctx.lineTo(44,-10); ctx.stroke();
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(-39,-21); ctx.lineTo(-8,-7); ctx.lineTo(-22,7); ctx.lineTo(31,24); ctx.stroke();
      } else {
        const spin = this.t / 90;
        ctx.globalCompositeOperation = "screen";
        const halo = ctx.createRadialGradient(5, 0, 3, 5, 0, this.w * .72);
        halo.addColorStop(0, "rgba(255,255,255,.95)");
        halo.addColorStop(.48, "rgba(255,235,155,.55)");
        halo.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(5, 0, this.w * .72, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = "#f7f7f4"; ctx.lineWidth = Math.max(9, this.h * .28);
        ctx.beginPath(); ctx.moveTo(-this.w * .62, 0); ctx.lineTo(-5, 0); ctx.stroke();
        ctx.fillStyle = "#fff0dc"; ctx.beginPath(); ctx.ellipse(10, 0, this.w * .26, this.h * .38, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#c69470"; ctx.lineWidth = 1.8;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath(); ctx.arc(this.w * .18, i * this.h * .13, this.h * .12, -1.1, 1.1); ctx.stroke();
        }
        ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(-8, 0, 20 + Math.sin(spin) * 4, -.8, .8); ctx.stroke();
      }
      ctx.restore();
    };

    Game.addNikaImpact = function(x, y) {
      this.sparks.push({ kind: "ring", x, y, vx: 0, vy: 0,
        life: 440, life0: 440, r: 8, rMax: 175, color: "#fff7c7" });
      this.sparks.push({ kind: "ring", x, y, vx: 0, vy: 0,
        life: 360, life0: 360, r: 8, rMax: 120, color: "#ffffff" });
      for (let i = 0; i < 28; i++) {
        const angle = (i / 28) * Math.PI * 2 + Math.random() * .18;
        const speed = 190 + Math.random() * 330;
        this.sparks.push({ kind: "dot", x, y,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 95,
          life: 380 + Math.random() * 300,
          color: i % 3 === 0 ? "#ffe66d" : "#ffffff", r: 2.5 + Math.random() * 4 });
      }
    };
  };
})();
