/* Fluency Lab StageScene
   Pure Canvas 2D, zero dependencies. First-person public speaking scene:
   a hall of ~100 seated people seen from behind a lectern.
   window.StageScene(canvas, {mood, seed}) */
(function (global) {
'use strict';

var ROWS = [20, 18, 16, 14, 12, 11, 9];      // index 0 = back row, 6 = front row
var NR = 7;
var EMPTY_ROWS = [2, 4, 5];                  // right-edge seat empty at start (97 seated)
var ST = { IDLE: 0, ATTN: 1, NOD: 2, PHONE: 3, WHISPER: 4, LOOK: 5, COUGH: 6, CLAP: 7, LAUGH: 8, STRETCH: 9, HAND: 10, RING: 11 };
var SKIN = ['#f2cfb0', '#e6b896', '#d09f78', '#b57d55', '#8f5c3b', '#6b4129'];
var HAIRC = ['#111012', '#1c1410', '#2e2018', '#4a3020', '#6b3a22', '#a9783f', '#d3b36a', '#8e8b88', '#c9c6c2'];
var SHIRT = ['#3b4a63', '#5a2f3a', '#2f4a43', '#4b4458', '#6b5a45', '#2b2f3a', '#7a7f8c', '#8a4b3c', '#35506b', '#3f3f45', '#6c3f5e', '#506a4a'];
var TAU = Math.PI * 2;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function mk(w, h) {
  var c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}
function rgb(hex) {
  var n = parseInt(hex.slice(1), 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}
function shade(hex, f) {
  var c = rgb(hex);
  return 'rgb(' + clamp(Math.round(c[0] * f), 0, 255) + ',' + clamp(Math.round(c[1] * f), 0, 255) + ',' + clamp(Math.round(c[2] * f), 0, 255) + ')';
}
function mixc(h1, h2, t) {
  var a = rgb(h1), b = rgb(h2);
  return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')';
}
function fogShade(hex, f, a) {
  var c = rgb(hex), F = [13, 11, 24];
  return 'rgb(' + Math.round(clamp(c[0] * f, 0, 255) * (1 - a) + F[0] * a) + ',' + Math.round(clamp(c[1] * f, 0, 255) * (1 - a) + F[1] * a) + ',' + Math.round(clamp(c[2] * f, 0, 255) * (1 - a) + F[2] * a) + ')';
}
function fogOver(c, a) {
  if (a <= 0.003) return;
  var g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(13,11,24,' + a.toFixed(3) + ')'; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = 'source-over';
}
function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function fmt(sec) {
  sec = Math.max(0, Math.round(sec));
  return pad2(Math.floor(sec / 60)) + ':' + pad2(sec % 60);
}
function glowSprite(r, g, b, size) {
  var c = mk(size, size), x = c.getContext('2d');
  var gr = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',1)');
  gr.addColorStop(0.25, 'rgba(' + r + ',' + g + ',' + b + ',0.45)');
  gr.addColorStop(0.6, 'rgba(' + r + ',' + g + ',' + b + ',0.1)');
  gr.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
  x.fillStyle = gr; x.fillRect(0, 0, size, size);
  return c;
}
function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

var MODES = {
  prep:     { house: 1.0,  spot: 0.0,  chat: 1.0 },
  intro:    { house: 0.38, spot: 0.55, chat: 0.35 },
  talk:     { house: 0.12, spot: 1.0,  chat: 0.0 },
  applause: { house: 0.6,  spot: 0.8,  chat: 0.0 },
  qa:       { house: 0.42, spot: 0.6,  chat: 0.1 }
};

function StageScene(canvas, opts) {
  opts = opts || {};
  this.cv = canvas;
  this.ctx = canvas.getContext('2d');
  this.mood = opts.mood || 'neutral';
  this.seed = ((opts.seed == null ? Math.floor(Math.random() * 1e9) : opts.seed) >>> 0);
  this.rnd = mulberry32(this.seed + 7919);
  this.t = 0; this.running = false; this.raf = 0; this.last = 0;
  this.att = 0.6; this.attT = 0.6; this.voice = 0; this.voiceT = 0;
  this.mode = 'prep';
  this.L = { house: 1, spot: 0, chat: 1 };
  this.LT = { house: 1, spot: 0, chat: 1 };
  this.mon = { elapsed: 0, total: 0, label: '', state: 'ok', topic: '' };
  this._monKey = ''; this._monC = null;
  this.door = 0; this.doorHold = 0;
  this.walkers = []; this.clapping = false; this.ovation = false;
  this._ms = 0; this._fps = 60; this._nf = 0;
  this._bound = this._loop.bind(this);
  this._gl = { x: [], y: [], r: [], a: [], n: 0 };
  this._w = new Array(12);
  this.photo = (StageScene.PHOTOS && StageScene.PHOTOS.base) ? StageScene.PHOTOS : null;
  this.pw = { base: 1, bored: 0, engaged: 0, applause: 0 };
  this.patches = []; this.glows = []; this._amb = 1.5; this._flash = 0;
  this._buildPeople();
  this._motes = [];
  var mr = mulberry32(this.seed + 31);
  for (var i = 0; i < 46; i++) this._motes.push({ x: mr(), y: mr(), s: 0.02 + mr() * 0.05, p: mr() * TAU, a: 0.25 + mr() * 0.6 });
  var w = canvas.clientWidth || (canvas.width && canvas.width / (global.devicePixelRatio || 1)) || 800;
  var h = canvas.clientHeight || (canvas.height && canvas.height / (global.devicePixelRatio || 1)) || 360;
  this.resize(w, h, global.devicePixelRatio || 1);
  this.L.house = 1; this.L.spot = 0; this.L.chat = 1;
}
var P = StageScene.prototype;

P._buildPeople = function () {
  var rn = mulberry32(this.seed), rt = mulberry32(this.seed + 555), i, c, n, p;
  this.ppl = []; this.rowP = [];
  for (i = 0; i < NR; i++) {
    n = ROWS[i]; this.rowP[i] = [];
    for (c = 0; c < n; c++) {
      var longHair = rn() < 0.42;
      p = {
        row: i, col: c, n: n, idx: this.ppl.length,
        empty: (EMPTY_ROWS.indexOf(i) >= 0 && c === n - 1),
        skin: SKIN[Math.floor(Math.pow(rn(), 1.3) * SKIN.length)],
        hair: HAIRC[Math.floor(rn() * HAIRC.length)],
        shirt: SHIRT[Math.floor(rn() * SHIRT.length)],
        hstyle: longHair ? (rn() < 0.7 ? 2 : 3) : [0, 0, 0, 1, 4, 5][Math.floor(rn() * 6)],
        glasses: rn() < 0.2, beard: !longHair && rn() < 0.16,
        hs: 0.94 + rn() * 0.12, bf: longHair ? 0.9 + rn() * 0.08 : 0.98 + rn() * 0.12,
        jx: (rn() - 0.5) * 0.36, jy: (rn() - 0.5) * 0.24,
        ph: rn() * TAU, attB: (rn() - 0.5) * 0.3, armsR: rn(), dir: rn() < 0.5 ? -1 : 1,
        st: ST.IDLE, tIn: 0, dur: 0.5 + rn() * 3, pend: -1, pendT: 0, pdur: 0, partner: -1,
        stand: 0, standT: 0, walk: false, wk: null,
        pdx: 0, pdy: 0, prot: 0, pbd: 0, psc: 1, arm: 0, hand: 0,
        x: 0, y: 0, r: 8, sx: 0, fogA: 1 - Math.pow(1 - 0.055, 6 - i)
      };
      p.fw = 0.9 + rt() * 0.2; p.jaw = rt(); p.chin = rt(); p.noseW = 0.85 + rt() * 0.4;
      p.eyeCol = ['#2a1a10', '#3a2414', '#4a3220', '#5a4a2c', '#3c4a4a', '#2a3a4a'][Math.floor(Math.pow(rt(), 2.4) * 6)];
      p.smile = -0.1 + rt() * 0.55; p.browT = 0.7 + rt() * 0.9; p.browA = rt(); p.age = rt(); p.cloth = Math.floor(rt() * 4);
      p.hairLight = ['#d3b36a', '#8e8b88', '#c9c6c2', '#a9783f'].indexOf(p.hair) >= 0; p.pale = rt() < 0.5;
      p.tie = (p.cloth === 2 && rt() < 0.5) ? ['#7a1f2b', '#1f3a6b', '#2b2b33', '#5a3a1f'][Math.floor(rt() * 4)] : null;
      p.scarf = null;
      if (longHair && rt() < 0.1) { p.hstyle = 6; p.beard = false; p.cloth = 0; p.scarf = ['#7a3a4a', '#2f5a63', '#6b5a8a', '#8a6a3a', '#e6e1d6', '#2b2f3a'][Math.floor(rt() * 6)]; }
      this.ppl.push(p); this.rowP[i].push(p);
    }
  }
};

P._geo = function () {
  var W = this.W, H = this.H, i, c;
  this.hy = 0.285 * H; this.K = 0.25 * H;
  this.rowY = []; this.rowR = []; this.rowS = []; this.pitch = []; this.aisle = []; this.nl = [];
  this.L0 = 0.04 * W; this.R0 = 0.93 * W; this.aisleX = 0.965 * W;
  for (i = 0; i < NR; i++) {
    var z = 1 + (6 - i) * 0.28, s = 1 / z;
    this.rowS[i] = s; this.rowY[i] = this.hy + this.K / z - (6 - i) * 0.0125 * H; this.rowR[i] = 0.05 * H * s;
    var n = ROWS[i], a = 0.045 * W * (0.55 + 0.45 * s), pitch = (this.R0 - this.L0 - a) / n;
    this.pitch[i] = pitch; this.aisle[i] = a; this.nl[i] = Math.ceil(n / 2);
    for (c = 0; c < n; c++) {
      var p = this.rowP[i][c];
      p.sx = this.L0 + pitch * (c + 0.5) + (c >= this.nl[i] ? a : 0);
      p.r = this.rowR[i] * p.hs;
      p.x = p.sx + p.jx * p.r; p.y = this.rowY[i] + p.jy * p.r;
    }
  }
};
// head centre y and radius for a fractional row index (used by walkers and the back door)
P._rowAt = function (tf) {
  var z = 1 + (6 - tf) * 0.28, s = 1 / z, H = this.H;
  return { y: this.hy + this.K / z - (6 - tf) * 0.0125 * H, r: 0.05 * H * s };
};

P.resize = function (w, h, dpr) {
  w = Math.max(80, Math.round(w || 800)); h = Math.max(50, Math.round(h || 360));
  dpr = Math.min(dpr || 1, 2);
  if (w * h > 520000 && dpr > 1.5) dpr = 1.5;
  this.W = w; this.H = h; this.d = dpr;
  this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
  if (this.cv.style) { this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px'; }
  this._geo(); this._layers(); this._sprites();
  this._monKey = ''; this._monC = null;
  this.render();
};

/* ---------- static layers ---------- */
P._layers = function () {
  var W = this.W, H = this.H, d = this.d, i, c, g, p;
  this.hallH = Math.ceil(H * 0.74) + 8;
  var fy = 0.43 * H;
  // HALL
  var hc = this.hallC = mk((W + 8) * d, this.hallH * d);
  g = hc.getContext('2d'); g.setTransform(d, 0, 0, d, 4 * d, 4 * d);
  var gw = g.createLinearGradient(0, 0, 0, fy);
  gw.addColorStop(0, '#1f1a25'); gw.addColorStop(1, '#14101a');
  g.fillStyle = gw; g.fillRect(-4, -4, W + 8, fy + 4);
  var pw = W * 0.075, pTop = H * 0.065, pBot = fy - H * 0.06;
  for (var x = -pw; x < W + pw; x += pw) {
    var alt = (Math.round(x / pw) & 1);
    var pg = g.createLinearGradient(0, pTop, 0, pBot);
    pg.addColorStop(0, alt ? '#2d2530' : '#271f2b'); pg.addColorStop(1, alt ? '#201a24' : '#1c1620');
    g.fillStyle = pg; g.fillRect(x + 2, pTop, pw - 4, pBot - pTop);
    g.fillStyle = 'rgba(255,225,190,.06)'; g.fillRect(x + 2, pTop, 1, pBot - pTop);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + pw - 3, pTop, 1.5, pBot - pTop);
  }
  g.fillStyle = '#0b090e'; g.fillRect(-4, -4, W + 8, H * 0.05 + 4);
  g.fillStyle = '#3a2a22'; g.fillRect(-4, H * 0.05, W + 8, 1.5);
  g.fillStyle = 'rgba(255,230,200,.05)'; g.fillRect(-4, H * 0.05 + 1.5, W + 8, 2);
  for (x = 0; x < W; x += W * 0.19) { g.fillStyle = '#100c13'; g.fillRect(x, -4, 4, H * 0.05 + 4); }
  g.fillStyle = '#1a120f'; g.fillRect(-4, pBot, W + 8, fy - pBot);
  g.fillStyle = '#4a3426'; g.fillRect(-4, pBot, W + 8, 1.2);
  g.fillStyle = '#100b0d'; g.fillRect(-4, fy, W + 8, this.hallH);
  // door recess + frame + sign body (dynamic parts drawn later)
  var d0 = this._rowAt(-0.8), dB = d0.y - 2.1 * d0.r + 8.8 * d0.r;
  this.doorR = { x: 0.937 * W, y: 0.085 * H, w: 0.055 * W, h: dB - 0.085 * H };
  var dr = this.doorR;
  g.fillStyle = '#3a2c24'; g.fillRect(dr.x - 2.5, dr.y - 2.5, dr.w + 5, dr.h + 2.5);
  g.fillStyle = '#080606'; g.fillRect(dr.x, dr.y, dr.w, dr.h);
  this.sign = { x: dr.x + dr.w / 2, y: dr.y - H * 0.036, w: Math.max(26, 0.058 * W), h: Math.max(8, 0.032 * H) };
  var sg = this.sign;
  g.fillStyle = '#07130b'; rrect(g, sg.x - sg.w / 2, sg.y - sg.h / 2, sg.w, sg.h, 1.5); g.fill();
  // sconces
  this.sconces = [0.14, 0.37, 0.63, 0.84].map(function (f) { return { x: f * W, y: 0.17 * H }; });
  for (i = 0; i < this.sconces.length; i++) {
    var sc = this.sconces[i];
    g.fillStyle = '#4a3828'; g.fillRect(sc.x - 1.5, sc.y - 4, 3, 9);
    g.fillStyle = '#e8c48a'; g.beginPath(); g.moveTo(sc.x - 4, sc.y - 4); g.lineTo(sc.x + 4, sc.y - 4); g.lineTo(sc.x + 2.5, sc.y + 2); g.lineTo(sc.x - 2.5, sc.y + 2); g.closePath(); g.fill();
  }
  // STRIPS (one per row, painted back to front)
  this.strips = [];
  var rr = mulberry32(this.seed + 99);
  for (i = 0; i < NR; i++) {
    var r = this.rowR[i], y = this.rowY[i];
    var top = Math.floor(y - r * 1.3), bot = Math.ceil(y + r * 3.9);
    var sc2 = mk((W + 8) * d, (bot - top + 8) * d), q = sc2.getContext('2d');
    q.setTransform(d, 0, 0, d, 4 * d, (4 - top) * d);
    var fl = i / 6;
    // aisles
    var ax = this.L0 + this.pitch[i] * this.nl[i];
    var cg = q.createLinearGradient(0, top, 0, bot);
    cg.addColorStop(0, mixc('#3a2c2e', '#5a4444', fl)); cg.addColorStop(1, mixc('#2a1e1f', '#40302f', fl));
    q.fillStyle = cg; q.fillRect(ax, top, this.aisle[i], bot - top);
    q.fillRect(this.R0, top, W + 4 - this.R0, bot - top);
    q.fillStyle = 'rgba(0,0,0,.35)';
    for (var st = 0; st < 3; st++) q.fillRect(this.R0, y + r * (0.2 + st * 1.2), W - this.R0 + 4, 1);
    // seats
    var seatBase = mixc('#33121b', '#70283a', fl);
    for (c = 0; c < ROWS[i]; c++) {
      p = this.rowP[i][c];
      var sw = this.pitch[i] * 0.86, sx = p.sx - sw / 2, sy = y + r * 0.5, sh = r * 3.4;
      var sgd = q.createLinearGradient(0, sy, 0, sy + sh);
      sgd.addColorStop(0, mixc('#4a1a26', '#8a3448', fl)); sgd.addColorStop(0.35, seatBase); sgd.addColorStop(1, mixc('#1c0a10', '#36131c', fl));
      q.fillStyle = sgd; rrect(q, sx, sy, sw, sh, Math.min(sw * 0.2, r * 0.9)); q.fill();
      q.strokeStyle = 'rgba(255,200,200,.12)'; q.lineWidth = 1; q.beginPath(); q.moveTo(sx + r * 0.5, sy + 0.5); q.lineTo(sx + sw - r * 0.5, sy + 0.5); q.stroke();
      q.fillStyle = 'rgba(0,0,0,.3)'; q.fillRect(p.sx + sw / 2 - 0.5, sy + r * 0.3, 1.5, sh);
    }
    // riser shadow + edge light
    var rg = q.createLinearGradient(0, y + r * 2.9, 0, bot);
    rg.addColorStop(0, 'rgba(6,4,6,0)'); rg.addColorStop(1, 'rgba(6,4,6,.85)');
    q.fillStyle = rg; q.fillRect(-4, y + r * 2.9, W + 8, bot - y - r * 2.9);
    q.fillStyle = 'rgba(210,170,140,.10)'; q.fillRect(-4, bot - 1.5, W + 8, 1);
    fogOver(sc2, 1 - Math.pow(1 - 0.055, 6 - i));
    this.strips.push({ c: sc2, top: top });
  }
  fogOver(hc, 0.3);
  // sprites for glows
  this.sp = {
    warm: glowSprite(255, 196, 120, 96), blue: glowSprite(110, 160, 255, 64), green: glowSprite(70, 255, 130, 64),
    white: glowSprite(255, 245, 225, 96), red: glowSprite(255, 70, 60, 64), amber: glowSprite(255, 180, 50, 64)
  };
  // cone
  var cn = mk(64 * 2, 128 * 2), cx = cn.getContext('2d');
  var cg2 = cx.createLinearGradient(0, 0, 0, 256);
  cg2.addColorStop(0, 'rgba(255,232,190,.9)'); cg2.addColorStop(0.5, 'rgba(255,225,180,.28)'); cg2.addColorStop(1, 'rgba(255,220,170,0)');
  cx.fillStyle = cg2; cx.beginPath(); cx.moveTo(52, 0); cx.lineTo(76, 0); cx.lineTo(128, 256); cx.lineTo(0, 256); cx.closePath(); cx.fill();
  cx.globalCompositeOperation = 'destination-in';
  var hg = cx.createLinearGradient(0, 0, 128, 0);
  hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(0.3, 'rgba(0,0,0,1)'); hg.addColorStop(0.7, 'rgba(0,0,0,1)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
  cx.fillStyle = hg; cx.fillRect(0, 0, 128, 256);
  this.sp.cone = cn;
  // exit sign lit (pre-rendered)
  var sw2 = Math.ceil(sg.w * d), sh2 = Math.ceil(sg.h * d), ec = mk(sw2, sh2), ex = ec.getContext('2d');
  ex.setTransform(d, 0, 0, d, 0, 0);
  ex.fillStyle = '#0a2a14'; rrect(ex, 0, 0, sg.w, sg.h, 1.5); ex.fill();
  ex.fillStyle = '#5dff8e'; ex.font = 'bold ' + Math.max(6, sg.h * 0.78) + 'px Arial,sans-serif';
  ex.textAlign = 'center'; ex.textBaseline = 'middle'; ex.fillText('EXIT', sg.w / 2, sg.h / 2 + 0.5);
  this.sp.exit = ec;
  // VIGNETTE
  var gc = mk(128, 128), gx = gc.getContext('2d'), gi = gx.createImageData(128, 128), gq;
  for (gq = 0; gq < gi.data.length; gq += 4) { var gv = Math.random() < 0.5 ? 0 : 255; gi.data[gq] = gi.data[gq + 1] = gi.data[gq + 2] = gv; gi.data[gq + 3] = 5 + Math.random() * 10; }
  gx.putImageData(gi, 0, 0); this._grainPat = this.ctx.createPattern(gc, 'repeat');
  var vc = this.vigC = mk(W * d, H * d), vg = vc.getContext('2d');
  var vgr = vg.createRadialGradient(W * 0.5, H * 0.46, H * 0.3, W * 0.5, H * 0.46, W * 0.62);
  vgr.addColorStop(0, 'rgba(0,0,0,0)'); vgr.addColorStop(0.65, 'rgba(0,0,0,.2)'); vgr.addColorStop(1, 'rgba(0,0,0,.7)');
  vg.fillStyle = vgr; vg.fillRect(0, 0, W * d, H * d);
  this._daisLayer(rr);
};

/* ---------- dais (lectern) static layer ---------- */
P._daisLayer = function (rr) {
  var W = this.W, H = this.H, d = this.d, g, i;
  var y0 = Math.floor(H * 0.62);
  this.dz = {
    y0: y0, far: 0.75 * H,
    mon: { x: 0.06 * W, y: 0.772 * H, w: 0.27 * W, h: 0.188 * H },
    bx: 0.60 * W, by: 0.935 * H, hx: 0.565 * W, hy: 0.655 * H,
    lamp: { x: 0.87 * W, y: 0.79 * H }
  };
  var dz = this.dz, dc = this.daisC = mk((W + 8) * d, (H - y0 + 8) * d);
  g = dc.getContext('2d'); g.setTransform(d, 0, 0, d, 4 * d, (4 - y0) * d);
  var far = dz.far;
  // apron (dark stage front)
  var ag = g.createLinearGradient(0, y0, 0, far);
  ag.addColorStop(0, 'rgba(6,5,8,0)'); ag.addColorStop(0.5, 'rgba(6,5,8,.88)'); ag.addColorStop(1, '#060507');
  g.fillStyle = ag; g.fillRect(-4, y0, W + 8, far - y0 + 1);
  g.fillStyle = '#060507'; g.fillRect(-4, far, W + 8, H - far + 8);
  // lectern top trapezoid
  var fx0 = 0.2 * W, fx1 = 0.8 * W, nx0 = -0.03 * W, nx1 = 1.03 * W, ny = H + 4;
  var wg = g.createLinearGradient(0, far, 0, ny);
  wg.addColorStop(0, '#7a4e2c'); wg.addColorStop(0.45, '#5b3920'); wg.addColorStop(1, '#3b2312');
  g.fillStyle = wg; g.beginPath(); g.moveTo(fx0, far); g.lineTo(fx1, far); g.lineTo(nx1, ny); g.lineTo(nx0, ny); g.closePath(); g.fill();
  g.save(); g.clip();
  for (i = 0; i < 90; i++) {
    var u = rr(), v = u + (rr() - 0.5) * 0.03;
    g.strokeStyle = rr() < 0.5 ? 'rgba(20,8,0,' + (0.06 + rr() * 0.14).toFixed(2) + ')' : 'rgba(255,210,150,' + (0.03 + rr() * 0.07).toFixed(2) + ')';
    g.lineWidth = 0.5 + rr() * 1.2;
    g.beginPath(); g.moveTo(fx0 + (fx1 - fx0) * u, far); g.lineTo(nx0 + (nx1 - nx0) * v, ny); g.stroke();
  }
  // sheen
  var sh = g.createLinearGradient(W * 0.1, far, W * 0.9, H);
  sh.addColorStop(0, 'rgba(255,230,190,0)'); sh.addColorStop(0.42, 'rgba(255,230,190,.0)'); sh.addColorStop(0.5, 'rgba(255,235,200,.16)'); sh.addColorStop(0.58, 'rgba(255,230,190,0)'); sh.addColorStop(1, 'rgba(255,230,190,0)');
  g.fillStyle = sh; g.fillRect(-4, far, W + 8, H - far + 8);
  g.restore();
  // far edge bevel + lip
  g.strokeStyle = '#b4875a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(fx0, far + 0.7); g.lineTo(fx1, far + 0.7); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(fx0, far - 1); g.lineTo(fx1, far - 1); g.stroke();
  g.strokeStyle = 'rgba(255,220,170,.22)'; g.lineWidth = 1; g.beginPath(); g.moveTo(fx0, far); g.lineTo(nx0, ny); g.moveTo(fx1, far); g.lineTo(nx1, ny); g.stroke();
  // notes card
  var nxa = 0.405 * W, nxb = 0.505 * W, nya = 0.855 * H, nxc = 0.392 * W, nxd = 0.522 * W, nyb = 0.965 * H;
  g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.moveTo(nxa + 3, nya + 3); g.lineTo(nxb + 3, nya + 3); g.lineTo(nxd + 4, nyb + 4); g.lineTo(nxc + 4, nyb + 4); g.closePath(); g.fill();
  var cgd = g.createLinearGradient(0, nya, 0, nyb); cgd.addColorStop(0, '#d9ceb4'); cgd.addColorStop(1, '#f1e8d0');
  g.fillStyle = cgd; g.beginPath(); g.moveTo(nxa, nya); g.lineTo(nxb, nya); g.lineTo(nxd, nyb); g.lineTo(nxc, nyb); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(70,60,50,.5)'; g.lineWidth = 0.8;
  for (i = 1; i < 6; i++) {
    var f = i / 6.5, ly = nya + (nyb - nya) * f, lx0 = nxa + (nxc - nxa) * f + 4 + i, lx1 = nxb + (nxd - nxb) * f - 4 - (i % 3) * 5;
    g.beginPath(); g.moveTo(lx0, ly); g.lineTo(lx1, ly); g.stroke();
  }
  // glass of water
  var gx = 0.745 * W, gy = 0.885 * H, gw = Math.max(13, W * 0.024), gh = Math.max(20, H * 0.085);
  g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(gx + 3, gy + 2, gw * 0.7, gw * 0.22, 0, 0, TAU); g.fill();
  var gb = g.createLinearGradient(gx - gw / 2, 0, gx + gw / 2, 0);
  gb.addColorStop(0, 'rgba(190,215,235,.38)'); gb.addColorStop(0.35, 'rgba(240,250,255,.2)'); gb.addColorStop(1, 'rgba(120,150,180,.3)');
  g.fillStyle = gb; g.beginPath(); g.moveTo(gx - gw / 2, gy - gh); g.lineTo(gx + gw / 2, gy - gh); g.lineTo(gx + gw * 0.38, gy); g.lineTo(gx - gw * 0.38, gy); g.closePath(); g.fill();
  g.fillStyle = 'rgba(150,200,235,.35)'; g.beginPath(); g.moveTo(gx - gw * 0.46, gy - gh * 0.65); g.lineTo(gx + gw * 0.46, gy - gh * 0.65); g.lineTo(gx + gw * 0.38, gy); g.lineTo(gx - gw * 0.38, gy); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(235,245,255,.7)'; g.lineWidth = 1; g.beginPath(); g.ellipse(gx, gy - gh, gw / 2, gw * 0.14, 0, 0, TAU); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(gx - gw * 0.28, gy - gh * 0.9, 1.5, gh * 0.7);
  // monitor frame
  var m = dz.mon;
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(m.x + 3, m.y + m.h - 1, m.w, 5);
  var mg = g.createLinearGradient(0, m.y, 0, m.y + m.h); mg.addColorStop(0, '#2a2d34'); mg.addColorStop(1, '#14161a');
  g.fillStyle = mg; rrect(g, m.x - 4, m.y - 4, m.w + 8, m.h + 8, 4); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1; rrect(g, m.x - 3.5, m.y - 3.5, m.w + 7, m.h + 7, 4); g.stroke();
  // lamp (static body)
  var lp = dz.lamp;
  g.fillStyle = '#17120e'; g.beginPath(); g.ellipse(lp.x, lp.y + 8, 11, 3.2, 0, 0, TAU); g.fill();
  g.strokeStyle = '#2a2420'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(lp.x, lp.y + 8); g.quadraticCurveTo(lp.x + 7, lp.y - 8, lp.x - 6, lp.y - 18); g.stroke();
  g.fillStyle = '#1b1612'; g.beginPath(); g.moveTo(lp.x - 12, lp.y - 11); g.lineTo(lp.x + 2, lp.y - 22); g.lineTo(lp.x + 6, lp.y - 14); g.closePath(); g.fill();
  g.fillStyle = '#ffd9a0'; g.beginPath(); g.ellipse(lp.x - 3, lp.y - 13.5, 6.5, 2.3, -0.5, 0, TAU); g.fill();
  // mic base
  g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.ellipse(dz.bx + 2, dz.by + 2, 11, 3.2, 0, 0, TAU); g.fill();
  var bg = g.createLinearGradient(dz.bx - 10, 0, dz.bx + 10, 0); bg.addColorStop(0, '#1b1c20'); bg.addColorStop(0.4, '#4a4d55'); bg.addColorStop(1, '#101114');
  g.fillStyle = bg; g.beginPath(); g.ellipse(dz.bx, dz.by, 10, 3, 0, 0, TAU); g.fill();
  g.fillRect(dz.bx - 10, dz.by - 3, 20, 3); g.beginPath(); g.ellipse(dz.bx, dz.by - 3, 10, 3, 0, 0, TAU); g.fillStyle = '#5a5d66'; g.fill();
};

/* ---------- people sprites ---------- */
P._sprites = function () {
  for (var i = 0; i < this.ppl.length; i++) { this._head(this.ppl[i]); this._body(this.ppl[i]); }
};

function hexMix(h1, h2, t) {
  var a = rgb(h1), b = rgb(h2), o = '#';
  for (var i = 0; i < 3; i++) { var v = Math.round(a[i] + (b[i] - a[i]) * t); o += (v < 16 ? '0' : '') + v.toString(16); }
  return o;
}
var HAS_FILTER = (function () { try { return 'filter' in CanvasRenderingContext2D.prototype; } catch (e) { return false; } })();

P._head = function (p) {
  var d = this.d, r = p.r, w = Math.ceil(r * 3.4 * d), h = Math.ceil(r * 3.6 * d);
  var out = mk(w, h), og = out.getContext('2d');
  var ox = w / 2, oy = h * 0.46;
  p.hsW = w / d; p.hsH = h / d; p.hsOx = ox / d; p.hsOy = oy / d;
  var rg = mulberry32(this.seed + p.idx * 977 + 13);
  var rx = r * 0.86 * p.fw, ry = r, hc = p.hair, st = p.hstyle, skin = p.skin;
  var detail = r * d > 11, dk = shade(hc, 0.6), i, a;
  var lipHex = hexMix(skin, '#9c3b3f', 0.38);
  var browHex = hexMix(hc, '#2a1c14', 0.45);

  function L() { var c = mk(w, h), g = c.getContext('2d'); g.setTransform(d, 0, 0, d, ox, oy); return { c: c, g: g }; }
  function F(g, k) { if (HAS_FILTER) g.filter = k > 0 ? 'blur(' + Math.max(0.25, k * r * d).toFixed(2) + 'px)' : 'none'; }
  function facePath(g, k) {
    k = k || 1;
    var jx = 1.0 + 0.1 * p.jaw, jy = 0.35 + 0.18 * p.jaw, cy = ry * (1.0 + 0.07 * p.chin);
    g.beginPath(); g.moveTo(0, -ry * k);
    g.bezierCurveTo(rx * 1.18 * k, -ry * k, rx * jx * 1.06 * k, ry * jy * k, 0, cy * k);
    g.bezierCurveTo(-rx * jx * 1.06 * k, ry * jy * k, -rx * 1.18 * k, -ry * k, 0, -ry * k); g.closePath();
  }
  function blob(g, x, y, ax, ay, col, al, blur, rot) {
    g.save(); F(g, blur); g.globalAlpha = al; g.fillStyle = col;
    g.beginPath(); g.ellipse(x, y, ax, ay, rot || 0, 0, TAU); g.fill(); g.restore();
  }
  function dots(g, n, x0, y0, x1, y1, al) {
    g.save(); g.globalCompositeOperation = 'source-atop'; F(g, 0);
    for (var k = 0; k < n; k++) {
      g.globalAlpha = al * (0.4 + rg() * 0.8); g.fillStyle = rg() < 0.55 ? 'rgb(40,18,8)' : 'rgb(255,235,215)';
      var s = Math.max(0.4 / d, r * (0.008 + rg() * 0.012));
      g.fillRect(x0 + rg() * (x1 - x0), y0 + rg() * (y1 - y0), s, s);
    }
    g.restore();
  }
  function strands(g, n, x0, y0, x1, y1, len, base) {
    g.save(); g.globalCompositeOperation = 'source-atop'; g.lineCap = 'round'; F(g, 0);
    for (var k = 0; k < n; k++) {
      var sx = x0 + rg() * (x1 - x0), sy = y0 + rg() * (y1 - y0), side = sx < 0 ? -1 : 1, L2 = len * (0.5 + rg() * 0.8);
      g.strokeStyle = rg() < 0.5 ? shade(base, 0.5 + rg() * 0.3) : shade(base, 1.2 + rg() * 0.6);
      g.globalAlpha = 0.16 + rg() * 0.3; g.lineWidth = Math.max(0.5 / d, r * (0.012 + rg() * 0.02));
      g.beginPath(); g.moveTo(sx, sy);
      g.quadraticCurveTo(sx + side * L2 * 0.25 + (rg() - 0.5) * r * 0.1, sy + L2 * 0.5, sx + side * L2 * 0.35 * (0.5 + rg()), sy + L2); g.stroke();
    }
    g.restore();
  }

  // ----- back hair (long styles) -----
  var HB = L(), g = HB.g;
  if (st === 2) {
    g.fillStyle = dk; g.beginPath(); g.moveTo(-rx * 1.12, -ry * 0.3); g.lineTo(-rx * 1.15, ry * 1.7);
    g.quadraticCurveTo(0, ry * 1.95, rx * 1.15, ry * 1.7); g.lineTo(rx * 1.12, -ry * 0.3); g.closePath(); g.fill();
    strands(g, detail ? 70 : 24, -rx * 1.15, -ry * 0.2, rx * 1.15, ry * 0.6, ry * 1.2, hc);
  }
  if (st === 3) { g.fillStyle = hc; g.beginPath(); g.arc(0, -ry * 1.12, r * 0.4, 0, TAU); g.fill(); strands(g, 14, -r * 0.4, -ry * 1.4, r * 0.4, -ry * 0.9, r * 0.35, hc); }

  // ----- ears -----
  var E = L(); g = E.g;
  for (a = -1; a <= 1; a += 2) {
    var eg = g.createRadialGradient(a * rx * 1.02, ry * 0.08, 0, a * rx * 1.02, ry * 0.08, r * 0.3);
    eg.addColorStop(0, shade(skin, 0.8)); eg.addColorStop(1, shade(skin, 0.62));
    g.fillStyle = eg; g.beginPath(); g.ellipse(a * rx * 1.0, ry * 0.1, r * 0.1, r * 0.21, a * 0.1, 0, TAU); g.fill();
    g.fillStyle = 'rgba(60,22,14,.35)'; g.beginPath(); g.ellipse(a * rx * 1.0, ry * 0.12, r * 0.04, r * 0.11, a * 0.1, 0, TAU); g.fill();
  }

  // ----- face -----
  var FC = L(); g = FC.g;
  g.fillStyle = shade(skin, 0.97 + rg() * 0.06); facePath(g); g.fill();
  g.save(); g.globalCompositeOperation = 'source-atop';
  // light from the front-left: left side lifted, right side falls off
  var lg = g.createLinearGradient(-rx, 0, rx, 0);
  lg.addColorStop(0, 'rgba(255,238,220,.14)'); lg.addColorStop(0.45, 'rgba(255,238,220,0)'); lg.addColorStop(1, 'rgba(50,20,8,.34)');
  g.fillStyle = lg; g.fillRect(-r * 1.4, -r * 1.2, r * 2.8, r * 2.5);
  // edge falloff (soft dark rim)
  g.save(); facePath(g); g.clip(); F(g, 0.17); g.strokeStyle = 'rgba(45,18,8,.4)'; g.lineWidth = r * 0.38; facePath(g); g.stroke(); g.restore();
  // forehead and cheekbone light
  blob(g, -rx * 0.1, -ry * 0.58, rx * 0.7, ry * 0.26, 'rgb(255,240,225)', 0.17, 0.12);
  blob(g, -rx * 0.55, ry * 0.26, rx * 0.3, ry * 0.18, 'rgb(255,238,220)', 0.13, 0.1, -0.4);
  blob(g, rx * 0.55, ry * 0.26, rx * 0.3, ry * 0.18, 'rgb(255,238,220)', 0.07, 0.1, 0.4);
  // warm cheeks
  blob(g, -rx * 0.62, ry * 0.4, r * 0.28, r * 0.17, 'rgb(215,95,85)', 0.13, 0.15);
  blob(g, rx * 0.62, ry * 0.4, r * 0.28, r * 0.17, 'rgb(205,90,80)', 0.12, 0.15);
  if (detail) {
    var ex = rx * 0.42, ey = ry * 0.02;
    // eye sockets, under-eye, brow ridge
    blob(g, -ex, ey - r * 0.02, r * 0.3, r * 0.17, 'rgb(70,30,20)', 0.2, 0.09);
    blob(g, ex, ey - r * 0.02, r * 0.3, r * 0.17, 'rgb(70,30,20)', 0.22, 0.09);
    blob(g, -ex, ey + r * 0.14, r * 0.22, r * 0.07, 'rgb(90,40,40)', 0.06 + 0.12 * p.age, 0.06);
    blob(g, ex, ey + r * 0.14, r * 0.22, r * 0.07, 'rgb(90,40,40)', 0.06 + 0.12 * p.age, 0.06);
    // nose
    blob(g, -rx * 0.03, ry * 0.14, r * 0.035, r * 0.26, 'rgb(255,240,225)', 0.2, 0.05);
    g.save(); F(g, 0.06); g.fillStyle = 'rgba(60,24,12,.22)'; g.beginPath();
    g.moveTo(rx * 0.1, -ry * 0.05); g.quadraticCurveTo(rx * 0.24, ry * 0.2, rx * 0.2 * p.noseW + rx * 0.08, ry * 0.4); g.lineTo(rx * 0.05, ry * 0.36); g.closePath(); g.fill(); g.restore();
    blob(g, 0, ry * 0.36, r * 0.1 * p.noseW, r * 0.07, 'rgb(255,235,215)', 0.2, 0.04);
    blob(g, -r * 0.2 * p.noseW, ry * 0.4, r * 0.07, r * 0.07, 'rgb(70,28,20)', 0.14, 0.04);
    blob(g, r * 0.2 * p.noseW, ry * 0.4, r * 0.07, r * 0.07, 'rgb(70,28,20)', 0.2, 0.04);
    blob(g, -r * 0.055, ry * 0.435, r * 0.036, r * 0.026, 'rgb(35,12,8)', 0.55, 0.012);
    blob(g, r * 0.055, ry * 0.435, r * 0.036, r * 0.026, 'rgb(35,12,8)', 0.55, 0.012);
    blob(g, 0, ry * 0.48, r * 0.16, r * 0.05, 'rgb(60,24,14)', 0.18, 0.05);
    // smile lines and age
    g.save(); F(g, 0.03); g.strokeStyle = 'rgba(80,32,22,' + (0.07 + 0.12 * p.age).toFixed(2) + ')'; g.lineWidth = r * 0.035; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-r * 0.26, ry * 0.4); g.quadraticCurveTo(-r * 0.34, ry * 0.56, -r * 0.3, ry * 0.7);
    g.moveTo(r * 0.26, ry * 0.4); g.quadraticCurveTo(r * 0.34, ry * 0.56, r * 0.3, ry * 0.7); g.stroke();
    if (p.age > 0.55) {
      g.strokeStyle = 'rgba(70,28,18,.07)';
      g.beginPath(); g.moveTo(-rx * 0.5, -ry * 0.5); g.quadraticCurveTo(0, -ry * 0.55, rx * 0.5, -ry * 0.5);
      g.moveTo(-rx * 0.4, -ry * 0.4); g.quadraticCurveTo(0, -ry * 0.44, rx * 0.4, -ry * 0.4); g.stroke();
    }
    g.restore();
    // under-lip and chin
    blob(g, 0, ry * 0.8, r * 0.17, r * 0.05, 'rgb(60,22,14)', 0.2, 0.05);
    blob(g, -rx * 0.02, ry * 0.92, r * 0.18, r * 0.08, 'rgb(255,238,220)', 0.1, 0.06);
  }
  // jaw shadow
  var jg = g.createLinearGradient(0, ry * 0.45, 0, ry * 1.06); jg.addColorStop(0, 'rgba(40,15,5,0)'); jg.addColorStop(1, 'rgba(40,15,5,.34)');
  F(g, 0); g.fillStyle = jg; g.fillRect(-r * 1.4, ry * 0.45, r * 2.8, r * 0.7);
  g.restore();
  // skin grain
  dots(g, Math.min(700, Math.round(r * r * 12)), -rx, -ry, rx, ry, 0.1);

  if (detail) {
    var ex2 = rx * 0.42, ey2 = ry * 0.02, ew = r * 0.2, eh = r * 0.085 * (0.85 + rg() * 0.3);
    // eyes
    for (a = -1; a <= 1; a += 2) {
      g.save(); g.translate(a * ex2, ey2);
      g.beginPath(); g.moveTo(-ew, 0); g.quadraticCurveTo(0, -eh * 2.1, ew, 0); g.quadraticCurveTo(0, eh * 1.25, -ew, 0); g.closePath();
      g.save(); g.clip();
      g.fillStyle = '#e9e2d8'; g.fillRect(-ew, -eh * 2, ew * 2, eh * 4);
      var sg = g.createLinearGradient(0, -eh * 1.5, 0, eh); sg.addColorStop(0, 'rgba(70,35,25,.5)'); sg.addColorStop(0.5, 'rgba(70,35,25,.05)'); sg.addColorStop(1, 'rgba(70,35,25,.12)');
      g.fillStyle = sg; g.fillRect(-ew, -eh * 2, ew * 2, eh * 4);
      var lx = (rg() - 0.5) * ew * 0.35, ir = eh * 1.02;
      var ig = g.createRadialGradient(lx, 0, ir * 0.1, lx, 0, ir);
      ig.addColorStop(0, shade(p.eyeCol, 1.9)); ig.addColorStop(0.65, p.eyeCol); ig.addColorStop(1, shade(p.eyeCol, 0.35));
      g.fillStyle = ig; g.beginPath(); g.arc(lx, -eh * 0.05, ir, 0, TAU); g.fill();
      g.fillStyle = '#050403'; g.beginPath(); g.arc(lx, -eh * 0.05, ir * 0.45, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(lx - ir * 0.32, -eh * 0.5, ir * 0.17, 0, TAU); g.fill();
      g.restore();
      g.strokeStyle = 'rgba(14,8,5,.92)'; g.lineWidth = r * 0.036; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-ew, 0); g.quadraticCurveTo(0, -eh * 2.1, ew, 0); g.stroke();
      g.lineWidth = r * 0.03; g.beginPath(); g.moveTo(a * ew * 0.4, -eh * 0.95); g.lineTo(a * ew * 1.15, -eh * 0.35); g.stroke();
      g.strokeStyle = 'rgba(80,36,24,.38)'; g.lineWidth = r * 0.028;
      g.beginPath(); g.moveTo(-ew * 0.9, -eh * 1.1); g.quadraticCurveTo(0, -eh * 3.5, ew * 0.95, -eh * 1.0); g.stroke();
      g.strokeStyle = 'rgba(100,45,35,.3)'; g.lineWidth = r * 0.02;
      g.beginPath(); g.moveTo(-ew * 0.8, eh * 0.35); g.quadraticCurveTo(0, eh * 1.5, ew * 0.8, eh * 0.35); g.stroke();
      g.restore();
    }
    // eyebrows
    for (a = -1; a <= 1; a += 2) {
      var bx = a * rx * 0.44, by = -ry * 0.2 - p.browA * r * 0.04, bw2 = rx * 0.34, th = r * 0.06 * p.browT;
      g.save(); F(g, 0.012); g.fillStyle = browHex; g.globalAlpha = 0.9;
      g.beginPath(); g.moveTo(bx - a * bw2 * 1.0, by + th * 0.6);
      g.quadraticCurveTo(bx - a * bw2 * 0.1, by - th * (1.8 + p.browA), bx + a * bw2 * 1.1, by + th * 1.3);
      g.quadraticCurveTo(bx - a * bw2 * 0.1, by - th * 0.2, bx - a * bw2 * 1.0, by + th * 0.6); g.fill(); g.restore();
    }
    // mouth
    var my = ry * 0.64, mw = rx * 0.32, lh = r * 0.07 * (0.8 + rg() * 0.5), sm = p.smile * r * 0.06;
    g.fillStyle = shade(lipHex, 0.82);
    g.beginPath(); g.moveTo(-mw, my - sm); g.bezierCurveTo(-mw * 0.5, my - lh * 1.25, -mw * 0.15, my - lh * 1.2, 0, my - lh * 0.8);
    g.bezierCurveTo(mw * 0.15, my - lh * 1.2, mw * 0.5, my - lh * 1.25, mw, my - sm); g.quadraticCurveTo(0, my + lh * 0.3, -mw, my - sm); g.fill();
    var lgd = g.createLinearGradient(0, my, 0, my + lh * 2.3); lgd.addColorStop(0, shade(lipHex, 1.05)); lgd.addColorStop(1, shade(lipHex, 0.88));
    g.fillStyle = lgd; g.beginPath(); g.moveTo(-mw * 0.94, my - sm * 0.9); g.quadraticCurveTo(0, my + lh * 0.3, mw * 0.94, my - sm * 0.9);
    g.quadraticCurveTo(mw * 0.5, my + lh * 2.5, 0, my + lh * 2.5); g.quadraticCurveTo(-mw * 0.5, my + lh * 2.5, -mw * 0.94, my - sm * 0.9); g.fill();
    blob(g, 0, my + lh * 1.3, mw * 0.35, lh * 0.35, 'rgb(255,235,230)', 0.22, 0.03);
    g.strokeStyle = 'rgba(55,18,18,.65)'; g.lineWidth = r * 0.03; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-mw * 1.02, my - sm * 1.1); g.quadraticCurveTo(0, my + lh * 0.45, mw * 1.02, my - sm * 1.1); g.stroke();
  } else {
    g.fillStyle = 'rgba(25,12,8,.4)'; g.fillRect(-rx * 0.65, -ry * 0.02, rx * 1.3, ry * 0.18);
    g.fillStyle = 'rgba(120,45,45,.5)'; g.fillRect(-rx * 0.28, ry * 0.6, rx * 0.56, ry * 0.07);
  }
  // beard and moustache
  if (p.beard) {
    g.save(); F(g, detail ? 0.03 : 0); g.fillStyle = shade(hc, 0.82); g.globalAlpha = 0.8; g.beginPath();
    g.moveTo(-rx * 1.0, ry * 0.02); g.bezierCurveTo(-rx * 1.02, ry * 0.9, -rx * 0.4, ry * 1.12, 0, ry * 1.1);
    g.bezierCurveTo(rx * 0.4, ry * 1.12, rx * 1.02, ry * 0.9, rx * 1.0, ry * 0.02);
    g.bezierCurveTo(rx * 0.75, ry * 0.5, rx * 0.4, ry * 0.46, 0, ry * 0.5); g.bezierCurveTo(-rx * 0.4, ry * 0.46, -rx * 0.75, ry * 0.5, -rx * 1.0, ry * 0.02);
    g.moveTo(-rx * 0.34, ry * 0.65); g.quadraticCurveTo(0, ry * 0.58, rx * 0.34, ry * 0.65); g.quadraticCurveTo(0, ry * 0.78, -rx * 0.34, ry * 0.65);
    g.fill('evenodd'); g.restore();
    g.save(); F(g, 0.02); g.fillStyle = shade(hc, 0.8); g.globalAlpha = 0.7; g.beginPath();
    g.moveTo(-rx * 0.4, ry * 0.52); g.quadraticCurveTo(0, ry * 0.46, rx * 0.4, ry * 0.52); g.quadraticCurveTo(rx * 0.2, ry * 0.6, 0, ry * 0.57); g.quadraticCurveTo(-rx * 0.2, ry * 0.6, -rx * 0.4, ry * 0.52); g.fill(); g.restore();
    dots(g, 160, -rx, ry * 0.4, rx, ry * 1.05, 0.28);
  }

  // ----- front hair / scarf -----
  var HF = L(); g = HF.g;
  var hg = g.createLinearGradient(0, -ry * 1.2, 0, ry * 0.4);
  hg.addColorStop(0, shade(hc, 1.35)); hg.addColorStop(0.5, hc); hg.addColorStop(1, shade(hc, 0.7));
  if (st === 6) {
    var sc = p.scarf, sgd = g.createLinearGradient(-rx * 1.3, -ry, rx * 1.3, ry * 1.5);
    sgd.addColorStop(0, shade(sc, 1.25)); sgd.addColorStop(0.5, sc); sgd.addColorStop(1, shade(sc, 0.6));
    g.fillStyle = sgd; g.beginPath(); g.ellipse(0, ry * 0.2, rx * 1.34, ry * 1.38, 0, 0, TAU); g.fill();
    g.save(); g.globalCompositeOperation = 'destination-out'; F(g, 0.015); facePath(g, 0.97); g.fillStyle = '#000'; g.fill(); g.restore();
    g.save(); g.globalCompositeOperation = 'source-atop'; F(g, 0.03); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = r * 0.06; g.lineCap = 'round';
    for (i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-rx * 1.1 + i * rx * 0.1, -ry * 0.2); g.quadraticCurveTo(-rx * 1.25, ry * 0.5, -rx * 1.05 + i * rx * 0.12, ry * 1.4); g.stroke(); g.beginPath(); g.moveTo(rx * 1.1 - i * rx * 0.1, -ry * 0.2); g.quadraticCurveTo(rx * 1.25, ry * 0.5, rx * 1.05 - i * rx * 0.12, ry * 1.4); g.stroke(); }
    g.restore();
  } else if (st !== 4) {
    var hl = st === 1 ? -ry * 0.72 : (st === 5 ? -ry * 0.5 : -ry * 0.45);
    g.fillStyle = hg; g.globalAlpha = st === 1 ? 0.62 : 1;
    g.beginPath(); g.moveTo(-rx * 1.06, 0); g.bezierCurveTo(-rx * 1.3, -ry * 1.35, rx * 1.3, -ry * 1.35, rx * 1.06, 0);
    g.bezierCurveTo(rx * 0.75, hl, -rx * 0.75, hl, -rx * 1.06, 0); g.fill(); g.globalAlpha = 1;
    if (st === 2) {
      g.fillStyle = hg; g.beginPath(); g.moveTo(-rx * 1.08, -ry * 0.1); g.lineTo(-rx * 1.18, ry * 1.5); g.lineTo(-rx * 0.88, ry * 1.4); g.lineTo(-rx * 0.8, -ry * 0.3); g.closePath();
      g.moveTo(rx * 1.08, -ry * 0.1); g.lineTo(rx * 1.18, ry * 1.5); g.lineTo(rx * 0.88, ry * 1.4); g.lineTo(rx * 0.8, -ry * 0.3); g.closePath(); g.fill();
    }
    if (st === 5) {
      g.fillStyle = hc;
      for (a = 0; a < 9; a++) { var an = Math.PI * (1.05 + a * 0.11); g.beginPath(); g.arc(Math.cos(an) * rx * 1.12, Math.sin(an) * ry * 1.12 + ry * 0.05, r * 0.27, 0, TAU); g.fill(); }
    }
    strands(g, detail ? 110 : 30, -rx * 1.1, -ry * 1.25, rx * 1.1, -ry * 0.3, ry * 0.9, hc);
    if (st === 2) strands(g, detail ? 50 : 14, -rx * 1.2, -ry * 0.3, rx * 1.2, ry * 0.4, ry * 1.1, hc);
    // sheen
    g.save(); g.globalCompositeOperation = 'source-atop'; F(g, 0.09);
    g.fillStyle = 'rgba(255,240,220,' + (p.hairLight ? 0.18 : 0.3) + ')'; g.beginPath(); g.ellipse(-rx * 0.25, -ry * 0.82, rx * 0.65, ry * 0.12, -0.22, 0, TAU); g.fill();
    g.restore();
    // soft hairline over the forehead
    g.save(); g.globalCompositeOperation = 'destination-out'; F(g, 0.04); g.fillStyle = 'rgba(0,0,0,.35)';
    g.beginPath(); g.ellipse(0, hl - ry * 0.02, rx * 0.85, ry * 0.06, 0, 0, TAU); g.fill(); g.restore();
    // flyaways
    if (detail) {
      g.save(); F(g, 0); g.strokeStyle = shade(hc, 1.1); g.globalAlpha = 0.35; g.lineWidth = Math.max(0.5 / d, r * 0.012); g.lineCap = 'round';
      for (i = 0; i < 9; i++) { var fa = Math.PI * (1.1 + rg() * 0.8), fx = Math.cos(fa) * rx * 1.12, fy = Math.sin(fa) * ry * 1.15;
        g.beginPath(); g.moveTo(fx, fy); g.quadraticCurveTo(fx * 1.06 + (rg() - 0.5) * r * 0.2, fy * 1.05 - r * 0.1, fx * 1.1 + (rg() - 0.5) * r * 0.3, fy * 1.1 - r * 0.2); g.stroke(); }
      g.restore();
    }
  } else {
    g.fillStyle = shade(hc, 0.9);
    g.beginPath(); g.ellipse(-rx * 1.0, -ry * 0.12, r * 0.14, r * 0.36, 0.1, 0, TAU); g.ellipse(rx * 1.0, -ry * 0.12, r * 0.14, r * 0.36, -0.1, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,240,220,.2)'; g.beginPath(); g.ellipse(-rx * 0.2, -ry * 0.7, rx * 0.5, ry * 0.2, -0.3, 0, TAU); g.fill();
  }

  // ----- glasses -----
  var GL = null;
  if (p.glasses) {
    GL = L(); g = GL.g;
    var gx = rx * 0.42, gy = ry * 0.03, gw = r * 0.27, gh = r * 0.2;
    g.lineWidth = Math.max(0.7 / d, r * 0.05);
    for (a = -1; a <= 1; a += 2) {
      rrect(g, a * gx - gw, gy - gh, gw * 2, gh * 2, r * 0.1);
      g.fillStyle = 'rgba(190,210,235,.08)'; g.fill(); g.strokeStyle = 'rgba(18,18,24,.92)'; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = Math.max(0.5 / d, r * 0.025);
      g.beginPath(); g.moveTo(a * gx - gw * 0.5, gy + gh * 0.5); g.lineTo(a * gx - gw * 0.05, gy - gh * 0.55); g.stroke(); g.lineWidth = Math.max(0.7 / d, r * 0.05);
    }
    g.strokeStyle = 'rgba(18,18,24,.9)'; g.beginPath(); g.moveTo(-gx + gw, gy - gh * 0.3); g.quadraticCurveTo(0, gy - gh * 0.7, gx - gw, gy - gh * 0.3);
    g.moveTo(-gx - gw, gy - gh * 0.3); g.lineTo(-rx * 1.05, gy - gh * 0.2); g.moveTo(gx + gw, gy - gh * 0.3); g.lineTo(rx * 1.05, gy - gh * 0.2); g.stroke();
  }

  // ----- composite -----
  og.setTransform(1, 0, 0, 1, 0, 0);
  og.drawImage(HB.c, 0, 0);
  og.drawImage(E.c, 0, 0);
  if (HAS_FILTER) og.filter = 'blur(' + (0.28 * d).toFixed(2) + 'px)';
  og.drawImage(FC.c, 0, 0);
  if (HAS_FILTER) og.filter = 'blur(' + (0.22 * d).toFixed(2) + 'px)';
  og.drawImage(HF.c, 0, 0);
  if (HAS_FILTER) og.filter = 'none';
  if (GL) og.drawImage(GL.c, 0, 0);
  var hh = og.createRadialGradient(ox - rx * 0.15 * d, oy - ry * 0.75 * d, 0, ox - rx * 0.15 * d, oy - ry * 0.75 * d, r * 0.7 * d);
  hh.addColorStop(0, 'rgba(255,245,230,.12)'); hh.addColorStop(1, 'rgba(255,245,230,0)');
  og.fillStyle = hh; og.fillRect(ox - r * 1.2 * d, oy - r * 1.2 * d, r * 2.4 * d, r * 1.2 * d);
  // depth of field: back rows soften
  var res = out, dof = Math.max(0, 3 - p.row) * 0.3 * d;
  if (HAS_FILTER && dof > 0.05) {
    var t2 = mk(w, h), tg = t2.getContext('2d'); tg.filter = 'blur(' + dof.toFixed(2) + 'px)'; tg.drawImage(out, 0, 0); res = t2;
  }
  fogOver(res, p.fogA);
  p.hs_c = res;
};

