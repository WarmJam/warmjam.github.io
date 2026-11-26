// 主程序：菜单、布局、输入、出杆流程、瞄准线、音效
(function (BP) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem('bp_' + k);
        return v == null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem('bp_' + k, JSON.stringify(v));
      } catch (e) {}
    },
  };

  const opts = Object.assign({ type: 'eight', mode: 'ai', level: 'normal', rackPos: '0', callPocket: '1', reds: '15', cloth: 'auto', table: 'cn', jaw: 'wpa' }, store.get('opts', {}));
  const ren = new BP.Renderer($('cv'));
  let table, sim, rules;
  let phase = 'menu'; // aim | ai | shooting | moving | over | menu
  const aim = { ang: 0, power: 0, a: 0, b: 0, elev: 0, pull: 0 };
  let guideMode = store.get('guide', 1); // 0 关 1 基础 2 高级
  let shot = null, shootT = 0, called = null, manualCall = false, placeBad = false;
  let adv = { key: '', res: null, t: 0 };

  // ---------------- 音效 ----------------
  const snd = new BP.Audio();
  function audio() {
    snd.ensure();
  }
  const panAt = (x, y) => (ren && ren.s ? (ren.w2s(x, y)[0] - window.innerWidth / 2) / (window.innerWidth / 2) : 0);
  function sfx(kind) {
    if (kind === 'foul') snd.foul();
    else if (kind === 'win') snd.win();
  }

  // ---------------- 菜单 ----------------
  function syncMenu() {
    document.querySelectorAll('.seg').forEach((seg) => {
      const k = seg.dataset.k;
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(opts[k]) === b.dataset.v));
    });
    $('rowLevel').classList.toggle('hide', opts.mode !== 'ai');
    $('rowRack').classList.toggle('hide', opts.type === 'snooker');
    $('noteRack').classList.toggle('hide', opts.type === 'snooker');
    $('rowCall').classList.toggle('hide', opts.type !== 'eight');
    $('rowReds').classList.toggle('hide', opts.type !== 'snooker');
    $('rowTable').classList.toggle('hide', opts.type === 'snooker');
    $('rowJaw').classList.toggle('hide', opts.type === 'snooker' || opts.table !== 'wpa');
    $('btnResume').classList.toggle('hide', !rules || !!rules.over);
  }
  document.querySelectorAll('.seg').forEach((seg) => {
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      opts[seg.dataset.k] = b.dataset.v;
      store.set('opts', opts);
      syncMenu();
    });
  });
  $('btnStart').onclick = () => {
    audio();
    newGame();
  };
  $('btnResume').onclick = () => {
    $('menu').classList.add('hide');
  };
  $('btnMenu').onclick = () => {
    syncMenu();
    $('menu').classList.remove('hide');
  };
  $('btnAgain').onclick = () => newGame();
  $('btnToMenu').onclick = () => {
    $('over').classList.add('hide');
    syncMenu();
    $('menu').classList.remove('hide');
  };
  function guideBtn() {
    $('btnGuide').textContent = BP.t('guide.label') + BP.t('guide.' + guideMode);
  }
  $('btnGuide').onclick = () => {
    guideMode = (guideMode + 1) % 3;
    store.set('guide', guideMode);
    adv.key = '';
    guideBtn();
  };
  guideBtn();

  // ---------------- 天眼模式（隐藏） ----------------
  // 菜单里“台呢”标签连点 5 次开关，打开后该标签字体变红；界面上没有任何入口
  let xray = false;
  let xrayClicks = 0, xrayLast = 0;
  const paintClothLabel = () => {
    const el = document.querySelector('[data-i18n="row.cloth"]');
    if (el) el.style.color = xray ? '#ff4a4a' : '';
  };
  const clothEl = document.querySelector('[data-i18n="row.cloth"]');
  if (clothEl) {
    clothEl.addEventListener('click', () => {
      const now = performance.now();
      xrayClicks = now - xrayLast > 2000 ? 1 : xrayClicks + 1;
      xrayLast = now;
      if (xrayClicks >= 5) {
        xrayClicks = 0;
        xray = !xray;
        adv.key = '';
        paintClothLabel();
      }
    });
  }

  // ---------------- 新游戏 ----------------
  let overTimer = 0; // 结算框延时弹出的计时器：重新开局时要取消，否则会盖在新局上
  function newGame() {
    clearTimeout(overTimer);
    $('menu').classList.add('hide');
    $('over').classList.add('hide');
    $('choice').classList.add('hide');
    $('toast').innerHTML = '';
    table = BP.makeTable(opts.type === 'snooker' ? 'snooker' : opts.table === 'wpa' ? 'wpa' : 'cn', { jaw: opts.jaw });
    sim = new BP.Sim(table);
    const mk = (key, ai) => ({ key, ai, get name() { return BP.t(this.key); } });
    const players = opts.mode === 'ai' ? [mk('p.you'), mk('p.cpu', true)] : [mk('p.p1'), mk('p.p2')];
    rules = BP.makeRules({ type: opts.type, players, rackPos: +opts.rackPos, callPocket: opts.callPocket === '1', reds: +opts.reds });
    rules.setup(sim);
    layout();
    Object.assign(aim, { power: 0, a: 0, b: 0, elev: 0, pull: 0 });
    const cue = sim.get(0);
    const tgt = sim.balls.filter((b) => b.id !== 0).sort((a, b) => a.x - b.x)[0];
    aim.ang = Math.atan2(tgt.y - cue.y, tgt.x - cue.x);
    updateSpinUI();
    updateElevUI();
    toast(BP.t('toast.start', { rule: rules.name, name: rules.player.name }), 'good');
    startTurn();
  }

  // ---------------- 布局 ----------------
  function layout() {
    const W = window.innerWidth, H = window.innerHeight;
    const port = H > W * 1.05;
    document.body.classList.toggle('port', port);
    document.body.classList.toggle('land', !port);
    if (!table) return;
    const top = $('top').getBoundingClientRect().bottom;
    let area;
    if (port) {
      const lp = $('lp').getBoundingClientRect();
      area = { x: 6, y: top + 6, w: W - 12, h: lp.top - top - 12 };
    } else {
      const l = $('lp').getBoundingClientRect(), r = $('rp').getBoundingClientRect();
      area = { x: l.right, y: top + 4, w: r.left - l.right, h: H - top - 8 };
    }
    ren.layout(table, area, Math.min(2, window.devicePixelRatio || 1));
  }
  window.addEventListener('resize', () => setTimeout(layout, 50));
  layout();

  // ---------------- 回合 ----------------
  function isAI() {
    return rules && rules.player.ai;
  }
  function startTurn() {
    aimLock = false;
    shot = null;
    called = null;
    manualCall = false;
    adv.key = '';
    renderHud();
    if (rules.over) return;
    if (isAI()) {
      phase = 'ai';
      $('think').classList.remove('hide');
      setTimeout(aiTurn, 650);
    } else {
      phase = 'aim';
      $('think').classList.add('hide');
      if (rules.bih) toast(BP.t(rules.bih === 'anywhere' ? 'toast.bihAny' : rules.bih === 'kitchen' ? 'toast.bihKitchen' : 'toast.bihD'));
      if (rules.needCall(sim)) toast(BP.t('toast.call'));
    }
  }

  function aiTurn() {
    const cue = sim.get(0);
    const orig = [cue.x, cue.y];
    BP.aiPlan(rules, sim, opts.level, (plan) => {
      $('think').classList.add('hide');
      const to = plan.place;
      cue.x = orig[0];
      cue.y = orig[1];
      const a0 = aim.ang;
      let da = plan.ang - a0;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      aim.a = plan.a || 0;
      aim.b = plan.b || 0;
      aim.elev = plan.elev || 0;
      updateSpinUI();
      updateElevUI();
      if (plan.pocket != null && rules.needCall(sim)) called = plan.pocket;
      const t0 = performance.now();
      const pw = BP.vToPower(plan.V);
      const anim = () => {
        if (phase !== 'ai') return;
        const k = Math.min(1, (performance.now() - t0) / 1100);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        if (to) {
          cue.x = orig[0] + (to[0] - orig[0]) * Math.min(1, k * 1.6);
          cue.y = orig[1] + (to[1] - orig[1]) * Math.min(1, k * 1.6);
        }
        aim.ang = a0 + da * e;
        aim.power = pw * Math.max(0, (k - 0.5) * 2);
        setPowerUI(aim.power);
        if (k < 1) requestAnimationFrame(anim);
        else setTimeout(() => shoot(pw), 250);
      };
      anim();
    });
  }

  function shoot(power) {
    if (phase !== 'aim' && phase !== 'ai') return;
    if (power < 0.02) return;
    audio();
    const cue = sim.get(0);
    if (rules.bih && !rules.canPlace(cue.x, cue.y, sim)) {
      toast(BP.t('toast.badPos'), 'foul');
      return;
    }
    if (rules.needCall(sim) && called == null) called = autoPocket();
    aim.power = power;
    if (rules.preShot) rules.preShot(sim);
    shot = {
      first: null, pots: [], railAfter: false, cuePot: false, cueOff: false, off: [],
      break: !!rules.breakShot, lowest: rules.lowest ? rules.lowest(sim) : null, called,
      rails: new Set(), minApproach: Infinity, onIds: rules.pre ? rules.pre.onIds : [],
    };
    phase = 'shooting';
    shootT = performance.now();
  }

  const ev = {
    hit(a, b, v) {
      snd.ball(v, panAt((a.x + b.x) / 2, (a.y + b.y) / 2), table.type === 'snooker' ? 1.06 : 1);
      if (shot && shot.first == null) {
        if (a.id === 0) shot.first = b.id;
        else if (b.id === 0) shot.first = a.id;
      }
    },
    cush(b, v, seg) {
      snd.cushion(v, panAt(b.x, b.y), !!(seg && seg.jaw), table.kind);
      if (shot && shot.first != null) shot.railAfter = true;
      if (shot && b.id !== 0) shot.rails.add(b.id);
    },
    pot(b, i) {
      snd.pot(b.potV || 1, panAt(b.x, b.y), table.kind);
      if (shot) shot.pots.push({ id: b.id, pocket: i });
    },
    off(b) {
      if (shot) shot.off.push(b.id);
    },
    land(b, v) {
      snd.cushion(v * 0.6, panAt(b.x, b.y), false, table.kind);
    },
  };

  function onStopped() {
    sim.stopAll();
    const cue = sim.get(0);
    shot.cuePot = cue.pocket >= 0 && !cue.on && !cue.off;
    shot.cueOff = !!cue.off;
    shot.off = shot.off.filter((id) => id !== 0);
    shot.railBalls = shot.rails.size;
    const res = rules.evaluate(shot, sim);
    if (res.foul) sfx('foul');
    res.msgs.forEach((m, i) => setTimeout(() => toast(m, i === 0 && res.foul ? 'foul' : ''), i * 250));
    if (res.over) {
      phase = 'over';
      renderHud();
      sfx('win');
      overTimer = setTimeout(() => {
        const w = rules.players[res.over.winner];
        $('overT').textContent = BP.t('over.wins', { name: w.name });
        $('overR').textContent = res.over.reason;
        $('over').classList.remove('hide');
      }, 1200);
      return;
    }
    if (rules.bih) {
      const c = sim.get(0);
      if (!c.on || !rules.canPlace(c.x, c.y, sim)) rules.placeCue(sim);
    }
    if (res.choice) {
      renderHud();
      const done = (ch) => {
        rules.applyChoice(ch, sim, res.choice).forEach((m, i) => setTimeout(() => toast(m, ch === 'play' && res.choice.freeBall ? 'good' : ''), 600 + i * 250));
        afterStop(res, true);
      };
      if (rules.player.ai) setTimeout(() => done(aiChoose(res.choice)), 900);
      else setTimeout(() => askChoice(res.choice, done), 700);
      phase = 'choice';
      return;
    }
    afterStop(res);
  }

  // 非犯规方的选择：电脑的判断
  function aiChoose(c) {
    // 对手确实被做了斯诺克时，复位两次后就不再复位（真实比赛里也会这样权衡）
    if (c.miss && (rules.pre && rules.pre.clearAny || (rules.replaceCount || 0) < 2)) return 'replace';
    if (c.freeBall) return 'play';
    const cue = sim.get(0);
    return BP.candidates(rules, sim, cue.x, cue.y).length || rules.bih ? 'play' : 'again';
  }
  function askChoice(c, done) {
    const me = rules.player.name, off = rules.players[c.offender].name;
    $('chT').textContent = BP.t(c.miss ? 'ch.miss' : 'ch.foul');
    $('chR').textContent = BP.t('ch.body', { off, foul: c.foul, me, pts: c.penalty });
    const opts = [['play', BP.t(c.freeBall ? 'ch.playFree' : 'ch.play')]];
    opts.push(['again', BP.t('ch.again', { off })]);
    if (c.miss) opts.push(['replace', BP.t('ch.replace', { off })]);
    $('chBtns').innerHTML = opts.map(([k, t], i) => `<button class="big ${i ? 'sec' : ''}" data-c="${k}">${t}</button>`).join('');
    $('choice').classList.remove('hide');
    $('chBtns').querySelectorAll('button').forEach((b) => (b.onclick = () => {
      $('choice').classList.add('hide');
      done(b.dataset.c);
    }));
  }

  function afterStop(res, keepAim) {
    // 瞄准方向默认指向一颗目标球
    const tg = rules.legalTargets(sim).map((id) => sim.get(id)).filter((b) => b && b.on);
    const c = sim.get(0);
    if (tg.length && !res.cont) {
      tg.sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
      aim.ang = Math.atan2(tg[0].y - c.y, tg[0].x - c.x);
    }
    aim.power = 0;
    setPowerUI(0);
    startTurn();
  }

  // ---------------- 瞄准线 ----------------
  function guideBasic() {
    const cue = sim.get(0), R = sim.R, t = table;
    const dx = Math.cos(aim.ang), dy = Math.sin(aim.ang);
    let best = Infinity, hit = null;
    for (const b of sim.balls) {
      if (!b.on || b.id === 0) continue;
      const rx = b.x - cue.x, ry = b.y - cue.y;
      const pr = rx * dx + ry * dy;
      if (pr <= 0) continue;
      const pp = rx * rx + ry * ry - pr * pr;
      if (pp > 4 * R * R) continue;
      const tt = pr - Math.sqrt(4 * R * R - pp);
      if (tt < best) {
        best = tt;
        hit = b;
      }
    }
    const hl = t.L / 2 - R, hw = t.W / 2 - R;
    const tc = Math.min(dx > 0 ? (hl - cue.x) / dx : dx < 0 ? (-hl - cue.x) / dx : 1e9, dy > 0 ? (hw - cue.y) / dy : dy < 0 ? (-hw - cue.y) / dy : 1e9);
    const rayLen = (x, y, ux, uy, max) => {
      const a = Math.min(ux > 0 ? (hl - x) / ux : ux < 0 ? (-hl - x) / ux : 1e9, uy > 0 ? (hw - y) / uy : uy < 0 ? (-hw - y) / uy : 1e9);
      return Math.max(0, Math.min(max, a));
    };
    const g = { from: [cue.x, cue.y] };
    if (hit && best < tc) {
      const gx = cue.x + dx * best, gy = cue.y + dy * best;
      g.ghost = [gx, gy];
      let nx = hit.x - gx, ny = hit.y - gy;
      const nn = Math.hypot(nx, ny);
      nx /= nn;
      ny /= nn;
      const cos = dx * nx + dy * ny;
      const ol = rayLen(hit.x, hit.y, nx, ny, 0.25 + 0.9 * cos);
      g.obj = [[hit.x, hit.y], [hit.x + nx * ol, hit.y + ny * ol]];
      g.objLegal = rules.legalTargets(sim).includes(hit.id);
      let tx = dx - cos * nx, ty = dy - cos * ny;
      const tn = Math.hypot(tx, ty);
      if (tn > 0.02) {
        tx /= tn;
        ty /= tn;
        const tl = rayLen(gx, gy, tx, ty, 0.35 * tn + 0.05);
        g.tan = [[gx, gy], [gx + tx * tl, gy + ty * tl]];
      }
      g.hit = hit;
      g.odir = [nx, ny];
    } else {
      g.ghost = [cue.x + dx * tc, cue.y + dy * tc];
    }
    return g;
  }
  function guideAdvanced(g) {
    const cue = sim.get(0);
    const key = [aim.ang.toFixed(4), aim.power.toFixed(2), aim.a.toFixed(2), aim.b.toFixed(2), aim.elev.toFixed(2), cue.x.toFixed(3), cue.y.toFixed(3)].join('|');
    const now = performance.now();
    if (key !== adv.key && now - adv.t > 90) {
      adv.key = key;
      adv.t = now;
      const s = sim.clone();
      const c = s.get(0);
      s.strike(c, aim.ang, BP.powerToV(Math.max(aim.power, 0.3)), aim.a, aim.b, (aim.elev * Math.PI) / 180);
      const cp = [[c.x, c.y]], op = [];
      let first = null, n = 0;
      s.run(5, {
        hit(a, b) {
          if (first == null) first = a.id === 0 ? b : b.id === 0 ? a : null;
        },
      }, 1 / 600);
      // 为了记录轨迹重新跑一遍（带采样）
      const s2 = sim.clone();
      const c2 = s2.get(0);
      s2.strike(c2, aim.ang, BP.powerToV(Math.max(aim.power, 0.3)), aim.a, aim.b, (aim.elev * Math.PI) / 180);
      const o2 = first ? s2.get(first.id) : null;
      let cuePot = -1, objPot = -1;
      const potEv = { pot(b, i) { if (b.id === 0) cuePot = i; else if (first && b.id === first.id) objPot = i; } };
      for (let t = 0; t < 5 && s2.moving(); t += 1 / 600) {
        s2.step(1 / 600, potEv);
        if (++n % 12 === 0) {
          if (c2.on) cp.push([c2.x, c2.y]);
          if (o2 && o2.on && (o2.vx || o2.vy)) op.push([o2.x, o2.y]);
        }
      }
      if (c2.on) cp.push([c2.x, c2.y]);
      // 两球最终停下的位置：进袋的球停在袋口中心，没进的停在最后位置
      const endPos = (b, potIdx) => {
        if (!b) return null;
        if (potIdx >= 0) {
          const p = table.pockets[potIdx];
          return [p.hx != null ? p.hx : p.x, p.hy != null ? p.hy : p.y];
        }
        return [b.x, b.y];
      };
      adv.res = { cuePath: cp, objPath: op, cueEnd: endPos(c2, cuePot), objEnd: first ? endPos(o2, objPot) : null, cuePot, objPot, objId: first ? first.id : null };
    }
    if (adv.res) {
      g.cuePath = adv.res.cuePath;
      g.objPath = adv.res.objPath.length > 1 ? adv.res.objPath : null;
      g.cueEnd = adv.res.cueEnd;
      g.objEnd = adv.res.objEnd;
      g.cuePot = adv.res.cuePot;
      g.objPot = adv.res.objPot;
      g.objId = adv.res.objId;
      g.tan = null;
    }
    return g;
  }
  function autoPocket() {
    const g = guideBasic();
    if (!g.hit || !g.odir) return 0;
    let best = 0, bd = -2;
    table.pockets.forEach((p, i) => {
      let vx = p.x - g.hit.x, vy = p.y - g.hit.y;
      const n = Math.hypot(vx, vy);
      const d = (vx / n) * g.odir[0] + (vy / n) * g.odir[1];
      if (d > bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  // ---------------- 输入：球台（触屏 + 鼠标） ----------------
  // 鼠标：移动=瞄准；左键按住往后拉、再往前推=出杆（拉得越远越大力）；单击=锁定/解锁瞄准；
  //       滚轮=微调方向（Shift 更快）；右键拖动=调击球点（加塞/高低杆）；Ctrl+滚轮=抬杆；Alt+滚轮=力度
  const cv = $('cv');
  let drag = null, aimLock = false;
  const STROKE_PX = 240; // 往后拉这么多像素 = 满力
  function inFrame(wx, wy) {
    const r = ren.rail || 0.12;
    return Math.abs(wx) < table.L / 2 + r && Math.abs(wy) < table.W / 2 + r;
  }
  function aimScreenDir() {
    const cue = sim.get(0);
    const [ax, ay] = ren.w2s(cue.x, cue.y);
    const [bx, by] = ren.w2s(cue.x + Math.cos(aim.ang), cue.y + Math.sin(aim.ang));
    const n = Math.hypot(bx - ax, by - ay);
    return [(bx - ax) / n, (by - ay) / n];
  }
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('pointerdown', (e) => {
    audio();
    if (phase !== 'aim') return;
    try {
      cv.setPointerCapture(e.pointerId);
    } catch (err) {}
    const mouse = e.pointerType === 'mouse';
    const [wx, wy] = ren.s2w(e.clientX, e.clientY);
    const cue = sim.get(0);
    if (mouse && e.button === 2) {
      drag = { type: 'spin', x: e.clientX, y: e.clientY, a0: aim.a, b0: aim.b };
      return;
    }
    const grab = Math.max(sim.R * 3, 28 / ren.s);
    if (rules.bih && Math.hypot(wx - cue.x, wy - cue.y) < grab) {
      drag = { type: 'place', ox: cue.x - wx, oy: cue.y - wy, lastOk: [cue.x, cue.y] };
      return;
    }
    if (rules.needCall(sim)) {
      const pi = table.pockets.findIndex((p) => Math.hypot(wx - p.x, wy - p.y) < Math.max(p.r * 2.4, 30 / ren.s));
      if (pi >= 0) {
        called = pi;
        manualCall = true;
        toast(BP.t('toast.called'));
        return;
      }
    }
    if (mouse && e.button === 0) {
      drag = { type: 'stroke', x: e.clientX, y: e.clientY, max: 0, dir: aimScreenDir() };
      return;
    }
    drag = { type: 'aim' };
    aim.ang = Math.atan2(wy - cue.y, wx - cue.x);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!sim || phase !== 'aim') return;
    const [wx, wy] = ren.s2w(e.clientX, e.clientY);
    const cue = sim.get(0);
    if (!drag) {
      // 鼠标悬停瞄准
      if (e.pointerType === 'mouse' && e.buttons === 0) {
        const nearCue = rules.bih && Math.hypot(wx - cue.x, wy - cue.y) < Math.max(sim.R * 3, 28 / ren.s);
        cv.style.cursor = nearCue ? 'grab' : 'crosshair';
        if (!aimLock && inFrame(wx, wy) && Math.hypot(wx - cue.x, wy - cue.y) > sim.R * 1.5) aim.ang = Math.atan2(wy - cue.y, wx - cue.x);
      }
      return;
    }
    if (drag.type === 'place') {
      const hl = table.L / 2 - sim.R, hw = table.W / 2 - sim.R;
      cue.x = Math.max(-hl, Math.min(hl, wx + drag.ox));
      cue.y = Math.max(-hw, Math.min(hw, wy + drag.oy));
      placeBad = !rules.canPlace(cue.x, cue.y, sim);
      if (!placeBad) drag.lastOk = [cue.x, cue.y];
    } else if (drag.type === 'aim') {
      if (Math.hypot(wx - cue.x, wy - cue.y) > sim.R * 1.2) aim.ang = Math.atan2(wy - cue.y, wx - cue.x);
    } else if (drag.type === 'stroke') {
      // 沿瞄准方向的反方向拉 = 后拉
      const pull = -((e.clientX - drag.x) * drag.dir[0] + (e.clientY - drag.y) * drag.dir[1]);
      const p = Math.max(0, Math.min(1, pull / STROKE_PX));
      drag.max = Math.max(drag.max, p);
      aim.power = p;
      setPowerUI(p);
      cv.style.cursor = 'grabbing';
      // 拉过之后再往前推过起点 = 出杆
      if (drag.max > 0.03 && pull < -6) {
        const pw = drag.max;
        drag = null;
        shoot(pw);
      }
    } else if (drag.type === 'spin') {
      let a = drag.a0 + (e.clientX - drag.x) / 110, b = drag.b0 - (e.clientY - drag.y) / 110;
      const m = Math.hypot(a, b);
      if (m > 1) {
        a /= m;
        b /= m;
      }
      aim.a = a;
      aim.b = b;
      updateSpinUI();
    }
  });
  const upT = () => {
    if (!drag) return;
    if (drag.type === 'place') {
      const cue = sim.get(0);
      if (placeBad) {
        cue.x = drag.lastOk[0];
        cue.y = drag.lastOk[1];
      }
      placeBad = false;
    } else if (drag.type === 'stroke') {
      cv.style.cursor = 'crosshair';
      if (drag.max > 0.03) {
        // 往后拉了但没往前推：松手也出杆
        shoot(drag.max);
      } else {
        aimLock = !aimLock;
        toast(BP.t(aimLock ? 'toast.lock' : 'toast.unlock'));
        aim.power = 0;
        setPowerUI(0);
      }
    }
    drag = null;
  };
  cv.addEventListener('pointerup', upT);
  cv.addEventListener('pointercancel', upT);
  cv.addEventListener('wheel', (e) => {
    if (!sim || phase !== 'aim') return;
    e.preventDefault();
    const s = Math.sign(e.deltaY) * Math.min(3, Math.max(1, Math.abs(e.deltaY) / 100));
    if (e.ctrlKey) {
      aim.elev = Math.max(0, Math.min(60, aim.elev - s * 2));
      updateElevUI();
    } else if (e.altKey) {
      aim.power = Math.max(0, Math.min(1, aim.power - s * 0.02));
      setPowerUI(aim.power);
    } else {
      aim.ang -= s * (e.shiftKey ? 0.012 : 0.0012);
    }
  }, { passive: false });

  // ---------------- 输入：控制条 ----------------
  function bindDrag(el, fn, end) {
    let on = false;
    el.addEventListener('pointerdown', (e) => {
      audio();
      on = true;
      try {
        el.setPointerCapture(e.pointerId);
      } catch (err) {}
      fn(e, true);
    });
    el.addEventListener('pointermove', (e) => on && fn(e, false));
    const up = (e) => {
      if (!on) return;
      on = false;
      if (end) end(e);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }
  function setPowerUI(p) {
    const port = document.body.classList.contains('port');
    $('powerFill').style[port ? 'width' : 'height'] = p * 100 + '%';
    $('powerFill').style[port ? 'height' : 'width'] = '';
    $('powerTxt').textContent = p > 0.005 ? Math.round(p * 100) + '%' : BP.t(port ? 'pw.right' : 'pw.down');
  }
  let pStart = null;
  bindDrag($('power'), (e, first) => {
    if (phase !== 'aim') return;
    const r = $('power').getBoundingClientRect();
    const port = r.width > r.height;
    const pos = port ? e.clientX : e.clientY;
    if (first) pStart = pos;
    const len = port ? r.width : r.height;
    aim.power = Math.max(0, Math.min(1, (pos - pStart) / (len * 0.85)));
    setPowerUI(aim.power);
  }, () => {
    if (phase !== 'aim') return;
    if (aim.power > 0.02) shoot(aim.power);
    else {
      aim.power = 0;
      setPowerUI(0);
    }
  });
  let fineLast = null;
  bindDrag($('fine'), (e, first) => {
    const r = $('fine').getBoundingClientRect();
    const port = r.width > r.height;
    const pos = port ? e.clientX : e.clientY;
    if (!first && phase === 'aim') {
      aim.ang += (port ? 1 : -1) * (pos - fineLast) * 0.0007;
      const off = (parseFloat($('fine').dataset.off || 0) + (pos - fineLast)) % 9;
      $('fine').dataset.off = off;
      $('fine').style.backgroundPosition = port ? `${off}px 0` : `0 ${off}px`;
    }
    fineLast = pos;
  });
  function updateSpinUI() {
    const d = $('spinDot');
    d.style.left = 50 + aim.a * 42 + '%';
    d.style.top = 50 - aim.b * 42 + '%';
    const t = [];
    if (aim.b > 0.15) t.push(BP.t(aim.b > 0.6 ? 'sp.follow' : 'sp.slightFollow'));
    else if (aim.b < -0.15) t.push(BP.t(aim.b < -0.6 ? 'sp.draw' : 'sp.slightDraw'));
    if (aim.a > 0.15) t.push(BP.t('sp.right'));
    else if (aim.a < -0.15) t.push(BP.t('sp.left'));
    $('spinTxt').textContent = t.length ? t.join(' + ') : BP.t('sp.center');
  }
  bindDrag($('spin'), (e) => {
    if (phase !== 'aim') return;
    const r = $('spin').getBoundingClientRect();
    let a = ((e.clientX - r.left) / r.width - 0.5) / 0.42;
    let b = -((e.clientY - r.top) / r.height - 0.5) / 0.42;
    const m = Math.hypot(a, b);
    if (m > 1) {
      a /= m;
      b /= m;
    }
    aim.a = a;
    aim.b = b;
    updateSpinUI();
  });
  $('spin').addEventListener('dblclick', () => {
    aim.a = aim.b = 0;
    updateSpinUI();
  });
  function updateElevUI() {
    const port = document.body.classList.contains('port');
    const k = aim.elev / 60;
    $('elevFill').style[port ? 'height' : 'width'] = k * 100 + '%';
    $('elevFill').style[port ? 'width' : 'height'] = '';
    $('elevTxt').textContent = BP.t('elev', { n: Math.round(aim.elev) }) + (aim.elev > 22 && Math.abs(aim.a) > 0.2 ? BP.t('elev.masse') : aim.elev > 22 && aim.b < 0.3 ? BP.t('elev.jump') : '');
  }
  bindDrag($('elev'), (e) => {
    if (phase !== 'aim') return;
    const r = $('elev').getBoundingClientRect();
    const port = r.height > r.width;
    const k = port ? 1 - (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
    aim.elev = Math.round(Math.max(0, Math.min(1, k)) * 60);
    updateElevUI();
  });
  $('shootBtn').onclick = () => {
    if (phase !== 'aim') return;
    shoot(aim.power > 0.02 ? aim.power : 0.45);
  };

  // 键盘
  const keys = {};
  window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (phase !== 'aim') return;
    const k = e.key.toLowerCase();
    const st = e.shiftKey ? 0.02 : 0.0015;
    if (e.key === 'ArrowLeft') aim.ang += st;
    else if (e.key === 'ArrowRight') aim.ang -= st;
    else if (e.key === 'ArrowUp') aim.power = Math.min(1, aim.power + 0.05);
    else if (e.key === 'ArrowDown') aim.power = Math.max(0, aim.power - 0.05);
    else if (e.key === ' ') {
      e.preventDefault();
      shoot(aim.power > 0.02 ? aim.power : 0.45);
    } else if (k === 'w') aim.b = Math.min(1, aim.b + 0.1);
    else if (k === 's') aim.b = Math.max(-1, aim.b - 0.1);
    else if (k === 'a') aim.a = Math.max(-1, aim.a - 0.1);
    else if (k === 'd') aim.a = Math.min(1, aim.a + 0.1);
    else if (k === 'q') aim.elev = Math.max(0, aim.elev - 5);
    else if (k === 'e') aim.elev = Math.min(60, aim.elev + 5);
    else if (k === 'g') $('btnGuide').click();
    else if (k === 'c') {
      aim.a = aim.b = 0;
    }
    if (/^arrow(up|down)$/i.test(e.key)) setPowerUI(aim.power);
    updateSpinUI();
    updateElevUI();
  });
  window.addEventListener('keyup', (e) => (keys[e.key] = false));

  // ---------------- 界面 ----------------
  function toast(text, cls = '') {
    const d = document.createElement('div');
    d.className = 'msg ' + cls;
    d.textContent = text;
    $('toast').appendChild(d);
    setTimeout(() => d.remove(), 3500);
    while ($('toast').children.length > 3) $('toast').firstChild.remove();
  }
  // 顶部栏里的立体小球：八球/九球画号码球（全色/花色），斯诺克画红球和彩球
  function hudBall(o) {
    const cls = ['hb'];
    if (o.off) cls.push('off');
    if (o.tgt) cls.push('tgt');
    if (o.small) cls.push('sm');
    let bg;
    if (o.color) bg = `background:${o.color}`;
    else {
      const c = BP.ballColor(o.id);
      bg = o.id > 8 ? `background: linear-gradient(180deg,#f4f1e8 0 23%, ${c} 23% 77%, #f4f1e8 77%)` : `background:${c}`;
    }
    const num = o.id != null && !o.color ? `<span>${o.id}</span>` : '';
    const cnt = o.count != null ? `<em>×${o.count}</em>` : '';
    return `<div class="${cls.join(' ')}" style="${bg}" title="${o.title || ''}">${num}</div>${cnt}`;
  }
  const SNC = () => BP.SN;
  function renderHud() {
    if (!rules) return;
    const h = rules.hud(sim);
    const R = rules.id;
    h.forEach((p, i) => {
      const el = $('p' + i);
      const cur = rules.cur === i && !rules.over;
      el.classList.toggle('on', cur);
      el.querySelector('.nm').textContent = p.name + (rules.players[i].ai ? ' 🤖' : '');
      let tag = '', balls = '';
      if (R === 'eight') {
        const g = rules.groups[i];
        if (!g) {
          tag = BP.t('tag.open');
          balls = cur ? [1, 9].map((id) => hudBall({ id, small: true, title: BP.t('hud.anyGroup') })).join('') : '';
        } else if (p.eight) {
          tag = BP.t('tag.on8');
          balls = hudBall({ id: 8, tgt: cur });
        } else {
          tag = BP.t(g === 'solid' ? 'tag.solid' : 'tag.stripe');
          balls = p.balls.filter((b) => b.on).map((b) => hudBall({ id: b.id, tgt: cur })).join('');
        }
      } else if (R === 'nine') {
        tag = p.fouls ? BP.t('tag.fouls', { n: p.fouls }) : '';
        if (cur) {
          const low = rules.lowest(sim);
          balls = hudBall({ id: low, tgt: true, title: BP.t('hud.target') });
        }
      } else {
        const SN = SNC();
        tag = p.brk ? BP.t('tag.brk', { n: p.brk }) : '';
        if (cur) {
          if (rules.freeBall) balls = `<div class="fb">${BP.t('tag.free')}</div>` + ['red', 'yellow', 'green', 'brown', 'blue', 'pink', 'black'].map((k) => hudBall({ color: SN[k].c, small: true, title: SN[k].n })).join('');
          else if (rules.phase === 'red') balls = hudBall({ color: SN.red.c, tgt: true, title: SN.red.n, count: p.remain });
          else if (rules.phase === 'color') balls = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'].map((k) => hudBall({ color: SN[k].c, tgt: true, title: SN[k].n })).join('');
          else {
            const k = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'][rules.seq];
            if (k) balls = hudBall({ color: SN[k].c, tgt: true, title: SN[k].n });
          }
          if (rules.warned) tag += BP.t('tag.warn');
        }
      }
      el.querySelector('.tg').textContent = tag;
      el.querySelector('.sc').textContent = p.score != null ? p.score : '';
      el.querySelector('.bl').innerHTML = balls;
    });
    if (R === 'nine') {
      const low = rules.lowest(sim);
      $('mid').innerHTML = h[0].balls.filter((b) => b.on).map((b) => hudBall({ id: b.id, tgt: b.id === low, small: b.id !== low })).join('');
    } else if (R === 'snooker') {
      const SN = SNC();
      $('mid').innerHTML = hudBall({ color: SN.red.c, small: true, count: h[0].remain, title: BP.t('hud.reds') });
    } else $('mid').innerHTML = '';
  }

  // ---------------- 主循环 ----------------
  let lastT = performance.now(), acc = 0;
  const DT = 1 / 1000;
  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (sim && table) {
      if (phase === 'shooting') {
        const k = (now - shootT) / 1000;
        if (k < 0.18) aim.pull = aim.power * (1 - k / 0.18);
        else {
          aim.pull = 0;
          const cue = sim.get(0);
          const V = BP.powerToV(aim.power);
          sim.strike(cue, aim.ang, V, aim.a, aim.b, (aim.elev * Math.PI) / 180);
          snd.cue(aim.power, Math.hypot(aim.a, aim.b), panAt(cue.x, cue.y));
          phase = 'moving';
          setPowerUI(0);
        }
      } else if (phase === 'aim' || phase === 'ai') {
        aim.pull += (aim.power - aim.pull) * Math.min(1, dt * 18);
      }
      if (phase === 'moving') {
        acc += dt;
        let n = 0;
        const cueB = sim.get(0);
        while (acc >= DT && n < 60) {
          sim.step(DT, ev);
          acc -= DT;
          n++;
          // 记录母球离目标球最近的距离（判断是否尽力解球）
          if (shot && shot.first == null && shot.onIds.length && cueB.on && n % 4 === 0) {
            for (const id of shot.onIds) {
              const b = sim.get(id);
              if (b.on) shot.minApproach = Math.min(shot.minApproach, Math.hypot(b.x - cueB.x, b.y - cueB.y) - 2 * sim.R);
            }
          }
        }
        if (!sim.moving()) {
          acc = 0;
          onStopped();
        }
      } else {
        // 让进袋动画播完
        sim.time += dt;
      }
      // 绘制
      const aiming = phase === 'aim' || phase === 'ai' || phase === 'shooting';
      const cue = sim.get(0);
      const st = { sim, tableOpts: { cloth: opts.cloth === 'auto' ? null : opts.cloth, apex: rules.footApex } };
      if (aiming && cue.on) {
        st.cue = { x: cue.x, y: cue.y, ang: aim.ang, pull: aim.pull, elev: aim.elev };
        if ((guideMode > 0 || xray) && phase !== 'shooting') {
          let g = guideBasic();
          if (guideMode === 2 || xray) g = guideAdvanced(g);
          if (xray) g.xray = true;
          st.guide = g;
          if (rules.needCall(sim) && !manualCall && phase === 'aim') called = autoPocket();
        }
        if (phase === 'aim' && guideMode > 0) st.targets = rules.legalTargets(sim);
      }
      if (rules.needCall(sim) && (phase === 'aim' || phase === 'ai' || phase === 'shooting')) {
        st.callPocket = called;
        st.pickPockets = phase === 'aim';
      }
      if (phase === 'aim' && rules.bih) {
        st.bih = rules.bih;
        st.showBih = true;
        st.placeBad = placeBad;
      }
      ren.draw(st);
    }
    requestAnimationFrame(frame);
  }
  document.querySelectorAll('[data-lang]').forEach((b) => (b.onclick = () => BP.setLang(b.dataset.lang)));
  window.addEventListener('langchange', () => {
    guideBtn();
    paintClothLabel();
    updateSpinUI();
    updateElevUI();
    setPowerUI(aim.power);
    renderHud();
  });
  BP.applyI18n();
  guideBtn();
  updateSpinUI();
  updateElevUI();
  setPowerUI(0);
  syncMenu();
  requestAnimationFrame(frame);
  window.BPG = { get sim() { return sim; }, get rules() { return rules; }, get phase() { return phase; }, aim, shoot, newGame, opts, ren };
})(window.BP);
