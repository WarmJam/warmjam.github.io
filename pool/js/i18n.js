// 中英文界面文字。BP.t(key, vars) 取当前语言的文字，{name} 这样的占位符由 vars 替换。
// 页面里带 data-i18n / data-i18n-html / data-i18n-title 的元素在切换语言时自动更新。
window.BP = window.BP || {};
(function (BP) {
  'use strict';

  const zh = {
    'title': '桌球',
    'menu.sub': '真实旋转物理 · 多种玩法与球台',
    'row.type': '玩法', 'mode.eight': '八球', 'mode.nine': '九球', 'mode.snooker': '斯诺克',
    'row.table': '球台', 'table.cn': '中式台（圆弧袋口）', 'table.wpa': '美式台（直袋角）',
    'row.jaw': '袋角', 'jaw.wpa': '标准收口（WPA 142°）', 'jaw.parallel': '平行袋角',
    'row.opp': '对手', 'opp.ai': '电脑', 'opp.pvp': '双人',
    'row.level': '电脑水平', 'level.easy': '简单', 'level.normal': '普通', 'level.hard': '高手',
    'row.rack': '摆球位置', 'rack.0': '标准', 'rack.35': '稍靠中', 'rack.65': '靠中间', 'rack.9': '中心',
    'note.rack': '越靠中间，开球后球越散、越容易打',
    'row.call': '8号球', 'call.1': '需指定袋口', 'call.0': '任意袋口',
    'row.reds': '红球数', 'reds.15': '15 颗', 'reds.10': '10 颗', 'reds.6': '6 颗',
    'row.cloth': '台呢', 'cloth.auto': '默认', 'cloth.blue': '蓝', 'cloth.green': '绿', 'cloth.red': '红',
    'btn.start': '开始游戏', 'btn.resume': '继续当前比赛',
    'help.mouse': '<b>鼠标</b>：移动鼠标瞄准；左键按住往后拉、再往前推＝出杆（拉得越远力越大）；单击＝锁定瞄准；滚轮微调（Shift 更快）；右键拖动＝调击球点；Ctrl+滚轮＝抬杆',
    'help.touch': '<b>触屏</b>：在球台上按住拖动瞄准；右侧"微调"条精细调整；键盘 ← → 也可微调',
    'help.shoot': '<b>出杆</b>：左侧力度条按住往下拉，松手出杆；或点"出杆"按钮 / 空格键',
    'help.spin': '<b>旋转</b>：拖动白球上的红点：上=高杆（跟进），下=低杆（缩杆），左右=加塞；双击回中',
    'help.elev': '<b>抬杆</b>：配合加塞可打扎杆（弧线球）；抬杆大、不加高杆可打跳球',
    'help.bih': '<b>自由球</b>：拖动母球摆放；八球打 8 号球时点袋口指定',
    'link.repo': 'GitHub 仓库', 'link.readme': 'README 说明文档',
    'top.menu': '菜单', 'top.guide': '瞄准线 (G)', 'guide.label': '线:',
    'guide.0': '关', 'guide.1': '基础', 'guide.2': '高级',
    'lbl.power': '力度', 'lbl.spin': '击球点（加塞/高低杆）', 'lbl.fine': '微调', 'btn.shoot': '出杆',
    'pw.down': '按住往下拉 · 松手出杆', 'pw.right': '按住往右拉 · 松手出杆',
    'sp.follow': '高杆', 'sp.slightFollow': '小高杆', 'sp.draw': '低杆', 'sp.slightDraw': '小低杆',
    'sp.right': '右塞', 'sp.left': '左塞', 'sp.center': '中杆',
    'elev': '抬杆 {n}°', 'elev.masse': ' 扎杆', 'elev.jump': ' 跳球',
    'think': '电脑思考中…',
    'mhelp': '🖱 移动瞄准 · 左键按住往后拉再往前推＝出杆 · 单击锁定瞄准 · 滚轮微调 · 右键拖动＝加塞/高低杆 · Ctrl+滚轮＝抬杆',
    'over.title': '比赛结束', 'over.wins': '🏆 {name}获胜！', 'btn.again': '再来一局', 'btn.toMenu': '返回菜单',
    // 名字
    'rule.eight': '八球', 'rule.nine': '九球', 'rule.snooker': '斯诺克',
    'p.you': '你', 'p.cpu': '电脑', 'p.p1': '玩家 1', 'p.p2': '玩家 2',
    'ball.red': '红球', 'ball.yellow': '黄球', 'ball.green': '绿球', 'ball.brown': '咖啡球', 'ball.blue': '蓝球', 'ball.pink': '粉球', 'ball.black': '黑球',
    'on.red': '红球', 'on.color': '任意彩球', 'on.none': '—',
    // 提示
    'toast.start': '{rule}开始！{name}开球',
    'toast.bihAny': '自由球：可把母球拖到任意位置',
    'toast.bihKitchen': '开球：可在开球线后摆放母球',
    'toast.bihD': '自由球：在 D 区内摆放母球',
    'toast.call': '打 8 号球：点一个袋口指定（默认自动选择）',
    'toast.badPos': '母球位置不合法', 'toast.called': '已指定袋口',
    'toast.lock': '🔒 瞄准已锁定（滚轮微调，再单击解锁）', 'toast.unlock': '🔓 瞄准已解锁',
    // 犯规原因
    'f.cuePot': '母球落袋', 'f.cueOff': '母球跳出台面', 'f.noHit': '没有击中任何球',
    'f.wrongFirst': '先碰到的不是自己的目标球', 'f.open8': '开放局不能先碰 8 号球',
    'f.noRail': '击球后没有球碰库', 'f.badBreak': '开球不合法（需进球或至少 4 颗目标球碰库）',
    'f.ballOff': '有球跳出台面', 'f.nineFirst': '必须先碰 {n} 号球',
    'f.snFirst': '先碰到了{hit}，应该打{on}', 'f.potWrong': '打进了{ball}', 'f.offBall': '{ball}跳出台面',
    'f.freeSnooker': '用自由球给对手做了斯诺克',
    'f.nineTwo': '（已连续两次犯规！）',
    // 对局消息
    'm.break8': '开球打进 8 号球，8 号球放回置球点',
    'm.lose8foul': '{name}打进 8 号球时犯规（{foul}）', 'm.lose8early': '{name}提前打进了 8 号球',
    'm.lose8pocket': '8 号球没有进指定的袋口', 'm.win8': '{name}打进 8 号球，赢了！',
    'm.group': '{name}：{grp}', 'grp.solid': '全色球（1-7）', 'grp.stripe': '花色球（9-15）',
    'm.foul': '犯规：{foul}', 'm.bih': '{name}获得自由球', 'm.turn': '轮到{name}', 'm.cont': '继续击球',
    'm.win9': '{name}打进 9 号球，赢了！', 'm.spot9': '犯规时打进的 9 号球放回置球点',
    'm.lose3fouls': '{name}连续三次犯规，判负',
    'm.sn.score': '{free}+{n} 分（单杆 {brk}）', 'm.sn.freePrefix': '自由球 ',
    'm.sn.clear': '红球打完，开始按顺序清彩球',
    'm.sn.foul': '犯规：{foul}，{name}得 {pts} 分', 'm.sn.foulMiss': '犯规并判 Miss：{foul}，{name}得 {pts} 分',
    'm.sn.threeMiss': '{name}在全球可见的情况下连续三次解球失败，本局判负',
    'm.sn.tie': '平分！黑球放回，决胜黑球', 'm.sn.win': '{name}赢得本局（{a} : {b}）',
    'c.freeBall': '{name}：自由球！可以把任意一颗球当作目标球', 'c.play': '{name}自己击球', 'c.again': '{name}再打一杆',
    'c.replace': '球复位，{name}重打', 'c.warn': '⚠ 警告：{name}再次解球失败将判负',
    // 选择对话框
    'ch.miss': '犯规并判 Miss！', 'ch.foul': '对手犯规',
    'ch.body': '{off}：{foul}，{me}得 {pts} 分。{me}想怎么做？',
    'ch.play': '我来打', 'ch.playFree': '我来打（自由球）', 'ch.again': '让{off}再打', 'ch.replace': '复位，让{off}重打',
    // 顶部状态栏
    'tag.open': '开放局', 'tag.solid': '全色', 'tag.stripe': '花色', 'tag.on8': '打 8 号球',
    'tag.fouls': '连续犯规 {n}', 'tag.brk': '单杆 {n}', 'tag.target': '目标：{t}', 'tag.free': '自由球', 'tag.warn': ' ⚠ 再失误判负',
    'hud.anyGroup': '任选全色或花色', 'hud.target': '目标球', 'hud.reds': '台面剩余红球',
  };

  const en = {
    'title': 'Billiards',
    'menu.sub': 'Realistic spin physics · Multiple game modes & tables',
    'row.type': 'Game', 'mode.eight': '8-Ball', 'mode.nine': '9-Ball', 'mode.snooker': 'Snooker',
    'row.table': 'Table', 'table.cn': 'Chinese table (round jaws)', 'table.wpa': 'American table (straight jaws)',
    'row.jaw': 'Pocket jaws', 'jaw.wpa': 'Standard taper (WPA 142°)', 'jaw.parallel': 'Parallel',
    'row.opp': 'Opponent', 'opp.ai': 'Computer', 'opp.pvp': '2 players',
    'row.level': 'Difficulty', 'level.easy': 'Easy', 'level.normal': 'Normal', 'level.hard': 'Expert',
    'row.rack': 'Rack position', 'rack.0': 'Standard', 'rack.35': 'Slightly forward', 'rack.65': 'Toward center', 'rack.9': 'Center',
    'note.rack': 'The closer to the center, the more the balls spread on the break — and the easier the game.',
    'row.call': '8-ball', 'call.1': 'Call pocket', 'call.0': 'Any pocket',
    'row.reds': 'Reds', 'reds.15': '15 reds', 'reds.10': '10 reds', 'reds.6': '6 reds',
    'row.cloth': 'Cloth', 'cloth.auto': 'Default', 'cloth.blue': 'Blue', 'cloth.green': 'Green', 'cloth.red': 'Red',
    'btn.start': 'Start game', 'btn.resume': 'Resume match',
    'help.mouse': '<b>Mouse</b>: move to aim; hold left button, pull back, then push forward = shoot (farther pull = more power); click = lock aim; wheel = fine aim (Shift = faster); right-drag = cue ball hit point; Ctrl+wheel = cue elevation',
    'help.touch': '<b>Touch</b>: drag on the table to aim; use the "Fine" strip on the right for small adjustments; ← → keys also work',
    'help.shoot': '<b>Shoot</b>: hold the power bar on the left and pull, release to shoot; or tap "Shoot" / press Space',
    'help.spin': '<b>Spin</b>: drag the red dot on the cue ball: up = follow, down = draw, left/right = side spin; double-click to reset',
    'help.elev': '<b>Elevation</b>: raise the cue with side spin for a masse (curve shot); raise it with no follow to jump the ball',
    'help.bih': '<b>Ball in hand</b>: drag the cue ball to place it; when shooting the 8-ball, tap a pocket to call it',
    'link.repo': 'GitHub repository', 'link.readme': 'README',
    'top.menu': 'Menu', 'top.guide': 'Aim line (G)', 'guide.label': 'Line: ',
    'guide.0': 'Off', 'guide.1': 'Basic', 'guide.2': 'Advanced',
    'lbl.power': 'Power', 'lbl.spin': 'Hit point (english / follow-draw)', 'lbl.fine': 'Fine', 'btn.shoot': 'Shoot',
    'pw.down': 'Hold & pull down · release', 'pw.right': 'Pull right · release to shoot',
    'sp.follow': 'Follow', 'sp.slightFollow': 'Slight follow', 'sp.draw': 'Draw', 'sp.slightDraw': 'Slight draw',
    'sp.right': 'Right english', 'sp.left': 'Left english', 'sp.center': 'Center',
    'elev': 'Elevation {n}°', 'elev.masse': ' Masse', 'elev.jump': ' Jump',
    'think': 'Computer is thinking…',
    'mhelp': '🖱 Move to aim · Hold left, pull back then push forward = shoot · Click = lock aim · Wheel = fine aim · Right-drag = spin · Ctrl+wheel = elevation',
    'over.title': 'Match over', 'over.wins': '🏆 {name} wins!', 'btn.again': 'Play again', 'btn.toMenu': 'Back to menu',
    'rule.eight': '8-Ball', 'rule.nine': '9-Ball', 'rule.snooker': 'Snooker',
    'p.you': 'You', 'p.cpu': 'Computer', 'p.p1': 'Player 1', 'p.p2': 'Player 2',
    'ball.red': 'red', 'ball.yellow': 'yellow', 'ball.green': 'green', 'ball.brown': 'brown', 'ball.blue': 'blue', 'ball.pink': 'pink', 'ball.black': 'black',
    'on.red': 'a red', 'on.color': 'any colour', 'on.none': '—',
    'toast.start': 'New {rule} game — {name} to break',
    'toast.bihAny': 'Ball in hand: drag the cue ball anywhere',
    'toast.bihKitchen': 'Break: place the cue ball behind the head string',
    'toast.bihD': 'Ball in hand: place the cue ball inside the D',
    'toast.call': 'On the 8-ball: tap a pocket to call it (auto-selected by default)',
    'toast.badPos': 'Illegal cue ball position', 'toast.called': 'Pocket called',
    'toast.lock': '🔒 Aim locked (wheel to fine-tune, click again to unlock)', 'toast.unlock': '🔓 Aim unlocked',
    'f.cuePot': 'Cue ball potted', 'f.cueOff': 'Cue ball jumped off the table', 'f.noHit': 'No ball was hit',
    'f.wrongFirst': 'The first ball hit was not your target', 'f.open8': 'Cannot hit the 8-ball first on an open table',
    'f.noRail': 'No ball reached a cushion after contact', 'f.badBreak': 'Illegal break (pot a ball or drive at least 4 object balls to a cushion)',
    'f.ballOff': 'A ball jumped off the table', 'f.nineFirst': 'Must hit ball {n} first',
    'f.snFirst': 'Hit the {hit} first; {on} was required', 'f.potWrong': 'Potted the {ball}', 'f.offBall': 'The {ball} jumped off the table',
    'f.freeSnooker': 'Used the free ball to snooker the opponent',
    'f.nineTwo': ' (second consecutive foul!)',
    'm.break8': '8-ball potted on the break — it is re-spotted',
    'm.lose8foul': '{name} fouled while potting the 8-ball ({foul})', 'm.lose8early': '{name} potted the 8-ball too early',
    'm.lose8pocket': 'The 8-ball did not go into the called pocket', 'm.win8': '{name} potted the 8-ball and wins!',
    'm.group': '{name}: {grp}', 'grp.solid': 'solids (1–7)', 'grp.stripe': 'stripes (9–15)',
    'm.foul': 'Foul: {foul}', 'm.bih': '{name} has ball-in-hand', 'm.turn': "{name}'s turn", 'm.cont': 'Shoot again',
    'm.win9': '{name} potted the 9-ball and wins!', 'm.spot9': 'The 9-ball potted on a foul is re-spotted',
    'm.lose3fouls': '{name} committed three consecutive fouls and loses',
    'm.sn.score': '{free}+{n} points (break {brk})', 'm.sn.freePrefix': 'Free ball ',
    'm.sn.clear': 'All reds are gone — now clear the colours in order',
    'm.sn.foul': 'Foul: {foul} — {name} scores {pts}', 'm.sn.foulMiss': 'Foul and a Miss: {foul} — {name} scores {pts}',
    'm.sn.threeMiss': '{name} failed three times in a row to hit a fully visible ball — frame awarded to the opponent',
    'm.sn.tie': 'Scores tied — the black is re-spotted, next pot wins', 'm.sn.win': '{name} wins the frame ({a} : {b})',
    'c.freeBall': '{name}: free ball! Any ball may be nominated as the ball on', 'c.play': '{name} plays on', 'c.again': '{name} plays again',
    'c.replace': 'Balls replaced — {name} plays again', 'c.warn': '⚠ Warning: another failure by {name} will lose the frame',
    'ch.miss': 'Foul and a Miss!', 'ch.foul': 'Opponent fouled',
    'ch.body': '{off}: {foul} — {me} scores {pts}. What would {me} like to do?',
    'ch.play': 'I will play', 'ch.playFree': 'I will play (free ball)', 'ch.again': 'Make {off} play again', 'ch.replace': 'Replace balls, {off} plays again',
    'tag.open': 'Open table', 'tag.solid': 'Solids', 'tag.stripe': 'Stripes', 'tag.on8': 'On the 8-ball',
    'tag.fouls': 'Consecutive fouls {n}', 'tag.brk': 'Break {n}', 'tag.target': 'On: {t}', 'tag.free': 'Free ball', 'tag.warn': ' ⚠ next miss loses',
    'hud.anyGroup': 'Solids or stripes — your choice', 'hud.target': 'Target ball', 'hud.reds': 'Reds remaining',
  };

  BP.LANGS = { zh, en };
  let stored = null;
  try {
    stored = localStorage.getItem('bp_lang');
  } catch (e) {}
  BP.lang = stored === 'zh' || stored === 'en' ? stored : /^zh/i.test(navigator.language || '') ? 'zh' : 'en';

  BP.t = function (key, vars) {
    let s = (BP.LANGS[BP.lang] && BP.LANGS[BP.lang][key]) || BP.LANGS.zh[key] || key;
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  };

  // 把带 data-i18n* 的元素刷新成当前语言
  BP.applyI18n = function () {
    document.documentElement.lang = BP.lang === 'zh' ? 'zh-CN' : 'en';
    document.title = BP.t('title');
    document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = BP.t(el.dataset.i18n)));
    document.querySelectorAll('[data-i18n-html]').forEach((el) => (el.innerHTML = BP.t(el.dataset.i18nHtml)));
    document.querySelectorAll('[data-i18n-title]').forEach((el) => (el.title = BP.t(el.dataset.i18nTitle)));
    document.querySelectorAll('[data-lang]').forEach((el) => el.classList.toggle('on', el.dataset.lang === BP.lang));
  };

  BP.setLang = function (l) {
    BP.lang = l;
    try {
      localStorage.setItem('bp_lang', l);
    } catch (e) {}
    BP.applyI18n();
    window.dispatchEvent(new Event('langchange'));
  };
})(window.BP);
