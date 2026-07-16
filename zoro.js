/**
 * Zoro - Character Skills & Drawing Engine (TALL, MUSCULAR VIBRANT VECTOR STYLE)
 * Upgraded details: Tall lean body ratio, muscular broad shoulders, narrow waist, detailed Haramaki texture, detailed boots, and eye flare.
 */
(() => {
  "use strict";

  window.ZoroInit = (Fighter, MOVES) => {
    // ---------------------------------------------------------------- Move Set
    MOVES.zoro = {
      close: { key:"close", name:"Santoryu — Chém Ba Kiếm", type:"melee",
        dmg:9, startup:60, active:100, recovery:180,
        reach:{dx:32,dy:-64,w:64,h:60}, knockback:210, launch:-30, meterGain:9,
        sfx:"slash", color:"#c8ffe0" },
      ranged: { key:"ranged", name:"36 Pao Phách Phong", type:"projectile",
        dmg:10, startup:130, active:0, recovery:290, meterGain:11,
        sfx:"slash",
        proj:{ kind:"slash", speed:600, w:40, h:70, dmg:10, knockback:280, launch:-70, life:2000, color:"#9affc4" } },
      asura: { key:"asura", name:"Kijin Ashura — Chém Xoay Nhảy", type:"melee",
        dmg:16, startup:350, active:650, recovery:300,
        reach:{dx:15,dy:-80,w:260,h:90}, knockback:260, launch:-50, meterGain:14,
        sfx:"slash", color:"#df9cff" },
      special: { key:"special", name:"Long Quyển Phong (Tatsumaki)", type:"projectile",
        dmg:21, startup:210, active:0, recovery:440, meterCost:50, meterGain:0,
        sfx:"special", cry:"Tatsumaki!",
        proj:{ kind:"tatsumaki", speed:460, w:70, h:120, dmg:21, knockback:480, launch:-220, life:2400, color:"#39d67e" } },
      // SIÊU CHIÊU 2 (↓+skill khi full Haki) — đĩa kiếm khí xoay bay
      sanzen: { key:"sanzen", name:"Santoryu Ougi: Sanzen Sekai", type:"projectile",
        dmg:22, startup:300, active:0, recovery:440, meterCost:100, meterGain:0,
        sfx:"slash", cry:"Sanzen Sekai!",
        proj:{ kind:"sanzen", speed:540, w:96, h:150, dmg:22, knockback:540, launch:-160, life:2600, color:"#8fffbf" } },
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

    // ---------------------------------------------------------------- Main Draw Zoro Method
    Fighter.prototype.drawZoro = function(flash) {
      const swing = this.armSwing();
      const legs = this.legPose();
      // Nhịp thở phập phồng sinh động ở trạng thái đứng yên (idle) hoặc di chuyển (walk)
      const bob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 2.5 : (this.state === "walk" ? Math.abs(Math.sin(this.walkPhase)) * 3.5 : 0);
      const skin    = flash ? "#ffc2ad" : "#f0c49a";
      const skinSh  = flash ? "#f0a48f" : "#d9a877";
      const white   = flash ? "#ffffff" : "#f2f2ea";
      const whiteSh = flash ? "#e6e6dc" : "#d0d0c4";
      const green   = flash ? "#59d488" : "#2ea15a";
      const greenSh = flash ? "#3aa564" : "#1c6e3c";

      const ctx = document.getElementById("game").getContext("2d");

      // Trạng thái quấn khăn nghiêm túc: Chỉ khi máu dưới 50 (hp < 50) thì mới quấn khăn bandana đen lên đầu
      const isSerious = (this.hp < 50);

      ctx.save();
      
      // Xoay toàn bộ cơ thể Zoro để tạo chuyển động nhào lộn hoặc xoay ngang chém gió thật sự!
      const isAsura = this.state === "attack" && this.attack && this.attack.def.key === "asura";
      if (isAsura) {
        const a = this.attack;
        const e = a.elapsed;
        const sEnd = a.def.startup;
        const act = a.def.active;
        
        ctx.translate(0, -60); // Tâm xoay nằm ở ngực
        if (e < sEnd) {
          const t = e / sEnd;
          ctx.rotate(-t * Math.PI * 0.12); // Hơi cúi/ngửa người chuẩn bị nhảy
        } else if (e < sEnd + act) {
          const t = (e - sEnd) / act;
          const spinCount = 2; // Xoay 2 vòng 720 độ cực kỳ uy lực và rõ nét!
          const angle = t * Math.PI * 2 * spinCount;
          
          if (!this.onGround) {
            // TRÊN CAO: Nhào lộn lộn vòng (xoay quanh tâm ngực)
            ctx.rotate(angle);
          } else {
            // MẶT ĐẤT: Xoay ngang người như lốc xoáy (co giãn trục X tạo ảo giác 3D)
            ctx.scale(Math.cos(angle), 1);
          }
        } else {
          const t = clamp((e - (sEnd + act)) / a.def.recovery, 0, 1);
          ctx.rotate((1 - t) * Math.PI * 0.05); // Trả lại tư thế đứng vững sau khi xoay chém
        }
        ctx.translate(0, 60);
      }

      ctx.translate(0, -bob);
      ctx.lineJoin = "round"; ctx.lineCap = "round";

      this.drawSwords();                                   // 3 kiếm giắt hông huyền thoại phía sau
      this.drawBackArm(skin, skinSh, { bandana: !isSerious }); // Tay sau (Chỉ buộc khăn ở bắp tay nếu không quấn đầu)
      
      // ---- VẼ ĐÔI CHÂN QUẦN THÙNG RỘNG CHẮC KHỎE (Zoro Stance) ----
      const pantsCol = flash ? "#3a3d47" : "#1a1b20";
      const pantsSh  = "#0f1013";

      // Chân sau (Trái) - Khuỵu tự nhiên
      const kneeL = -6 + Math.sin(legs.a) * 16;
      const footL = kneeL + Math.sin(legs.a) * 8 + 4;
      ctx.strokeStyle = pantsSh; ctx.lineWidth = 16;
      ctx.beginPath(); ctx.moveTo(-6, -52); ctx.lineTo(kneeL, -28); ctx.lineTo(footL, -10); ctx.stroke();
      // Giày sau
      ctx.fillStyle = "#1e1f26"; roundRect(ctx, footL - 7, -11, 22, 9, 4); ctx.fill();
      ctx.fillStyle = "#0c0d10"; roundRect(ctx, footL - 7, -4, 22, 4, 2); ctx.fill();

      // Chân trước (Phải) - Đứng tấn dứt khoát
      const kneeR = 6 + Math.sin(legs.b) * 16;
      const footR = kneeR + Math.sin(legs.b) * 8 + 4;
      // viền contour ống quần
      ctx.strokeStyle = "#000000"; ctx.lineWidth = 17;
      ctx.beginPath(); ctx.moveTo(6, -52); ctx.lineTo(kneeR, -28); ctx.lineTo(footR, -10); ctx.stroke();
      ctx.strokeStyle = pantsCol; ctx.lineWidth = 15;
      ctx.beginPath(); ctx.moveTo(6, -52); ctx.lineTo(kneeR, -28); ctx.lineTo(footR, -10); ctx.stroke();
      // Giày trước (Boots)
      ctx.fillStyle = "#2b2d36"; roundRect(ctx, footR - 7, -11, 22, 9, 4); ctx.fill();
      ctx.fillStyle = "#0f1013"; roundRect(ctx, footR - 7, -4, 22, 4, 2); ctx.fill();
      // Gân sáng dọc ống quần + đầu gối + ánh bóng mũi bốt -> khối chân rõ hơn
      ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(kneeR + 3, -27); ctx.lineTo(footR + 1, -13); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.beginPath(); ctx.arc(kneeR + 1, -28, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)"; roundRect(ctx, footR - 6, -11, 18, 2.4, 1.4); ctx.fill();

      // ---- ÁO VÕ PHỤC TRẮNG (Cơ bắp vai rộng V-Shape siêu dũng mãnh) ----
      const sg = ctx.createLinearGradient(-14, -105, 14, -62);
      sg.addColorStop(0, white); sg.addColorStop(1, whiteSh);
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(-14, -105); ctx.quadraticCurveTo(0, -109, 14, -105);
      ctx.lineTo(11, -62); ctx.lineTo(-11, -62);
      ctx.closePath();
      ctx.fill();
      // viền contour cel-shading
      ctx.strokeStyle = flash ? "#cfcfc2" : "#b0b0a4"; ctx.lineWidth = 1.8; ctx.stroke();

      // Bóng đổ tối bên phải áo (khối 3D)
      ctx.fillStyle = "rgba(150,150,138,0.38)";
      ctx.beginPath();
      ctx.moveTo(6, -104); ctx.quadraticCurveTo(11, -84, 10, -62);
      ctx.lineTo(4, -62); ctx.quadraticCurveTo(7, -84, 3, -104);
      ctx.closePath(); ctx.fill();
      // Nếp gấp vải áo gi
      ctx.strokeStyle = "rgba(150,150,138,0.5)"; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-8, -100); ctx.quadraticCurveTo(-10, -82, -8, -64);
      ctx.moveTo(9, -100);  ctx.quadraticCurveTo(11, -82, 9, -64);
      ctx.stroke();
      // Rim-light cạnh trái áo võ phục
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-13, -104); ctx.quadraticCurveTo(-12, -84, -10, -63); ctx.stroke();

      // Vết sẹo chém chéo của Mihawk khổng lồ sắc sảo trên ngực áo
      ctx.strokeStyle = "#9a2a1a"; ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-10, -96); ctx.lineTo(8, -75);
      ctx.stroke();
      // Các nốt khâu dọc vết sẹo
      ctx.strokeStyle = whiteSh; ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const sx = -10 + i * 4.5;
        const sy = -96 + i * 5.2;
        ctx.moveTo(sx - 2.5, sy + 3);
        ctx.lineTo(sx + 2.5, sy - 3);
      }
      ctx.stroke();

      // cổ áo hở chữ V
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.moveTo(-5, -105); ctx.lineTo(5, -105); ctx.lineTo(0, -84); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = whiteSh; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-5, -105); ctx.lineTo(0, -84); ctx.lineTo(5, -105); ctx.stroke();

      // ---- ĐAI BỤNG XANH (HARAMAKI) TINH SẢO ----
      const hg = ctx.createLinearGradient(0, -66, 0, -42);
      hg.addColorStop(0, green); hg.addColorStop(1, greenSh);
      ctx.fillStyle = hg;
      roundRect(ctx, -13, -66, 26, 24, 5); ctx.fill();
      ctx.strokeStyle = flash ? "#2a7a48" : "#0f4a24"; ctx.lineWidth = 1.6; ctx.stroke();  // viền contour
      // bóng đổ nửa dưới haramaki
      ctx.fillStyle = "rgba(10,60,25,0.28)"; roundRect(ctx, -13, -50, 26, 8, 3); ctx.fill();
      // Vẽ các sợi thớ dệt xếp lớp dọc Haramaki
      ctx.strokeStyle = "rgba(10, 80, 30, 0.28)"; ctx.lineWidth = 1;
      for (let ox = -10; ox <= 10; ox += 4) {
        ctx.beginPath(); ctx.moveTo(ox, -65); ctx.lineTo(ox, -43); ctx.stroke();
      }
      ctx.strokeStyle = greenSh; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-13, -58); ctx.lineTo(13, -58);
      ctx.moveTo(-13, -50); ctx.lineTo(13, -50);
      ctx.stroke();

      this.drawHeadZoro(skin, skinSh, green, greenSh, flash, isSerious);
      this.drawFrontArmZoro(swing, skin, skinSh, flash);

      // ---- HIỆU ỨNG QUỶ THUẬT ASHURA NỔI BẬT HƠN (Khi đang ở trạng thái chém Ashura) ----
      if (isAsura) {
        // Demonic Ashura Aura bùng cháy ngọn lửa tím đậm sắc sảo
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const darkGrad = ctx.createRadialGradient(0, -60, 10, 0, -60, 75);
        darkGrad.addColorStop(0, "rgba(128, 0, 128, 0.82)");
        darkGrad.addColorStop(0.45, "rgba(139, 0, 139, 0.44)");
        darkGrad.addColorStop(0.8, "rgba(220, 20, 60, 0.16)");
        darkGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = darkGrad;
        ctx.beginPath(); ctx.arc(0, -60, 75, 0, Math.PI * 2); ctx.fill();
        
        // Vẽ các đốm kiếm khí linh hồn màu tím bay bốc lên
        const anim = this.animTime * 15;
        for (let i = 0; i < 4; i++) {
          const px = Math.sin(i * 1.5 + anim * 0.12) * 45;
          const py = -60 - (anim * 2.5 + i * 20) % 65;
          ctx.fillStyle = "#df9cff";
          ctx.beginPath(); ctx.arc(px, py, 2.5 + Math.sin(i) * 1.2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();

        // Draw multiple rotating swords (nine-sword style illusion!)
        ctx.save();
        ctx.translate(0, -60);
        const rot = this.animTime * 6; // Xoay chậm và đầm hơn nhiều để nhìn rõ chém ngang xoay
        ctx.rotate(rot);
        
        for (let i = 0; i < 3; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI * 2) / 3);
          
          // Vẽ 1 thanh kiếm xoay phát sáng xanh lục/tím huyền ảo cực nét
          ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4.8; ctx.lineCap = "round";
          ctx.shadowColor = "#8e2bbf"; ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.moveTo(15, 0);
          ctx.lineTo(82, 0);
          ctx.stroke();
          
          // Chuôi kiếm
          ctx.strokeStyle = "#a30e0e"; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(15, 0); ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.restore();
        }
        ctx.restore();

        // Vòng chém xoáy tròn lớn bao bọc quanh người rực rỡ sắc bén
        ctx.strokeStyle = "rgba(142, 43, 191, 0.48)"; ctx.lineWidth = 15;
        ctx.beginPath(); ctx.arc(0, -60, 72, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)"; ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.arc(0, -60, 68, 0, Math.PI * 2); ctx.stroke();
      }

      ctx.restore();
    };

    // ---------------------------------------------------------------- Head Zoro
    Fighter.prototype.drawHeadZoro = function(skin, skinSh, green, greenSh, flash, isSerious) {
      const ctx = document.getElementById("game").getContext("2d");
      const headBob = this.state === "idle" ? Math.sin(this.animTime * 4.5) * 0.8 : 0;
      ctx.save();
      ctx.translate(0, headBob);

      // cổ thon cao
      ctx.fillStyle = skinSh; roundRect(ctx, -3, -112, 6, 11, 2); ctx.fill();
      
      // mặt (Tỷ lệ 1:7 thon nhỏ nghiêm nghị)
      const fg = ctx.createLinearGradient(-11, -132, 11, -110);
      fg.addColorStop(0, skin); fg.addColorStop(1, skinSh);
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(0, -121, 12, 0, Math.PI * 2); ctx.fill();
      // viền contour mặt + bóng hàm (cel-shading)
      ctx.strokeStyle = "rgba(120,80,55,0.4)"; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(0, -121, 12, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "rgba(150,95,60,0.18)";
      ctx.beginPath(); ctx.ellipse(-6, -117, 4.3, 6.5, 0.25, 0, Math.PI * 2); ctx.fill();

      // tai + 3 khuyên vàng bên tai trái khẽ đung đưa nhẹ
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(-11, -120, 2.5, 0, Math.PI * 2); ctx.fill();
      const sway = Math.sin(this.animTime * 4.5) * 1.0;
      ctx.fillStyle = "#f5c518";
      for (let i = 0; i < 3; i++) {
        const ex = -12 + i * 0.5 + sway * 0.45;
        const ey = -115 + i * 4;
        ctx.beginPath(); ctx.arc(ex, ey, 1.6, 0, Math.PI * 2); ctx.fill();
      }

      if (isSerious) {
        // --- BANDANA ĐEN ---
        ctx.fillStyle = flash ? "#3d404a" : "#1e1e24";
        ctx.beginPath();
        ctx.arc(0, -121, 12, Math.PI * 1.0, Math.PI * 2.0);
        ctx.closePath(); ctx.fill();
        roundRect(ctx, -13, -126, 26, 5.5, 1.8); ctx.fill();
        
        // Đuôi dây thắt nút ruy-băng
        const bandanaWiggle = Math.sin(this.animTime * 7.5) * 3.5;
        ctx.strokeStyle = flash ? "#3d404a" : "#121216";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-9, -122);
        ctx.quadraticCurveTo(-18, -122 + bandanaWiggle, -23, -115 + bandanaWiggle * 1.4);
        ctx.moveTo(-9, -122);
        ctx.quadraticCurveTo(-16, -116 - bandanaWiggle, -20, -109 - bandanaWiggle * 1.4);
        ctx.stroke();
      } else {
        // --- TÓC XANH LỤC BẢO CHÂN THỰC ---
        const hairCol = flash ? "#7de0a4" : green;
        ctx.fillStyle = hairCol;
        ctx.beginPath();
        ctx.arc(0, -121, 12, Math.PI * 1.03, Math.PI * 1.97);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-12, -122);
        ctx.lineTo(-10, -133); ctx.lineTo(-5, -125);
        ctx.lineTo(-2, -136); ctx.lineTo(2, -125);
        ctx.lineTo(6, -134); ctx.lineTo(10, -124);
        ctx.lineTo(12, -122);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = greenSh;
        ctx.beginPath(); ctx.moveTo(-2, -136); ctx.lineTo(2, -125); ctx.lineTo(-1, -126); ctx.closePath(); ctx.fill();
        // ánh tóc (sheen) lục bảo bóng
        ctx.strokeStyle = flash ? "#c8ffe0" : "#8fffbf"; ctx.lineWidth = 1.5; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(-8, -128); ctx.quadraticCurveTo(-2, -131, 5, -128); ctx.stroke();
      }

      // Vẽ chiếc mũi dễ thương kiểu anime nghiêm nghị
      ctx.strokeStyle = skinSh; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(1, -117); ctx.lineTo(3, -116); ctx.stroke();

      // BIỂU CẢM GƯƠNG MẶT
      const isAsura = this.state === "attack" && this.attack && this.attack.def.key === "asura";
      if (this.state === "hurt") {
        ctx.strokeStyle = "#15151c"; ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(2.5, -122); ctx.lineTo(8.5, -118);
        ctx.stroke();
        
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#15151c"; ctx.lineWidth = 1.6;
        roundRect(ctx, 2, -114, 8, 4.5, 1.5); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(2, -111.5); ctx.lineTo(10, -111.5); ctx.stroke();
      } else if (this.state === "ko") {
        ctx.strokeStyle = "#15151c"; ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(2.5, -120); ctx.lineTo(8.5, -120);
        ctx.stroke();
        
        ctx.fillStyle = "#330a0a";
        ctx.beginPath(); ctx.ellipse(5, -112, 2.5, 1.8, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "#15151c"; ctx.lineWidth = 1.2; ctx.stroke();

        ctx.fillStyle = "#a30e0e";
        ctx.beginPath();
        ctx.moveTo(5, -111); ctx.lineTo(7, -105); ctx.lineTo(8.5, -105); ctx.lineTo(6, -111);
        ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.ellipse(5, -120, 2.8, 3.2, 0, 0, Math.PI * 2); ctx.fill();
        
        // ---- LOÉ MẮT QUỶ ĐỎ ĐẮC Ý ----
        if (isSerious || isAsura) {
          ctx.fillStyle = "#ff1a1a";
          ctx.beginPath(); ctx.arc(5.6, -120, 1.8, 0, Math.PI * 2); ctx.fill();
          
          ctx.strokeStyle = "rgba(255, 30, 30, 0.7)"; ctx.lineWidth = 1.6;
          ctx.beginPath(); 
          ctx.moveTo(-2, -120); ctx.lineTo(13, -120);
          ctx.moveTo(5.6, -126); ctx.lineTo(5.6, -114);
          ctx.stroke();
        } else {
          ctx.fillStyle = "#15151c";
          ctx.beginPath(); ctx.arc(5.6, -120, 1.6, 0, Math.PI * 2); ctx.fill();
        }

        ctx.strokeStyle = "#20242b"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(1.5, -126); ctx.lineTo(9.5, -125); ctx.stroke();
        
        ctx.strokeStyle = "#6a2626"; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(2, -113); ctx.lineTo(9, -113); ctx.stroke();
      }

      // sẹo dọc qua mắt trái
      ctx.strokeStyle = "#b5493a"; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(5, -128); ctx.lineTo(5, -115); ctx.stroke();

      // ---- KATANA NGẬM MIỆNG khi tung ASHURA (Tam Đao Lưu) ----
      if (isAsura) {
        ctx.save();
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        // hàm nghiến chặt cắn kiếm
        ctx.strokeStyle = "#4a1414"; ctx.lineWidth = 2.6;
        ctx.beginPath(); ctx.moveTo(1, -112); ctx.lineTo(9, -112); ctx.stroke();
        ctx.fillStyle = "#f4f4f4";
        roundRect(ctx, 2, -113.4, 6.5, 2, 0.8); ctx.fill();

        // chuôi kiếm trắng (Wado) kéo về sau
        ctx.strokeStyle = "#eef0f0"; ctx.lineWidth = 4.6;
        ctx.beginPath(); ctx.moveTo(4, -111.5); ctx.lineTo(-17, -108); ctx.stroke();
        ctx.strokeStyle = "rgba(0,0,0,0.28)"; ctx.lineWidth = 1;
        for (let i = 1; i <= 4; i++) {
          const t = i / 5; const hx = 4 - 21 * t, hy = -111.5 + 3.5 * t;
          ctx.beginPath(); ctx.moveTo(hx + 1.6, hy - 1.6); ctx.lineTo(hx - 1.6, hy + 1.6); ctx.stroke();
        }
        // đốc chuôi
        ctx.fillStyle = "#d9dce0";
        ctx.beginPath(); ctx.arc(-17, -108, 2.4, 0, Math.PI * 2); ctx.fill();

        // tsuba (chắn kiếm) tại miệng
        ctx.fillStyle = "#ffd700";
        ctx.beginPath(); ctx.arc(6, -111.6, 2.8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#b8860b"; ctx.lineWidth = 0.8; ctx.stroke();

        // lưỡi kiếm vươn ra trước, phát sáng quỷ khí tím
        const mbg = ctx.createLinearGradient(9, 0, 52, 0);
        mbg.addColorStop(0, "#cfdae4"); mbg.addColorStop(0.5, "#ffffff"); mbg.addColorStop(1, "#eef4fa");
        ctx.shadowColor = "#8e2bbf"; ctx.shadowBlur = 9;
        ctx.strokeStyle = mbg; ctx.lineWidth = 4.6;
        ctx.beginPath(); ctx.moveTo(9, -112); ctx.lineTo(52, -114.5); ctx.stroke();
        ctx.shadowBlur = 0;
        // sống kiếm
        ctx.strokeStyle = "rgba(120,140,160,.65)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(10, -113.6); ctx.lineTo(50, -116); ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
    };

    // ---------------------------------------------------------------- Front Arm Zoro
    Fighter.prototype.drawFrontArmZoro = function(swing, skin, skinSh, flash) {
      const ctx = document.getElementById("game").getContext("2d");
      const attacking = this.state === "attack" && this.attack;
      const ang = attacking ? (-1.2 + swing * 2.0) : -0.24;
      const y = -86;
      ctx.save();
      ctx.translate(11, -93);
      ctx.rotate(ang);
      // viền contour cánh tay
      ctx.strokeStyle = "#a5734a"; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.lineWidth = 13;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(12, 3); ctx.lineTo(24, 3); ctx.stroke();
      // cánh tay cơ bắp
      ctx.strokeStyle = skin; ctx.lineWidth = 11;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(12, 3); ctx.lineTo(24, 3); ctx.stroke();
      // khối cơ (highlight + bóng)
      ctx.strokeStyle = "rgba(255,224,196,0.7)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(1, -1.5); ctx.lineTo(12, 1.5); ctx.stroke();
      ctx.strokeStyle = "rgba(150,95,58,0.35)"; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(2, 4); ctx.lineTo(13, 6); ctx.stroke();
      // bàn tay
      ctx.fillStyle = "#a5734a"; ctx.beginPath(); ctx.arc(24, 3, 5.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(24, 3, 5, 0, Math.PI * 2); ctx.fill();

      // ---- katana bảo kiếm ----
      ctx.translate(24, 3);
      ctx.strokeStyle = "#2c7a3f"; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
      ctx.fillStyle = "#d4a017"; ctx.fillRect(6, -4, 3, 8);
      
      const bg = ctx.createLinearGradient(9, 0, 66, 0);
      bg.addColorStop(0, "#cfdae4"); bg.addColorStop(0.5, "#ffffff"); bg.addColorStop(1, "#eef4fa");
      
      if (attacking) {
        ctx.shadowColor = "#39d67e";
        ctx.shadowBlur = 11;
      }
      ctx.strokeStyle = bg; ctx.lineWidth = 5.5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(9, -1); ctx.lineTo(66, -4); ctx.stroke();
      ctx.shadowBlur = 0;

      // Kiếm Enma bùng cháy ngọn lửa quỷ màu xanh lá rực rỡ tỏa khí phách khi nộ đầy 100%
      if (this.meter >= 100) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const fAnim = this.animTime * 15;
        for (let i = 0; i < 5; i++) {
          const fx = 14 + i * 11;
          const fy = -2.5 + Math.sin(fAnim * 0.4 + i) * 3;
          const fr = 4.5 + Math.sin(fAnim * 0.2 + i * 1.5) * 1.8;
          ctx.fillStyle = i % 2 ? "rgba(100, 255, 180, 0.45)" : "rgba(30, 220, 100, 0.28)";
          ctx.beginPath();
          ctx.arc(fx, fy, fr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      
      ctx.strokeStyle = "rgba(120,140,160,.6)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(9, -3); ctx.lineTo(64, -6); ctx.stroke();
      
      if (attacking && this.attack.def.type === "melee" && this.attack.phase !== "startup") {
        ctx.strokeStyle = "rgba(120, 255, 180, 0.6)"; ctx.lineWidth = 15;
        ctx.beginPath(); ctx.arc(-6, 0, 56, -0.85, 0.85); ctx.stroke();
        
        ctx.strokeStyle = "rgba(255, 255, 255, 0.88)"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(-6, 0, 56, -0.65, 0.65); ctx.stroke();
      }
      ctx.restore();
    };

    // ---------------------------------------------------------------- Draw Swords on Hilt
    Fighter.prototype.drawSwords = function() {
      const ctx = document.getElementById("game").getContext("2d");
      const swords = [
        { sheath: "#fefefe", wrap: "#ffffff", tsuba: "#ffd700" }, // Wado Ichimonji
        { sheath: "#181716", wrap: "#800000", tsuba: "#caa010" }, // Shusui
        { sheath: "#b81a0e", wrap: "#202020", tsuba: "#caa010" }  // Sandai Kitetsu
      ];
      for (let i = 0; i < 3; i++) {
        const s = swords[i];
        const bx = -11 - i * 4.5;
        const top = -62 + i * 2.2;
        const angle = 0.22 + i * 0.05;
        ctx.save();
        ctx.translate(bx, top);
        ctx.rotate(angle);
        
        if (this.meter >= 100) {
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          ctx.fillStyle = "rgba(100, 255, 180, 0.16)";
          ctx.beginPath();
          ctx.ellipse(-5, 17, 10, 24, -0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Vỏ kiếm
        ctx.strokeStyle = s.sheath;
        ctx.lineWidth = 5.2; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-11, 35); ctx.stroke();
        
        // Chuôi kiếm có vân đan chéo tỉ mỉ tinh xảo
        ctx.strokeStyle = s.wrap;
        ctx.lineWidth = 4.2;
        ctx.beginPath(); ctx.moveTo(3, -9); ctx.lineTo(0, 0); ctx.stroke();
        
        // Vẽ vân đan chuôi (Wrap details)
        ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(2, -7); ctx.lineTo(1, -2);
        ctx.moveTo(1.5, -4); ctx.lineTo(0.5, 0);
        ctx.stroke();

        // Tsuba cách điệu hoa văn vàng
        ctx.fillStyle = s.tsuba;
        ctx.beginPath(); ctx.arc(1, -1, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    };
  };
})();