P._body = function (p) {
  var d = this.d, r = p.r, bw = r * 2.15 * p.bf, w = Math.ceil((bw * 2 + r * 0.6) * d), h = Math.ceil(r * 3.25 * d);
  var c = mk(w, h), g0 = c.getContext('2d');
  var rg = mulberry32(this.seed + p.idx * 613 + 5);
  var cx = w / 2, cyy = -0.55 * r * d;
  p.bsW = w / d; p.bsH = h / d; p.bs_c = c; p.bw = bw;
  var i, a, skin = p.skin, cl = p.cloth, col = cl === 2 ? shade(p.shirt, 0.62) : p.shirt;
  var colHex = cl === 2 ? hexMix(p.shirt, '#0a0a10', 0.38) : p.shirt;
  function L() { var cc = mk(w, h), gg = cc.getContext('2d'); gg.setTransform(d, 0, 0, d, cx, cyy); return { c: cc, g: gg }; }
  function F(gg, k) { if (HAS_FILTER) gg.filter = k > 0 ? 'blur(' + Math.max(0.25, k * r * d).toFixed(2) + 'px)' : 'none'; }
  function sil(gg) {
    gg.beginPath(); gg.moveTo(-bw, r * 3.8); gg.lineTo(-bw * 0.97, r * 2.3);
    gg.bezierCurveTo(-bw * 0.9, r * 1.7, -r * 0.8, r * 1.55, -r * 0.42, r * 1.4);
    gg.lineTo(r * 0.42, r * 1.4); gg.bezierCurveTo(r * 0.8, r * 1.55, bw * 0.9, r * 1.7, bw * 0.97, r * 2.3);
    gg.lineTo(bw, r * 3.8); gg.closePath();
  }
  // neck
  var N = L(), g = N.g;
  var ng = g.createLinearGradient(-r * 0.32, 0, r * 0.32, 0);
  ng.addColorStop(0, shade(skin, 0.68)); ng.addColorStop(0.35, shade(skin, 0.95)); ng.addColorStop(1, shade(skin, 0.6));
  g.fillStyle = ng; g.beginPath(); g.moveTo(-r * 0.36, r * 0.5); g.lineTo(r * 0.36, r * 0.5); g.lineTo(r * 0.42, r * 1.7); g.lineTo(-r * 0.42, r * 1.7); g.closePath(); g.fill();
  g.save(); g.globalCompositeOperation = 'source-atop'; F(g, 0.12);
  g.fillStyle = 'rgba(25,8,2,.7)'; g.fillRect(-r * 0.5, r * 0.45, r, r * 0.5);
  g.restore();
  // garment
  var G = L(); g = G.g;
  var sg = g.createLinearGradient(0, r * 1.4, 0, r * 3.8);
  sg.addColorStop(0, shade(colHex, 1.32)); sg.addColorStop(0.3, colHex); sg.addColorStop(1, shade(colHex, 0.6));
  g.fillStyle = sg; sil(g); g.fill();
  g.save(); g.globalCompositeOperation = 'source-atop';
  // side shading and folds
  var sdg = g.createLinearGradient(-bw, 0, bw, 0); sdg.addColorStop(0, 'rgba(0,0,0,.18)'); sdg.addColorStop(0.3, 'rgba(255,255,255,.05)'); sdg.addColorStop(0.7, 'rgba(0,0,0,0)'); sdg.addColorStop(1, 'rgba(0,0,0,.35)');
  F(g, 0); g.fillStyle = sdg; g.fillRect(-bw, r * 1.3, bw * 2, r * 2.6);
  F(g, 0.05); g.lineCap = 'round';
  for (i = 0; i < 5; i++) {
    var fx = (rg() - 0.5) * bw * 1.4, fy = r * (1.9 + rg() * 0.5);
    g.strokeStyle = 'rgba(0,0,0,' + (0.16 + rg() * 0.12).toFixed(2) + ')'; g.lineWidth = r * (0.05 + rg() * 0.05);
    g.beginPath(); g.moveTo(fx, fy); g.quadraticCurveTo(fx + (rg() - 0.5) * r * 0.5, fy + r * 0.5, fx + (rg() - 0.5) * r * 0.9, fy + r * 1.2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = r * 0.04;
    g.beginPath(); g.moveTo(fx + r * 0.06, fy); g.quadraticCurveTo(fx + r * 0.1, fy + r * 0.5, fx + r * 0.1, fy + r * 1.2); g.stroke();
  }
  // shoulder rim light
  F(g, 0.04); g.strokeStyle = 'rgba(255,240,220,.3)'; g.lineWidth = r * 0.07;
  g.beginPath(); g.moveTo(-bw * 0.95, r * 2.2); g.bezierCurveTo(-bw * 0.9, r * 1.7, -r * 0.8, r * 1.55, -r * 0.42, r * 1.42); g.stroke();
  g.restore();
  // weave
  g.save(); g.globalCompositeOperation = 'source-atop'; F(g, 0);
  var nd = Math.min(500, Math.round(r * r * 6));
  for (i = 0; i < nd; i++) { g.globalAlpha = 0.05 + rg() * 0.06; g.fillStyle = rg() < 0.5 ? '#000' : '#fff'; var sz = Math.max(0.4 / d, r * 0.012); g.fillRect((rg() - 0.5) * bw * 2, r * 1.4 + rg() * r * 2.4, sz, sz); }
  g.restore();
  // neckline and details by style
  g.save(); F(g, 0);
  var skinD = shade(skin, 0.78);
  if (cl === 0) {
    g.fillStyle = skinD; g.beginPath(); g.moveTo(-r * 0.46, r * 1.36); g.quadraticCurveTo(0, r * 2.3, r * 0.46, r * 1.36); g.closePath(); g.fill();
    g.strokeStyle = shade(colHex, 0.55); g.lineWidth = r * 0.12; g.beginPath(); g.moveTo(-r * 0.48, r * 1.36); g.quadraticCurveTo(0, r * 2.34, r * 0.48, r * 1.36); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = r * 0.03; g.beginPath(); g.moveTo(-r * 0.5, r * 1.38); g.quadraticCurveTo(0, r * 2.4, r * 0.5, r * 1.38); g.stroke();
  } else if (cl === 1) {
    g.fillStyle = skinD; g.beginPath(); g.moveTo(-r * 0.4, r * 1.36); g.lineTo(0, r * 2.35); g.lineTo(r * 0.4, r * 1.36); g.closePath(); g.fill();
    g.fillStyle = shade(colHex, 1.22);
    g.beginPath(); g.moveTo(-r * 0.46, r * 1.28); g.lineTo(-r * 0.04, r * 2.32); g.lineTo(-r * 0.62, r * 2.0); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(r * 0.46, r * 1.28); g.lineTo(r * 0.04, r * 2.32); g.lineTo(r * 0.62, r * 2.0); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = r * 0.03; g.beginPath(); g.moveTo(-r * 0.46, r * 1.28); g.lineTo(-r * 0.04, r * 2.32); g.lineTo(-r * 0.62, r * 2.0); g.moveTo(r * 0.46, r * 1.28); g.lineTo(r * 0.04, r * 2.32); g.lineTo(r * 0.62, r * 2.0); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.35)'; for (i = 0; i < 3; i++) { g.beginPath(); g.arc(0, r * (2.55 + i * 0.4), r * 0.035, 0, TAU); g.fill(); }
  } else if (cl === 2) {
    var shirtC = p.pale ? '#dfe3ea' : '#c9d4e6';
    g.fillStyle = shirtC; g.beginPath(); g.moveTo(-r * 0.4, r * 1.34); g.lineTo(0, r * 2.9); g.lineTo(r * 0.4, r * 1.34); g.closePath(); g.fill();
    g.fillStyle = skinD; g.beginPath(); g.moveTo(-r * 0.3, r * 1.34); g.lineTo(0, r * 1.95); g.lineTo(r * 0.3, r * 1.34); g.closePath(); g.fill();
    if (p.tie) { g.fillStyle = p.tie; g.beginPath(); g.moveTo(-r * 0.1, r * 1.9); g.lineTo(r * 0.1, r * 1.9); g.lineTo(r * 0.16, r * 3.1); g.lineTo(0, r * 3.3); g.lineTo(-r * 0.16, r * 3.1); g.closePath(); g.fill(); }
    g.fillStyle = shade(colHex, 1.14);
    g.beginPath(); g.moveTo(-r * 0.5, r * 1.36); g.lineTo(-r * 0.02, r * 2.95); g.lineTo(-r * 0.85, r * 2.55); g.lineTo(-r * 0.72, r * 1.7); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(r * 0.5, r * 1.36); g.lineTo(r * 0.02, r * 2.95); g.lineTo(r * 0.85, r * 2.55); g.lineTo(r * 0.72, r * 1.7); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = r * 0.03; g.beginPath(); g.moveTo(-r * 0.5, r * 1.36); g.lineTo(-r * 0.02, r * 2.95); g.moveTo(r * 0.5, r * 1.36); g.lineTo(r * 0.02, r * 2.95); g.stroke();
  } else {
    g.fillStyle = skinD; g.beginPath(); g.ellipse(0, r * 1.45, r * 0.38, r * 0.3, 0, 0, Math.PI); g.fill();
    var rg2 = g.createLinearGradient(0, r * 1.2, 0, r * 1.8); rg2.addColorStop(0, shade(colHex, 1.3)); rg2.addColorStop(1, shade(colHex, 0.8));
    g.fillStyle = rg2; g.beginPath(); g.ellipse(0, r * 1.52, r * 0.62, r * 0.26, 0, 0, TAU); g.fill();
    g.fillStyle = skinD; g.beginPath(); g.ellipse(0, r * 1.45, r * 0.34, r * 0.16, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = r * 0.03; g.beginPath(); g.ellipse(0, r * 1.52, r * 0.62, r * 0.26, 0, 0.2, Math.PI - 0.2); g.stroke();
  }
  // scarf drape
  if (p.scarf) {
    var scg = g.createLinearGradient(0, r * 1.2, 0, r * 3.2); scg.addColorStop(0, shade(p.scarf, 1.25)); scg.addColorStop(1, shade(p.scarf, 0.6));
    g.fillStyle = scg; g.beginPath(); g.moveTo(-r * 0.62, r * 1.2); g.bezierCurveTo(-r * 1.4, r * 1.9, -r * 1.2, r * 2.9, -r * 0.3, r * 3.3);
    g.lineTo(r * 0.3, r * 3.3); g.bezierCurveTo(r * 1.2, r * 2.9, r * 1.4, r * 1.9, r * 0.62, r * 1.2); g.quadraticCurveTo(0, r * 1.7, -r * 0.62, r * 1.2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = r * 0.05;
    for (i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * r * 0.2, r * 1.6); g.quadraticCurveTo(i * r * 0.4, r * 2.4, i * r * 0.3, r * 3.2); g.stroke(); }
  }
  g.restore();

  g0.setTransform(1, 0, 0, 1, 0, 0);
  g0.drawImage(N.c, 0, 0);
  g0.drawImage(G.c, 0, 0);
  fogOver(c, p.fogA);
  p.shirtD = fogShade(p.shirt, 0.62, p.fogA); p.shirtF = fogShade(p.shirt, 1, p.fogA); p.skinF = fogShade(p.skin, 1, p.fogA);
};

/* ---------- behaviour ---------- */
function rr2(s, a, b) { return a + s.rnd() * (b - a); }

P._enter = function (p, st, dur, partner) {
  p.st = st; p.tIn = 0; p.dur = dur; p.partner = partner == null ? -1 : partner; p.pendT = 0;
};
P._later = function (p, st, dur, delay) {
  if (delay <= 0) { this._enter(p, st, dur); return; }
  p.pend = st; p.pdur = dur; p.pendT = delay;
};
P._effA = function (p) { return clamp(this.att + p.attB, 0, 1); };

P._next = function (p) {
  var s = this, m = s.mood, a = s._effA(p), ch = s.L.chat, w = s._w, i, sum = 0;
  if (p.stand > 0.5 && s.ovation) { s._enter(p, ST.CLAP, 1e9); return; }
  if (s.clapping) { s._enter(p, ST.CLAP, 1e9); return; }
  var sup = m === 'supportive' ? 1 : 0, tough = m === 'tough' ? 1 : 0, voiced = s.voice > 0.12;
  var lo = 1 - a;
  w[ST.IDLE] = 3;
  w[ST.ATTN] = 0.4 + 5 * Math.pow(a, 1.2) * (sup ? 1.3 : tough ? 0.8 : 1);
  w[ST.NOD] = (0.15 + 3 * a * a) * (sup ? 1.6 : tough ? 0.35 : 1) * (voiced ? 1.6 : 0.6) * (1 - ch * 0.8);
  w[ST.PHONE] = (0.1 + 4 * Math.pow(lo, 1.5)) * (tough ? 1.6 : sup ? 0.5 : 1) * (1 + ch * 0.8);
  w[ST.WHISPER] = (0.1 + 2.6 * lo) * (1 + 6 * ch);
  w[ST.LOOK] = 0.2 + 2.6 * lo * (tough ? 1.3 : 1);
  w[ST.STRETCH] = 0.15 + 1.4 * lo;
  w[ST.COUGH] = 0.05 + 0.1 * lo;
  w[ST.CLAP] = 0; w[ST.LAUGH] = ch * 1.4 + (sup && voiced ? 0.1 : 0);
  w[ST.HAND] = (s.mode === 'qa' && s._hands() < 6 && p.hand < 1) ? 0.45 : 0;
  w[ST.RING] = 0;
  for (i = 0; i < 12; i++) sum += w[i];
  var r = s.rnd() * sum, st = 0;
  for (i = 0; i < 12; i++) { r -= w[i]; if (r <= 0) { st = i; break; } }
  var dur = 2;
  switch (st) {
    case ST.IDLE: dur = rr2(s, 1.5, 4); break;
    case ST.ATTN: dur = rr2(s, 2, 5.5); break;
    case ST.NOD: dur = rr2(s, 1.2, 2.6); break;
    case ST.PHONE: dur = rr2(s, 3, 9); break;
    case ST.WHISPER: dur = rr2(s, 2.5, 5); break;
    case ST.LOOK: dur = rr2(s, 2, 4.5); break;
    case ST.STRETCH: dur = rr2(s, 1.6, 2.6); break;
    case ST.COUGH: dur = rr2(s, 1.1, 1.6); break;
    case ST.LAUGH: dur = rr2(s, 1.6, 2.8); break;
    case ST.HAND: dur = rr2(s, 8, 20); break;
  }
  p.dir = s.rnd() < 0.5 ? -1 : 1;
  if (st === ST.WHISPER) {
    var nb = s._neighbor(p);
    if (!nb) { s._enter(p, ST.IDLE, rr2(s, 1, 2.5)); return; }
    s._enter(p, st, dur, nb.idx); s._enter(nb, st, dur, p.idx);
    return;
  }
  s._enter(p, st, dur);
};
P._hands = function () { var n = 0; for (var i = 0; i < this.ppl.length; i++) if (this.ppl[i].st === ST.HAND) n++; return n; };
P._ok = function (p) { return !p.empty && !p.walk; };
P._neighbor = function (p) {
  var row = this.rowP[p.row], a = row[p.col - 1], b = row[p.col + 1], o = [];
  if (a && this._ok(a) && a.st !== ST.WHISPER && p.col !== this.nl[p.row]) o.push(a);
  if (b && this._ok(b) && b.st !== ST.WHISPER && b.col !== this.nl[p.row]) o.push(b);
  return o.length ? o[Math.floor(this.rnd() * o.length)] : null;
};
P._nearest = function (x01) {
  var best = null, bd = 1e9, i, p, W = this.W;
  if (x01 == null) {
    var tries = 0;
    while (tries++ < 60) { p = this.ppl[Math.floor(this.rnd() * this.ppl.length)]; if (this._ok(p)) return p; }
    return this.ppl[0];
  }
  for (i = 0; i < this.ppl.length; i++) {
    p = this.ppl[i]; if (!this._ok(p)) continue;
    var dd = Math.abs(p.x / W - x01) + this.rnd() * 0.08;
    if (dd < bd) { bd = dd; best = p; }
  }
  return best;
};

P.update = function (dt) {
  var i, p, k, t, s = this;
  s.t += dt; t = s.t;
  var ks = 1 - Math.exp(-dt * 1.6);
  s.att += (s.attT - s.att) * (1 - Math.exp(-dt * 2.2));
  s.voice += (s.voiceT - s.voice) * (1 - Math.exp(-dt * (s.voiceT > s.voice ? 14 : 6)));
  var kl = 1 - Math.exp(-dt * 2.2);
  s.L.house += (s.LT.house - s.L.house) * kl; s.L.spot += (s.LT.spot - s.L.spot) * kl; s.L.chat += (s.LT.chat - s.L.chat) * kl;
  // door
  if (s.doorHold > 0) s.doorHold -= dt;
  var dT = s.doorHold > 0 ? 1 : 0;
  s.door += (dT - s.door) * (1 - Math.exp(-dt * 7));
  // qa re-raise hands: handled via weights; "hand" cooldown
  var kp = 1 - Math.exp(-dt * 7), pt, pd, pr, pb, psc, hdx, hdy;
  for (i = 0; i < s.ppl.length; i++) {
    p = s.ppl[i];
    if (p.empty) continue;
    p.stand += (p.standT - p.stand) * (1 - Math.exp(-dt * 3.2));
    if (p.walk) { continue; }
    p.tIn += dt;
    if (p.pendT > 0) { p.pendT -= dt; if (p.pendT <= 0) s._enter(p, p.pend, p.pdur); }
    else if (p.tIn >= p.dur) s._next(p);
    var u = clamp(p.tIn / p.dur, 0, 1), ph = p.ph, dx = 0, dy = 0, rot = 0, bd = 0, sc = 1, arm = 0, hand = 0;
    var br = Math.sin(t * 1.3 + ph);
    switch (p.st) {
      case ST.IDLE: rot = Math.sin(t * 0.4 + ph) * 0.03; dy = br * 0.02; break;
      case ST.ATTN: dy = 0.12; sc = 1.05; rot = Math.sin(t * 0.5 + ph) * 0.015; bd = -0.04; break;
      case ST.NOD: dy = 0.1 + 0.2 * Math.sin(t * 5.2 + ph); sc = 1.04; break;
      case ST.PHONE: dy = 0.5; sc = 1.0; rot = 0.04 * Math.sin(t * 0.7 + ph); bd = 0.1; break;
      case ST.WHISPER: { var pr2 = p.partner >= 0 ? s.ppl[p.partner] : null; var dr = pr2 ? (pr2.x > p.x ? 1 : -1) : p.dir; rot = 0.22 * dr; dx = 0.5 * dr; dy = 0.08; break; }
      case ST.LOOK: rot = 0.08 * p.dir + Math.sin(t * 0.6 + ph) * 0.03; dx = 0.35 * p.dir; dy = -0.04; bd = 0.16; sc = 0.97; break;
      case ST.COUGH: dy = 0.38 + 0.08 * Math.sin(t * 24); rot = 0.05 * Math.sin(t * 21); hand = 1; bd = 0.06; break;
      case ST.CLAP: dy = 0.04 + 0.03 * Math.sin(t * 9 + ph); sc = 1.03; arm = 1; break;
      case ST.LAUGH: rot = -0.1 * Math.sin(t * 3 + ph); dy = -0.12 + 0.16 * Math.abs(Math.sin(t * 14 + ph)); bd = 0.1 * Math.sin(t * 14 + ph); break;
      case ST.STRETCH: { var bump = Math.sin(Math.PI * u); dy = -0.2 * bump; bd = -0.25 * bump; sc = 1 + 0.03 * bump; arm = 2 * bump; break; }
      case ST.HAND: dy = 0.0; sc = 1.03; hand = 2; break;
      case ST.RING: dy = 0.5 + 0.04 * Math.sin(t * 20); bd = 0.1; break;
    }
    if (p.stand > 0.02) { dy -= 0; }
    p.pdx += (dx - p.pdx) * kp; p.pdy += (dy - p.pdy) * kp; p.prot += (rot - p.prot) * kp;
    p.pbd += (bd - p.pbd) * kp; p.psc += (sc - p.psc) * kp;
    p.arm = arm; p.handM = hand;
    p.pbd += br * 0.0015;
  }
  // walkers
  for (i = s.walkers.length - 1; i >= 0; i--) {
    var wk = s.walkers[i]; wk.t += dt;
    var pts = wk.pts, tt = wk.t, acc = 0, j, done = true;
    for (j = 0; j < pts.length - 1; j++) {
      var seg = wk.durs[j];
      if (tt < acc + seg) {
        var f = (tt - acc) / seg;
        var a0 = pts[j], a1 = pts[j + 1];
        wk.x = a0.x + (a1.x - a0.x) * f; wk.y = a0.y + (a1.y - a0.y) * f; wk.r = a0.r + (a1.r - a0.r) * f; wk.leg = j;
        done = false; break;
      }
      acc += seg;
    }
    if (wk.mode === 'out' && wk.t > wk.durs[0] + wk.durs[1] + wk.durs[2] - 1.2) s.doorHold = Math.max(s.doorHold, 1.4);
    if (wk.mode === 'in' && wk.t < 1.8) s.doorHold = Math.max(s.doorHold, 1.4);
    if (done) {
      var q = wk.p;
      if (wk.mode === 'in') { q.walk = false; q.empty = false; q.stand = 1; q.standT = 0; q.x = q.x; s._enter(q, ST.IDLE, rr2(s, 1, 2)); }
      else { q.walk = false; q.empty = true; q.stand = 0; q.standT = 0; }
      s.walkers.splice(i, 1);
    }
  }
  if (s.photo) s._photoUpdate(dt);
};

/* ---------- photographic crowd (optional: needs StageScene.loadPhotos) ---------- */
var PH_W = 1536, PH_H = 1024, PH_Y0 = 30;
function sstep(x, a, b) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
StageScene.PHOTOS = null;
StageScene.loadPhotos = function (base) {
  if (StageScene.PHOTOS) return Promise.resolve(StageScene.PHOTOS);
  var names = ['base', 'bored', 'engaged', 'applause'], out = {};
  return Promise.all(names.map(function (n) {
    return new Promise(function (res, rej) {
      var im = new Image(); im.onload = function () { out[n] = im; res(); }; im.onerror = function () { rej(new Error('photo ' + n)); };
      im.src = (base || '') + 'crowd-' + n + '.webp';
    });
  })).then(function () { StageScene.PHOTOS = out; return out; });
};
P._view = function () {
  var W = this.W, H = this.H, k = Math.max(W / PH_W, H / (PH_H - PH_Y0 - 20));
  return { k: k, sx0: (PH_W - W / k) / 2, sy0: PH_Y0 };
};
P._photoUpdate = function (dt) {
  var s = this, A = s.att, t = s.t, c, n, nm = ['base', 'bored', 'engaged', 'applause'];
  var kk = 1 - Math.exp(-dt * (s.clapping || s.mode === 'applause' || s.pw.applause > 0.2 ? 3 : 1.1));
  if (!s.pwz) { s.pwz = []; for (c = 0; c < 5; c++) s.pwz.push({ base: 1, bored: 0, engaged: 0, applause: 0 }); }
  for (c = 0; c < 5; c++) {
    // each part of the room drifts on its own: some people tune in earlier, some drift off
    var Ac = clamp(A + 0.24 * Math.sin(t * 0.23 + c * 1.7) + 0.1 * Math.sin(t * 0.51 + c * 2.9), 0, 1), tw;
    if (s.mode === 'applause' || s.clapping) tw = { base: 0, bored: 0, engaged: 0, applause: 1 };
    else {
      var e = sstep(Ac, 0.55, 0.92) * (0.6 + 0.4 * (0.5 + 0.5 * Math.sin(t * 0.7 + c)));
      var b = sstep(Ac, 0.52, 0.12) * (0.65 + 0.35 * (0.5 + 0.5 * Math.sin(t * 0.5 + c * 2)));
      if (s.mode === 'prep') { b = Math.max(b, 0.25 * s.L.chat); e = 0; }
      if (s.mode === 'intro') { e = 0; b *= 0.5; }
      tw = { base: Math.max(0.12, 1 - e - b), bored: b, engaged: e, applause: 0 };
    }
    for (n = 0; n < 4; n++) s.pwz[c][nm[n]] += (tw[nm[n]] - s.pwz[c][nm[n]]) * (kk * (0.8 + 0.2 * Math.sin(c * 3.1 + 1)));
  }
  var tot = { base: 0, bored: 0, engaged: 0, applause: 0 };
  for (c = 0; c < 5; c++) for (n = 0; n < 4; n++) tot[nm[n]] += s.pwz[c][nm[n]] / 5;
  s.pw = tot;
  // ambient life: heads tilt, people shift, nod along. More restless when attention is low.
  s._amb -= dt;
  if (s._amb <= 0) {
    s._amb = (0.3 + Math.random() * 0.7) / (1 + 1.6 * (1 - A));
    if (!s.clapping && s.mode !== 'applause') {
      var r = Math.random(), kind = r < 0.35 ? 'tilt' : r < 0.65 ? 'shift' : (s.voice > 0.25 && A > 0.5 ? 'nod' : 'look');
      s._patch(0.05 + Math.random() * 0.9, kind, 1.2 + Math.random() * 1.6);
    }
  }
  for (n = s.patches.length - 1; n >= 0; n--) { s.patches[n].u += dt / s.patches[n].dur; if (s.patches[n].u >= 1) s.patches.splice(n, 1); }
  for (n = s.glows.length - 1; n >= 0; n--) { s.glows[n].u += dt / s.glows[n].dur; if (s.glows[n].u >= 1) s.glows.splice(n, 1); }
  if (s._flash > 0) s._flash -= dt;
};
P._dom = function () {
  var best = 'base', bw = -1, n;
  for (n in this.pw) if (this.pw[n] > bw) { bw = this.pw[n]; best = n; }
  return this.photo[best];
};
P._rowY = function () {
  // rows of faces sit roughly between y=130 and y=570 in the photo; weight toward the middle
  var u = (Math.random() + Math.random()) / 2; return 130 + u * 440;
};
P._patch = function (x01, kind, dur, y) {
  var s = this; if (!s.photo || s.patches.length > 30) return null;
  var ix = x01 * PH_W, iy = y || s._rowY(), hr = 14 + (iy - 100) * 0.085;
  var pw = hr * 3.4, ph = hr * 4.0, v = s._view(), d = s.d;
  var c = mk(pw * v.k * d, ph * v.k * d), g = c.getContext('2d');
  g.drawImage(s._dom(), ix - pw / 2, iy - ph / 2, pw, ph, 0, 0, c.width, c.height);
  var rg = g.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.18, c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.5);
  rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in'; g.fillStyle = rg; g.fillRect(0, 0, c.width, c.height);
  var p = { c: c, ix: ix, iy: iy, hr: hr, pw: pw, ph: ph, kind: kind, u: 0, dur: dur || 1.6, dir: Math.random() < 0.5 ? -1 : 1 };
  s.patches.push(p); return p;
};
P._camOff = function (yc) {
  // parallax: the speaker sways a little, near rows move more than far rows
  var t = this.t, W = this.W, H = this.H, near = clamp(yc / (H * 0.8), 0, 1), nf = 0.2 + 0.8 * near;
  var cam = (Math.sin(t * 0.37) * 2.4 + Math.sin(t * 0.83 + 1) * 1.0 + Math.sin(t * 0.13 + 2) * 1.6) * (W / 1000);
  return { x: cam * nf, y: Math.sin(t * 1.15 + near * 2.2) * 0.7 * nf + Math.sin(t * 0.55 + near) * 0.5 * nf };
};
P._photoDraw = function (g, swx, swy) {
  var s = this, ph = s.photo, v = s._view(), W = s.W, H = s.H, d = s.d, n, c, a, S, i;
  var order = ['base', 'bored', 'engaged', 'applause'];
  var breath = 1.02 + 0.006 * Math.sin(s.t * 0.8) + (s.ovation ? 0.006 * Math.abs(Math.sin(s.t * 4)) : 0);
  var mixKey = s.W + 'x' + s.H + ':' + s.d; s._mixDirty = (s._mixKey !== mixKey); s._mixKey = mixKey;
  var k = v.k * breath, sw = W / k, sh = H / k;
  var sx = clamp((PH_W - sw) / 2, 0, PH_W - sw), sy = clamp(v.sy0 + 6, 0, PH_H - sh);
  // crowd mix, five columns that each react on their own
  if (!s.mixC || s.mixC.width !== Math.round(W * d) || s.mixC.height !== Math.round(H * d)) { s.mixC = mk(W * d, H * d); s.mixG = s.mixC.getContext('2d'); }
  var m = s.mixG, cw = sw / 5;
  m.setTransform(d, 0, 0, d, 0, 0);
  s._mixN = (s._mixN || 0) + 1;
  if (s._mixN % 4 === 1 || s._mixDirty) for (c = 0; c < 5; c++) {
    var w0 = s.pwz ? s.pwz[c] : s.pw, dx0 = c * W / 5, dw = W / 5 + 1;
    S = w0.base; m.globalAlpha = 1; m.drawImage(ph.base, sx + c * cw, sy, cw + 0.4, sh, dx0, 0, dw, H);
    for (n = 1; n < 4; n++) {
      var w = w0[order[n]]; if (w < 0.004) continue;
      S += w; m.globalAlpha = w / S; m.drawImage(ph[order[n]], sx + c * cw, sy, cw + 0.4, sh, dx0, 0, dw, H);
    }
  }
  m.globalAlpha = 1;
  // depth strips with parallax
  var NS = 12, sh2 = H / NS, mk1 = Math.round(sh2 * d);
  g.globalAlpha = 1;
  for (i = 0; i < NS; i++) {
    var o = s._camOff((i + 0.5) * sh2), y0 = i * sh2;
    g.drawImage(s.mixC, 0, Math.floor(y0 * d), W * d, Math.ceil(sh2 * d) + 1, o.x, y0 + o.y, W, sh2 + 1 / d);
  }
  s._vw = { k: k, sx: sx, sy: sy };
  // moving heads
  for (n = 0; n < s.patches.length; n++) {
    var p = s.patches[n], u = p.u, env = Math.sin(Math.PI * clamp(u, 0, 1)); env = Math.min(1, env * 2.2);
    var dx = 0, dy = 0, rot = 0, hr = p.hr;
    switch (p.kind) {
      case 'cough': dy = hr * 0.5 * Math.abs(Math.sin(u * Math.PI * 5)) * (1 - u * 0.5); rot = 0.07 * Math.sin(u * 30); break;
      case 'clear': dy = hr * 0.28 * Math.abs(Math.sin(u * Math.PI * 3)); break;
      case 'whisper': dx = p.dir * hr * 0.5 * env; rot = p.dir * 0.14 * env; break;
      case 'shift': dx = p.dir * hr * 0.2 * Math.sin(u * Math.PI); dy = -hr * 0.12 * Math.sin(u * Math.PI); break;
      case 'tilt': rot = p.dir * 0.1 * Math.sin(u * Math.PI); dy = hr * 0.06 * Math.sin(u * Math.PI); break;
      case 'nod': dy = hr * 0.22 * Math.abs(Math.sin(u * Math.PI * 2.5)); break;
      case 'laugh': dy = -hr * 0.14 + hr * 0.2 * Math.abs(Math.sin(u * 30)); rot = 0.08 * Math.sin(u * 22); break;
      case 'look': dx = p.dir * hr * 0.24 * env; rot = p.dir * 0.1 * env; break;
    }
    var cx = (p.ix - sx) * k, cy = (p.iy - sy) * k, co = s._camOff(cy);
    g.save(); g.globalAlpha = env; g.translate(cx + co.x + dx * k, cy + co.y + dy * k); g.rotate(rot);
    g.drawImage(p.c, -p.pw * k / 2, -p.ph * k / 2, p.pw * k, p.ph * k); g.restore();
  }
  g.globalAlpha = 1;
};
P._photoOverlays = function (g) {
  var s = this, W = s.W, H = s.H, v = s._vw || s._view(), n;
  g.globalCompositeOperation = 'lighter';
  for (n = 0; n < s.glows.length; n++) {
    var q = s.glows[n], cx = (q.ix - (v.sx || 0)) * (v.k), cy = (q.iy - (v.sy || 0)) * v.k, r = q.hr * v.k * (q.ring ? 3.4 : 2.6);
    var fl = q.ring ? (Math.sin(q.u * 70) > 0 ? 1 : 0.35) : (0.7 + 0.2 * Math.sin(q.u * 20));
    g.globalAlpha = fl * Math.min(1, (1 - q.u) * 4) * Math.min(1, q.u * 8);
    g.drawImage(s.sp.blue, cx - r, cy - r, r * 2, r * 2);
  }
  var sh = 0.1 + 0.07 * Math.sin(s.t * 1.3) + 0.04 * Math.sin(s.t * 3.7 + 1), lx = [0.04, 0.49, 0.92], li;
  for (li = 0; li < 3; li++) { g.globalAlpha = sh * (0.7 + 0.3 * Math.sin(s.t * 0.9 + li * 2)); g.drawImage(s.sp.warm, W * lx[li] - W * 0.12, -H * 0.05, W * 0.24, H * 0.3); }
  if (s._flash > 0) { g.globalAlpha = Math.min(1, s._flash) * 0.8; g.drawImage(s.sp.warm, W * 0.9, H * 0.05, W * 0.2, H * 0.4); }
  g.globalAlpha = 1;
};
P._photoTrigger = function (name, o) {
  var s = this, x = (o.x == null ? 0.08 + Math.random() * 0.84 : o.x), res = { x: x }, i, y = s._rowY();
  switch (name) {
    case 'cough': s._patch(x, 'cough', 1.5, y); break;
    case 'throatClear': s._patch(x, 'clear', 1.0, y); break;
    case 'whisper': s._patch(x, 'whisper', 3.8, y); s._patch(Math.min(0.97, x + 0.035), 'whisper', 3.8, y); break;
    case 'shift': for (i = 0; i < 3; i++) s._patch(0.06 + Math.random() * 0.88, 'shift', 1.8 + Math.random(), null); break;
    case 'phone': s.glows.push({ ix: x * PH_W, iy: y, hr: 14 + (y - 100) * 0.085, u: 0, dur: 9, ring: false }); break;
    case 'phoneRing': s.glows.push({ ix: x * PH_W, iy: y, hr: 14 + (y - 100) * 0.085, u: 0, dur: 3.8, ring: true });
      for (i = 0; i < 4; i++) s._patch(clamp(x + (Math.random() - 0.5) * 0.12, 0.05, 0.95), 'look', 2.2, y + (Math.random() - 0.5) * 60); break;
    case 'laugh': for (i = 0; i < 9; i++) s._patch(0.06 + Math.random() * 0.88, 'laugh', 1.8 + Math.random(), null); break;
    case 'lateComer': s._flash = 1.8; res.x = 0.96; break;
    case 'walkOut': res.x = 0.95; setTimeout(function () { s._flash = 1.6; }, 3200); break;
    case 'clapStart': s.clapping = true; break;
    case 'clapStop': s.clapping = false; s.ovation = false; break;
    case 'standOvation': s.ovation = true; s.clapping = true; break;
    case 'settle': s.clapping = false; s.ovation = false; break;
    case 'lean': for (i = 0; i < 5; i++) s._patch(0.06 + Math.random() * 0.88, 'look', 3, null); break;
  }
  return res;
};

