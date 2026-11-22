/* leaderboard.js — WarmJam 主页小游戏共享排行榜
 * 远程存储用 npoint.io bin（免登录、CORS 开放），所有访客共用一份榜单；
 * 远程不可用时自动降级为本机 localStorage 纪录。
 * 用法：
 *   var board = WJBoard.create({ binUrl: 'https://api.npoint.io/xxxx', localKey: 'wj_board_snake' });
 *   board.load().then(function(res){ board.render(el, res.list, res.remote); });
 *   board.submit({name, score, diff}).then(function(r){ r.rank /* -1=未上榜 *\/ });
 */
(function (global) {
  'use strict';

  var MAX_ENTRIES = 10;

  function getPid() {
    var pid = null;
    try { pid = localStorage.getItem('wj_pid'); } catch (e) {}
    if (!pid) {
      var chars = 'abcdefghjkmnpqrstuvwxyz23456789';
      pid = '';
      for (var i = 0; i < 6; i++) pid += chars.charAt(Math.floor(Math.random() * chars.length));
      try { localStorage.setItem('wj_pid', pid); } catch (e) {}
    }
    return pid;
  }

  function getName() {
    try { return localStorage.getItem('wj_name') || ''; } catch (e) { return ''; }
  }

  function deviceLabel() {
    var ua = navigator.userAgent || '';
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua)) return 'iPad';
    if (/iPod/i.test(ua)) return 'iPod';
    if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'Android 手机' : 'Android 平板';
    if (/Windows/i.test(ua)) return 'Windows 电脑';
    if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac 电脑';
    if (/Linux/i.test(ua)) return 'Linux 电脑';
    return '未知设备';
  }

  function cleanStr(s, max) {
    s = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, '').trim();
    if (s.length > max) s = s.slice(0, max);
    return s;
  }

  function roundScore(s, decimals) {
    var n = Number(s);
    if (!Number.isFinite(n) || n < 0) return 0;
    var f = Math.pow(10, decimals);
    return Math.round(n * f) / f;
  }
  function fetchTimeout(url, opts, ms) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var tid = ctrl ? setTimeout(function () { ctrl.abort(); }, ms || 8000) : null;
    var o = Object.assign({}, opts || {});
    if (ctrl) o.signal = ctrl.signal;
    return fetch(url, o).finally(function () { if (tid) clearTimeout(tid); });
  }
  function cmpScore(a, b, lowerBetter) {
    return lowerBetter ? (a.score - b.score) : (b.score - a.score);
  }
  function fmtScore(s, decimals) {
    return decimals ? Number(s).toFixed(decimals) : String(s);
  }

  function sanitize(list, lowerBetter, decimals) {
    if (!Array.isArray(list)) return [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e || typeof e !== 'object') continue;
      var score = Number(e.score);
      if (!Number.isFinite(score) || score < 0 || score > 99999999) continue;
      if (lowerBetter && score <= 0) continue;
      out.push({
        pid: cleanStr(e.pid, 12) || '?',
        name: cleanStr(e.name, 16),
        device: cleanStr(e.device, 16) || '未知设备',
        score: roundScore(e.score, decimals),
        diff: Math.max(1, Math.min(10, parseInt(e.diff, 10) || 1)),
        date: cleanStr(e.date, 24)
      });
    }
    out.sort(function (a, b) { return cmpScore(a, b, lowerBetter); });
    return out.slice(0, MAX_ENTRIES);
  }

  function loadLocal(key, lowerBetter, decimals) {
    try {
      var arr = JSON.parse(localStorage.getItem(key));
      return sanitize(arr, lowerBetter, decimals);
    } catch (e) { return []; }
  }

  function saveLocal(key, list) {
    try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) {}
  }

  function create(opts) {
    // lowerBetter: 分数越小越好（如反应速度）；decimals: 分数小数位；scoreLabel: 榜单表头
    var lowerBetter = !!opts.lowerBetter;
    var decimals = Math.max(0, Math.min(3, parseInt(opts.decimals, 10) || 0));
    var scoreLabel = opts.scoreLabel || '分数';
    var hideDiff = !!opts.hideDiff; // 无难度设定的游戏隐藏"难度"列
    var api = {
      binUrl: opts.binUrl,
      localKey: opts.localKey || 'wj_board_local',
      pid: getPid(),
      device: deviceLabel(),
      getName: getName,
      saveName: function (n) {
        try { localStorage.setItem('wj_name', cleanStr(n, 16)); } catch (e) {}
      },

      _submitting: false,
      load: function () {
        var self = this;
        return fetchTimeout(self.binUrl, { cache: 'no-store' }, 8000).then(function (r) {
          if (!r.ok) throw new Error('http ' + r.status);
          return r.json();
        }).then(function (data) {
          return { list: sanitize(data, lowerBetter, decimals), remote: true };
        }).catch(function () {
          return { list: loadLocal(self.localKey, lowerBetter, decimals), remote: false };
        });
      },

      submit: function (entry) {
        var self = this;
        if (self._submitting) return Promise.reject(new Error('busy'));
        var rawScore = Number(entry.score);
        if (!Number.isFinite(rawScore) || rawScore < 0 || (lowerBetter && rawScore <= 0)) {
          return Promise.reject(new Error('invalid score'));
        }
        self._submitting = true;
        var item = {
          pid: self.pid,
          name: cleanStr(entry.name, 16) || self.pid,
          device: self.device,
          score: roundScore(entry.score, decimals),
          diff: Math.max(1, Math.min(10, parseInt(entry.diff, 10) || 1)),
          date: new Date().toISOString().slice(0, 19).replace('T', ' ')
        };
        return self.load().then(function (res) {
          var list = res.list.slice();
          list.push(item);
          list.sort(function (a, b) { return cmpScore(a, b, lowerBetter); });
          list = list.slice(0, MAX_ENTRIES);
          var rank = -1;
          for (var i = 0; i < list.length; i++) {
            if (list[i] === item) { rank = i; break; }
          }
          var finish = function (okRemote) {
            if (!okRemote) saveLocal(self.localKey, list);
            return { rank: rank, remote: okRemote, list: list };
          };
          if (res.remote) {
            return fetchTimeout(self.binUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(list)
            }, 8000).then(function (r) {
              if (!r.ok) throw new Error('http ' + r.status);
              return finish(true);
            }).catch(function () {
              return finish(false);
            });
          }
          return finish(false);
        }).finally(function () { self._submitting = false; });
      },

      // 渲染榜单（全部用 textContent，防止 XSS）
      render: function (container, list, remote) {
        while (container.firstChild) container.removeChild(container.firstChild);
        if (!list.length) {
          var p = document.createElement('p');
          p.className = 'empty';
          p.textContent = '还没有人上榜，快来当第一个！';
          container.appendChild(p);
        } else {
          var medals = ['🥇', '🥈', '🥉'];
          var table = document.createElement('table');
          table.className = 'board';
          var head = document.createElement('tr');
          var headers = ['名次', '玩家', '设备', scoreLabel];
          if (!hideDiff) headers.push('难度');
          headers.push('日期');
          headers.forEach(function (t) {
            var th = document.createElement('th');
            th.textContent = t;
            head.appendChild(th);
          });
          table.appendChild(head);
          list.forEach(function (e, i) {
            var tr = document.createElement('tr');
            if (e.pid === api.pid) tr.className = 'me';
            var cells = [
              medals[i] || ('第' + (i + 1) + '名'),
              e.name || e.pid,
              e.device,
              fmtScore(e.score, decimals),
              (e.date || '').slice(0, 10)
            ];
            if (!hideDiff) cells.splice(4, 0, 'Lv.' + e.diff);
            cells.forEach(function (c) {
              var td = document.createElement('td');
              td.textContent = c;
              tr.appendChild(td);
            });
            table.appendChild(tr);
          });
          container.appendChild(table);
        }
        var note = document.createElement('p');
        note.className = 'hint';
        note.textContent = remote
          ? '🏆 全站玩家共享榜单 · 只保留历史最高 10 条 · 你的设备识别码：' + api.pid
          : '⚠️ 排行榜服务器连接失败，当前显示的是本机离线纪录（仅自己可见）。';
        container.appendChild(note);
      }
    };
    return api;
  }

  global.WJBoard = { create: create, MAX: MAX_ENTRIES };
})(window);
