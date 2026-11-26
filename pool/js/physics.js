// 桌球物理：球台几何 + 带完整旋转的滑动/滚动摩擦模型
// 世界坐标：米，原点在台面中心，x 沿长边（+x 为脚库/置球端），y 沿短边（向上为正）
window.BP = window.BP || {};
(function (BP) {
  'use strict';
  const G = 9.81;

  // ---------------- 球台（全部按官方/标准尺寸） ----------------
  // kind: 'wpa'  美式台（WPA 器材规范：9 尺台，角袋口 4.5"，中袋口 5"，切角 142°/104°）
  //       'cn'   中式八球台（2540×1270mm，球 57.15mm，圆弧袋角，角袋 85mm，中袋 86mm）
  //       'snooker' 斯诺克台（WPBSA：3569×1778mm，球 52.5mm，袋口按 WPBSA 2005/6 模板）
  const IN = 0.0254;
  BP.TABLES = {
    wpa: { name: 'American (WPA)', sub: '9 ft, straight jaws', L: 2.54, W: 1.27, R: 0.028575, cloth: '#1f6fb8', frame: 0.145 },
    cn: { name: 'Chinese 8-ball', sub: '2540x1270 mm, round jaws', L: 2.54, W: 1.27, R: 0.028575, cloth: '#1c6d9e', frame: 0.15 },
    snooker: { name: 'Snooker', sub: 'WPBSA 12 ft', L: 3.569, W: 1.778, R: 0.02625, cloth: '#1d7a3a', frame: 0.16 },
  };
  BP.makeTable = function (kind, o = {}) {
    const t = Object.assign({ kind, type: kind === 'snooker' ? 'snooker' : 'pool' }, BP.TABLES[kind]);
    const { L, W } = t;
    const hl = L / 2, hw = W / 2;
    const cushions = [], pockets = [];
    // 6 条库边：每条的"库面"是一条折线：袋角 → 鼻线 → 袋角
    // 角袋 (sx,sy)：长库一侧的袋角 jl[sx][sy]，短库一侧的袋角 js[sx][sy]；中袋 (sy)：左右袋角 jm[sy][±1]
    const jl = {}, js = {}, jm = {};
    const key = (a, b) => a + ',' + b;

    if (kind === 'wpa') {
      const Mc = 4.5 * IN, Ms = 5.0 * IN; // 袋口宽（两袋角尖之间）
      // 袋角切角：WPA 规范 142°/104°（向里收口）；或平行袋角 135°/90°（可选）
      const par = o.jaw === 'parallel';
      const cutC = ((par ? 135 : 142) * Math.PI) / 180, cutS = ((par ? 90 : 104) * Math.PI) / 180;
      t.jaw = par ? 'parallel' : 'wpa';
      const shelfC = 1.625 * IN, shelfS = 0.1875 * IN; // 袋口平台深度（规范区间 1~2.25" / 0~0.375" 的中值）
      const depth = 2.0 * IN; // 库边胶条宽度
      t.cw = depth;
      const u = Mc / Math.SQRT2;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        // 长库袋角尖 P1，沿 142° 切角向外延伸
        const P1 = [sx * (hl - u), sy * hw];
        const d1 = [sx * -Math.cos(cutC), sy * Math.sin(cutC)];
        const l1 = depth / Math.abs(d1[1]);
        jl[key(sx, sy)] = [P1, [P1[0] + d1[0] * l1, P1[1] + d1[1] * l1]];
        const P2 = [sx * hl, sy * (hw - u)];
        const d2 = [sx * Math.sin(cutC), sy * -Math.cos(cutC)];
        const l2 = depth / Math.abs(d2[0]);
        js[key(sx, sy)] = [P2, [P2[0] + d2[0] * l2, P2[1] + d2[1] * l2]];
        // 落袋孔：袋口中心沿 45° 轴向外 shelf 处开始下落
        const mx = sx * (hl - u / 2), my = sy * (hw - u / 2);
        const throat = Mc - 2 * shelfC * Math.tan(cutC - (3 * Math.PI) / 4);
        const r = throat / 2;
        const k = (shelfC + r) / Math.SQRT2;
        pockets.push({ x: mx + sx * k, y: my + sy * k, r, corner: true, sx, sy, ax: mx, ay: my, mouth: Mc });
      }
      for (const sy of [-1, 1]) {
        jm[sy] = {};
        for (const sg of [-1, 1]) {
          const P = [(sg * Ms) / 2, sy * hw];
          const d = [sg * Math.cos(cutS), sy * Math.sin(cutS)];
          const l = depth / Math.abs(d[1]);
          jm[sy][sg] = [P, [P[0] + d[0] * l, P[1] + d[1] * l]];
        }
        const throat = Ms - 2 * shelfS * Math.tan(cutS - Math.PI / 2);
        const r = throat / 2;
        pockets.push({ x: 0, y: sy * (hw + shelfS + r), r, corner: false, sx: 0, sy, ax: 0, ay: sy * hw, mouth: Ms });
      }
    } else {
      // 圆弧袋角：WPBSA 2005/6 模板（单位英寸）
      //   角袋：库鼻线距石板边 1.875"，袋角圆弧 r=3.0"，切点距石板角 5.43"，落袋弧 r=3.5"（以石板角为圆心）
      //   中袋：袋角圆弧 r=3.125"，切点距中线 4.344"，落袋弧 r=2.094"，圆心在石板边外 0.156"
      let kc = 1, km = 1;
      if (kind === 'cn') {
        // 中式八球台：角袋口 85mm、中袋口 86mm —— 按模板形状等比例缩放到该开口
        const openC = (Math.SQRT2 * (5.43 - 1.875 + 3.0) - 2 * 3.0) * IN; // 模板角袋最窄处 3.27"
        kc = 0.085 / openC;
        km = 0.086 / (3.816 * IN); // 模板中袋袋角与落袋弧交点处宽 3.816"
      }
      const e = 1.875 * IN;
      t.cw = e;
      const arc = (C, Rj, dir0, dir1, n = 18) => {
        // 从 C + Rj*dir0 转到 C + Rj*dir1（小角度方向）
        const a0 = Math.atan2(dir0[1], dir0[0]);
        let a1 = Math.atan2(dir1[1], dir1[0]);
        let da = a1 - a0;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        const pts = [];
        for (let i = 0; i <= n; i++) {
          const a = a0 + (da * i) / n;
          pts.push([C[0] + Math.cos(a) * Rj, C[1] + Math.sin(a) * Rj]);
        }
        return pts;
      };
      // 角袋
      {
        const ec = e * kc, Rj = 3.0 * IN * kc, D = 5.43 * IN * kc, rf = 3.5 * IN * kc;
        const phi = Math.acos(1 - ec / Rj); // 圆弧转到胶条外沿深度处为止
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
          const T1x = sx * (hl + ec - D);
          const C1 = [T1x, sy * (hw + Rj)];
          jl[key(sx, sy)] = arc(C1, Rj, [0, -sy], [sx * Math.sin(phi), -sy * Math.cos(phi)]);
          const T2y = sy * (hw + ec - D);
          const C2 = [sx * (hl + Rj), T2y];
          js[key(sx, sy)] = arc(C2, Rj, [-sx, 0], [-sx * Math.cos(phi), sy * Math.sin(phi)]);
          const m = (ec - D + Rj) / 2; // 两袋角圆心连线中点（袋口中心）
          pockets.push({ x: sx * (hl + ec), y: sy * (hw + ec), r: rf, corner: true, sx, sy, ax: sx * (hl + m), ay: sy * (hw + m), mouth: 0.0831 * kc });
        }
      }
      // 中袋
      {
        const em = e * km, Rj = 3.125 * IN * km, xT = 4.344 * IN * km, rf = 2.094 * IN * km, off = 0.156 * IN * km;
        const phi = Math.acos(1 - em / Rj);
        for (const sy of [-1, 1]) {
          jm[sy] = {};
          for (const sg of [-1, 1]) {
            const C = [sg * xT, sy * (hw + Rj)];
            jm[sy][sg] = arc(C, Rj, [0, -sy], [-sg * Math.sin(phi), -sy * Math.cos(phi)]);
          }
          pockets.push({ x: 0, y: sy * (hw + em + off), r: rf, corner: false, sx: 0, sy, ax: 0, ay: sy * hw, mouth: 3.816 * IN * km });
        }
      }
    }

    // 组装库边：库面折线（从一个袋角的外端 → 鼻线 → 另一个袋角的外端）
    const rev = (a) => a.slice().reverse();
    for (const sy of [-1, 1]) {
      for (const sx of [-1, 1]) {
        // 长库：角袋 (sx,sy) 到中袋 (sy) 之间
        const corner = jl[key(sx, sy)], mid = jm[sy][sx];
        cushions.push({ face: rev(corner).concat(mid), out: [0, sy] });
      }
    }
    for (const sx of [-1, 1]) cushions.push({ face: rev(js[key(sx, -1)]).concat(js[key(sx, 1)]), out: [sx, 0] });
    t.cushions = cushions;
    const segs = [];
    for (const c of cushions) {
      for (let i = 0; i + 1 < c.face.length; i++) {
        const [a, b] = [c.face[i], c.face[i + 1]];
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-6) {
          const off = (p) => (c.out[0] ? Math.abs(p[0]) - hl : Math.abs(p[1]) - hw);
          segs.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], jaw: off(a) > 1e-5 || off(b) > 1e-5 });
        }
      }
    }
    t.segs = segs;
    // 袋口平台（两袋角之间铺台呢的区域）
    t.mouths = pockets.map((p) => (p.corner ? jl[key(p.sx, p.sy)].concat(rev(js[key(p.sx, p.sy)])) : jm[p.sy][-1].concat(rev(jm[p.sy][1]))));
    t.pockets = pockets;
    // 可见袋洞：所有袋口同样大小的圆洞，前沿与"开始下落"的边缘对齐（袋角弧线弯进洞里）
    const hr = 0.86 * 2 * t.R;
    for (const p of pockets) {
      const ax = p.corner ? p.sx * Math.SQRT1_2 : 0, ay = p.corner ? p.sy * Math.SQRT1_2 : p.sy;
      const ex = p.x - ax * p.r, ey = p.y - ay * p.r; // 下落边缘在袋口轴线上的点
      p.hr = hr;
      p.hx = ex + ax * hr;
      p.hy = ey + ay * hr;
    }
    // 袋口喉道：两袋角沿末端切线继续向外延伸（木框在这里是挖空的）
    const ext = (arr, pk) => {
      const e = arr[arr.length - 1], p = arr[arr.length - 2];
      const d = Math.hypot(e[0] - p[0], e[1] - p[1]) || 1;
      const L = Math.hypot(pk.x - e[0], pk.y - e[1]); // 延伸到落袋孔中心为止
      return [e, [e[0] + ((e[0] - p[0]) / d) * L, e[1] + ((e[1] - p[1]) / d) * L]];
    };
    t.throats = pockets.map((p) => {
      const [a, b] = p.corner ? [jl[key(p.sx, p.sy)], js[key(p.sx, p.sy)]] : [jm[p.sy][-1], jm[p.sy][1]];
      const ea = ext(a, p), eb = ext(b, p);
      return [ea[0], ea[1], eb[1], eb[0]];
    });

    if (kind === 'snooker') {
      // WPBSA 规则 Section 1：开球线距底库 737mm，D 半径 292mm，黑球点距顶库 324mm，
      // 粉球点在蓝球点与顶库中间，蓝球点在台面正中
      t.baulkX = -hl + 0.737;
      t.dR = 0.292;
      t.spots = {
        yellow: [t.baulkX, -t.dR], green: [t.baulkX, t.dR], brown: [t.baulkX, 0],
        blue: [0, 0], pink: [hl / 2, 0], black: [hl - 0.324, 0],
      };
    } else if (kind === 'cn') {
      // 中式八球规则：开球线距底库 450mm；置球点距顶库 635mm
      t.headX = -hl + 0.45;
      t.footSpot = hl - 0.635;
    } else {
      // WPA：开球线（head string）与置球点都在四分之一台长处
      t.headX = -hl / 2;
      t.footSpot = hl / 2;
    }
    return t;
  };

  // ---------------- 模拟 ----------------
  const P = {
    mu_s: 0.2, // 滑动摩擦
    mu_r: 0.011, // 滚动阻力
    sp_dec: 14, // 竖轴旋转(侧旋)衰减 rad/s²
    e_ball: 0.94,
    e_cush: 0.78,
    mu_cush: 0.26,
    mu_ball: 0.055, // 球-球摩擦（产生"投掷"）
  };
  BP.PHYS = P;

  function qmul(a, b) {
    return [
      a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
      a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
      a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
      a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
    ];
  }
  BP.qmul = qmul;
  BP.qrand = () => {
    const u = Math.random(), v = Math.random() * 2 * Math.PI, w = Math.random() * 2 * Math.PI;
    return [Math.sqrt(1 - u) * Math.sin(v), Math.sqrt(1 - u) * Math.cos(v), Math.sqrt(u) * Math.sin(w), Math.sqrt(u) * Math.cos(w)];
  };

  class Sim {
    constructor(table) {
      this.t = table;
      this.R = table.R;
      this.balls = [];
      this.time = 0;
    }
    add(id, x, y, extra = {}) {
      const b = Object.assign({
        id, x, y, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0, z: 0, vz: 0, on: true, pocket: -1, potT: 0, q: BP.qrand(),
      }, extra);
      this.balls.push(b);
      return b;
    }
    get(id) {
      return this.balls.find((b) => b.id === id);
    }
    moving() {
      for (const b of this.balls) {
        if (!b.on) continue;
        if (b.vx !== 0 || b.vy !== 0 || b.z > 0 || Math.abs(b.wx) + Math.abs(b.wy) > 1e-3) return true;
      }
      return false;
    }
    clone() {
      const s = new Sim(this.t);
      s.balls = this.balls.map((b) => Object.assign({}, b, { q: b.q.slice() }));
      s.lite = true;
      return s;
    }

    // 出杆：dir 方向角，V 速度(m/s)，a 左右塞(-1..1，右为正)，b 高低杆(-1..1，高为正)，elev 抬杆角(弧度)
    strike(ball, ang, V, a, b, elev) {
      const R = this.R;
      // 侧旋引起的母球偏移（squirt）
      const squirt = -a * 0.025 * Math.cos(elev);
      const dir = ang + squirt;
      const dx = Math.cos(dir), dy = Math.sin(dir);
      const ce = Math.cos(elev), se = Math.sin(elev);
      const off = 0.5; // 最大击点偏移 = 0.5R
      const vh = V * ce;
      ball.vx = dx * vh;
      ball.vy = dy * vh;
      const wt = (2.5 * V * off * b) / R; // 高/低杆
      const ws = (2.5 * V * off * a) / R; // 塞
      const wd = ws * se * 1.25; // 扎杆(masse)分量：沿行进方向的水平转轴
      ball.wx = -wt * dy + wd * dx;
      ball.wy = wt * dx + wd * dy;
      ball.wz = -ws * ce;
      // 跳球：大角度抬杆且不加高杆时，球被压向台面后弹起
      if (elev > 0.4 && b < 0.3) {
        ball.vz = V * se * 0.4;
        ball.z = 0.0001;
      }
    }

    step(dt, ev) {
      const R = this.R, t = this.t, balls = this.balls;
      const hl = t.L / 2, hw = t.W / 2;
      this.time += dt;
      for (const b of balls) {
        if (!b.on) continue;
        const air = b.z > 0;
        if (air) {
          b.vz -= G * dt;
          b.z += b.vz * dt;
          if (b.z <= 0) {
            b.z = 0;
            if (b.vz < -0.4) {
              b.vz = -b.vz * 0.45;
              b.z = 0.00001;
              if (ev && ev.land) ev.land(b, -b.vz);
            } else b.vz = 0;
          }
        } else {
          const ux = b.vx - R * b.wy, uy = b.vy + R * b.wx;
          const u = Math.hypot(ux, uy);
          if (u > 1e-4) {
            // 滑动
            const acc = P.mu_s * G;
            let f = 1;
            if (3.5 * acc * dt > u) f = u / (3.5 * acc * dt);
            const ax = (-acc * ux) / u, ay = (-acc * uy) / u;
            b.vx += ax * dt * f;
            b.vy += ay * dt * f;
            b.wx += (2.5 / R) * ay * dt * f;
            b.wy += -(2.5 / R) * ax * dt * f;
          } else {
            // 纯滚动
            const s = Math.hypot(b.vx, b.vy);
            const d = P.mu_r * G * dt;
            if (s <= d) {
              b.vx = b.vy = 0;
            } else {
              b.vx *= (s - d) / s;
              b.vy *= (s - d) / s;
            }
            b.wx = -b.vy / R;
            b.wy = b.vx / R;
          }
          if (b.wz !== 0) {
            const d = P.sp_dec * dt;
            b.wz = Math.abs(b.wz) <= d ? 0 : b.wz - Math.sign(b.wz) * d;
          }
          if (b.vx === 0 && b.vy === 0 && Math.abs(b.wx) + Math.abs(b.wy) < 1e-3) {
            b.wx = b.wy = 0;
          }
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        // 姿态（仅用于渲染）
        if (!this.lite) {
          const wm = Math.hypot(b.wx, b.wy, b.wz);
          if (wm > 1e-3) {
            const h = (wm * dt) / 2, s = Math.sin(h) / wm;
            b.q = qmul([Math.cos(h), b.wx * s, b.wy * s, b.wz * s], b.q);
          }
        }
      }

      // 球与球
      const n = balls.length, D = 2 * R;
      // 紧贴的球堆（开球）需要多次迭代，冲量才能一次传到底
      for (let pass = 0; pass < 6; pass++) {
      let any = false;
      for (let i = 0; i < n; i++) {
        const a = balls[i];
        if (!a.on) continue;
        for (let j = i + 1; j < n; j++) {
          const c = balls[j];
          if (!c.on) continue;
          const dx = c.x - a.x, dy = c.y - a.y;
          if (dx > D || dx < -D || dy > D || dy < -D) continue;
          const dz = c.z - a.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= D * D || d2 === 0) continue;
          const d = Math.sqrt(d2);
          const nx = dx / d, ny = dy / d, nz = dz / d;
          const vrel = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny + (a.vz - c.vz) * nz;
          if (vrel > 1e-6) {
            any = true;
            const J = ((1 + P.e_ball) / 2) * vrel;
            a.vx -= J * nx;
            a.vy -= J * ny;
            c.vx += J * nx;
            c.vy += J * ny;
            if (nz !== 0) {
              a.vz = Math.max(-1, Math.min(0.7, a.vz - J * nz * 0.5));
              c.vz = Math.max(-1, Math.min(0.7, c.vz + J * nz * 0.5));
              if (a.z <= 0 && a.vz < 0) a.vz = 0;
              if (c.z <= 0 && c.vz < 0) c.vz = 0;
              if (a.vz > 0 && a.z <= 0) a.z = 0.00001;
              if (c.vz > 0 && c.z <= 0) c.z = 0.00001;
            }
            // 切向摩擦：切球投掷 + 侧旋投掷
            const tx = -ny, ty = nx;
            const vt = (a.vx - c.vx) * tx + (a.vy - c.vy) * ty + R * (a.wz + c.wz);
            if (Math.abs(vt) > 1e-5) {
              const jt = Math.min(P.mu_ball * J, Math.abs(vt) / 7) * Math.sign(vt);
              a.vx -= jt * tx;
              a.vy -= jt * ty;
              c.vx += jt * tx;
              c.vy += jt * ty;
              a.wz -= (2.5 / R) * jt;
              c.wz -= (2.5 / R) * jt;
            }
            if (ev && ev.hit) ev.hit(a, c, vrel);
          }
          // 分离
          const ov = (D - d) / 2 + 1e-7;
          a.x -= nx * ov;
          a.y -= ny * ov;
          c.x += nx * ov;
          c.y += ny * ov;
        }
      }
      if (!any) break;
      }

      // 库边
      for (const b of balls) {
        if (!b.on) continue;
        if (Math.abs(b.x) < hl - R - 0.08 && Math.abs(b.y) < hw - R - 0.08) continue;
        for (const s of t.segs) {
          const ex = s.bx - s.ax, ey = s.by - s.ay;
          const l2 = ex * ex + ey * ey;
          let k = ((b.x - s.ax) * ex + (b.y - s.ay) * ey) / l2;
          k = k < 0 ? 0 : k > 1 ? 1 : k;
          const px = s.ax + ex * k, py = s.ay + ey * k;
          const dx = b.x - px, dy = b.y - py;
          const d2 = dx * dx + dy * dy;
          if (d2 >= R * R || d2 === 0) continue;
          // 跳得够高就飞出台面
          if (b.z > 0.045) continue;
          const d = Math.sqrt(d2);
          const nx = dx / d, ny = dy / d;
          const vn = b.vx * nx + b.vy * ny;
          if (vn < 0) {
            const tx = -ny, ty = nx;
            let vt = b.vx * tx + b.vy * ty;
            const e = P.e_cush - Math.min(0.1, -vn * 0.02);
            const vn2 = -vn * e;
            // 侧旋与库边摩擦
            const sv = vt - b.wz * R;
            const j = Math.min(P.mu_cush * (1 + e) * -vn, Math.abs(sv) / 3.5) * Math.sign(sv);
            vt -= j;
            b.wz += (2.5 * j) / R;
            b.vx = nx * vn2 + tx * vt;
            b.vy = ny * vn2 + ty * vt;
            // 库边鼻线高于球心（约 0.27R），法向冲量会给反弹方向加上"上旋"；
            // 原有的高/低杆旋转方向保持不变（高杆撞库后路线向前弯，低杆向后弯）
            const wn = b.wx * -ny + b.wy * nx; // 沿 +n 方向滚动的分量
            const wt2 = b.wx * nx + b.wy * ny;
            const wn2 = wn + (0.4 * (1 + e) * -vn) / R;
            b.wx = -ny * wn2 + nx * wt2 * 0.95;
            b.wy = nx * wn2 + ny * wt2 * 0.95;
            if (ev && ev.cush) ev.cush(b, -vn, s);
          }
          b.x = px + nx * (R + 1e-7);
          b.y = py + ny * (R + 1e-7);
        }
      }

      // 落袋 / 出界
      for (const b of balls) {
        if (!b.on) continue;
        for (let i = 0; i < t.pockets.length; i++) {
          const p = t.pockets[i];
          const dx = b.x - p.x, dy = b.y - p.y;
          if (dx * dx + dy * dy < p.r * p.r && b.z < 0.03) {
            this.pot(b, i, ev);
            break;
          }
        }
        if (b.on && (Math.abs(b.x) > hl + 0.03 || Math.abs(b.y) > hw + 0.03)) {
          if (b.z > 0.03) {
            b.on = false;
            b.off = true;
            b.vx = b.vy = b.vz = 0;
            if (ev && ev.off) ev.off(b);
          } else {
            // 从袋角缝隙钻出：算作进最近的袋
            let bi = 0, bd = 1e9;
            t.pockets.forEach((p, i) => {
              const d = Math.hypot(b.x - p.x, b.y - p.y);
              if (d < bd) {
                bd = d;
                bi = i;
              }
            });
            this.pot(b, bi, ev);
          }
        }
      }
    }

    pot(b, i, ev) {
      b.on = false;
      b.pocket = i;
      b.potT = this.time;
      b.potV = Math.hypot(b.vx, b.vy);
      b.potFrom = [b.x, b.y];
      b.vx = b.vy = b.vz = b.z = 0;
      b.wx = b.wy = b.wz = 0;
      if (ev && ev.pot) ev.pot(b, i);
    }

    // 运行直到静止（用于预览与 AI）
    run(maxT, ev, dt = 1 / 800) {
      let t = 0;
      while (t < maxT) {
        this.step(dt, ev);
        t += dt;
        if (!this.moving()) break;
      }
      return t;
    }

    stopAll() {
      for (const b of this.balls) {
        b.vx = b.vy = b.vz = b.wx = b.wy = b.wz = 0;
        b.z = 0;
      }
    }

    // 位置是否可放球
    free(x, y, ignore) {
      const D = 2 * this.R + 0.0005;
      for (const b of this.balls) {
        if (!b.on || b === ignore) continue;
        if ((b.x - x) ** 2 + (b.y - y) ** 2 < D * D) return false;
      }
      const hl = this.t.L / 2 - this.R, hw = this.t.W / 2 - this.R;
      return Math.abs(x) <= hl && Math.abs(y) <= hw;
    }
  }
  BP.Sim = Sim;
})(window.BP);