/* ---------- public API ---------- */
P.setAttention = function (a) { this.attT = clamp(+a || 0, 0, 1); };
P.setVoice = function (v) { this.voiceT = clamp(+v || 0, 0, 1); };
P.setMood = function (m) { if (m === 'supportive' || m === 'neutral' || m === 'tough') this.mood = m; };
P.setMonitor = function (o) {
  o = o || {};
  var m = this.mon;
  if (o.elapsed != null) m.elapsed = +o.elapsed || 0;
  if (o.total != null) m.total = +o.total || 0;
  if (o.label != null) m.label = String(o.label);
  if (o.state != null) m.state = o.state;
  if (o.topic != null) m.topic = String(o.topic);
};
P.setMode = function (mode) {
  var cfg = MODES[mode]; if (!cfg) return;
  var prev = this.mode; this.mode = mode;
  this.LT.house = cfg.house; this.LT.spot = cfg.spot; this.LT.chat = cfg.chat;
  if (mode === 'applause') { if (!this.clapping) this.trigger('clapStart'); }
  else if (prev === 'applause') { this.trigger('clapStop'); if (this.ovation) this._endOvation(); }
  if (mode === 'qa') {
    var n = 0, tries = 0;
    while (n < 3 && tries++ < 40) { var p = this._nearest(null); if (p.st !== ST.HAND) { this._later(p, ST.HAND, rr2(this, 8, 18), rr2(this, 0.4, 3)); n++; } }
  }
};
P.pickX = function () { if (this.photo) return 0.08 + Math.random() * 0.84;
  return this._pickXp();
};
P._pickXp = function () { var p = this._nearest(null); return p.x / this.W; };
P._endOvation = function () {
  this.ovation = false;
  for (var i = 0; i < this.ppl.length; i++) { var p = this.ppl[i]; if (!p.walk) p.standT = 0; }
};
P.trigger = function (name, o) {
  o = o || {}; var s = this, i, p, x01 = o.x, res = { x: 0.5 }, n, q;
  if (s.photo) return s._photoTrigger(name, o);
  var W = s.W;
  switch (name) {
    case 'cough': case 'throatClear':
      p = s._nearest(x01); if (!p) break; res.x = p.x / W;
      s._enter(p, ST.COUGH, name === 'cough' ? rr2(s, 1.2, 1.7) : rr2(s, 0.8, 1.1));
      if (name === 'throatClear') { q = s._neighbor(p); if (q) s._later(q, ST.LOOK, 1.5, 0.3); }
      break;
    case 'whisper':
      p = s._nearest(x01); if (!p) break; res.x = p.x / W; q = s._neighbor(p);
      if (q) { var dd = rr2(s, 3, 5.5); s._enter(p, ST.WHISPER, dd, q.idx); s._enter(q, ST.WHISPER, dd, p.idx); }
      break;
    case 'phone':
      p = s._nearest(x01); if (!p) break; res.x = p.x / W; s._enter(p, ST.PHONE, rr2(s, 7, 14)); break;
    case 'phoneRing':
      p = s._nearest(x01); if (!p) break; res.x = p.x / W; s._enter(p, ST.RING, rr2(s, 3.2, 4.2));
      for (i = -2; i <= 2; i++) { q = s.rowP[p.row][p.col + i]; if (q && q !== p && s._ok(q) && !s.clapping) s._later(q, ST.LOOK, rr2(s, 1.5, 2.5), rr2(s, 0.15, 0.9)); }
      break;
    case 'clapStart':
      s.clapping = true;
      for (i = 0; i < s.ppl.length; i++) { p = s.ppl[i]; if (s._ok(p)) s._later(p, ST.CLAP, 1e9, rr2(s, 0, 1.3)); }
      res.x = 0.5; break;
    case 'clapStop':
      s.clapping = false;
      for (i = 0; i < s.ppl.length; i++) { p = s.ppl[i]; if (s._ok(p) && (p.st === ST.CLAP || p.pend === ST.CLAP)) { if (p.pendT > 0) { p.pendT = 0; } s._later(p, ST.IDLE, rr2(s, 1.2, 3), rr2(s, 0, 1.2)); } }
      if (s.ovation) s._endOvation();
      break;
    case 'laugh':
      n = 0; p = s._nearest(x01); res.x = p ? p.x / W : 0.5;
      for (i = 0; i < s.ppl.length; i++) {
        q = s.ppl[i]; if (!s._ok(q) || s.clapping) continue;
        var near = p ? Math.abs(q.x - p.x) / W < 0.3 : true;
        if (s.rnd() < (near ? 0.65 : 0.35)) s._later(q, ST.LAUGH, rr2(s, 1.6, 2.8), rr2(s, 0, 0.9));
      }
      break;
    case 'lateComer': s._lateComer(res); break;
    case 'walkOut': s._walkOut(res, x01); break;
    case 'lean':
      for (i = 0; i < s.ppl.length; i++) { p = s.ppl[i]; if (s._ok(p) && s.rnd() < 0.4 && !s.clapping) s._later(p, ST.ATTN, rr2(s, 3, 5), rr2(s, 0, 1.2)); }
      break;
    case 'shift':
      for (i = 0; i < s.ppl.length; i++) { p = s.ppl[i]; if (s._ok(p) && s.rnd() < 0.25 && !s.clapping) s._later(p, ST.STRETCH, rr2(s, 1.6, 2.4), rr2(s, 0, 1.6)); }
      break;
    case 'settle':
      s.clapping = false; if (s.ovation) s._endOvation();
      for (i = 0; i < s.ppl.length; i++) { p = s.ppl[i]; if (s._ok(p)) { p.pendT = 0; s._later(p, s.rnd() < 0.55 ? ST.ATTN : ST.IDLE, rr2(s, 2, 5), rr2(s, 0, 1.8)); } }
      break;
    case 'standOvation':
      s.ovation = true; s.clapping = true;
      for (i = 0; i < s.ppl.length; i++) {
        p = s.ppl[i]; if (!s._ok(p)) continue;
        s._later(p, ST.CLAP, 1e9, rr2(s, 0, 1.0));
        var dl = rr2(s, 0.2, 3.2) + (6 - p.row) * 0.08;
        (function (pp, d0) { pp._standAt = s.t + d0; })(p, dl);
        p.standT = 0; p._stand = true;
      }
      s._ovT = 0;
      break;
  }
  return res;
};
P._ovationTick = function () {
  if (!this.ovation) return;
  for (var i = 0; i < this.ppl.length; i++) { var p = this.ppl[i]; if (p._stand && p._standAt <= this.t && !p.walk && !p.empty) { p.standT = 1; p._stand = false; } }
};

