// 规则：中式/美式八球、九球、斯诺克
(function (BP) {
  'use strict';
  const _t = (k, v) => BP.t(k, v);
  const POOL_COLORS = ['#f4f1e8', '#f5c400', '#1f45c8', '#d42020', '#5b2c90', '#f07000', '#0a7d3e', '#7e1c1c', '#141414'];
  BP.ballColor = (id) => POOL_COLORS[id > 8 ? id - 8 : id];
  const SN = {
    red: { v: 1, c: '#c8161c', get n() { return _t('ball.red'); } },
    yellow: { v: 2, c: '#f2c400', get n() { return _t('ball.yellow'); } },
    green: { v: 3, c: '#0b7c38', get n() { return _t('ball.green'); } },
    brown: { v: 4, c: '#6d3b1b', get n() { return _t('ball.brown'); } },
    blue: { v: 5, c: '#1545c4', get n() { return _t('ball.blue'); } },
    pink: { v: 6, c: '#f28aad', get n() { return _t('ball.pink'); } },
    black: { v: 7, c: '#121212', get n() { return _t('ball.black'); } },
  };
  BP.SN = SN;
  const COLOR_ORDER = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'];

  // 三角/菱形摆球
  function rackPositions(apexX, R, rows, gap = 0.0004) {
    const dx = (2 * R + gap) * Math.sqrt(3) / 2, dy = 2 * R + gap;
    const pos = [];
    rows.forEach((n, r) => {
      for (let i = 0; i < n; i++) pos.push([apexX + r * dx, (i - (n - 1) / 2) * dy, r, i]);
    });
    return pos;
  }
  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  class Base {
    constructor(opts) {
      this.opts = opts;
      this.players = opts.players.map((p) => Object.assign(p, { score: 0, fouls: 0 }));
      this.cur = 0;
      this.over = null;
    }
    get player() {
      return this.players[this.cur];
    }
    get other() {
      return this.players[1 - this.cur];
    }
    switchTurn() {
      this.cur = 1 - this.cur;
    }
    // 自由球区域检查
    canPlace(x, y, sim) {
      if (!sim.free(x, y, sim.get(0))) return false;
      const t = sim.t;
      if (this.bih === 'kitchen') return x <= t.headX;
      if (this.bih === 'D') return x <= t.baulkX && Math.hypot(x - t.baulkX, y) <= t.dR;
      return true;
    }
    defaultCuePos(sim) {
      const t = sim.t;
      if (this.bih === 'D') return [t.baulkX - t.dR * 0.5, t.dR * 0.35];
      return [t.headX - 0.12, 0];
    }
    placeCue(sim, pos) {
      const cue = sim.get(0);
      cue.on = true;
      cue.pocket = -1;
      cue.off = false;
      let [x, y] = pos || this.defaultCuePos(sim);
      if (!this.canPlace(x, y, sim)) {
        // 找一个可放的位置
        const t = sim.t;
        for (let k = 0; k < 400; k++) {
          const nx = this.bih === 'D' ? t.baulkX - Math.random() * t.dR : this.bih === 'kitchen' ? -t.L / 2 + 0.05 + Math.random() * (t.headX + t.L / 2 - 0.05) : (Math.random() - 0.5) * (t.L - 0.1);
          const ny = (Math.random() - 0.5) * (this.bih === 'D' ? 2 * t.dR : t.W - 0.1);
          if (this.canPlace(nx, ny, sim)) {
            x = nx;
            y = ny;
            break;
          }
        }
      }
      cue.x = x;
      cue.y = y;
      cue.vx = cue.vy = cue.wx = cue.wy = cue.wz = cue.z = cue.vz = 0;
    }
    // 把球放回置球点（被占则沿中线往后找）
    respot(sim, b, x, y) {
      b.on = true;
      b.pocket = -1;
      b.off = false;
      b.vx = b.vy = b.wx = b.wy = b.wz = b.z = b.vz = 0;
      let nx = x;
      while (!sim.free(nx, y, b) && nx < sim.t.L / 2 - sim.R) nx += 0.004;
      while (!sim.free(nx, y, b) && nx > -sim.t.L / 2 + sim.R) nx -= 0.004;
      b.x = nx;
      b.y = y;
    }
  }

  // ======================= 八球 =======================
  class Eight extends Base {
    constructor(opts) {
      super(opts);
      this.id = 'eight';
      this.groups = [null, null]; // 'solid' | 'stripe'
    }
    setup(sim) {
      const t = sim.t, R = sim.R;
      const apex = t.footSpot * (1 - this.opts.rackPos);
      const pos = rackPositions(apex, R, [1, 2, 3, 4, 5]);
      const ids = shuffle([1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15]);
      // 8 号在第三排中间；后排两角一全一花
      const order = new Array(15);
      order[4] = 8;
      const s = ids.filter((i) => i < 8), st = ids.filter((i) => i > 8);
      order[10] = s.pop();
      order[14] = st.pop();
      const rest = shuffle(s.concat(st));
      for (let i = 0; i < 15; i++) if (order[i] == null) order[i] = rest.pop();
      this.footApex = apex;
      sim.add(0, t.headX - 0.15, 0);
      pos.forEach((p, i) => sim.add(order[i], p[0], p[1]));
      this.bih = 'kitchen';
      this.breakShot = true;
      this.placeCue(sim, [t.headX - 0.15, 0]);
    }
    groupOf(id) {
      return id === 8 ? 'eight' : id < 8 ? 'solid' : 'stripe';
    }
    remaining(sim, g) {
      return sim.balls.filter((b) => b.on && b.id !== 0 && this.groupOf(b.id) === g).length;
    }
    onEight(sim, p = this.cur) {
      const g = this.groups[p];
      return g && this.remaining(sim, g) === 0;
    }
    legalTargets(sim) {
      const g = this.groups[this.cur];
      return sim.balls.filter((b) => b.on && b.id !== 0 && (this.breakShot ? true : g ? (this.onEight(sim) ? b.id === 8 : this.groupOf(b.id) === g) : b.id !== 8)).map((b) => b.id);
    }
    needCall(sim) {
      return this.opts.callPocket && !this.breakShot && this.onEight(sim);
    }
    evaluate(shot, sim) {
      const msgs = [];
      const me = this.cur;
      const g = this.groups[me];
      const wasOnEight = g && this.remaining(sim, g) + shot.pots.filter((p) => this.groupOf(p.id) === g).length === 0;
      let foul = null;
      if (shot.cuePot) foul = _t('f.cuePot');
      else if (shot.cueOff) foul = _t('f.cueOff');
      else if (shot.first == null) foul = _t('f.noHit');
      else if (!this.breakShot) {
        if (g) {
          if (wasOnEight ? shot.first !== 8 : this.groupOf(shot.first) !== g) foul = _t('f.wrongFirst');
        } else if (shot.first === 8) foul = _t('f.open8');
      }
      if (!foul && !this.breakShot && shot.pots.length === 0 && !shot.railAfter) foul = _t('f.noRail');
      if (!foul && this.breakShot && !shot.pots.some((p) => p.id !== 0) && shot.railBalls < 4) foul = _t('f.badBreak');
      if (!foul && shot.off.length) foul = _t('f.ballOff');
      // 出台的目标球放回
      for (const id of shot.off) if (id !== 0) this.respot(sim, sim.get(id), this.footApex, 0);

      const potIds = shot.pots.map((p) => p.id).filter((id) => id !== 0);
      const eightIn = potIds.includes(8);
      const brk = this.breakShot;
      this.breakShot = false;

      if (eightIn) {
        if (brk) {
          this.respot(sim, sim.get(8), this.footApex, 0);
          msgs.push(_t('m.break8'));
        } else {
          const p8 = shot.pots.find((p) => p.id === 8);
          const called = this.opts.callPocket ? shot.called : p8.pocket;
          if (foul) return this.end(1 - me, _t('m.lose8foul', { name: this.player.name, foul }));
          if (!wasOnEight) return this.end(1 - me, _t('m.lose8early', { name: this.player.name }));
          if (called !== p8.pocket) return this.end(1 - me, _t('m.lose8pocket'));
          return this.end(me, _t('m.win8', { name: this.player.name }));
        }
      }

      if (!g && !brk && !foul) {
        const first = potIds.find((id) => id !== 8);
        if (first != null) {
          const grp = this.groupOf(first);
          this.groups[me] = grp;
          this.groups[1 - me] = grp === 'solid' ? 'stripe' : 'solid';
          msgs.push(_t('m.group', { name: this.player.name, grp: _t(grp === 'solid' ? 'grp.solid' : 'grp.stripe') }));
        }
      }
      if (foul) {
        msgs.unshift(_t('m.foul', { foul }));
        this.switchTurn();
        this.bih = brk && (shot.cuePot || foul === _t('f.badBreak')) ? 'kitchen' : 'anywhere';
        msgs.push(_t('m.bih', { name: this.player.name }));
        return { foul, msgs, bih: this.bih };
      }
      const myG = this.groups[me];
      const good = potIds.some((id) => id !== 8 && (!myG || this.groupOf(id) === myG)) || (brk && potIds.length > 0);
      this.bih = null;
      if (!good) {
        this.switchTurn();
        msgs.push(_t('m.turn', { name: this.player.name }));
      } else msgs.push(_t('m.cont'));
      return { foul: null, msgs, bih: null, cont: good };
    }
    end(winner, reason) {
      this.over = { winner, reason };
      return { over: this.over, msgs: [reason] };
    }
    hud(sim) {
      return this.players.map((p, i) => {
        const g = this.groups[i];
        const balls = g ? sim.balls.filter((b) => b.id !== 0 && this.groupOf(b.id) === g).map((b) => ({ id: b.id, on: b.on })) : [];
        return { name: p.name, tag: g ? _t(g === 'solid' ? 'tag.solid' : 'tag.stripe') : _t('tag.open'), balls, eight: g && this.onEight(sim, i) };
      });
    }
  }

  // ======================= 九球 =======================
  class Nine extends Base {
    constructor(opts) {
      super(opts);
      this.id = 'nine';
    }
    setup(sim) {
      const t = sim.t, R = sim.R;
      const apex = t.footSpot * (1 - this.opts.rackPos);
      const pos = rackPositions(apex, R, [1, 2, 3, 2, 1]);
      const others = shuffle([2, 3, 4, 5, 6, 7, 8]);
      const order = [1];
      for (let i = 1; i < 9; i++) order.push(i === 4 ? 9 : others.pop());
      this.footApex = apex;
      sim.add(0, t.headX - 0.15, 0);
      pos.forEach((p, i) => sim.add(order[i], p[0], p[1]));
      this.bih = 'kitchen';
      this.breakShot = true;
      this.placeCue(sim, [t.headX - 0.15, 0]);
    }
    lowest(sim) {
      let m = 99;
      for (const b of sim.balls) if (b.on && b.id > 0 && b.id < m) m = b.id;
      return m;
    }
    legalTargets(sim) {
      return [this.lowest(sim)];
    }
    needCall() {
      return false;
    }
    evaluate(shot, sim) {
      const msgs = [];
      const me = this.cur;
      const low = shot.lowest;
      let foul = null;
      if (shot.cuePot) foul = _t('f.cuePot');
      else if (shot.cueOff) foul = _t('f.cueOff');
      else if (shot.first == null) foul = _t('f.noHit');
      else if (shot.first !== low) foul = _t('f.nineFirst', { n: low });
      else if (!shot.pots.length && !shot.railAfter && !shot.break) foul = _t('f.noRail');
      else if (shot.break && !shot.pots.some((p) => p.id !== 0) && shot.railBalls < 4) foul = _t('f.badBreak');
      if (!foul && shot.off.length) foul = _t('f.ballOff');
      for (const id of shot.off) if (id !== 0) this.respot(sim, sim.get(id), this.footApex, 0);
      const potIds = shot.pots.map((p) => p.id).filter((id) => id !== 0);
      this.breakShot = false;
      if (potIds.includes(9)) {
        if (!foul) return this.end(me, _t('m.win9', { name: this.player.name }));
        this.respot(sim, sim.get(9), this.footApex, 0);
        msgs.push(_t('m.spot9'));
      }
      if (foul) {
        this.player.fouls++;
        if (this.player.fouls >= 3) return this.end(1 - me, _t('m.lose3fouls', { name: this.player.name }));
        msgs.unshift(_t('m.foul', { foul: foul + (this.player.fouls === 2 ? _t('f.nineTwo') : '') }));
        this.switchTurn();
        this.bih = 'anywhere';
        msgs.push(_t('m.bih', { name: this.player.name }));
        return { foul, msgs, bih: 'anywhere' };
      }
      this.player.fouls = 0;
      this.bih = null;
      if (!potIds.length) {
        this.switchTurn();
        msgs.push(_t('m.turn', { name: this.player.name }));
        return { msgs };
      }
      msgs.push(_t('m.cont'));
      return { msgs, cont: true };
    }
    end(winner, reason) {
      this.over = { winner, reason };
      return { over: this.over, msgs: [reason] };
    }
    hud(sim) {
      const balls = sim.balls.filter((b) => b.id > 0).sort((a, b) => a.id - b.id).map((b) => ({ id: b.id, on: b.on }));
      return this.players.map((p, i) => ({ name: p.name, tag: p.fouls ? _t('tag.fouls', { n: p.fouls }) : '', balls: i === 0 ? balls : [], fouls: p.fouls }));
    }
  }

  // ======================= 斯诺克（WPBSA 规则） =======================
  // 几何判定工具
  function segBlocked(sim, ax, ay, bx, by, clear, isBlocker) {
    const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
    for (const b of sim.balls) {
      if (!b.on || !isBlocker(b)) continue;
      let k = l2 ? ((b.x - ax) * ex + (b.y - ay) * ey) / l2 : 0;
      k = Math.max(0, Math.min(1, k));
      if ((ax + ex * k - b.x) ** 2 + (ay + ey * k - b.y) ** 2 < clear * clear) return true;
    }
    return false;
  }
  // 母球能否直线击中目标球的某个"触点偏移"（k=-1..1：-1/1 为左右两个极边，0 为全球）
  function canHit(sim, cx, cy, tb, k, isBlocker) {
    const R = sim.R, dx = tb.x - cx, dy = tb.y - cy, d = Math.hypot(dx, dy) || 1;
    const px = -dy / d, py = dx / d;
    const off = k * (2 * R - 0.0004);
    // 击中时母球中心的位置（鬼球）
    const gx = tb.x + px * off - (dx / d) * Math.sqrt(Math.max(0, 4 * R * R - off * off));
    const gy = tb.y + py * off - (dy / d) * Math.sqrt(Math.max(0, 4 * R * R - off * off));
    return !segBlocked(sim, cx, cy, gx, gy, 2 * R - 0.0002, (b) => b.id !== 0 && b !== tb && isBlocker(b));
  }

  class Snooker extends Base {
    constructor(opts) {
      super(opts);
      this.id = 'snooker';
      this.phase = 'red'; // red | color | seq
      this.seq = 0;
      this.brk = 0;
      this.freeBall = false;
      this.missRun = 0; // 连续"全球可见仍打空"的次数（三次判负）
      this.warned = false;
      this.fromReplace = false;
    }
    setup(sim) {
      const t = sim.t, R = sim.R;
      sim.add(0, t.baulkX - 0.1, 0.1, { kind: 'cue' });
      const reds = this.opts.reds || 15;
      const rows = reds === 6 ? [1, 2, 3] : reds === 10 ? [1, 2, 3, 4] : [1, 2, 3, 4, 5];
      // 红球紧贴成等边三角形，顶端红球尽量靠近粉球点但不占用（WPBSA Section 3 Rule 2）
      const apex = t.spots.pink[0] + 2 * R + 0.0003;
      rackPositions(apex, R, rows, 0.0001).forEach((p, i) => sim.add(i + 1, p[0], p[1], { kind: 'red' }));
      COLOR_ORDER.forEach((k, i) => sim.add(16 + i, t.spots[k][0], t.spots[k][1], { kind: k }));
      this.bih = 'D';
      this.placeCue(sim, [t.baulkX - 0.08, 0.12]);
    }
    kind(sim, id) {
      return sim.get(id).kind;
    }
    redsLeft(sim) {
      return sim.balls.filter((b) => b.on && b.kind === 'red').length;
    }
    onKinds() {
      if (this.phase === 'red') return ['red'];
      if (this.phase === 'color') return COLOR_ORDER;
      return [COLOR_ORDER[this.seq]];
    }
    onDesc() {
      if (this.phase === 'red') return _t('on.red');
      if (this.phase === 'color') return _t('on.color');
      const k = COLOR_ORDER[this.seq];
      return k ? SN[k].n : _t('on.none');
    }
    ballsOn(sim) {
      const ks = this.onKinds();
      return sim.balls.filter((b) => b.on && b.id !== 0 && ks.includes(b.kind));
    }
    legalTargets(sim) {
      if (this.freeBall) return sim.balls.filter((b) => b.on && b.id !== 0).map((b) => b.id);
      return this.ballsOn(sim).map((b) => b.id);
    }
    needCall() {
      return false;
    }
    val(k) {
      return SN[k] ? SN[k].v : 0;
    }
    remaining(sim, phase = this.phase, seq = this.seq) {
      if (phase === 'seq') return COLOR_ORDER.slice(seq).reduce((s, k) => s + this.val(k), 0);
      return this.redsLeft(sim) * 8 + 27 + (phase === 'color' ? 7 : 0);
    }
    needsSnookers(sim, scores, phase, seq) {
      const rem = this.remaining(sim, phase, seq);
      return Math.abs(scores[0] - scores[1]) > rem;
    }

    // 被做斯诺克：对所有目标球，都无法直线同时击中两个极边（Section 2 Rule 17）
    snookeredAt(sim, cx, cy, onBalls, isBlocker) {
      for (const b of onBalls) if (canHit(sim, cx, cy, b, -1, isBlocker) && canHit(sim, cx, cy, b, 1, isBlocker)) return false;
      return true;
    }
    isSnookered(sim) {
      const on = this.ballsOn(sim);
      if (!on.length) return false;
      const onSet = new Set(on);
      const blocker = (b) => !onSet.has(b);
      const cue = sim.get(0);
      if (this.bih !== 'D') return this.snookeredAt(sim, cue.x, cue.y, on, blocker);
      // 母球在手：从 D 区任何位置都被挡才算
      const t = sim.t;
      for (let i = 0; i < 60; i++) {
        const a = Math.PI / 2 + (i / 59) * Math.PI;
        for (const r of [t.dR * 0.999, t.dR * 0.5, 0.001]) {
          const x = t.baulkX + Math.cos(a) * r, y = Math.sin(a) * r;
          if (sim.free(x, y, cue) && !this.snookeredAt(sim, x, y, on, blocker)) return false;
        }
      }
      return true;
    }

    // 出杆前记录局面（复位用）与判罚所需信息
    preShot(sim) {
      const on = this.ballsOn(sim);
      const onSet = new Set(on);
      const cue = sim.get(0);
      const notOn = (b) => !onSet.has(b);
      let clearAny = false, fullBall = false;
      for (const b of on) {
        for (let k = -1; k <= 1.001; k += 0.1) if (canHit(sim, cue.x, cue.y, b, k, notOn)) clearAny = true;
        if (canHit(sim, cue.x, cue.y, b, 0, notOn) && canHit(sim, cue.x, cue.y, b, -0.999, notOn) && canHit(sim, cue.x, cue.y, b, 0.999, notOn)) fullBall = true;
      }
      this.pre = {
        clearAny, fullBall, onIds: on.map((b) => b.id),
        scores: this.players.map((p) => p.score), phase: this.phase, seq: this.seq, reds: this.redsLeft(sim),
      };
      this.snap = {
        balls: sim.balls.map((b) => Object.assign({}, b, { q: b.q.slice() })),
        phase: this.phase, seq: this.seq, bih: this.bih, cur: this.cur, brk: this.brk,
      };
    }

    respotColor(sim, b) {
      const t = sim.t;
      const own = t.spots[b.kind];
      const tryAt = (x, y) => sim.free(x, y, b);
      let spot = own;
      if (!tryAt(own[0], own[1])) {
        spot = null;
        for (const k of COLOR_ORDER.slice().reverse()) {
          const s = t.spots[k];
          if (tryAt(s[0], s[1])) {
            spot = s;
            break;
          }
        }
      }
      if (spot) {
        b.on = true;
        b.pocket = -1;
        b.off = false;
        b.x = spot[0];
        b.y = spot[1];
        b.vx = b.vy = b.wx = b.wy = b.wz = b.z = b.vz = 0;
      } else this.respot(sim, b, own[0], own[1]);
    }

    evaluate(shot, sim) {
      const msgs = [];
      const me = this.cur;
      const on = this.phase;
      const fb = this.freeBall;
      const onK = this.onKinds();
      const ballOnVal = on === 'red' ? 1 : on === 'seq' ? this.val(COLOR_ORDER[this.seq]) : 0;
      const firstId = shot.first;
      const firstK = firstId != null ? this.kind(sim, firstId) : null;
      // 自由球：先碰到的非目标球即视为被指定的自由球
      const nominated = fb && firstK && !onK.includes(firstK) ? firstId : null;
      const potIds = shot.pots.filter((p) => p.id !== 0).map((p) => p.id);
      const offIds = shot.off.filter((id) => id !== 0);
      let foul = null, missable = false;
      let fv = Math.max(4, ballOnVal);
      const worth = (id) => (id === nominated ? ballOnVal : this.val(this.kind(sim, id)));
      if (shot.cuePot) foul = _t('f.cuePot');
      else if (shot.cueOff) foul = _t('f.cueOff');
      if (firstId == null) {
        foul = foul || _t('f.noHit');
        missable = true;
      } else if (!onK.includes(firstK) && nominated == null) {
        foul = foul || _t('f.snFirst', { hit: SN[firstK].n, on: this.onDesc() });
        fv = Math.max(fv, this.val(firstK));
        missable = true;
      }
      if (on === 'color' && firstK && firstK !== 'red') fv = Math.max(fv, this.val(firstK));
      for (const id of potIds.concat(offIds)) {
        const k = this.kind(sim, id);
        let ok;
        if (on === 'red') ok = k === 'red' || id === nominated;
        else if (on === 'color') ok = k === firstK && potIds.length === 1 && !offIds.length;
        else ok = k === COLOR_ORDER[this.seq] || id === nominated;
        if (offIds.includes(id)) ok = false;
        if (!ok) {
          foul = foul || (offIds.includes(id) ? _t('f.offBall', { ball: SN[k].n }) : _t('f.potWrong', { ball: SN[k].n }));
          fv = Math.max(fv, worth(id));
        }
      }

      // 复位彩球（红球不复位；顺序阶段合法打进的目标彩球不复位；自由球一律复位）
      const respotAll = (legalSeqId) => {
        for (const id of potIds.concat(offIds)) {
          const b = sim.get(id);
          if (b.kind === 'red') {
            b.on = false;
            continue;
          }
          if (id === legalSeqId) continue;
          this.respotColor(sim, b);
        }
      };

      if (!foul) {
        // ---- 合法击球 ----
        let scored = 0, legalSeqId = null;
        const nomPotted = nominated != null && potIds.includes(nominated);
        if (on === 'red') {
          scored = potIds.filter((id) => this.kind(sim, id) === 'red').length + (nomPotted ? 1 : 0);
          if (scored) this.phase = 'color';
        } else if (on === 'color') {
          if (potIds.length === 1) scored = this.val(this.kind(sim, potIds[0]));
          this.phase = this.redsLeft(sim) > 0 ? 'red' : 'seq';
          if (this.phase === 'seq') this.seq = 0;
        } else {
          const tgt = potIds.find((id) => this.kind(sim, id) === COLOR_ORDER[this.seq]);
          if (tgt != null) {
            scored = ballOnVal;
            legalSeqId = tgt;
            this.seq++;
          } else if (nomPotted) scored = ballOnVal;
        }
        respotAll(legalSeqId);
        // 自由球不能用来给对手做斯诺克（粉、黑两球时除外）
        if (fb && nominated != null && !scored) {
          const objs = sim.balls.filter((b) => b.on && b.id !== 0);
          const pinkBlackOnly = objs.length === 2 && objs.every((b) => b.kind === 'pink' || b.kind === 'black');
          const nb = sim.get(nominated);
          const nextOn = this.ballsOn(sim);
          const cue = sim.get(0);
          if (!pinkBlackOnly && nb.on && nextOn.length && this.snookeredAt(sim, cue.x, cue.y, nextOn, (b) => b === nb)) {
            foul = _t('f.freeSnooker');
            fv = Math.max(4, ballOnVal);
            scored = 0;
          }
        }
        if (!foul) {
          this.freeBall = false;
          this.fromReplace = false;
          this.missRun = 0;
          this.player.score += scored;
          this.bih = null;
          if (scored) {
            this.brk += scored;
            msgs.push(_t('m.sn.score', { free: fb && nomPotted ? _t('m.sn.freePrefix') : '', n: scored, brk: this.brk }));
            if (on === 'color' && this.phase === 'seq') msgs.push(_t('m.sn.clear'));
          } else {
            this.brk = 0;
            this.switchTurn();
            if (on === 'color') this.phase = this.redsLeft(sim) > 0 ? 'red' : 'seq';
            msgs.push(_t('m.turn', { name: this.player.name }));
          }
          return this.checkEnd(sim, { msgs, cont: scored > 0 });
        }
      } else {
        respotAll(null);
      }

      // ---- 犯规 ----
      this.freeBall = false;
      const other = 1 - me;
      this.players[other].score += fv;
      this.brk = 0;
      // Foul and a Miss（Section 3 Rule 14）
      let miss = false;
      if (missable) {
        const pre = this.pre || { scores: [0, 0], clearAny: true, fullBall: false };
        const after = this.players.map((p) => p.score);
        const needBefore = this.needsSnookers(sim, pre.scores, pre.phase, pre.seq);
        const needAfter = this.needsSnookers(sim, after, this.redsLeft(sim) ? 'red' : 'seq', on === 'seq' ? this.seq : 0);
        if (pre.fullBall && this.fromReplace && this.missRun >= 1) miss = true; // 全球可见时第二次起：不论比分都判 Miss
        else if (needBefore || needAfter) miss = false; // 任何一方需要罚分才能追上时不判 Miss
        else if (pre.clearAny) miss = true; // 有直线路线能碰到目标球却没碰到
        else miss = shot.minApproach > 3 * 2 * sim.R; // 被做斯诺克：解球离目标球太远视为没有尽力
        if (miss && pre.fullBall) this.missRun = this.fromReplace ? this.missRun + 1 : 1;
        else if (!miss || !pre.fullBall) this.missRun = 0;
      } else this.missRun = 0;
      this.fromReplace = false;
      msgs.push(_t(miss ? 'm.sn.foulMiss' : 'm.sn.foul', { foul, name: this.players[other].name, pts: fv }));
      if (miss && this.missRun >= 3 && this.warned) {
        this.over = { winner: other, reason: _t('m.sn.threeMiss', { name: this.players[me].name }) };
        return { over: this.over, msgs: msgs.concat([this.over.reason]) };
      }
      this.cur = other;
      this.phase = this.redsLeft(sim) > 0 ? 'red' : 'seq';
      if (on !== 'seq' && this.phase === 'seq') this.seq = 0;
      this.bih = shot.cuePot || shot.cueOff ? 'D' : null;
      if (this.bih) this.placeCue(sim);
      const snookered = this.isSnookered(sim);
      return this.checkEnd(sim, {
        foul, msgs, bih: this.bih,
        choice: { offender: me, miss, freeBall: snookered, penalty: fv, foul },
      });
    }

    // 非犯规方的选择：'play' 自己打（被做斯诺克时是自由球）/ 'again' 让对方从现在的位置再打 / 'replace' 复位让对方重打（Miss 时）
    applyChoice(choice, sim, info) {
      const msgs = [];
      this.replaceCount = choice === 'replace' ? (this.replaceCount || 0) + 1 : 0;
      if (choice === 'play') {
        this.missRun = 0;
        this.warned = false;
        this.freeBall = !!info.freeBall;
        msgs.push(this.freeBall ? _t('c.freeBall', { name: this.player.name }) : _t('c.play', { name: this.player.name }));
      } else if (choice === 'again') {
        this.missRun = 0;
        this.warned = false;
        this.cur = info.offender;
        this.freeBall = false;
        msgs.push(_t('c.again', { name: this.player.name }));
      } else {
        const s = this.snap;
        sim.balls.forEach((b, i) => Object.assign(b, s.balls[i], { q: s.balls[i].q.slice() }));
        this.phase = s.phase;
        this.seq = s.seq;
        this.bih = s.bih;
        this.cur = info.offender;
        this.freeBall = false;
        this.fromReplace = true;
        msgs.push(_t('c.replace', { name: this.player.name }));
        if (this.missRun >= 2) {
          this.warned = true;
          msgs.push(_t('c.warn', { name: this.player.name }));
        }
      }
      return msgs;
    }

    checkEnd(sim, res) {
      if (this.phase === 'seq' && this.seq >= COLOR_ORDER.length) {
        const [a, b] = this.players;
        if (a.score === b.score) {
          this.seq = 5;
          this.respotColor(sim, sim.balls.find((x) => x.kind === 'black'));
          this.bih = 'D';
          this.placeCue(sim);
          res.msgs.push(_t('m.sn.tie'));
          res.bih = 'D';
          delete res.choice;
          return res;
        }
        const w = a.score > b.score ? 0 : 1;
        this.over = { winner: w, reason: _t('m.sn.win', { name: this.players[w].name, a: a.score, b: b.score }) };
        res.over = this.over;
        res.msgs.push(this.over.reason);
      }
      return res;
    }
    hud(sim) {
      return this.players.map((p, i) => ({
        name: p.name, score: p.score,
        tag: i === this.cur ? _t('tag.target', { t: this.freeBall ? _t('tag.free') : this.onDesc() }) + (this.warned ? ' ⚠' : '') : '',
        brk: i === this.cur ? this.brk : 0, remain: this.redsLeft(sim),
      }));
    }
  }

  for (const [C, k] of [[Eight, 'eight'], [Nine, 'nine'], [Snooker, 'snooker']]) {
    Object.defineProperty(C.prototype, 'name', { get() { return _t('rule.' + k); } });
  }
  BP.makeRules = function (opts) {
    if (opts.type === 'nine') return new Nine(opts);
    if (opts.type === 'snooker') return new Snooker(opts);
    return new Eight(opts);
  };
})(window.BP);
