// 电脑对手：几何选球 + 物理模拟验证（难度越高模拟越多、误差越小）
(function (BP) {
  'use strict';
  const LV = {
    easy: { noise: 1.3, sims: 0, powers: [1.25], spins: [[0, 0]] },
    normal: { noise: 0.45, sims: 6, powers: [1.0, 1.4], spins: [[0, 0], [0, 0.45]] },
    hard: { noise: 0.12, sims: 10, powers: [0.95, 1.3, 1.8], spins: [[0, 0], [0, 0.55], [0, -0.55], [0.5, 0], [-0.5, 0]] },
  };
  BP.VMAX = 8.6;
  BP.powerToV = (p) => 0.2 + (BP.VMAX - 0.2) * Math.pow(p, 1.5);
  BP.vToPower = (v) => Math.pow(Math.max(0, Math.min(1, (v - 0.2) / (BP.VMAX - 0.2))), 1 / 1.5);

  function segClear(sim, ax, ay, bx, by, ignore, rad) {
    const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
    for (const b of sim.balls) {
      if (!b.on || ignore.has(b.id)) continue;
      let k = l2 ? ((b.x - ax) * ex + (b.y - ay) * ey) / l2 : 0;
      k = Math.max(0, Math.min(1, k));
      if ((ax + ex * k - b.x) ** 2 + (ay + ey * k - b.y) ** 2 < rad * rad) return false;
    }
    return true;
  }
  BP.segClear = segClear;

  // 几何可行的进球线路
  function candidates(rules, sim, cx, cy) {
    const R = sim.R, t = sim.t, out = [];
    const hl = t.L / 2 - R, hw = t.W / 2 - R;
    for (const id of rules.legalTargets(sim)) {
      const b = sim.get(id);
      if (!b || !b.on) continue;
      t.pockets.forEach((p, pi) => {
        let dx = p.ax - b.x, dy = p.ay - b.y;
        const d2 = Math.hypot(dx, dy);
        if (d2 < 1e-4) return;
        dx /= d2;
        dy /= d2;
        if (!p.corner && Math.abs(dy) < 0.55) return; // 中袋角度太斜
        const gx = b.x - dx * 2 * R, gy = b.y - dy * 2 * R;
        if (Math.abs(gx) > hl || Math.abs(gy) > hw) return;
        let vx = gx - cx, vy = gy - cy;
        const d1 = Math.hypot(vx, vy);
        if (d1 < 1e-4) return;
        vx /= d1;
        vy /= d1;
        const cos = vx * dx + vy * dy;
        if (cos < 0.22) return;
        const ign = new Set([0, id]);
        if (!segClear(sim, cx, cy, gx, gy, ign, 2 * R - 0.0005)) return;
        if (!segClear(sim, b.x, b.y, p.ax, p.ay, new Set([0, id]), 2 * R - 0.001)) return;
        const score = d1 + 1.6 * d2 + 1.4 * (1 / cos - 1) + (p.corner ? 0 : 0.25);
        const vObj = Math.sqrt(2 * 0.2 * d2) + 0.45;
        const V = Math.min(6.5, Math.sqrt((vObj / cos) ** 2 + 2 * 0.35 * d1) * 1.12);
        out.push({ id, pocket: pi, ang: Math.atan2(vy, vx), score, V, cut: Math.acos(Math.min(1, cos)) });
      });
    }
    return out.sort((a, b) => a.score - b.score);
  }
  BP.candidates = candidates;

  // 在副本里试打，判断结果
  function trial(rules, sim, c, V, spin) {
    const s = sim.clone();
    const cue = s.get(0);
    s.strike(cue, c.ang, V, spin[0], spin[1], 0);
    let first = null;
    const pots = [];
    s.run(9, {
      hit: (a, b) => {
        if (first == null) {
          if (a.id === 0) first = b.id;
          else if (b.id === 0) first = a.id;
        }
      },
      pot: (b, i) => pots.push({ id: b.id, pocket: i }),
    }, 1 / 700);
    const legal = rules.legalTargets(sim);
    let v = 0;
    const cuePot = pots.some((p) => p.id === 0) || !cue.on;
    if (cuePot) v -= 50;
    if (first == null || !legal.includes(first)) v -= 40;
    const hitTarget = pots.some((p) => p.id === c.id);
    if (hitTarget) v += 20;
    // 规则相关的特殊球
    if (rules.id === 'eight') {
      if (pots.some((p) => p.id === 8) && !(rules.onEight(sim) && c.id === 8)) v -= 200;
      if (rules.groups[rules.cur]) {
        const g = rules.groups[rules.cur];
        v += pots.filter((p) => p.id !== 0 && p.id !== 8 && rules.groupOf(p.id) === g && p.id !== c.id).length * 5;
        v -= pots.filter((p) => p.id !== 0 && p.id !== 8 && rules.groupOf(p.id) !== g).length * 3;
      }
    } else if (rules.id === 'nine') {
      if (pots.some((p) => p.id === 9) && !cuePot && first != null && legal.includes(first)) v += 100;
      v += pots.filter((p) => p.id !== 0).length * 3;
    } else {
      const bad = pots.filter((p) => p.id !== 0 && !legal.includes(p.id));
      if (rules.phase === 'color' && pots.filter((p) => p.id !== 0).length > 1) v -= 40;
      v -= bad.length * 40;
      if (hitTarget) v += (BP.SN[s.get(c.id).kind] || { v: 1 }).v;
    }
    // 走位：母球停下后是否还有好球
    if (hitTarget && !cuePot && cue.on) {
      const next = candidates(rules, s, cue.x, cue.y).filter((n) => n.id !== c.id);
      if (next.length) v += Math.max(0, 4 - next[0].score * 2);
      else v -= 2;
    }
    return { v, hitTarget, cuePot };
  }

  // 解斯诺克：沿各个方向试打，找第一个碰到合法目标球、母球不落袋、吃库最少的路线
  function escapePlan(rules, sim, done) {
    const legal = new Set(rules.legalTargets(sim));
    const N = 360, speeds = [2.4, 3.6];
    let i = 0, best = null;
    const tick = () => {
      const t0 = performance.now();
      while (i < N * speeds.length && performance.now() - t0 < 14) {
        const ang = ((i % N) / N) * Math.PI * 2, V = speeds[(i / N) | 0];
        i++;
        const s = sim.clone();
        const c = s.get(0);
        s.strike(c, ang, V, 0, 0, 0);
        let first = null, cush = 0;
        const ev = {
          hit: (a, b) => {
            if (first == null) first = a.id === 0 ? b.id : b.id === 0 ? a.id : null;
          },
          cush: (b) => {
            if (b.id === 0 && first == null) cush++;
          },
        };
        for (let t = 0; t < 5 && first == null && c.on && s.moving(); t += 1 / 500) s.step(1 / 500, ev);
        if (first != null && legal.has(first) && c.on) {
          const score = cush * 10 + V;
          if (!best || score < best.score) best = { ang, V, score };
        }
      }
      if (i < N * speeds.length) setTimeout(tick, 0);
      else done(best ? { ang: best.ang, V: best.V } : null);
    };
    setTimeout(tick, 0);
  }
  BP.escapePlan = escapePlan;

  // 生成一杆
  BP.aiPlan = function (rules, sim, level, done) {
    const L = LV[level] || LV.normal;
    const cue = sim.get(0);
    const R = sim.R, t = sim.t;
    const noise = () => ((Math.random() + Math.random() + Math.random() - 1.5) * L.noise * Math.PI) / 180;
    const result = { a: 0, b: 0, elev: 0 };

    // 开球
    if (rules.breakShot) {
      const tg = sim.balls.filter((b) => b.on && b.id !== 0).sort((a, b) => a.x - b.x)[0];
      result.ang = Math.atan2(tg.y - cue.y, tg.x - cue.x) + noise() * 0.5;
      result.V = BP.VMAX * 0.97;
      result.b = -0.1;
      return setTimeout(() => done(result), 50);
    }
    if (rules.id === 'snooker' && sim.balls.filter((b) => b.on && b.kind === 'red').length === (rules.opts.reds || 15) && rules.phase === 'red' && rules.player.score + rules.other.score === 0 && !rules.didBreak) {
      rules.didBreak = true;
      const reds = sim.balls.filter((b) => b.on && b.kind === 'red').sort((a, b) => b.x - a.x || b.y - a.y);
      const back = reds[0];
      const gx = back.x - 2 * R * 0.3, gy = back.y + 2 * R * 0.95;
      result.ang = Math.atan2(gy - cue.y, gx - cue.x);
      result.V = 3.6;
      result.a = 0.5;
      return setTimeout(() => done(result), 50);
    }

    // 自由球：挑一个好位置
    if (rules.bih) {
      let best = null;
      for (let k = 0; k < 260; k++) {
        let x, y;
        if (rules.bih === 'D') {
          const a = Math.PI / 2 + Math.random() * Math.PI, r = Math.sqrt(Math.random()) * t.dR * 0.95;
          x = t.baulkX + Math.cos(a) * r;
          y = Math.sin(a) * r;
        } else if (rules.bih === 'kitchen') {
          x = -t.L / 2 + R + 0.02 + Math.random() * (t.headX - (-t.L / 2 + R + 0.02));
          y = (Math.random() - 0.5) * (t.W - 4 * R);
        } else {
          x = (Math.random() - 0.5) * (t.L - 4 * R);
          y = (Math.random() - 0.5) * (t.W - 4 * R);
        }
        if (!rules.canPlace(x, y, sim)) continue;
        const c = candidates(rules, sim, x, y)[0];
        const sc = c ? c.score : 99;
        if (!best || sc < best.sc) best = { x, y, sc };
      }
      if (best) {
        cue.x = best.x;
        cue.y = best.y;
        result.place = [best.x, best.y];
      }
    }

    // 斯诺克被判 Miss 后复位重打：不冒险，选一颗能直接全球击中的目标球稳稳碰到
    if (rules.id === 'snooker' && rules.fromReplace) {
      const on = rules.legalTargets(sim).map((id) => sim.get(id)).filter((b) => b && b.on);
      on.sort((a, b) => Math.hypot(a.x - cue.x, a.y - cue.y) - Math.hypot(b.x - cue.x, b.y - cue.y));
      const tg = on.find((b) => segClear(sim, cue.x, cue.y, b.x, b.y, new Set([0, b.id]), 2 * R - 0.001));
      if (tg) {
        result.ang = Math.atan2(tg.y - cue.y, tg.x - cue.x);
        result.V = 2.0;
        result.safety = true;
        return setTimeout(() => done(result), 50);
      }
    }
    const cands = candidates(rules, sim, cue.x, cue.y);
    if (!cands.length) {
      // 防守：直接打一颗合法球
      const legal = rules.legalTargets(sim).map((id) => sim.get(id));
      legal.sort((a, b) => Math.hypot(a.x - cue.x, a.y - cue.y) - Math.hypot(b.x - cue.x, b.y - cue.y));
      let tg = legal.find((b) => segClear(sim, cue.x, cue.y, b.x, b.y, new Set([0, b.id]), 2 * R - 0.001));
      if (!tg && legal.length) {
        // 被挡住：模拟搜索一库/多库解球路线
        return escapePlan(rules, sim, (p) => {
          if (p) Object.assign(result, p, { safety: true });
          else {
            result.ang = Math.atan2(legal[0].y - cue.y, legal[0].x - cue.x);
            result.V = 2.2;
          }
          done(result);
        });
      }
      if (!tg) tg = sim.balls.find((b) => b.on && b.id !== 0);
      result.ang = Math.atan2(tg.y - cue.y, tg.x - cue.x) + noise();
      result.V = 2.2;
      result.safety = true;
      return setTimeout(() => done(result), 50);
    }
    const pickC = (c, V, spin) => {
      result.ang = c.ang + noise();
      result.V = V;
      result.a = spin[0];
      result.b = spin[1];
      result.pocket = c.pocket;
      done(result);
    };
    if (!L.sims) return setTimeout(() => pickC(cands[0], cands[0].V * L.powers[0], L.spins[0]), 50);

    // 分批模拟，避免卡住界面
    const jobs = [];
    for (const c of cands.slice(0, L.sims)) for (const pw of L.powers) for (const sp of L.spins) jobs.push({ c, V: Math.min(BP.VMAX, c.V * pw), sp });
    let best = null, i = 0;
    const tick = () => {
      const t0 = performance.now();
      while (i < jobs.length && performance.now() - t0 < 12) {
        const j = jobs[i++];
        const r = trial(rules, sim, j.c, j.V, j.sp);
        const v = r.v - j.c.score * 1.5;
        if (!best || v > best.v) best = { v, j };
      }
      if (i < jobs.length) setTimeout(tick, 0);
      else pickC(best.j.c, best.j.V, best.j.sp);
    };
    setTimeout(tick, 0);
  };
})(window.BP);