P._lateComer = function (res) {
  var s = this, emp = [], i, p;
  for (i = 0; i < s.ppl.length; i++) if (s.ppl[i].empty && !s.ppl[i].walk) emp.push(s.ppl[i]);
  if (!emp.length) { res.x = 0.96; s.doorHold = 1.6; return; }
  p = emp[Math.floor(s.rnd() * emp.length)];
  var d0 = s._rowAt(-0.8), r0 = s._rowAt(p.row), ax = s.aisleX;
  var door = { x: s.doorR.x + s.doorR.w / 2, y: d0.y - 2.1 * d0.r, r: d0.r };
  var a1 = { x: ax, y: r0.y - 2.1 * r0.r, r: r0.r };
  var seat = { x: p.x, y: p.y - 2.1 * p.r, r: p.r };
  p.walk = true; p.empty = false; p.stand = 1; p.standT = 1;
  s.doorHold = 1.8;
  s.walkers.push({ p: p, mode: 'in', t: 0, pts: [door, { x: ax, y: door.y + 2, r: door.r }, a1, seat], durs: [0.5, 2.4 + (p.row * 0.1), 1.0], x: door.x, y: door.y, r: door.r, leg: 0, row: p.row });
  res.x = p.x / s.W;
};
P._walkOut = function (res, x01) {
  var s = this, i, c = [], p;
  for (i = 0; i < s.ppl.length; i++) { p = s.ppl[i]; if (s._ok(p) && p.col >= p.n - 2 && p.row >= 1) c.push(p); }
  if (!c.length) return;
  p = c[Math.floor(s.rnd() * c.length)];
  var d0 = s._rowAt(-0.8), r0 = s._rowAt(p.row), ax = s.aisleX;
  var seat = { x: p.x, y: p.y - 2.1 * p.r, r: p.r };
  var a1 = { x: ax, y: r0.y - 2.1 * r0.r, r: r0.r };
  var door = { x: s.doorR.x + s.doorR.w / 2, y: d0.y - 2.1 * d0.r, r: d0.r };
  p.standT = 1; p.pendT = 0; s._enter(p, ST.IDLE, 5);
  res.x = p.x / s.W;
  // wait for the stand-up (0.9s) before they begin walking
  s.walkers.push({ p: p, mode: 'out', t: 0, base: p.y, pts: [{ x: seat.x, y: p.y, r: seat.r }, seat, a1, { x: ax, y: door.y + 2, r: door.r }, door], durs: [0.8, 1.0, 2.6, 0.5], x: seat.x, y: p.y, r: seat.r, leg: 0, row: p.row });
  p.walk = true; p.wk = s.walkers[s.walkers.length - 1];
};

