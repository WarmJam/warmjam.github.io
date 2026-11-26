// 2D 渲染：球台、逐像素着色的立体滚动球、球杆、瞄准线
(function (BP) {
  'use strict';

  class Renderer {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.sprites = new Map();
      this.glyphs = {};
    }

    // 布局：area 是 CSS 像素下可用于球台的矩形
    layout(table, area, dpr) {
      this.t = table;
      this.dpr = dpr;
      const W = window.innerWidth, H = window.innerHeight;
      this.cv.width = Math.round(W * dpr);
      this.cv.height = Math.round(H * dpr);
      this.cv.style.width = W + 'px';
      this.cv.style.height = H + 'px';
      this.rail = table.frame;
      const fw = table.L + 2 * this.rail, fh = table.W + 2 * this.rail;
      this.portrait = area.h > area.w * 1.05;
      const s = this.portrait ? Math.min(area.w / fh, area.h / fw) : Math.min(area.w / fw, area.h / fh);
      this.s = s;
      this.cx = area.x + area.w / 2;
      this.cy = area.y + area.h / 2;
      this.tableImg = null;
      this.sprites.clear();
    }
    // 世界 -> 屏幕（CSS 像素）
    w2s(x, y) {
      return this.portrait ? [this.cx - y * this.s, this.cy - x * this.s] : [this.cx + x * this.s, this.cy - y * this.s];
    }
    s2w(px, py) {
      return this.portrait ? [-(py - this.cy) / this.s, -(px - this.cx) / this.s] : [(px - this.cx) / this.s, -(py - this.cy) / this.s];
    }
    // 把 ctx 设成世界坐标
    worldTransform(ctx, scale = this.dpr) {
      const s = this.s * scale, cx = this.cx * scale, cy = this.cy * scale;
      if (this.portrait) ctx.setTransform(0, -s, -s, 0, cx, cy);
      else ctx.setTransform(s, 0, 0, -s, cx, cy);
    }

    // ---------------- 球台（缓存） ----------------
    buildTable(opts) {
      const t = this.t, dpr = this.dpr;
      const c = document.createElement('canvas');
      c.width = this.cv.width;
      c.height = this.cv.height;
      const g = c.getContext('2d');
      this.worldTransform(g);
      const hl = t.L / 2, hw = t.W / 2, rl = this.rail, cw = t.cw;
      const cloth = opts.cloth || t.cloth;
      const snk = t.type === 'snooker';
      const X0 = -hl - rl, Y0 = -hw - rl, FW = t.L + 2 * rl, FH = t.W + 2 * rl;
      // 木框四角做成以角袋为圆心的圆弧（弧形球台）
      const cp = t.pockets.filter((p) => p.corner);
      const RC = Math.max(0.05, cp.reduce((m, p) => m + (hl + rl - Math.abs(p.hx) + hw + rl - Math.abs(p.hy)) / 2, 0) / cp.length);
      const rr = (x, y, w, h, r) => {
        g.beginPath();
        g.moveTo(x + r, y);
        g.lineTo(x + w - r, y);
        g.arcTo(x + w, y, x + w, y + r, r);
        g.lineTo(x + w, y + h - r);
        g.arcTo(x + w, y + h, x + w - r, y + h, r);
        g.lineTo(x + r, y + h);
        g.arcTo(x, y + h, x, y + h - r, r);
        g.lineTo(x, y + r);
        g.arcTo(x, y, x + r, y, r);
        g.closePath();
      };
      const poly = (pts) => {
        g.beginPath();
        pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
        g.closePath();
      };

      // 1. 地面投影 + 木框
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.75)';
      g.shadowBlur = 45 * dpr;
      g.shadowOffsetY = 18 * dpr;
      rr(X0, Y0, FW, FH, RC);
      g.fillStyle = '#3a1c0c';
      g.fill();
      g.restore();
      const woodA = snk ? '#4a2210' : '#6e3a1a', woodB = snk ? '#6d3418' : '#94532a';
      rr(X0, Y0, FW, FH, RC);
      g.fillStyle = woodA;
      g.fill();
      // 木纹：长边横纹、短边竖纹
      const grain = (x, y, w, h, vertical) => {
        g.save();
        g.beginPath();
        g.rect(x, y, w, h);
        g.clip();
        const lg = vertical ? g.createLinearGradient(x, 0, x + w, 0) : g.createLinearGradient(0, y, 0, y + h);
        lg.addColorStop(0, woodA);
        lg.addColorStop(0.45, woodB);
        lg.addColorStop(0.55, woodB);
        lg.addColorStop(1, woodA);
        g.fillStyle = lg;
        g.fillRect(x, y, w, h);
        const n = 70;
        for (let i = 0; i < n; i++) {
          g.strokeStyle = Math.random() < 0.5 ? 'rgba(40,16,4,0.22)' : 'rgba(255,210,160,0.08)';
          g.lineWidth = 0.0012 + Math.random() * 0.0025;
          g.beginPath();
          if (vertical) {
            const px = x + Math.random() * w;
            g.moveTo(px, y);
            for (let k = 1; k <= 8; k++) g.lineTo(px + Math.sin(k * 1.3 + i) * 0.004, y + (k / 8) * h);
          } else {
            const py = y + Math.random() * h;
            g.moveTo(x, py);
            for (let k = 1; k <= 16; k++) g.lineTo(x + (k / 16) * w, py + Math.sin(k * 0.9 + i) * 0.004);
          }
          g.stroke();
        }
        g.restore();
      };
      const wr = rl - cw; // 木质部分宽度
      g.save();
      rr(X0, Y0, FW, FH, RC);
      g.clip();
      grain(X0, Y0, FW, wr, false);
      grain(X0, hw + cw, FW, wr, false);
      grain(X0, Y0 + wr, wr, FH - 2 * wr, true);
      grain(hl + cw, Y0 + wr, wr, FH - 2 * wr, true);
      g.restore();
      // 外缘倒角高光与内缘暗边
      rr(X0, Y0, FW, FH, RC);
      g.strokeStyle = 'rgba(255,220,180,0.25)';
      g.lineWidth = 0.006;
      g.stroke();
      rr(X0 + 0.012, Y0 + 0.012, FW - 0.024, FH - 0.024, RC - 0.012);
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 0.004;
      g.stroke();

      // 2. 袋口金属/皮革包角（在木框上，先画）
      const kind = t.kind;
      g.save();
      rr(X0, Y0, FW, FH, RC);
      g.clip();
      for (const p of t.pockets) {
        const lr = p.hr + 0.034;
        const lg = g.createRadialGradient(p.hx, p.hy, p.hr * 0.9, p.hx, p.hy, lr);
        if (kind === 'snooker') {
          lg.addColorStop(0, '#5a3c0c');
          lg.addColorStop(0.35, '#e2bd55');
          lg.addColorStop(0.7, '#a07a26');
          lg.addColorStop(1, '#6a4c14');
        } else if (kind === 'cn') {
          lg.addColorStop(0, '#3a3e44');
          lg.addColorStop(0.35, '#e8edf2');
          lg.addColorStop(0.7, '#8e96a0');
          lg.addColorStop(1, '#4a5058');
        } else {
          lg.addColorStop(0, '#120a06');
          lg.addColorStop(0.5, '#4a2c1a');
          lg.addColorStop(1, '#1e1108');
        }
        g.fillStyle = lg;
        g.beginPath();
        g.arc(p.hx, p.hy, lr, 0, 7);
        g.fill();
        if (kind === 'wpa') {
          g.strokeStyle = 'rgba(255,225,180,0.4)';
          g.lineWidth = 0.0018;
          g.setLineDash([0.006, 0.004]);
          g.beginPath();
          g.arc(p.hx, p.hy, lr - 0.008, 0, 7);
          g.stroke();
          g.setLineDash([]);
        }
      }
      g.restore();

      // 3. 台呢：台面 + 袋口平台（两袋角之间）
      g.fillStyle = cloth;
      g.fillRect(-hl, -hw, t.L, t.W);
      for (const m of t.mouths) {
        poly(m);
        g.fill();
      }
      // 纹理和灯光要覆盖台面和袋口平台：分别裁剪各画一遍（避免路径方向相反时互相抵消）
      const clothFx = (clipFn, n, outsideRect) => {
      g.save();
      g.beginPath();
      clipFn();
      g.clip();
      if (outsideRect) {
        g.beginPath();
        g.rect(-hl - 1, -hw - 1, t.L + 2, t.W + 2);
        g.rect(-hl, -hw, t.L, t.W);
        g.clip('evenodd');
      }
      for (let i = 0; i < n; i++) {
        g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)';
        g.fillRect(-hl - 0.05 + Math.random() * (t.L + 0.1), -hw - 0.05 + Math.random() * (t.W + 0.1), 0.0025, 0.0025);
      }
      g.globalCompositeOperation = 'lighter';
      for (const lx of [-hl * 0.55, 0, hl * 0.55]) {
        const lg = g.createRadialGradient(lx, 0, 0.02, lx, 0, hw * 1.25);
        lg.addColorStop(0, 'rgba(255,250,230,0.16)');
        lg.addColorStop(0.6, 'rgba(255,250,230,0.05)');
        lg.addColorStop(1, 'rgba(255,250,230,0)');
        g.fillStyle = lg;
        g.fillRect(-hl - 0.1, -hw - 0.1, t.L + 0.2, t.W + 0.2);
      }
      g.globalCompositeOperation = 'source-over';
      const vg = g.createRadialGradient(0, 0, hw * 0.6, 0, 0, hl * 1.15);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.28)');
      g.fillStyle = vg;
      g.fillRect(-hl - 0.1, -hw - 0.1, t.L + 0.2, t.W + 0.2);
      g.restore();
      };
      clothFx(() => g.rect(-hl, -hw, t.L, t.W), 9000);
      for (const m of t.mouths) {
        clothFx(() => {
          m.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
          g.closePath();
        }, 150, true);
      }

      // 4. 库边胶条：按真实库面折线（鼻线 + 袋角弧/斜面）
      const offs = (p, out) => (out[0] ? Math.abs(p[0]) - hl : Math.abs(p[1]) - hw);
      const faces = [];
      for (const cu of t.cushions) {
        const { face, out } = cu;
        const a = face[0], b = face[face.length - 1];
        const back = (p) => {
          const d = cw - offs(p, out);
          return [p[0] + out[0] * d, p[1] + out[1] * d];
        };
        const pts = face.concat([back(b), back(a)]);
        const n0 = out[0] ? [out[0] * hl, 0] : [0, out[1] * hw];
        const lg = g.createLinearGradient(n0[0], n0[1], n0[0] + out[0] * cw, n0[1] + out[1] * cw);
        lg.addColorStop(0, shade(cloth, 0.16));
        lg.addColorStop(0.2, shade(cloth, 0.03));
        lg.addColorStop(1, shade(cloth, -0.32));
        // 台面上的库边阴影
        g.save();
        g.beginPath();
        g.rect(-hl, -hw, t.L, t.W);
        g.clip();
        g.shadowColor = 'rgba(0,0,0,0.55)';
        g.shadowBlur = 10 * dpr;
        poly(pts);
        g.fillStyle = shade(cloth, -0.2);
        g.fill();
        g.restore();
        poly(pts);
        g.fillStyle = lg;
        g.fill();
        // 袋角：胶条卷进袋口的一面更暗
        g.save();
        poly(pts);
        g.clip();
        g.lineJoin = 'round';
        g.strokeStyle = 'rgba(0,0,0,0.45)';
        g.lineWidth = 0.012;
        const half = (face.length / 2) | 0;
        for (const arr of [face.slice(0, half), face.slice(half)]) {
          g.beginPath();
          arr.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
          g.stroke();
        }
        g.restore();
        // 胶条外沿与木框分界
        g.strokeStyle = 'rgba(0,0,0,0.55)';
        g.lineWidth = 0.003;
        g.beginPath();
        const ba = back(a), bb = back(b);
        g.moveTo(ba[0], ba[1]);
        g.lineTo(bb[0], bb[1]);
        g.stroke();
        faces.push(face);
      }

      // 5. 袋洞：所有袋口同样大小的圆洞，盖在胶条/木框被挖掉的部分上
      g.save();
      rr(X0, Y0, FW, FH, RC);
      g.clip();
      for (const p of t.pockets) {
        const hg = g.createRadialGradient(p.hx, p.hy, 0, p.hx, p.hy, p.hr);
        hg.addColorStop(0, '#000');
        hg.addColorStop(0.75, '#030303');
        hg.addColorStop(0.93, '#161616');
        hg.addColorStop(1, '#2a2a2a');
        g.fillStyle = hg;
        g.beginPath();
        g.arc(p.hx, p.hy, p.hr, 0, 7);
        g.fill();
        // 洞口内壁：上方受光的一侧稍亮，看起来有深度
        const ig = g.createLinearGradient(p.hx - p.hr * 0.5, p.hy + p.hr * 0.6, p.hx + p.hr * 0.5, p.hy - p.hr * 0.6);
        ig.addColorStop(0, 'rgba(255,255,255,0.10)');
        ig.addColorStop(0.5, 'rgba(255,255,255,0)');
        g.strokeStyle = ig;
        g.lineWidth = p.hr * 0.18;
        g.beginPath();
        g.arc(p.hx, p.hy, p.hr * 0.91, 0, 7);
        g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.05)';
        g.lineWidth = 0.0015;
        for (let k = 0.3; k < 0.7; k += 0.2) {
          g.beginPath();
          g.arc(p.hx, p.hy, p.hr * k, 0, 7);
          g.stroke();
        }
      }
      g.restore();

      // 6. 库面亮边（台面与胶条的交界）—— 只画在洞外，袋口轮廓清清楚楚
      g.save();
      g.beginPath();
      g.rect(X0 - 1, Y0 - 1, FW + 2, FH + 2);
      for (const p of t.pockets) {
        g.moveTo(p.hx + p.hr, p.hy);
        g.arc(p.hx, p.hy, p.hr, 0, Math.PI * 2);
      }
      g.clip('evenodd');
      g.lineJoin = 'round';
      for (const face of faces) {
        g.strokeStyle = 'rgba(255,255,255,0.62)';
        g.lineWidth = 0.0026;
        g.beginPath();
        face.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
        g.stroke();
      }
      g.restore();
      // 洞口边缘一圈细亮边
      for (const p of t.pockets) {
        g.strokeStyle = 'rgba(255,255,255,0.28)';
        g.lineWidth = 0.0018;
        g.beginPath();
        g.arc(p.hx, p.hy, p.hr, 0, 7);
        g.stroke();
      }

      // 7. 钻石点（贝母镶嵌）
      const dia = (x, y) => {
        const s = 0.0085;
        const dg = g.createRadialGradient(x - s * 0.3, y + s * 0.3, 0, x, y, s * 1.2);
        dg.addColorStop(0, '#ffffff');
        dg.addColorStop(0.5, '#e6eef2');
        dg.addColorStop(1, '#9fb0b8');
        g.fillStyle = dg;
        g.beginPath();
        g.moveTo(x - s, y);
        g.lineTo(x, y + s * 0.75);
        g.lineTo(x + s, y);
        g.lineTo(x, y - s * 0.75);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.4)';
        g.lineWidth = 0.001;
        g.stroke();
      };
      const mid = cw + wr * 0.5;
      if (!snk) {
        for (let i = 1; i < 8; i++) if (i !== 4) for (const s of [-1, 1]) dia(-hl + (i * t.L) / 8, s * (hw + mid));
        for (let i = 1; i < 4; i++) for (const s of [-1, 1]) dia(s * (hl + mid), -hw + (i * t.W) / 4);
      } else {
        // 斯诺克台：短边中点铜牌
        for (const s of [-1, 1]) {
          g.fillStyle = '#c9a441';
          g.beginPath();
          g.ellipse(s * (hl + mid), 0, 0.012, 0.03, 0, 0, 7);
          g.fill();
        }
      }

      // 7. 标线
      g.strokeStyle = 'rgba(255,255,255,0.4)';
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = 0.0028;
      if (snk) {
        g.beginPath();
        g.moveTo(t.baulkX, -hw);
        g.lineTo(t.baulkX, hw);
        g.stroke();
        g.beginPath();
        g.arc(t.baulkX, 0, t.dR, Math.PI / 2, Math.PI * 1.5);
        g.stroke();
        for (const k in t.spots) {
          g.beginPath();
          g.arc(t.spots[k][0], t.spots[k][1], 0.004, 0, 7);
          g.fill();
        }
      } else {
        g.setLineDash([0.012, 0.012]);
        g.strokeStyle = 'rgba(255,255,255,0.22)';
        g.beginPath();
        g.moveTo(t.headX, -hw);
        g.lineTo(t.headX, hw);
        g.stroke();
        g.setLineDash([]);
        for (const x of [opts.apex != null ? opts.apex : t.footSpot, t.headX]) {
          g.beginPath();
          g.arc(x, 0, 0.005, 0, 7);
          g.fill();
        }
      }
      this.tableImg = c;
    }

    // ---------------- 球的精灵 ----------------
    glyph(n) {
      if (this.glyphs[n]) return this.glyphs[n];
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = '#fbfaf5';
      g.beginPath();
      g.arc(64, 64, 64, 0, 7);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 5;
      g.beginPath();
      g.arc(64, 64, 61, 0, 7);
      g.stroke();
      g.fillStyle = '#0c0c0c';
      g.font = `900 ${n > 9 ? 64 : 82}px "Arial Black", Arial, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(n), 64, 70);
      if (n === 6 || n === 9) g.fillRect(44, 108, 40, 7);
      return (this.glyphs[n] = g.getImageData(0, 0, 128, 128).data);
    }
    ballStyle(b) {
      if (this.t.type === 'snooker') {
        if (b.id === 0) return { base: [246, 243, 232] };
        return { base: hex(BP.SN[b.kind].c) };
      }
      if (b.id === 0) return { base: [246, 243, 232], dot: true };
      const col = hex(BP.ballColor(b.id));
      return { base: col, stripe: b.id > 8, num: b.id };
    }
    sprite(b, rpx) {
      let sp = this.sprites.get(b.id);
      const q = b.q;
      if (sp && sp.r === rpx && Math.abs(sp.q[0] * q[0] + sp.q[1] * q[1] + sp.q[2] * q[2] + sp.q[3] * q[3]) > 0.99995) return sp.c;
      const S = Math.ceil(rpx * 2) + 2;
      if (!sp || sp.r !== rpx) {
        const c = document.createElement('canvas');
        c.width = c.height = S;
        sp = { c, r: rpx, q: q.slice(), img: c.getContext('2d').createImageData(S, S) };
        this.sprites.set(b.id, sp);
      }
      sp.q = q.slice();
      const st = this.ballStyle(b);
      const glyph = st.num ? this.glyph(st.num) : null;
      const d = sp.img.data;
      // 旋转矩阵（世界->球体：用共轭四元数）
      const [w, x, y, z] = q;
      const m00 = 1 - 2 * (y * y + z * z), m01 = 2 * (x * y + w * z), m02 = 2 * (x * z - w * y);
      const m10 = 2 * (x * y - w * z), m11 = 1 - 2 * (x * x + z * z), m12 = 2 * (y * z + w * x);
      const m20 = 2 * (x * z + w * y), m21 = 2 * (y * z - w * x), m22 = 1 - 2 * (x * x + y * y);
      const Lx = -0.42, Ly = 0.55, Lz = 0.72;
      const Hn = Math.hypot(Lx, Ly, Lz + 1);
      const Hx = Lx / Hn, Hy = Ly / Hn, Hz = (Lz + 1) / Hn;
      const half = S / 2, P = this.portrait;
      for (let py = 0; py < S; py++) {
        for (let px = 0; px < S; px++) {
          const i = (py * S + px) * 4;
          const sx = (px + 0.5 - half) / rpx, sy = (py + 0.5 - half) / rpx;
          const r2 = sx * sx + sy * sy;
          const r = Math.sqrt(r2);
          const a = Math.max(0, Math.min(1, (1 - r) * rpx + 0.5));
          if (a <= 0) {
            d[i + 3] = 0;
            continue;
          }
          const vz = Math.sqrt(Math.max(0, 1 - Math.min(1, r2)));
          const vx = sx, vy = -sy; // 视图空间：右、上、朝向观察者
          // 视图 -> 世界
          const wx = P ? vy : vx, wy = P ? -vx : vy, wz = vz;
          // 世界 -> 球体
          const bx = m00 * wx + m01 * wy + m02 * wz;
          const by = m10 * wx + m11 * wy + m12 * wz;
          const bz = m20 * wx + m21 * wy + m22 * wz;
          let cr = st.base[0], cg = st.base[1], cb = st.base[2];
          if (st.num) {
            const az = Math.abs(bz);
            // 花色球：彩色宽带绕着经过两个号码圆的大圆，两端是白色
            if (st.stripe && Math.abs(bx) > 0.62) {
              cr = 246;
              cg = 244;
              cb = 236;
            }
            if (az > 0.86) {
              const u = (bz > 0 ? bx : -bx) / 0.51, v = by / 0.51;
              const gx = Math.max(0, Math.min(127, ((u * 0.5 + 0.5) * 128) | 0)), gy = Math.max(0, Math.min(127, ((-v * 0.5 + 0.5) * 128) | 0));
              const gi = (gy * 128 + gx) * 4;
              cr = glyph[gi];
              cg = glyph[gi + 1];
              cb = glyph[gi + 2];
            }
          } else if (st.dot && bz > 0.985) {
            cr = 200;
            cg = 30;
            cb = 30;
          }
          const diff = Math.max(0, vx * Lx + vy * Ly + vz * Lz);
          const spec = Math.pow(Math.max(0, vx * Hx + vy * Hy + vz * Hz), 70) * 1.1 + Math.pow(Math.max(0, vx * Hx + vy * Hy + vz * Hz), 8) * 0.08;
          // 明暗更分明：环境光 + 漫反射，边缘压暗并加一圈细描边，球在台呢上更醒目
          const lit = (0.5 + 0.62 * diff) * (0.72 + 0.28 * vz);
          const rim = Math.pow(1 - vz, 3) * 0.18;
          const edge = r > 1 - 1.3 / rpx ? 0.55 : 1;
          d[i] = Math.min(255, (cr * lit + 255 * spec + 40 * rim) * edge);
          d[i + 1] = Math.min(255, (cg * lit + 255 * spec + 60 * rim) * edge);
          d[i + 2] = Math.min(255, (cb * lit + 255 * spec + 80 * rim) * edge);
          d[i + 3] = a * 255;
        }
      }
      sp.c.getContext('2d').putImageData(sp.img, 0, 0);
      return sp.c;
    }

    // ---------------- 每帧绘制 ----------------
    draw(state) {
      const ctx = this.ctx, dpr = this.dpr, t = this.t;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0e1116';
      ctx.fillRect(0, 0, this.cv.width, this.cv.height);
      const bg = ctx.createRadialGradient(this.cx * dpr, this.cy * dpr, 50, this.cx * dpr, this.cy * dpr, Math.max(this.cv.width, this.cv.height) * 0.7);
      bg.addColorStop(0, '#2a3040');
      bg.addColorStop(1, '#0b0d12');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, this.cv.width, this.cv.height);
      if (!this.tableImg) this.buildTable(state.tableOpts || {});
      ctx.drawImage(this.tableImg, 0, 0);
      const sim = state.sim;
      const R = t.R, rpx = Math.max(3, R * this.s * dpr);

      // 自由球区域
      if (state.bih && state.showBih) {
        this.worldTransform(ctx);
        ctx.save();
        ctx.beginPath();
        ctx.rect(-t.L / 2, -t.W / 2, t.L, t.W);
        for (const p of t.pockets) {
          ctx.moveTo(p.hx + p.hr, p.hy);
          ctx.arc(p.hx, p.hy, p.hr, 0, Math.PI * 2);
        }
        ctx.clip('evenodd');
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        if (state.bih === 'kitchen') ctx.fillRect(-t.L / 2, -t.W / 2, t.headX + t.L / 2, t.W);
        else if (state.bih === 'D') {
          ctx.beginPath();
          ctx.arc(t.baulkX, 0, t.dR, Math.PI / 2, Math.PI * 1.5);
          ctx.fill();
        }
        ctx.restore();
      }
      // 指定袋口
      if (state.callPocket != null) {
        const pk = t.pockets[state.callPocket]; const p = { x: pk.hx, y: pk.hy, r: pk.hr };
        this.worldTransform(ctx);
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 0.008;
        ctx.setLineDash([0.012, 0.008]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 1.35, 0, 7);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (state.pickPockets) {
        this.worldTransform(ctx);
        ctx.fillStyle = 'rgba(255,210,63,0.18)';
        for (const p of t.pockets) {
          ctx.beginPath();
          ctx.arc(p.hx, p.hy, p.hr * 1.3, 0, 7);
          ctx.fill();
        }
      }

      // 进袋动画
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (const b of sim.balls) {
        if (b.on || b.pocket < 0 || b.off) continue;
        const k = (sim.time - b.potT) / 0.35;
        if (k > 1 || k < 0) continue;
        const pk = t.pockets[b.pocket]; const p = { x: pk.hx, y: pk.hy, r: pk.hr };
        const x = b.potFrom[0] + (p.x - b.potFrom[0]) * Math.min(1, k * 1.5), y = b.potFrom[1] + (p.y - b.potFrom[1]) * Math.min(1, k * 1.5);
        const [sx, sy] = this.w2s(x, y);
        const img = this.sprite(b, rpx);
        const sc = 1 - k * 0.45;
        ctx.globalAlpha = 1 - k;
        const sz = img.width * sc;
        ctx.drawImage(img, sx * dpr - sz / 2, sy * dpr - sz / 2, sz, sz);
        ctx.globalAlpha = 1;
      }

      // 影子
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      for (const b of sim.balls) {
        if (!b.on) continue;
        const [sx, sy] = this.w2s(b.x, b.y);
        const lift = 1 + b.z * 30;
        ctx.beginPath();
        ctx.ellipse(sx * dpr + rpx * 0.28 * lift, sy * dpr + rpx * 0.34 * lift, rpx * 1.02 * lift, rpx * 0.92 * lift, 0.5, 0, 7);
        ctx.fill();
      }
      // 目标球提示
      if (state.targets && state.targets.length <= 7) {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1.5 * dpr;
        for (const id of state.targets) {
          const b = sim.get(id);
          if (!b || !b.on) continue;
          const [sx, sy] = this.w2s(b.x, b.y);
          ctx.beginPath();
          ctx.arc(sx * dpr, sy * dpr, rpx + 3 * dpr, 0, 7);
          ctx.stroke();
        }
      }
      // 瞄准线（在球下面）
      if (state.guide) this.drawGuide(state.guide, rpx);
      // 球
      for (const b of sim.balls) {
        if (!b.on) continue;
        const [sx, sy] = this.w2s(b.x, b.y);
        const img = this.sprite(b, rpx);
        const sc = 1 + b.z * 12;
        const sz = img.width * sc;
        ctx.drawImage(img, sx * dpr - sz / 2, sy * dpr - sz / 2 - b.z * this.s * dpr * 0.6, sz, sz);
      }
      // 自由球手柄
      if (state.bih && state.showBih) {
        const c = sim.get(0);
        const [sx, sy] = this.w2s(c.x, c.y);
        ctx.strokeStyle = state.placeBad ? '#ff4a4a' : '#ffd23f';
        ctx.lineWidth = 2 * dpr;
        ctx.setLineDash([5 * dpr, 4 * dpr]);
        ctx.beginPath();
        ctx.arc(sx * dpr, sy * dpr, rpx * 2.1, 0, 7);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = `${16 * dpr}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText('✋', sx * dpr, sy * dpr - rpx * 2.6);
      }
      // 球杆
      if (state.cue) this.drawCue(state.cue, rpx);
    }

    drawGuide(g, rpx) {
      const ctx = this.ctx, dpr = this.dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const P = (x, y) => this.w2s(x, y).map((v) => v * dpr);
      const line = (pts, col, w, dash) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = w * dpr;
        ctx.setLineDash(dash ? dash.map((v) => v * dpr) : []);
        ctx.beginPath();
        pts.forEach((p, i) => {
          const [x, y] = P(p[0], p[1]);
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      };
      line([g.from, g.ghost], 'rgba(255,255,255,0.85)', 1.6);
      const [gx, gy] = P(g.ghost[0], g.ghost[1]);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.arc(gx, gy, rpx, 0, 7);
      ctx.stroke();
      if (g.obj) line(g.obj, g.objLegal === false ? 'rgba(255,90,90,0.95)' : 'rgba(255,230,120,0.95)', 2);
      if (g.tan) line(g.tan, 'rgba(160,220,255,0.75)', 1.4, [5, 4]);
      if (g.cuePath) line(g.cuePath, 'rgba(255,255,255,0.55)', 1.4, [3, 4]);
      if (g.objPath) line(g.objPath, 'rgba(255,230,120,0.55)', 1.4, [3, 4]);
    }

    // 精细球杆：皮头/白箍/枫木前节/接牙/尖角镶嵌/手柄缠线/尾节
    drawCue(c, rpx) {
      const ctx = this.ctx, dpr = this.dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const [bx, by] = this.w2s(c.x, c.y);
      const [ex, ey] = this.w2s(c.x + Math.cos(c.ang), c.y + Math.sin(c.ang));
      let dx = ex - bx, dy = ey - by;
      const n = Math.hypot(dx, dy);
      dx /= n;
      dy /= n;
      const elev = ((c.elev || 0) * Math.PI) / 180;
      const fore = Math.cos(elev); // 抬杆时俯视缩短
      const m = this.s * dpr; // 每米像素
      const R = this.t.R;
      const gap = (R + 0.006 + c.pull * 0.22) * m;
      const Lc = 1.47 * fore * m;
      const tipW = 0.0065 * m, buttW = 0.0152 * m;
      ctx.save();
      ctx.translate(bx * dpr - dx * gap, by * dpr - dy * gap);
      ctx.rotate(Math.atan2(dy, dx) + Math.PI);
      const W = (u) => tipW + (buttW - tipW) * Math.min(1, Math.max(0, (u - 0.3) / 0.7)) * 0.9 + (buttW - tipW) * 0.1 * u;
      const seg = (u0, u1) => {
        ctx.beginPath();
        ctx.moveTo(u0 * Lc, -W(u0));
        ctx.lineTo(u1 * Lc, -W(u1));
        ctx.lineTo(u1 * Lc, W(u1));
        ctx.lineTo(u0 * Lc, W(u0));
        ctx.closePath();
      };
      // 投影在台面上的影子（抬杆越高影子越远）
      ctx.save();
      ctx.translate(0, (5 + elev * 40) * dpr);
      ctx.filter = `blur(${3 * dpr}px)`;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      seg(0, 1);
      ctx.fill();
      ctx.restore();
      const parts = [
        [0, 0.006, '#2f6fd0'], // 巧粉皮头
        [0.006, 0.024, '#f6f3ea'], // 白箍
        [0.024, 0.735, 'maple'],
        [0.735, 0.75, 'silver'],
        [0.75, 0.765, '#111'],
        [0.765, 1.1, 'ebony'],
        [1.1, 1.106, 'silver'],
        [1.106, 1.33, 'wrap'],
        [1.33, 1.336, 'silver'],
        [1.336, 1.458, 'rose'],
        [1.458, 1.47, '#0c0c0c'],
      ];
      for (const [a0, a1, kind] of parts) {
        const u0 = a0 / 1.47, u1 = a1 / 1.47;
        seg(u0, u1);
        let fill = kind;
        if (kind === 'maple') {
          const lg = ctx.createLinearGradient(u0 * Lc, 0, u1 * Lc, 0);
          lg.addColorStop(0, '#f4e6c6');
          lg.addColorStop(1, '#e4c690');
          fill = lg;
        } else if (kind === 'silver') {
          const lg = ctx.createLinearGradient(0, -W(u1), 0, W(u1));
          lg.addColorStop(0, '#f5f7fa');
          lg.addColorStop(0.5, '#9aa2ad');
          lg.addColorStop(1, '#e2e6ec');
          fill = lg;
        } else if (kind === 'ebony') fill = '#24140c';
        else if (kind === 'wrap') fill = '#161616';
        else if (kind === 'rose') {
          const lg = ctx.createLinearGradient(u0 * Lc, 0, u1 * Lc, 0);
          lg.addColorStop(0, '#6a2416');
          lg.addColorStop(1, '#4a140c');
          fill = lg;
        }
        ctx.fillStyle = fill;
        ctx.fill();
        if (kind === 'maple') {
          ctx.save();
          ctx.clip();
          ctx.strokeStyle = 'rgba(150,100,40,0.18)';
          ctx.lineWidth = 0.6 * dpr;
          for (let k = 0; k < 5; k++) {
            ctx.beginPath();
            const yy = (k / 4 - 0.5) * W(u1) * 1.4;
            ctx.moveTo(u0 * Lc, yy);
            ctx.bezierCurveTo(u0 * Lc + Lc * 0.2, yy + 1 * dpr, u1 * Lc - Lc * 0.2, yy - 1 * dpr, u1 * Lc, yy);
            ctx.stroke();
          }
          ctx.restore();
        } else if (kind === 'ebony') {
          // 枫木尖角镶嵌（带彩色贴皮）
          ctx.save();
          ctx.clip();
          const x0 = u0 * Lc, x1 = u1 * Lc, w = W(u1);
          for (const [col, k] of [['#1e5bd0', 1.12], ['#f0dcb0', 1]]) {
            ctx.fillStyle = col;
            for (const s of [-1, 1]) {
              ctx.beginPath();
              ctx.moveTo(x0 + (x1 - x0) * 0.08, s * w * 0.15 * k);
              ctx.lineTo(x1, s * w * 0.95);
              ctx.lineTo(x1, s * w * 0.15);
              ctx.closePath();
              ctx.fill();
            }
            ctx.beginPath();
            ctx.moveTo(x0 + (x1 - x0) * 0.05 / k, 0);
            ctx.lineTo(x1, -w * 0.28 * k);
            ctx.lineTo(x1, w * 0.28 * k);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        } else if (kind === 'wrap') {
          // 爱尔兰亚麻缠线纹理
          ctx.save();
          ctx.clip();
          ctx.strokeStyle = 'rgba(255,255,255,0.09)';
          ctx.lineWidth = 0.7 * dpr;
          const x0 = u0 * Lc, x1 = u1 * Lc, w = W(u1);
          for (let x = x0; x < x1 + w * 2; x += 2.2 * dpr) {
            ctx.beginPath();
            ctx.moveTo(x, -w);
            ctx.lineTo(x - w * 0.8, w);
            ctx.stroke();
          }
          ctx.restore();
        } else if (kind === 'rose') {
          ctx.save();
          ctx.clip();
          ctx.fillStyle = '#d8c9a0';
          for (const f of [0.18, 0.2, 0.8]) ctx.fillRect(u0 * Lc + (u1 - u0) * Lc * f, -W(u1), 1.2 * dpr, W(u1) * 2);
          ctx.restore();
        }
      }
      // 整根圆柱体光影
      seg(0, 1);
      const sh = ctx.createLinearGradient(0, -buttW, 0, buttW);
      sh.addColorStop(0, 'rgba(0,0,0,0.35)');
      sh.addColorStop(0.28, 'rgba(255,255,255,0.32)');
      sh.addColorStop(0.42, 'rgba(255,255,255,0.05)');
      sh.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = sh;
      ctx.fill();
      ctx.restore();
    }
  }

  function hex(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function shade(h, k) {
    const c = hex(h).map((v) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)))));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  BP.Renderer = Renderer;
})(window.BP);
