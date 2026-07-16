/**
 * Luffy - Character Skills & Drawing Engine (TALL, LEAN VIBRANT VECTOR STYLE)
 * Upgraded details: Tall, lean proportions (ratio 1:7), organic bent knees, tilted straw hat (Screenshot 1), 3D yellow sash, and clean smooth filled vector styling.
 */
(() => {
  "use strict";

  window.LuffyInit = (Fighter, MOVES) => {
    // ---------------------------------------------------------------- Move Set
    MOVES.luffy = {
      close: { key:"close", name:"Gomu Gomu no Pistol", type:"melee",
        dmg:8, startup:70, active:90, recovery:170,
        reach:{dx:34,dy:-58,w:56,h:30}, knockback:230, launch:-40, meterGain:9,
        sfx:"punch", color:"#ff6b6b" },
      ranged: { key:"ranged", name:"Gomu Gomu no Gatling", type:"projectile",
        dmg:18, startup:120, active:360, recovery:240, meterGain:12,
        sfx:"punch",
        multiProj: { count: 6, interval: 60, dmg: 3, speed: 650 },
        proj:{ kind:"gatling", speed:650, w:44, h:26, dmg:3, knockback:110, launch:-22, life:1000, color:"#ffcf9e" } },
      axe: { key:"axe", name:"Gomu Gomu no Ono", type:"melee",
        dmg:16, startup:220, active:150, recovery:230,
        reach:{dx:15,dy:-200,w:340,h:205}, knockback:350, launch:140, meterGain:14,
        sfx:"punch", color:"#ff9a6b" },
      special: { key:"special", name:"Red Hawk", type:"projectile",
        dmg:22, startup:230, active:0, recovery:430, meterCost:50, meterGain:0,
        sfx:"special",
        proj:{ kind:"redhawk", speed:640, w:66, h:44, dmg:22, knockback:520, launch:-180, life:2200, color:"#ff5a2b" } },
    };

    // ---------------------------------------------------------------- Leg Swing Math for Axe Kick
    Fighter.prototype.legAxeSwing = function() {
      if (this.state === "attack" && this.attack && this.attack.def.key === "axe") {
        const d = this.attack.def, a = this.attack, e = a.elapsed;
        const sEnd = d.startup;
        const aEnd = sEnd + d.active;
        if (e < sEnd) {
          const t = e / sEnd;
          return { h: -48 - t * 180, x: 10 - t * 35, state: "rising" };
        } else if (e < aEnd) {
          const t = (e - sEnd) / d.active;
          const h = -228 + t * 218; // từ -228 xuống -10
          const x = -25 + t * 365;   // vươn cực xa ra 340px phía trước!
          return { h, x, state: "slamming" };
        }
        const t = clamp((e - aEnd) / d.recovery, 0, 1);
        return { h: -10 + t * (-38), x: 340 - t * 330, state: "recovery" };
      }
      return null;
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

    // ---------------------------------------------------------------- Main Draw Luffy Method
    Fighter.prototype.drawLuffy = function(flash) {
      const swing = this.armSwing();
      const legs = this.legPose();
      // Nhịp thở phập phồng sinh động ở trạng thái đứng yên (idle) hoặc di chuyển (walk)
      const bob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 2.5 : (this.state === "walk" ? Math.abs(Math.sin(this.walkPhase)) * 3.5 : 0);
      const skin    = flash ? "#ffc2ad" : "#f6cfa4";
      const skinSh  = flash ? "#f0a48f" : "#e0ac7f";
      const red     = flash ? "#ff7358" : "#e5342e";
      const redSh   = flash ? "#d8503c" : "#a81f1a";
      const blue    = flash ? "#5c93ef" : "#2f6fd8";
      const blueSh  = flash ? "#3f6fc4" : "#1f4fa8";

      const ctx = document.getElementById("game").getContext("2d");

      ctx.save();
      ctx.translate(0, -bob);
      ctx.lineJoin = "round"; ctx.lineCap = "round";

      // ---- HIỆU ỨNG GEAR 2 (Khói hồng bồng bềnh cuộn trào) ----
      if (this.meter >= 100 || this.hp < 50) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const anim = this.animTime * 7;
        for (let i = 0; i < 6; i++) {
          const steamY = (anim * 14 + i * 22) % 115;
          const steamX = Math.sin(anim * 0.2 + i * 2.1) * 20;
          const r = 6 + Math.sin(anim * 0.15 + i) * 3;
          const op = clamp(0.38 * (1 - steamY / 115), 0, 0.45);
          
          ctx.fillStyle = i % 2 ? `rgba(255, 182, 193, ${op})` : `rgba(255, 255, 255, ${op * 0.8})`;
          ctx.beginPath();
          ctx.arc(steamX, -steamY, r, 0, Math.PI * 2);
          ctx.arc(steamX - r * 0.6, -steamY + r * 0.3, r * 0.7, 0, Math.PI * 2);
          ctx.arc(steamX + r * 0.6, -steamY - r * 0.3, r * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      this.drawBackArm(skin, skinSh);
      
      const isAxe = this.state === "attack" && this.attack && this.attack.def.key === "axe";
      if (isAxe) {
        const axe = this.legAxeSwing();
        if (axe) {
          // CHÂN SAU ĐỨNG TÂN (Đầm, dứt khoát, mượt mà)
          const backAng = 0.35;
          const kneeX = -6 + Math.sin(backAng) * 16;
          const footX = kneeX + Math.sin(backAng) * 6 + 4;
          
          // Đùi (quần ngắn)
          ctx.strokeStyle = blueSh; ctx.lineWidth = 17;
          ctx.beginPath(); ctx.moveTo(-6, -52); ctx.lineTo(kneeX, -28); ctx.stroke();
          
          // Gấu quần trắng
          ctx.strokeStyle = "#dcdcdc"; ctx.lineWidth = 19;
          ctx.beginPath(); ctx.moveTo(kneeX - 1, -29); ctx.lineTo(kneeX + 1, -26); ctx.stroke();
          
          // Bắp chân (màu da trần)
          ctx.strokeStyle = skinSh; ctx.lineWidth = 12;
          ctx.beginPath(); ctx.moveTo(kneeX, -27); ctx.lineTo(footX, -10); ctx.stroke();
          
          // Dép rơm chân sau
          ctx.fillStyle = "#cdbf9f"; roundRect(ctx, footX - 7, -11, 22, 9, 4); ctx.fill();
          ctx.fillStyle = "#a98d5f"; roundRect(ctx, footX - 7, -4, 22, 4, 2); ctx.fill();

          // CHÂN TRƯỚC SIÊU DÀI RÌU CAO SU (NỆN TỪ TRÊN TRỜI XUỐNG)
          const hipX = 6;
          const hipY = -52;
          const targetX = axe.x;
          const targetY = axe.h;

          // Quần đùi chân trước co giãn
          ctx.strokeStyle = blue; ctx.lineWidth = 17;
          ctx.beginPath(); ctx.moveTo(hipX, hipY);
          ctx.lineTo(hipX + (targetX - hipX) * 0.15, hipY + (targetY - hipY) * 0.15);
          ctx.stroke();

          // Gấu quần trắng
          ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 19;
          ctx.beginPath();
          const gx = hipX + (targetX - hipX) * 0.15;
          const gy = hipY + (targetY - hipY) * 0.15;
          ctx.moveTo(gx - 2, gy); ctx.lineTo(gx + 2, gy);
          ctx.stroke();

          // Bắp chân trần siêu dài kéo giãn cực nét
          ctx.strokeStyle = skin; ctx.lineWidth = 12;
          ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(targetX, targetY);
          ctx.stroke();

          // Dép rơm nện xuống
          ctx.save();
          ctx.translate(targetX, targetY);
          const rotateAng = axe.state === "slamming" ? Math.PI * 0.25 : 0;
          ctx.rotate(rotateAng);
          ctx.fillStyle = "#efe2c8"; roundRect(ctx, -7, -11, 22, 9, 4); ctx.fill();
          ctx.fillStyle = "#a98d5f"; roundRect(ctx, -7, -4, 22, 4, 2); ctx.fill();
          ctx.restore();

          // Hiệu ứng luồng gió quật mạnh sấm sét
          if (axe.state === "slamming") {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.45)"; ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(targetX - 10, targetY - 45);
            ctx.lineTo(targetX - 25, targetY - 15);
            ctx.stroke();
          }
        }
      } else {
        // ---- ĐÔI CHÂN: đùi short xanh + bắp chân trần + gấu quần cuộn gọn ----
        const drawLeg = (hipX, ang, front) => {
          const kneeX = hipX + Math.sin(ang) * 16;
          const footX = kneeX + Math.sin(ang) * 8 + 4;
          // đùi (quần short)
          ctx.strokeStyle = front ? blue : blueSh; ctx.lineWidth = 17;
          ctx.beginPath(); ctx.moveTo(hipX, -52); ctx.lineTo(kneeX, -30); ctx.stroke();
          // bắp chân trần
          ctx.strokeStyle = front ? skin : skinSh; ctx.lineWidth = 11;
          ctx.beginPath(); ctx.moveTo(kneeX, -30); ctx.lineTo(footX, -10); ctx.stroke();
          // highlight bắp chân -> khối tròn
          if (front) {
            ctx.strokeStyle = "rgba(255,226,198,0.75)"; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(kneeX + 3, -27); ctx.lineTo(footX + 2, -13); ctx.stroke();
          }
          // gấu quần cuộn trắng gọn (không phồng thành cục)
          ctx.fillStyle = front ? "#ffffff" : "#e0e0e0";
          roundRect(ctx, kneeX - 9, -33, 18, 7, 3.5); ctx.fill();
          ctx.fillStyle = "rgba(0,0,0,0.10)"; roundRect(ctx, kneeX - 9, -27.5, 18, 1.8, 1); ctx.fill();
          // dép rơm
          ctx.fillStyle = front ? "#efe2c8" : "#cdbf9f"; roundRect(ctx, footX - 7, -11, 22, 9, 4); ctx.fill();
          ctx.fillStyle = "#a98d5f"; roundRect(ctx, footX - 7, -4, 22, 4, 2); ctx.fill();
          // quai dép đan chữ X
          ctx.strokeStyle = "#5a4028"; ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(footX - 5, -9); ctx.lineTo(footX + 9, -11);
          ctx.moveTo(footX - 5, -11); ctx.lineTo(footX + 9, -9);
          ctx.stroke();
        };
        drawLeg(-6, legs.a, false);   // chân sau (tối hơn)
        drawLeg(6, legs.b, true);     // chân trước
      }

      // ---- ÁO VEST ĐỎ THON GỌN (Dáng người V-Shape thon mảnh mượt mà) ----
      const vg = ctx.createLinearGradient(-13, -105, 13, -56);
      vg.addColorStop(0, red); vg.addColorStop(1, redSh);
      ctx.fillStyle = vg;
      ctx.beginPath();
      ctx.moveTo(-13, -105); ctx.quadraticCurveTo(0, -108, 13, -105);
      ctx.lineTo(10, -56); ctx.quadraticCurveTo(0, -53, -10, -56);
      ctx.closePath();
      ctx.fill();

      // Rim-light cạnh trái áo cho khối nổi 3D
      ctx.strokeStyle = "rgba(255,150,125,0.55)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-12, -104); ctx.quadraticCurveTo(-11, -80, -9, -57); ctx.stroke();

      // Cúc áo vàng lấp lánh thon dọc áo vest
      ctx.fillStyle = "#ffd23f";
      ctx.beginPath();
      ctx.arc(-8, -78, 2.2, 0, Math.PI*2);
      ctx.arc(8, -78, 2.2, 0, Math.PI*2);
      ctx.fill();

      // ngực trần chữ V thon thả quyến rũ
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.moveTo(-6, -105); ctx.lineTo(6, -105); ctx.lineTo(0, -70); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = redSh; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-6, -105); ctx.lineTo(0, -70); ctx.lineTo(6, -105); ctx.stroke();
      
      // Sẹo chữ X cực sắc sảo trên ngực
      ctx.strokeStyle = "#b04a39"; ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(-4, -94); ctx.lineTo(4, -80);
      ctx.moveTo(4, -94); ctx.lineTo(-4, -80);
      ctx.stroke();
      ctx.strokeStyle = "#e89280"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-4, -93); ctx.lineTo(4, -79); ctx.stroke();

      // ---- THẮT LƯNG VÀNG RỰC RỠ ----
      ctx.fillStyle = "#ffd23f";
      roundRect(ctx, -12, -58, 24, 7, 3); ctx.fill();
      ctx.fillStyle = "rgba(160, 110, 10, 0.35)";
      ctx.fillRect(-12, -55, 24, 2);
      ctx.fillStyle = "#e0b02e"; ctx.fillRect(-12, -53, 24, 2.5);
      
      // Dải thắt lụa vàng rủ đung đưa mềm mại
      const sashWiggle = (this.state === "walk") ? Math.sin(this.walkPhase * 2) * 5 : Math.sin(this.animTime * 4.5) * 2;
      ctx.fillStyle = "#ffd23f";
      ctx.beginPath();
      ctx.moveTo(2, -54);
      ctx.quadraticCurveTo(sashWiggle - 3, -42, sashWiggle - 7, -25);
      ctx.lineTo(sashWiggle - 1, -25);
      ctx.quadraticCurveTo(sashWiggle - 1, -42, 7, -54);
      ctx.closePath(); ctx.fill();

      this.drawHeadLuffy(skin, skinSh, flash);
      this.drawFrontArmLuffy(swing, skin, skinSh);

      ctx.restore();
    };

    // ---------------------------------------------------------------- Head Luffy
    Fighter.prototype.drawHeadLuffy = function(skin, skinSh, flash) {
      const ctx = document.getElementById("game").getContext("2d");
      const headBob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 0.8 : 0;
      ctx.save();
      ctx.translate(0, headBob);

      // Cổ thon cao
      ctx.fillStyle = skinSh; roundRect(ctx, -3, -112, 6, 11, 2); ctx.fill();
      
      // Mặt (Đầu thon nhỏ tỉ lệ 1:7 cực kỳ nam tính)
      const fg = ctx.createLinearGradient(-11, -132, 11, -110);
      fg.addColorStop(0, skin); fg.addColorStop(1, skinSh);
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(0, -121, 12, 0, Math.PI * 2); ctx.fill();
      
      // Tai thon gọn
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(-11, -120, 2.5, 0, Math.PI * 2); ctx.fill();

      // Mái tóc đen tỉa nhiều lớp nhọn cực ngầu
      ctx.fillStyle = flash ? "#37323d" : "#181820";
      ctx.beginPath();
      ctx.moveTo(-12, -118);
      ctx.quadraticCurveTo(-14, -132, -6, -134);
      ctx.quadraticCurveTo(-3, -140, 2, -134);
      ctx.quadraticCurveTo(8, -139, 10, -131);
      ctx.quadraticCurveTo(14, -127, 11, -118);
      ctx.quadraticCurveTo(5, -125, -2, -123);
      ctx.quadraticCurveTo(-8, -124, -12, -118);
      ctx.closePath(); ctx.fill();

      // Vân tóc nhọn nhô ra ngoài bóng tóc
      ctx.beginPath();
      ctx.moveTo(-4, -123); ctx.lineTo(-1, -129); ctx.lineTo(2, -123);
      ctx.moveTo(3, -124); ctx.lineTo(6, -130); ctx.lineTo(8, -124);
      ctx.fill();

      // Vẽ chiếc mũi dễ thương kiểu anime
      ctx.strokeStyle = skinSh; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(1, -118); ctx.lineTo(3, -117); ctx.stroke();

      // Đôi má hồng ửng
      ctx.fillStyle = "rgba(255, 100, 100, 0.32)";
      ctx.beginPath();
      ctx.ellipse(6, -115, 2.8, 1.4, Math.PI * 0.1, 0, Math.PI * 2);
      ctx.ellipse(-4, -116, 2.0, 1.1, -Math.PI * 0.1, 0, Math.PI * 2);
      ctx.fill();

      // BIỂU CẢM GƯƠNG MẶT
      if (this.state === "hurt") {
        ctx.strokeStyle = "#181820"; ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(2, -123); ctx.lineTo(9, -119);
        ctx.moveTo(2, -119); ctx.lineTo(9, -123);
        ctx.stroke();
        
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#181820"; ctx.lineWidth = 1.8;
        roundRect(ctx, -2, -113, 8, 5, 1.8); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-2, -110.5); ctx.lineTo(6, -110.5); ctx.stroke();
      } else if (this.state === "ko") {
        ctx.strokeStyle = "#181820"; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(3, -122); ctx.lineTo(8, -117);
        ctx.moveTo(8, -122); ctx.lineTo(3, -117);
        ctx.stroke();

        ctx.fillStyle = "#4a1515";
        ctx.beginPath(); ctx.ellipse(4, -111, 3.5, 2.5, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "#181820"; ctx.lineWidth = 1.3; ctx.stroke();
      } else {
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.ellipse(5, -121, 3.2, 3.8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#15151c";
        ctx.beginPath(); ctx.arc(5.8, -120, 1.9, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#181820"; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(1.5, -126); ctx.lineTo(8.5, -125); ctx.stroke();

        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.moveTo(-1, -113); ctx.quadraticCurveTo(5, -105, 11, -113);
        ctx.quadraticCurveTo(5, -110, -1, -113); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#7a2a2a"; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(-1, -113); ctx.quadraticCurveTo(5, -105, 11, -113);
        ctx.stroke();
      }

      ctx.strokeStyle = "#c05a49"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(2, -114); ctx.lineTo(7, -114); ctx.stroke();

      // ---- MŨ RƠM NGHIÊNG SAU ĐẦU NÂNG CẤP ĐẸP MẮT (Tilted back like Screenshot 1) ----
      ctx.save();
      ctx.translate(-5, -131);
      ctx.rotate(-0.28); // Nghiêng ngược lên trên ra sau đầu để nhấc mũ lên, lộ rõ mặt và mắt dũng mãnh chuẩn lãng tử!
      
      const brimY = 0;
      ctx.fillStyle = flash ? "#ffe6a0" : "#e6c163";
      ctx.beginPath(); ctx.ellipse(0, brimY, 24, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#c8a44e"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(0, brimY, 24, 7, 0, 0, Math.PI * 2); ctx.stroke();
      
      // Vân đan rơm xoắn ốc
      ctx.strokeStyle = "rgba(140, 95, 20, 0.2)"; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, brimY, 18, 5, 0, 0, Math.PI * 2);
      ctx.ellipse(0, brimY, 12, 3.5, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = flash ? "#f2d68a" : "#d8b24e";
      ctx.beginPath(); ctx.ellipse(0, brimY - 3, 12, 9, 0, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = "#cf3b3b"; ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.moveTo(-11, brimY - 3); ctx.lineTo(11, brimY - 3); ctx.stroke();
      
      // Sợi rơm dọc dập dềnh
      ctx.strokeStyle = "rgba(150,110,40,.32)"; ctx.lineWidth = 0.8;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 4, brimY - 1); ctx.lineTo(i * 5, brimY + 5); ctx.stroke(); }

      // Dây thắt nơ rủ
      const bowWiggle = Math.sin(this.animTime * 6) * 3;
      ctx.fillStyle = "#cf3b3b";
      ctx.beginPath();
      ctx.moveTo(-7, brimY - 2);
      ctx.quadraticCurveTo(-15, brimY + 4 + bowWiggle, -20, brimY + 13 + bowWiggle * 1.5);
      ctx.quadraticCurveTo(-12, brimY + 10, -5, brimY - 2);
      ctx.closePath(); ctx.fill();
      
      ctx.restore();

      ctx.restore();
    };

    // ---------------------------------------------------------------- Front Arm Luffy
    Fighter.prototype.drawFrontArmLuffy = function(swing, skin, skinSh) {
      const ctx = document.getElementById("game").getContext("2d");
      const attacking = this.state === "attack" && this.attack;
      const y = -86;

      // Hiệu ứng liên hoàn đấm mờ cho chiêu Gatling Cao Su
      if (attacking && this.attack.def.key === "ranged") {
        ctx.save();
        ctx.strokeStyle = "rgba(224, 160, 111, 0.4)";
        ctx.lineWidth = 9;
        const anim = this.animTime * 25;
        for (let i = 0; i < 3; i++) {
          const angle = (anim + i * 2) % (Math.PI * 2);
          const bx = 12 + Math.cos(angle) * 15;
          const by = y + Math.sin(angle) * 15;
          ctx.beginPath();
          ctx.moveTo(12, -96);
          ctx.lineTo(bx, by);
          ctx.stroke();
          
          ctx.fillStyle = "rgba(246, 207, 164, 0.5)";
          ctx.beginPath();
          ctx.arc(bx, by, 7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        return;
      }

      const isMelee = attacking && this.attack.def.type === "melee";
      const reach = isMelee ? 20 + swing * 52 : (attacking ? 24 + swing * 10 : 8);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      // vệt tốc độ khi đấm cao su
      if (isMelee && this.attack.phase !== "startup") {
        ctx.strokeStyle = "rgba(255,220,140,.45)"; ctx.lineWidth = 14;
        ctx.beginPath(); ctx.moveTo(14, y); ctx.lineTo(reach - 6, y); ctx.stroke();
      }
      // cánh tay thon dài
      ctx.strokeStyle = skin; ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(11, -96);
      ctx.lineTo(reach * 0.55, y + 1);
      ctx.lineTo(reach, y);
      ctx.stroke();
      
      // nắm đấm
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(reach, y, 8.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skinSh;
      ctx.beginPath(); ctx.arc(reach, y + 2.5, 4, 0, Math.PI * 2); ctx.fill();
    };
  };
})();