P.start = function () {
  if (this.running) return;
  this.running = true; this.last = 0;
  this.raf = requestAnimationFrame(this._bound);
};
P.stop = function () {
  this.running = false;
  if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
};
P._loop = function (ts) {
  if (!this.running) return;
  this.raf = requestAnimationFrame(this._bound);
  var dt = this.last ? Math.min(0.1, (ts - this.last) / 1000) : 0.016;
  this.last = ts;
  var t0 = performance.now();
  this.update(dt); this._ovationTick(); this.render();
  var ms = performance.now() - t0;
  this._ms = this._nf++ ? this._ms * 0.92 + ms * 0.08 : ms;
  if (dt > 0) this._fps = this._fps * 0.92 + (1 / dt) * 0.08;
};
P.getStats = function () { return { fps: Math.round(this._fps * 10) / 10, avgFrameMs: Math.round(this._ms * 100) / 100 }; };
// test helper: step simulation without rendering
P.advance = function (sec) { var st = 1 / 30; while (sec > 0) { this.update(Math.min(st, sec)); this._ovationTick(); sec -= st; } };

/* ---------- rendering ---------- */
P._armsOn = function (p) {
  var st = p.st;
  if (!(st <= ST.NOD || st === ST.LOOK) || p.stand > 0.05) return false;
  return this.mood === 'tough' ? p.armsR < 0.5 : (this.mood === 'neutral' ? p.armsR < 0.1 : false);
};

