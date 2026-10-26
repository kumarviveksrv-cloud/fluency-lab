/* ============================================
   FLUENCY LAB — STAGE AUDIO
   Procedural room sound for the public speaking simulator.
   Everything is synthesised with WebAudio (no audio files):
   crowd babble, applause, coughs, chairs, phones, doors,
   plus a host voice via speechSynthesis.
   Stylised rather than recorded, but a hall reverb ties it together.
   ============================================ */

class StageAudio {
  constructor() {
    this.ctx = null;
    this.level = 0;            // crowd chatter 0..1
    this.muted = false;
    this._timer = null;
    this._applauseCache = {};
  }

  // Must be called from a user gesture
  async init() {
    if (this.ctx) { await this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    const c = this.ctx;

    this.master = c.createGain();
    this.master.gain.value = 0.9;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.ratio.value = 4;
    this.master.connect(this.comp).connect(c.destination);

    // Event bus: dry + hall reverb
    this.bus = c.createGain();
    this.dry = c.createGain(); this.dry.gain.value = 1;
    this.wet = c.createGain(); this.wet.gain.value = 0.32;
    this.verb = c.createConvolver();
    this.verb.buffer = this._impulse(1.9, 2.4);
    this.bus.connect(this.dry).connect(this.master);
    this.bus.connect(this.verb).connect(this.wet).connect(this.master);

    // Shared white noise
    const n = c.sampleRate * 2;
    this.noise = c.createBuffer(1, n, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;

    this._startRoomTone();
    await c.resume();
  }

  _impulse(seconds, decay) {
    const c = this.ctx, n = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        lp += ((Math.random() * 2 - 1) - lp) * 0.35;      // soften highs like a real hall
        d[i] = lp * Math.pow(1 - t, decay);
      }
    }
    return buf;
  }

  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.9; }

  // ─── Continuous room: HVAC tone + babble ───
  _startRoomTone() {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise; src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160;
    this.toneGain = c.createGain(); this.toneGain.gain.value = 0.05;
    src.connect(lp).connect(this.toneGain).connect(this.master);
    src.start();
    this._schedule();
  }

  // 0 = hushed hall, 0.15 = quiet attentive room, 0.6 = pre-show chatter, 1 = loud
  setCrowdLevel(l) { this.level = Math.max(0, Math.min(1, l)); }

  _schedule() {
    const tick = () => {
      if (!this.ctx) return;
      const l = this.level;
      // number of babble bursts this tick (every 70 ms)
      const n = l < 0.03 ? 0 : Math.random() < l * 1.6 ? 1 + (l > 0.5 ? 1 : 0) + (l > 0.85 ? 1 : 0) : 0;
      for (let i = 0; i < n; i++) this._babble(0.02 + l * 0.07);
      this._timer = setTimeout(tick, 70);
    };
    tick();
  }

  _babble(peak) {
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.value = 260 + Math.random() * 900; f.Q.value = 3 + Math.random() * 5;
    const g = c.createGain();
    const dur = 0.12 + Math.random() * 0.45;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak * (0.4 + Math.random() * 0.6), t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = c.createStereoPanner(); p.pan.value = Math.random() * 2 - 1;
    s.connect(f).connect(g).connect(p).connect(this.bus);
    s.start(t, Math.random() * 1.5, dur + 0.05);
  }

  // ─── Helpers ───
  _src(t, offset = 0, dur = 1) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noise;
    s.start(t, offset, dur); return s;
  }
  _env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  _pan(pan) { const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan || 0)); return p; }

  // ─── Applause ───
  _applauseBuffer(seconds) {
    const key = Math.round(seconds);
    if (this._applauseCache[key]) return this._applauseCache[key];
    const c = this.ctx, sr = 24000, n = Math.floor(sr * key);
    const buf = c.createBuffer(2, n, sr);
    // click templates: short decaying noise, high-passed
    const tpl = [];
    for (let k = 0; k < 10; k++) {
      const len = 160 + Math.floor(Math.random() * 260);
      const a = new Float32Array(len); let prev = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        a[i] = (w - prev * 0.6) * Math.exp(-i / (len * 0.22));
        prev = w;
      }
      tpl.push(a);
    }
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < n; i++) {                       // low roar of many hands
        const t = i / n;
        const env = Math.min(1, t * key / 0.9) * (t > 0.7 ? Math.max(0, (1 - t) / 0.3) : 1);
        lp += ((Math.random() * 2 - 1) - lp) * 0.12;
        d[i] = lp * 0.22 * env;
      }
      const clapsPerSec = 260;
      const total = Math.floor(key * clapsPerSec);
      for (let k = 0; k < total; k++) {
        const pos = Math.floor(Math.random() * n), t = pos / n;
        const env = Math.min(1, t * key / 0.9) * (t > 0.7 ? Math.max(0, (1 - t) / 0.3) : 1);
        if (Math.random() > env) continue;
        const T = tpl[Math.floor(Math.random() * tpl.length)];
        const amp = (0.25 + Math.random() * 0.75) * 0.55 * env;
        for (let i = 0; i < T.length && pos + i < n; i++) d[pos + i] += T[i] * amp;
      }
    }
    this._applauseCache[key] = buf;
    return buf;
  }

  applause(seconds = 6, gain = 0.9) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this._applauseBuffer(seconds);
    const g = c.createGain(); g.gain.value = gain;
    s.connect(g).connect(this.bus);
    s.start(t);
  }

  // ─── Small events ───
  cough(pan = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime;
    const bursts = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < bursts; i++) {
      const t = t0 + i * (0.16 + Math.random() * 0.05);
      const s = this._src(t, Math.random() * 1.5, 0.2);
      const f = c.createBiquadFilter(); f.type = 'bandpass';
      f.frequency.setValueAtTime(1100 + Math.random() * 300, t);
      f.frequency.exponentialRampToValueAtTime(600, t + 0.12); f.Q.value = 1.3;
      const g = c.createGain(); this._env(g, t, 0.008, 0.45, 0.12);
      s.connect(f).connect(g).connect(this._pan(pan)).connect(this.bus);
      const o = c.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.1);
      const og = c.createGain(); this._env(og, t, 0.01, 0.12, 0.1);
      o.connect(og).connect(this._pan(pan)).connect(this.bus);
      o.start(t); o.stop(t + 0.15);
    }
  }

  throatClear(pan = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, t); o.frequency.linearRampToValueAtTime(92, t + 0.5);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5;
    f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(950, t + 0.2);
    f.frequency.linearRampToValueAtTime(600, t + 0.5);
    const g = c.createGain(); this._env(g, t, 0.06, 0.3, 0.42);
    o.connect(f).connect(g).connect(this._pan(pan)).connect(this.bus);
    o.start(t); o.stop(t + 0.6);
    const s = this._src(t, 0.3, 0.5);
    const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1400; nf.Q.value = 0.8;
    const ng = c.createGain(); this._env(ng, t, 0.05, 0.1, 0.4);
    s.connect(nf).connect(ng).connect(this._pan(pan)).connect(this.bus);
  }

  chair(pan = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const s = this._src(t, Math.random(), 0.7);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 5;
    f.frequency.setValueAtTime(1300, t); f.frequency.exponentialRampToValueAtTime(380, t + 0.55);
    const g = c.createGain(); this._env(g, t, 0.03, 0.22, 0.5);
    const lfo = c.createOscillator(); lfo.frequency.value = 38;
    const lg = c.createGain(); lg.gain.value = 0.12;
    lfo.connect(lg).connect(g.gain);
    s.connect(f).connect(g).connect(this._pan(pan)).connect(this.bus);
    lfo.start(t); lfo.stop(t + 0.7);
  }

  phoneBuzz(pan = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = t0 + i * 0.42;
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 165;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
      const g = c.createGain(); this._env(g, t, 0.02, 0.2, 0.3);
      const am = c.createOscillator(); am.frequency.value = 28;
      const ag = c.createGain(); ag.gain.value = 0.08;
      am.connect(ag).connect(g.gain);
      o.connect(lp).connect(g).connect(this._pan(pan)).connect(this.bus);
      o.start(t); o.stop(t + 0.4); am.start(t); am.stop(t + 0.4);
    }
  }

  phoneRing(pan = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime;
    for (let i = 0; i < 6; i++) {
      const t = t0 + i * 0.17;
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.value = i % 2 ? 1175 : 880;
      const g = c.createGain(); this._env(g, t, 0.005, 0.16, 0.12);
      o.connect(g).connect(this._pan(pan)).connect(this.bus);
      o.start(t); o.stop(t + 0.16);
    }
  }

  whisper(pan = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime;
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * (0.14 + Math.random() * 0.1);
      const s = this._src(t, Math.random() * 1.5, 0.25);
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2800 + Math.random() * 1500; f.Q.value = 0.9;
      const g = c.createGain(); this._env(g, t, 0.02, 0.07, 0.1);
      s.connect(f).connect(g).connect(this._pan(pan)).connect(this.bus);
    }
  }

  laugh(strength = 0.5) {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime;
    for (let i = 0; i < 18; i++) {
      const t = t0 + Math.random() * 0.5;
      const s = this._src(t, Math.random() * 1.5, 0.6);
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 450 + Math.random() * 900; f.Q.value = 4;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      for (let k = 0; k < 5; k++) {              // ha-ha-ha pulsing
        const tk = t + k * 0.16;
        g.gain.linearRampToValueAtTime(0.09 * strength, tk + 0.04);
        g.gain.linearRampToValueAtTime(0.01, tk + 0.12);
      }
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      s.connect(f).connect(g).connect(this._pan(Math.random() * 2 - 1)).connect(this.bus);
    }
  }

  door() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(34, t + 0.22);
    const g = c.createGain(); this._env(g, t, 0.005, 0.5, 0.25);
    o.connect(g).connect(this._pan(-0.7)).connect(this.bus); o.start(t); o.stop(t + 0.3);
    const s = this._src(t + 0.02, 0.2, 0.2);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const ng = c.createGain(); this._env(ng, t + 0.02, 0.005, 0.25, 0.15);
    s.connect(lp).connect(ng).connect(this._pan(-0.7)).connect(this.bus);
  }

  footsteps(n = 5) {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime;
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.52;
      const o = c.createOscillator(); o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.06);
      const g = c.createGain(); this._env(g, t, 0.004, 0.16, 0.07);
      o.connect(g).connect(this._pan(-0.5 + i * 0.1)).connect(this.bus); o.start(t); o.stop(t + 0.1);
    }
  }

  // Soft gong to mark "your time starts now"
  gong() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    [[392, 0.25], [588, 0.12], [784, 0.08]].forEach(([f, v]) => {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = c.createGain(); this._env(g, t, 0.01, v, 2.2);
      o.connect(g).connect(this.bus); o.start(t); o.stop(t + 2.4);
    });
  }

  // ─── Host voice ───
  _pickVoice(kind) {
    const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    const en = vs.filter(v => /^en/i.test(v.lang));
    const pref = kind === 'host'
      ? [/male|daniel|rishi|google uk english male|david|james/i, /en-gb|en-in/i]
      : [/female|samantha|google us english|zira|hazel/i, /en-us|en-in/i];
    for (const re of pref) { const v = en.find(x => re.test(x.name + ' ' + x.lang)); if (v) return v; }
    return en[0] || null;
  }

  speak(text, { kind = 'host', pitch, rate } = {}) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window) || this.muted) { resolve(); return; }
      const u = new SpeechSynthesisUtterance(text);
      const v = this._pickVoice(kind);
      if (v) u.voice = v;
      u.lang = (v && v.lang) || 'en-US';
      u.pitch = pitch ?? (kind === 'host' ? 0.85 : 1.1);
      u.rate = rate ?? (kind === 'host' ? 0.95 : 1.0);
      u.volume = 1;
      const guard = setTimeout(resolve, Math.max(4000, text.length * 110));
      u.onend = u.onerror = () => { clearTimeout(guard); resolve(); };
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    });
  }

  stopSpeaking() { try { speechSynthesis.cancel(); } catch {} }

  close() {
    clearTimeout(this._timer);
    this.stopSpeaking();
    try { this.ctx && this.ctx.close(); } catch {}
    this.ctx = null;
  }
}

window.StageAudio = StageAudio;
