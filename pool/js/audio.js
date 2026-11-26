// 桌球音效（纯合成，无外部音频文件）
// 球与球：酚醛树脂球的清脆"咔"——短促的高频瞬态 + 几个快速衰减的共振频率（模态合成），力度越大越响越亮
// 出杆：皮头击球的"嗒"；库边：橡胶闷响；袋角（响袋）：球在袋角来回磕碰的硬"咔哒"；落袋：掉进袋里的闷"咚"+滚动
// 所有声音按碰撞速度变化音量和音色，并按球在台面上的位置做左右声像，再加一点房间混响
(function (BP) {
  'use strict';

  // 从三段录音中切出的样本（录音名, 起点秒, 终点秒, 高通Hz），切点按每一下撞击的起音和衰减位置确定
  const SLICES = {
    hitHard: [['hit03', 0.26, 0.797, 60]], // 4.0k/2.7kHz 清脆重击，余音长
    hitMed: [['hit02', 1.156, 1.5, 150], ['break', 1.662, 1.95, 150]], // 2.1~2.7kHz
    hitSoft: [['hit03', 1.107, 1.33, 150], ['hit03', 1.428, 1.6, 150], ['hit02', 1.504, 1.688, 150]], // 2.7~3.3kHz 轻碰
    breakHit: [['break', 0.865, 1.66, 120], ['hit02', 0.478, 1.15, 60]], // 开球：炸开 + 球堆散开的一串碰撞
    cueHard: [['break', 0.58, 0.86, 40]], // 86Hz 低频"咚" + 1.85kHz
    cue: [['hit03', 0.085, 0.258, 60], ['hit02', 0.398, 0.476, 60]], // 皮头击球 300~800Hz
    cushion: [['break', 1.346, 1.47, 40], ['hit03', 0.796, 0.83, 40]], // <300Hz 的闷响
    jaw: [['break', 2.609, 2.71, 120]], // 相隔 30ms 的"咔-咔"：响袋
    pocket: [['hit03', 0.796, 1.1, 40]], // 三下低沉的"咚咚咚"：落袋
  };

  class Audio {
    constructor() {
      this.ac = null;
      this.muted = false;
      this.lastT = {};
      this.bank = null; // 样本库（加载成功后优先使用录音）
    }
    // 把内嵌的录音解码并切片、归一化
    loadSamples() {
      if (!this._loadP) this._loadP = this._loadSamples();
      return this._loadP;
    }
    async _loadSamples() {
      if (!BP.SOUND_DATA) return;
      this.loading = true;
      try {
        const bufs = {};
        for (const k in BP.SOUND_DATA) {
          const bin = atob(BP.SOUND_DATA[k]);
          const u8 = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
          bufs[k] = await new Promise((res, rej) => this.ac.decodeAudioData(u8.buffer, res, rej));
        }
        const bank = {};
        for (const name in SLICES) {
          bank[name] = SLICES[name].map(([f, s, e, hp]) => {
            const src = bufs[f], sr = src.sampleRate;
            const i0 = Math.floor(s * sr), i1 = Math.min(src.length, Math.floor(e * sr));
            const out = this.ac.createBuffer(1, i1 - i0, sr);
            const o = out.getChannelData(0);
            for (let c = 0; c < src.numberOfChannels; c++) {
              const d = src.getChannelData(c);
              for (let i = 0; i < o.length; i++) o[i] += d[i0 + i] / src.numberOfChannels;
            }
            // 淡入 2ms、淡出 25ms，避免爆音
            const fi = Math.floor(0.002 * sr), fo = Math.min(o.length >> 1, Math.floor(0.025 * sr));
            for (let i = 0; i < fi; i++) o[i] *= i / fi;
            for (let i = 0; i < fo; i++) o[o.length - 1 - i] *= i / fo;
            let pk = 0;
            for (let i = 0; i < o.length; i++) pk = Math.max(pk, Math.abs(o[i]));
            return { buf: out, norm: pk > 0 ? 0.9 / pk : 1, hp };
          });
        }
        this.bank = bank;
      } catch (e) {
        console.warn('Failed to load sound samples, falling back to synthesized sounds', e);
      }
      this.loading = false;
    }
    // 播放一个样本：gain 音量，rate 变速（音高），bright 0..1 越小越闷（软击球高频少）
    sample(name, gain, rate, pan, bright = 1, wet = 0.4, delay = 0) {
      const list = this.bank && this.bank[name];
      if (!list) return false;
      const s = list[(Math.random() * list.length) | 0];
      const ac = this.ac, t = ac.currentTime + 0.003 + delay;
      const src = ac.createBufferSource();
      src.buffer = s.buf;
      src.playbackRate.value = rate;
      const hp = ac.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = s.hp;
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2200 + 18000 * Math.pow(bright, 1.5);
      const g = ac.createGain();
      g.gain.value = gain * s.norm;
      src.connect(hp).connect(lp).connect(g).connect(this.out(pan, wet));
      src.start(t);
      return true;
    }
    ensure(ctx) {
      if (!this.ac) {
        const A = window.AudioContext || window.webkitAudioContext;
        if (!A && !ctx) return;
        const ac = (this.ac = ctx || new A());
        this.master = ac.createGain();
        this.master.gain.value = 0.9;
        const comp = ac.createDynamicsCompressor();
        comp.threshold.value = -10;
        comp.ratio.value = 4;
        this.master.connect(comp).connect(ac.destination);
        // 房间混响（短）
        this.rev = ac.createConvolver();
        this.rev.buffer = this.makeIR(0.55, 3.2);
        this.revIn = ac.createGain();
        this.revIn.gain.value = 0.16;
        this.revIn.connect(this.rev).connect(this.master);
        this.noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.revIn.gain.value = 0.08; // 录音本身已带房间声，混响减少
        this.loadSamples();
      }
      if (this.ac.state === 'suspended' && !(window.OfflineAudioContext && this.ac instanceof OfflineAudioContext)) this.ac.resume();
    }
    makeIR(sec, decay) {
      const ac = this.ac, n = Math.floor(ac.sampleRate * sec);
      const b = ac.createBuffer(2, n, ac.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = b.getChannelData(c);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay) * (i < 90 ? i / 90 : 1);
      }
      return b;
    }
    // 输出链：声像 → 主输出 + 混响
    out(pan, wet = 1) {
      const ac = this.ac;
      const g = ac.createGain();
      let node = g;
      if (ac.createStereoPanner) {
        const p = ac.createStereoPanner();
        p.pan.value = Math.max(-0.85, Math.min(0.85, pan || 0));
        g.connect(p);
        node = p;
      }
      node.connect(this.master);
      if (wet) {
        const w = ac.createGain();
        w.gain.value = wet;
        node.connect(w).connect(this.revIn);
      }
      return g;
    }
    // 衰减正弦（一个共振模态）
    mode(dest, t, f, amp, decay, attack = 0.0006) {
      const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + decay + 0.02);
    }
    // 滤波噪声瞬态
    burst(dest, t, dur, amp, type, freq, q = 0.8, f2) {
      t = Math.max(t, this.ac.currentTime);
      const ac = this.ac, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = this.noiseBuf;
      f.type = type;
      f.frequency.setValueAtTime(freq, t);
      if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
      f.Q.value = q;
      g.gain.setValueAtTime(amp, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(dest);
      s.start(t, Math.random() * 0.8);
      s.stop(t + dur + 0.02);
    }
    gate(key, ms) {
      const now = performance.now();
      if (this.lastT[key] && now - this.lastT[key] < ms) return false;
      this.lastT[key] = now;
      return true;
    }
    ok() {
      return this.ac && !this.muted;
    }

    // 球撞球：v = 法向相对速度 (m/s)
    ball(v, pan, size = 1) {
      if (!this.ok() || v < 0.02 || !this.gate('b' + Math.round(pan * 20), 12)) return;
      const t = this.ac.currentTime + 0.002;
      const k = Math.min(1, Math.pow(v / 5, 0.75)); // 力度 0..1
      if (this.bank) {
        const rate = (0.95 + Math.random() * 0.08 + 0.05 * k) * size;
        // 开球：母球全力撞进球堆，播放整段"炸开"录音，随后 0.35 秒内的大力碰撞由这段录音覆盖
        if (v > 5.2 && this.gate('break', 1500)) {
          this.sample('breakHit', 1.0, rate * 0.98, pan, 1, 0.25);
          return;
        }
        if (this.lastT.break && performance.now() - this.lastT.break < 350 && v > 1.0) return;
        const name = k > 0.62 ? 'hitHard' : k > 0.28 ? 'hitMed' : 'hitSoft';
        this.sample(name, 0.05 + 0.95 * Math.pow(k, 1.1), rate, pan, 0.35 + 0.65 * k, 0.3);
        return;
      }
      const amp = 0.05 + 0.95 * k;
      const d = this.out(pan, 0.7);
      const det = 1 + (Math.random() - 0.5) * 0.05;
      const f0 = 3150 * det / size;
      // 冲击瞬态：越用力越"亮"
      this.burst(d, t, 0.006 + 0.004 * k, 0.9 * amp, 'highpass', 1800 + 2500 * k, 0.7);
      // 球体共振（非谐波，快速衰减）
      this.mode(d, t, f0, 0.55 * amp, 0.045 + 0.03 * k);
      this.mode(d, t, f0 * 1.58, 0.32 * amp * (0.5 + k), 0.03 + 0.02 * k);
      this.mode(d, t, f0 * 2.31, 0.18 * amp * k, 0.02 + 0.015 * k);
      this.mode(d, t, f0 * 0.52, 0.12 * amp, 0.03);
    }
    // 出杆：p = 力度 0..1，spin = 杆法偏移量
    cue(p, spin = 0, pan = 0) {
      if (!this.ok()) return;
      const t = this.ac.currentTime + 0.002;
      const k = Math.min(1, 0.15 + p);
      if (this.sample(p > 0.7 ? 'cueHard' : 'cue', 0.12 + 0.88 * p, 0.97 + 0.06 * p + (Math.random() - 0.5) * 0.03, pan, 0.5 + 0.5 * p, 0.25)) return;
      const d = this.out(pan, 0.5);
      // 皮头压缩的闷"嗒"
      this.burst(d, t, 0.028 + 0.02 * k, 0.8 * k, 'bandpass', 1100 + 900 * k, 1.1, 500);
      this.mode(d, t, 820 + 300 * k, 0.35 * k, 0.05);
      // 母球被击中的轻"咔"
      this.mode(d, t + 0.001, 2900, 0.22 * k * (1 + spin * 0.4), 0.035);
      this.burst(d, t, 0.005, 0.5 * k, 'highpass', 3500, 0.7);
      // 大力出杆有杆身擦过手架的"嗖"
      if (p > 0.6) this.burst(d, t - 0.06, 0.08, 0.08 * (p - 0.6) * 2.5, 'bandpass', 2400, 0.6, 5000);
    }
    // 库边：v 法向速度；jaw=true 表示撞在袋角上（响袋）
    cushion(v, pan, jaw, kind) {
      if (!this.ok() || v < 0.04 || !this.gate((jaw ? 'j' : 'c') + Math.round(pan * 10), 30)) return;
      const t = this.ac.currentTime + 0.002;
      const k = Math.min(1, Math.pow(v / 4, 0.8));
      if (this.bank) {
        if (jaw) this.sample('jaw', 0.15 + 0.85 * k, 0.96 + Math.random() * 0.08 + 0.04 * k, pan, 0.5 + 0.5 * k, 0.3);
        else this.sample('cushion', 0.1 + 0.9 * k, 0.94 + Math.random() * 0.1, pan, 0.6 + 0.4 * k, 0.3);
        return;
      }
      const d = this.out(pan, 0.6);
      if (jaw) {
        // 响袋：硬朗的"咔哒"——袋角木衬/铁袋口受撞，频率更高、更响
        const metal = kind === 'snooker' || kind === 'cn';
        this.burst(d, t, 0.012, 0.9 * k, 'bandpass', metal ? 2600 : 1500, 1.4);
        this.mode(d, t, metal ? 1850 : 1150, 0.5 * k, metal ? 0.09 : 0.05);
        this.mode(d, t, metal ? 3300 : 2100, 0.25 * k, 0.04);
        this.mode(d, t, 240, 0.35 * k, 0.07);
      } else {
        // 普通库边：橡胶 + 木框的闷响
        this.burst(d, t, 0.05, 0.55 * k, 'lowpass', 900 + 900 * k, 0.7, 300);
        this.mode(d, t, 130 + 40 * k, 0.55 * k, 0.09);
        this.mode(d, t, 380, 0.15 * k, 0.05);
      }
    }
    // 落袋：v 进袋速度
    pot(v, pan, kind) {
      if (!this.ok()) return;
      const t = this.ac.currentTime + 0.01;
      const k = Math.min(1, 0.25 + Math.pow(v / 3, 0.8));
      if (this.sample('pocket', 0.12 + 0.5 * k, 0.95 + Math.random() * 0.08, pan, 0.7 + 0.3 * k, 0.35, 0.03)) return;
      const d = this.out(pan, 0.8);
      const net = kind === 'snooker' || kind === 'cn';
      // 掉下去撞到袋底
      this.mode(d, t + 0.05, net ? 150 : 110, 0.6 * k, 0.16);
      this.burst(d, t + 0.05, 0.09, 0.5 * k, 'lowpass', net ? 700 : 450, 0.8, 150);
      // 在袋里滚动/和别的球相碰
      const n = net ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const dt = 0.14 + i * (0.09 + Math.random() * 0.05);
        this.burst(d, t + dt, 0.05, 0.22 * k / (i + 1), 'bandpass', 500 + Math.random() * 300, 1, 250);
        if (net) this.mode(d, t + dt, 2600 + Math.random() * 400, 0.06 * k / (i + 1), 0.03);
      }
    }
    foul() {
      if (!this.ok()) return;
      const t = this.ac.currentTime, d = this.out(0, 0.2);
      this.mode(d, t, 330, 0.18, 0.25);
      this.mode(d, t + 0.14, 220, 0.18, 0.3);
    }
    win() {
      if (!this.ok()) return;
      const t = this.ac.currentTime, d = this.out(0, 0.5);
      [523, 659, 784, 1047].forEach((f, i) => this.mode(d, t + i * 0.11, f, 0.14, 0.4, 0.01));
    }
  }
  BP.Audio = Audio;
})(window.BP);