P._person = function (g, p, ox, oy) {
  var d = this.d, r = p.r, x = p.x + ox, y = p.y + oy, lift = p.stand * 2.1 * r, st = p.st, t = this.t;
  var hx = x + p.pdx * r, hy = y + p.pdy * r + p.pbd * r * 0.5 - lift, by = y + 0.32 * r + p.pbd * r - lift, bw = p.bw;
  var gl = this._gl, k;
  if (p.stand > 0.02) { g.fillStyle = p.shirtD; g.fillRect(x - bw * 0.97, by + p.bsH - 1, bw * 1.94, lift + r * 0.6); }
  g.drawImage(p.bs_c, x - p.bsW / 2, by, p.bsW, p.bsH);
  var cy, sy;
  if (this._armsOn(p)) {
    g.fillStyle = p.shirtD; g.fillRect(x - bw * 0.8, by + r * 1.5, bw * 1.6, r * 0.72);
    g.fillStyle = 'rgba(255,255,255,.09)'; g.fillRect(x - bw * 0.8, by + r * 1.5, bw * 1.6, 1);
    g.fillStyle = p.skinF; g.beginPath(); g.arc(x - bw * 0.52, by + r * 1.86, r * 0.19, 0, TAU); g.arc(x + bw * 0.52, by + r * 1.86, r * 0.19, 0, TAU); g.fill();
  }
  // head
  var c = Math.cos(p.prot), s2 = Math.sin(p.prot), sc = p.psc;
  g.setTransform(d * c * sc, d * s2 * sc, -d * s2 * sc, d * c * sc, d * hx, d * hy);
  g.drawImage(p.hs_c, -p.hsOx, -p.hsOy, p.hsW, p.hsH);
  g.setTransform(d, 0, 0, d, 0, 0);
  // props
  if (st === ST.PHONE || st === ST.RING) {
    var py = by + r * 1.55 + p.pdy * r * 0.3;
    g.save(); g.translate(x + r * 0.1, py); g.rotate(0.1);
    g.fillStyle = '#0c0d11'; rrect(g, -r * 0.38, -r * 0.2, r * 0.76, r * 1.2, r * 0.12); g.fill();
    g.fillStyle = '#2a2d36'; g.fillRect(-r * 0.2, r * 0.0, r * 0.14, r * 0.14);
    g.restore();
    g.fillStyle = p.skinF; g.beginPath(); g.arc(x - r * 0.52, py + r * 0.55, r * 0.22, 0, TAU); g.arc(x + r * 0.7, py + r * 0.5, r * 0.22, 0, TAU); g.fill();
    k = gl.n++;
    var fl = st === ST.RING ? (Math.sin(t * 15) > 0 ? 1 : 0.35) : 0.62 + 0.18 * Math.sin(t * 3 + p.ph) + (Math.sin(t * 0.9 + p.ph * 3) > 0.7 ? 0.2 : 0);
    gl.x[k] = hx; gl.y[k] = hy + r * 1.0; gl.r[k] = r * (st === ST.RING ? 3.2 : 2.5); gl.a[k] = fl;
  } else if (st === ST.COUGH) {
    var hdx = hx + p.dir * r * 0.12, hdy = hy + r * 0.7;
    g.strokeStyle = p.shirtF; g.lineWidth = r * 0.55; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x + p.dir * bw * 0.6, by + r * 2.8); g.lineTo(hdx + p.dir * r * 0.2, hdy + r * 0.5); g.stroke();
    g.fillStyle = p.skinF; g.beginPath(); g.arc(hdx, hdy, r * 0.36, 0, TAU); g.fill();
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.arc(hdx + r * 0.05, hdy + r * 0.12, r * 0.3, 0, Math.PI); g.fill();
  } else if (st === ST.CLAP) {
    var ph = Math.sin(t * 10.5 + p.ph) * 0.5 + 0.5, gap = r * (0.1 + 0.55 * ph);
    cy = hy + r * (2.3 - p.stand * 0.5);
    g.strokeStyle = p.shirtF; g.lineWidth = r * 0.42; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - bw * 0.68, by + r * 2.7); g.lineTo(hx - gap, cy); g.moveTo(x + bw * 0.68, by + r * 2.7); g.lineTo(hx + gap, cy); g.stroke();
    g.fillStyle = p.skinF; g.beginPath(); g.arc(hx - gap, cy, r * 0.34, 0, TAU); g.arc(hx + gap, cy, r * 0.34, 0, TAU); g.fill();
  } else if (st === ST.STRETCH && p.arm > 0.05) {
    sy = hy - r * (0.1 + p.arm * 1.2);
    g.strokeStyle = p.shirtF; g.lineWidth = r * 0.55; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - bw * 0.75, by + r * 2.5); g.lineTo(x - bw * 0.95, sy); g.moveTo(x + bw * 0.75, by + r * 2.5); g.lineTo(x + bw * 0.95, sy); g.stroke();
    g.fillStyle = p.skinF; g.beginPath(); g.arc(x - bw * 0.95, sy, r * 0.3, 0, TAU); g.arc(x + bw * 0.95, sy, r * 0.3, 0, TAU); g.fill();
  } else if (st === ST.HAND) {
    var e = Math.min(1, p.tIn * 2.2); e = e * e * (3 - 2 * e);
    var ax = x + p.dir * bw * 0.8, ty = by + r * 2.8 - e * (r * 4.4 + p.psc);
    g.strokeStyle = p.shirtF; g.lineWidth = r * 0.55; g.lineCap = 'round';
    g.beginPath(); g.moveTo(ax, by + r * 2.8); g.lineTo(ax + p.dir * r * 0.1, ty); g.stroke();
    g.fillStyle = p.skinF; g.beginPath(); g.ellipse(ax + p.dir * r * 0.1, ty - r * 0.2, r * 0.26, r * 0.36, 0, 0, TAU); g.fill();
  }
};

P._walker = function (g, wk, ox, oy) {
  var p = wk.p, d = this.d, sc = wk.r / p.r, r = wk.r, x = wk.x + ox, y = wk.y + oy, t = this.t;
  var bob = Math.abs(Math.sin(t * 7 + p.ph)) * r * 0.12, by = y + 0.32 * r - bob, bw = p.bw * sc;
  var feet = y + 8.4 * r, legsOn = wk.mode === 'in' ? wk.leg < 2 : wk.leg >= 1;
  var seatLift = (wk.mode === 'out' && wk.leg === 0) ? clamp((wk.base - wk.y) / (2.1 * r), 0, 1) : 1;
  if (legsOn && seatLift > 0.5) {
    var sw = Math.sin(t * 7 + p.ph) * r * 0.35;
    g.fillStyle = '#14151b';
    g.beginPath(); g.moveTo(x - bw * 0.62, by + p.bsH * sc - 2); g.lineTo(x - bw * 0.04, by + p.bsH * sc - 2); g.lineTo(x - bw * 0.08 + sw, feet); g.lineTo(x - bw * 0.52 + sw, feet); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x + bw * 0.04, by + p.bsH * sc - 2); g.lineTo(x + bw * 0.62, by + p.bsH * sc - 2); g.lineTo(x + bw * 0.52 - sw, feet); g.lineTo(x + bw * 0.08 - sw, feet); g.closePath(); g.fill();
    g.fillStyle = '#0a0a0c'; g.fillRect(x - bw * 0.54 + sw, feet - 1, bw * 0.48, 2); g.fillRect(x + bw * 0.06 - sw, feet - 1, bw * 0.48, 2);
  } else if (seatLift > 0.02) {
    g.fillStyle = p.shirtD; g.fillRect(x - bw * 0.97, by + p.bsH * sc - 1, bw * 1.94, r * 2.2 * seatLift + r * 0.5);
  }
  g.drawImage(p.bs_c, x - p.bsW * sc / 2, by, p.bsW * sc, p.bsH * sc);
  g.setTransform(d * sc, 0, 0, d * sc, d * x, d * (y - bob));
  g.drawImage(p.hs_c, -p.hsOx, -p.hsOy, p.hsW, p.hsH);
  g.setTransform(d, 0, 0, d, 0, 0);
};

P._monDraw = function () {
  var m = this.mon, z = this.dz.mon, d = this.d;
  var key = Math.round(m.elapsed) + '|' + Math.round(m.total) + '|' + m.label + '|' + m.state + '|' + m.topic;
  if (key === this._monKey && this._monC) return;
  this._monKey = key;
  var w = z.w, h = z.h, c = this._monC;
  if (!c || c.width !== Math.round(w * d)) c = this._monC = mk(w * d, h * d);
  var g = c.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, h);
  var col = m.state === 'red' ? '#ff5a4d' : m.state === 'amber' ? '#ffc24d' : '#6dffa8';
  var bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#0a1016'); bg.addColorStop(1, '#04070a');
  g.fillStyle = bg; rrect(g, 0, 0, w, h, 3); g.fill();
  var mono = 'ui-monospace,Menlo,Consolas,"Courier New",monospace';
  var lab = (m.label || '').toUpperCase(), lc = lab === 'OPEN' ? '#4fd1c5' : lab === 'BODY' ? '#6aa8ff' : lab === 'CLOSE' ? '#b794ff' : lab === 'WRAP UP' ? '#ffc24d' : '#9aa6b5';
  g.textBaseline = 'middle';
  if (lab) {
    g.font = 'bold ' + (h * 0.14) + 'px ' + mono; var tw = g.measureText(lab).width + h * 0.16;
    g.fillStyle = lc; rrect(g, w * 0.04, h * 0.07, tw, h * 0.2, 2); g.fill();
    g.fillStyle = '#041014'; g.textAlign = 'center'; g.fillText(lab, w * 0.04 + tw / 2, h * 0.17 + 0.5);
  }
  var tx = w * 0.04 + (lab ? g.measureText(lab).width + h * 0.16 + w * 0.03 : 0);
  var topic = m.topic || '';
  g.font = (h * 0.125) + 'px system-ui,Arial,sans-serif'; g.textAlign = 'left'; g.fillStyle = '#8c97a6';
  var maxW = w * 0.86 - tx;
  while (topic.length > 2 && g.measureText(topic).width > maxW) topic = topic.slice(0, -2);
  if (topic !== (m.topic || '')) topic = topic.replace(/\s+$/, '') + String.fromCharCode(8230);
  g.fillText(topic, tx, h * 0.17 + 0.5);
  g.fillStyle = col; g.beginPath(); g.arc(w * 0.935, h * 0.17, h * 0.055, 0, TAU); g.fill();
  g.font = 'bold ' + (h * 0.43) + 'px ' + mono; g.textAlign = 'left'; g.fillStyle = col;
  g.fillText(fmt(m.elapsed), w * 0.04, h * 0.57);
  if (m.total > 0) {
    g.font = (h * 0.11) + 'px ' + mono; g.fillStyle = '#6c7787'; g.textAlign = 'right'; g.fillText('LEFT', w * 0.96, h * 0.42);
    g.font = 'bold ' + (h * 0.26) + 'px ' + mono; g.fillStyle = '#d3dae3'; g.fillText('-' + fmt(Math.max(0, m.total - m.elapsed)), w * 0.96, h * 0.62);
  }
  g.fillStyle = '#18202a'; g.fillRect(w * 0.04, h * 0.84, w * 0.92, h * 0.07);
  if (m.total > 0) { g.fillStyle = col; g.fillRect(w * 0.04, h * 0.84, w * 0.92 * clamp(m.elapsed / m.total, 0, 1), h * 0.07); }
  g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, 0, w, h * 0.35);
};

P.render = function () {
  var s = this, g = s.ctx, W = s.W, H = s.H, d = s.d, t = s.t, L = s.L, i, j, p, k;
  var q = 1 / d, swx = Math.round((Math.sin(t * 0.6) * 0.8 + Math.sin(t * 0.37 + 1) * 0.25) / q) * q, swy = Math.round((Math.sin(t * 0.5 + 1) * 0.7) / q) * q;
  var gl = s._gl; gl.n = 0;
  g.setTransform(d, 0, 0, d, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#050408'; g.fillRect(0, 0, W, H);
  var photo = s.photo;
  if (photo) s._photoDraw(g, swx, swy); else {
  g.drawImage(s.hallC, -4 + Math.round(swx * 0.3 / q) * q, -4 + Math.round(swy * 0.3 / q) * q, W + 8, s.hallH);
  // back door (interior light + leaf)
  var dr = s.doorR, dv = s.door;
  if (dv > 0.01) {
    g.globalAlpha = dv; g.fillStyle = '#f4dcae'; g.fillRect(dr.x, dr.y, dr.w, dr.h);
    var lg = g.createLinearGradient(dr.x, 0, dr.x + dr.w, 0);
    g.globalAlpha = 1;
  }
  g.fillStyle = '#2b2019'; g.fillRect(dr.x, dr.y, dr.w * (1 - 0.82 * dv), dr.h);
  g.fillStyle = 'rgba(255,230,190,.14)'; g.fillRect(dr.x, dr.y, 1, dr.h);
  g.fillStyle = '#b8955e'; g.fillRect(dr.x + dr.w * (1 - 0.82 * dv) - 3, dr.y + dr.h * 0.55, 1.6, 1.6);
  // rows
  for (i = 0; i < NR; i++) {
    var sh = 0.3 + 0.7 * s.rowS[i], ox = Math.round(swx * sh / q) * q, oy = Math.round(swy * sh / q) * q, stp = s.strips[i];
    var sh2 = stp.c.height / d;
    g.drawImage(stp.c, -4 + ox, stp.top - 4 + oy, W + 8, sh2);
    var row = s.rowP[i];
    for (j = 0; j < row.length; j++) { p = row[j]; if (!p.empty && !p.walk) s._person(g, p, ox, oy); }
  }
  for (i = 0; i < s.walkers.length; i++) s._walker(g, s.walkers[i], swx * 0.7, swy * 0.7);
  }
  // lighting: darken the hall
  var dark = (photo ? 0.16 : 0.64) * (1 - L.house);
  if (dark > 0.01) { g.globalAlpha = dark; g.fillStyle = '#04050f'; g.fillRect(0, 0, W, s.hallH - 8); g.globalAlpha = 1; }
  g.globalCompositeOperation = 'lighter';
  var amb = 0.55 * (L.house - 0.3);
  if (amb > 0.02 && !photo) { g.globalAlpha = amb; g.fillStyle = '#40362e'; g.fillRect(0, 0, W, s.hallH - 8); }
  if (!photo) {
  // ceiling light cones
  var ca = 0.1 + 0.16 * L.house + 0.1 * L.spot, cw = W * 0.2, ch = H * 0.62, cn = s.sp.cone;
  g.globalAlpha = ca;
  for (i = 0; i < 3; i++) g.drawImage(cn, W * (0.2 + i * 0.3) - cw / 2, 0, cw, ch);
  // warm fill from the lectern side
  var wa = 0.2 * L.spot + 0.03 * L.house;
  if (wa > 0.03) { g.globalAlpha = wa; g.drawImage(s.sp.warm, W * 0.05, H * 0.3, W * 0.9, H * 0.5); }
  // stage light bloom
  var fa = 0.15 + 0.55 * Math.max(L.spot, 0.3 * (1 - L.house));
  g.globalAlpha = fa * 0.9; g.drawImage(s.sp.white, W * 0.2 - 40, -26, 80, 70); g.drawImage(s.sp.white, W * 0.8 - 40, -26, 80, 70);
  g.globalAlpha = fa * 0.5; g.drawImage(s.sp.warm, W * 0.5 - W * 0.3, -H * 0.12, W * 0.6, H * 0.3);
  g.globalAlpha = fa * 0.35; g.drawImage(s.sp.white, W * 0.1, 3, W * 0.8, 6);
  // sconces
  g.globalAlpha = 0.5 + 0.3 * L.house;
  for (i = 0; i < s.sconces.length; i++) { var sc = s.sconces[i]; g.drawImage(s.sp.warm, sc.x - 26, sc.y - 22, 52, 52); }
  // exit sign + door glow
  var sg = s.sign;
  g.globalAlpha = 0.65 + 0.1 * Math.sin(t * 2.1); g.drawImage(s.sp.green, sg.x - sg.w * 0.9, sg.y - sg.h * 1.8, sg.w * 1.8, sg.h * 3.6);
  if (dv > 0.02) { g.globalAlpha = dv * 0.8; g.drawImage(s.sp.warm, dr.x - dr.w * 0.8, dr.y, dr.w * 2.6, dr.h * 1.2); }
  }
  if (photo) s._photoOverlays(g);
  // dust motes
  g.globalAlpha = 0.22 + 0.3 * L.spot + 0.2 * L.house; g.fillStyle = '#ffe8c0'; g.beginPath();
  for (i = 0; i < s._motes.length; i++) {
    var m = s._motes[i], mx = m.x * W + Math.sin(t * m.s * 4 + m.p) * 10, my = ((m.y + t * m.s * 0.04) % 1) * H * 0.62;
    g.rect(mx, my, 1.3 * m.a + 0.4, 1.3 * m.a + 0.4);
  }
  g.fill();
  // phone glows
  for (k = 0; k < gl.n; k++) {
    g.globalAlpha = gl.a[k]; g.drawImage(s.sp.blue, gl.x[k] - gl.r[k], gl.y[k] - gl.r[k], gl.r[k] * 2, gl.r[k] * 2);
  }
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  if (!photo) g.drawImage(s.sp.exit, s.sign.x - s.sign.w / 2, s.sign.y - s.sign.h / 2, s.sign.w, s.sign.h);
  // dais
  var dz = s.dz, ox2 = Math.round(-swx * 1.6 / q) * q, oy2 = Math.round(-swy * 1.6 / q) * q, vib = s.voice;
  g.drawImage(s.daisC, -4 + ox2, dz.y0 - 4 + oy2, W + 8, s.daisC.height / d);
  g.setTransform(d, 0, 0, d, d * ox2, d * oy2);
  s._monDraw();
  var mz = dz.mon;
  g.drawImage(s._monC, mz.x, mz.y, mz.w, mz.h);
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.5; g.drawImage(s.sp.warm, dz.lamp.x - 18 - 70, dz.lamp.y - 12 - 50, 140, 100);
  g.globalAlpha = 0.3; g.drawImage(s.sp.warm, dz.lamp.x - 120, dz.lamp.y + 8, 190, 60);
  g.globalAlpha = 0.9; g.drawImage(s.sp.white, dz.lamp.x - 14, dz.lamp.y - 24, 24, 24);
  var red = s.mon.state === 'red', amb = s.mon.state === 'amber';
  g.globalAlpha = 0.5 + (red ? 0.4 * Math.sin(t * 7) : 0); g.drawImage(red ? s.sp.red : amb ? s.sp.amber : s.sp.green, mz.x + mz.w * 0.935 - 12, mz.y + mz.h * 0.17 - 12, 24, 24);
  g.globalAlpha = 0.12; g.drawImage(s.sp.white, mz.x - 20, mz.y + mz.h - 8, mz.w + 40, 50);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  // mic
  var hx = dz.hx + Math.sin(t * 71) * vib * 0.9, hy = dz.hy + Math.cos(t * 83) * vib * 0.7;
  g.strokeStyle = '#0b0b0e'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(dz.bx, dz.by - 3); g.quadraticCurveTo(dz.bx + W * 0.07, dz.by - (dz.by - hy) * 0.55, hx, hy + 17); g.stroke();
  g.strokeStyle = '#6a6d76'; g.lineWidth = 1.3;
  g.beginPath(); g.moveTo(dz.bx - 1, dz.by - 3.5); g.quadraticCurveTo(dz.bx + W * 0.07 - 1, dz.by - (dz.by - hy) * 0.55, hx - 1, hy + 17); g.stroke();
  var pr = Math.max(9, H * 0.034);
  g.fillStyle = 'rgba(14,14,18,.62)'; g.beginPath(); g.arc(hx, hy, pr, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(70,72,80,.55)'; g.lineWidth = 0.6; g.beginPath();
  for (i = -2; i <= 2; i++) { g.moveTo(hx - pr, hy + i * pr * 0.34); g.lineTo(hx + pr, hy + i * pr * 0.34); g.moveTo(hx + i * pr * 0.34, hy - pr); g.lineTo(hx + i * pr * 0.34, hy + pr); }
  g.stroke();
  g.strokeStyle = '#2a2b31'; g.lineWidth = 2; g.beginPath(); g.arc(hx, hy, pr, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.beginPath(); g.arc(hx, hy, pr - 1, Math.PI * 1.05, Math.PI * 1.45); g.stroke();
  // LED
  var ly = hy + pr + 6, lc = s.voice > 0.9 ? s.sp.red : s.sp.green;
  g.fillStyle = s.voice > 0.9 ? '#ff6a5a' : (s.voice > 0.04 ? '#6dffa8' : '#1b3a28'); g.beginPath(); g.arc(hx, ly, 2, 0, TAU); g.fill();
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.15 + 0.85 * clamp(s.voice * 1.4, 0, 1);
  g.drawImage(lc, hx - 10, ly - 10, 20, 20);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  g.setTransform(d, 0, 0, d, 0, 0);
  g.drawImage(s.vigC, 0, 0, W, H);
  if (s._grainPat) {
    g.setTransform(1, 0, 0, 1, (Math.random() * 128) | 0, (Math.random() * 128) | 0); g.fillStyle = s._grainPat;
    g.fillRect(-128, -128, s.cv.width + 128, s.cv.height + 128); g.setTransform(d, 0, 0, d, 0, 0);
  }
};

global.StageScene = StageScene;
})(typeof window !== 'undefined' ? window : this);
