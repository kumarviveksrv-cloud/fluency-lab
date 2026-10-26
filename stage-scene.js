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
  var rn = mulberry32(this.seed), i, c, n, p;
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

P._head = function (p) {
  var d = this.d, r = p.r, w = Math.ceil(r * 3.4 * d), h = Math.ceil(r * 3.6 * d);
  var c = mk(w, h), g = c.getContext('2d');
  g.setTransform(d, 0, 0, d, w / 2, h * 0.46);
  p.hsW = w / d; p.hsH = h / d; p.hsOx = w / 2 / d; p.hsOy = h * 0.46 / d;
  p.hs_c = c;
  var rx = r * 0.8, ry = r, hc = p.hair, st = p.hstyle, dark = shade(hc, 0.6), x, a;
  var hg = g.createLinearGradient(0, -ry * 1.2, 0, ry * 0.4);
  hg.addColorStop(0, shade(hc, 1.35)); hg.addColorStop(0.5, hc); hg.addColorStop(1, shade(hc, 0.7));
  // back hair
  if (st === 2) {
    g.fillStyle = dark; g.beginPath(); g.moveTo(-rx * 1.12, -ry * 0.3); g.lineTo(-rx * 1.15, ry * 1.7); g.quadraticCurveTo(0, ry * 1.95, rx * 1.15, ry * 1.7); g.lineTo(rx * 1.12, -ry * 0.3); g.closePath(); g.fill();
  }
  if (st === 3) { g.fillStyle = hc; g.beginPath(); g.arc(0, -ry * 1.12, r * 0.4, 0, TAU); g.fill(); }
  // ears
  g.fillStyle = shade(p.skin, 0.82);
  g.beginPath(); g.ellipse(-rx * 1.02, ry * 0.08, r * 0.15, r * 0.26, 0, 0, TAU); g.ellipse(rx * 1.02, ry * 0.08, r * 0.15, r * 0.26, 0, 0, TAU); g.fill();
  // face
  var fg = g.createRadialGradient(-rx * 0.25, -ry * 0.45, r * 0.1, 0, ry * 0.1, r * 1.2);
  fg.addColorStop(0, shade(p.skin, 1.12)); fg.addColorStop(0.55, p.skin); fg.addColorStop(1, shade(p.skin, 0.62));
  g.fillStyle = fg; g.beginPath(); g.moveTo(0, -ry);
  g.bezierCurveTo(rx * 1.18, -ry, rx * 1.06, ry * 0.35, 0, ry * 1.04);
  g.bezierCurveTo(-rx * 1.06, ry * 0.35, -rx * 1.18, -ry, 0, -ry); g.fill();
  // jaw shadow
  var jg = g.createLinearGradient(0, ry * 0.3, 0, ry * 1.05); jg.addColorStop(0, 'rgba(40,15,5,0)'); jg.addColorStop(1, 'rgba(40,15,5,.28)');
  g.fillStyle = jg; g.beginPath(); g.moveTo(-rx * 0.95, ry * 0.3); g.lineTo(rx * 0.95, ry * 0.3); g.bezierCurveTo(rx * 1.0, ry * 0.8, rx * 0.4, ry * 1.04, 0, ry * 1.04); g.bezierCurveTo(-rx * 0.4, ry * 1.04, -rx * 1.0, ry * 0.8, -rx * 0.95, ry * 0.3); g.fill();
  // beard
  if (p.beard) {
    g.fillStyle = shade(hc, 0.85); g.globalAlpha = 0.88; g.beginPath(); g.moveTo(-rx * 0.99, ry * 0.05);
    g.bezierCurveTo(-rx * 1.0, ry * 0.9, -rx * 0.4, ry * 1.1, 0, ry * 1.08); g.bezierCurveTo(rx * 0.4, ry * 1.1, rx * 1.0, ry * 0.9, rx * 0.99, ry * 0.05);
    g.bezierCurveTo(rx * 0.7, ry * 0.5, rx * 0.4, ry * 0.42, 0, ry * 0.46); g.bezierCurveTo(-rx * 0.4, ry * 0.42, -rx * 0.7, ry * 0.5, -rx * 0.99, ry * 0.05); g.fill(); g.globalAlpha = 1;
  }
  // hair cap
  if (st !== 4) {
    var hl = st === 1 ? -ry * 0.72 : (st === 5 ? -ry * 0.5 : -ry * 0.45);
    g.fillStyle = hg; g.globalAlpha = st === 1 ? 0.62 : 1;
    g.beginPath(); g.moveTo(-rx * 1.06, ry * 0.0);
    g.bezierCurveTo(-rx * 1.3, -ry * 1.35, rx * 1.3, -ry * 1.35, rx * 1.06, ry * 0.0);
    g.bezierCurveTo(rx * 0.75, hl, -rx * 0.75, hl, -rx * 1.06, ry * 0.0); g.fill(); g.globalAlpha = 1;
    if (st === 2) {
      g.fillStyle = hg; g.beginPath(); g.moveTo(-rx * 1.08, -ry * 0.1); g.lineTo(-rx * 1.18, ry * 1.5); g.lineTo(-rx * 0.88, ry * 1.4); g.lineTo(-rx * 0.8, -ry * 0.3); g.closePath();
      g.moveTo(rx * 1.08, -ry * 0.1); g.lineTo(rx * 1.18, ry * 1.5); g.lineTo(rx * 0.88, ry * 1.4); g.lineTo(rx * 0.8, -ry * 0.3); g.closePath(); g.fill();
    }
    if (st === 5) {
      g.fillStyle = hc;
      for (a = 0; a < 9; a++) { var an = Math.PI * (1.05 + a * 0.11); g.beginPath(); g.arc(Math.cos(an) * rx * 1.12, Math.sin(an) * ry * 1.12 + ry * 0.05, r * 0.27, 0, TAU); g.fill(); }
    }
  } else {
    g.fillStyle = shade(hc, 0.9);
    g.beginPath(); g.ellipse(-rx * 1.0, -ry * 0.12, r * 0.14, r * 0.36, 0.1, 0, TAU); g.ellipse(rx * 1.0, -ry * 0.12, r * 0.14, r * 0.36, -0.1, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,240,220,.16)'; g.beginPath(); g.ellipse(-rx * 0.2, -ry * 0.7, rx * 0.5, ry * 0.2, -0.3, 0, TAU); g.fill();
  }
  // face features
  if (r * d > 11) {
    g.fillStyle = '#1a1210';
    g.beginPath(); g.ellipse(-rx * 0.42, ry * 0.04, r * 0.115, r * 0.07, 0, 0, TAU); g.ellipse(rx * 0.42, ry * 0.04, r * 0.115, r * 0.07, 0, 0, TAU); g.fill();
    g.strokeStyle = shade(hc, 0.8); g.lineWidth = Math.max(0.6, r * 0.07); g.lineCap = 'round';
    g.beginPath(); g.moveTo(-rx * 0.7, -ry * 0.16); g.lineTo(-rx * 0.15, -ry * 0.2); g.moveTo(rx * 0.15, -ry * 0.2); g.lineTo(rx * 0.7, -ry * 0.16); g.stroke();
    g.strokeStyle = 'rgba(60,25,10,.22)'; g.lineWidth = Math.max(0.5, r * 0.06);
    g.beginPath(); g.moveTo(-rx * 0.04, ry * 0.08); g.lineTo(rx * 0.08, ry * 0.4); g.lineTo(-rx * 0.1, ry * 0.43); g.stroke();
    if (!p.beard) { g.strokeStyle = 'rgba(120,45,45,.75)'; g.lineWidth = Math.max(0.7, r * 0.08); g.beginPath(); g.moveTo(-rx * 0.3, ry * 0.62); g.quadraticCurveTo(0, ry * 0.7, rx * 0.3, ry * 0.62); g.stroke(); }
    g.fillStyle = 'rgba(210,90,80,.10)'; g.beginPath(); g.ellipse(-rx * 0.62, ry * 0.38, r * 0.2, r * 0.13, 0, 0, TAU); g.ellipse(rx * 0.62, ry * 0.38, r * 0.2, r * 0.13, 0, 0, TAU); g.fill();
  } else {
    g.fillStyle = 'rgba(25,12,8,.38)'; g.fillRect(-rx * 0.65, -ry * 0.02, rx * 1.3, ry * 0.2);
  }
  if (p.glasses) {
    g.strokeStyle = 'rgba(20,20,26,.85)'; g.lineWidth = Math.max(0.6, r * 0.06);
    g.beginPath(); g.arc(-rx * 0.42, ry * 0.04, r * 0.24, 0, TAU); g.moveTo(rx * 0.42 + r * 0.24, ry * 0.04); g.arc(rx * 0.42, ry * 0.04, r * 0.24, 0, TAU);
    g.moveTo(-rx * 0.18, ry * 0.02); g.lineTo(rx * 0.18, ry * 0.02); g.stroke();
  }
  // front light highlight
  var hh = g.createRadialGradient(-rx * 0.15, -ry * 0.75, 0, -rx * 0.15, -ry * 0.75, r * 0.7);
  hh.addColorStop(0, 'rgba(255,245,230,.16)'); hh.addColorStop(1, 'rgba(255,245,230,0)');
  g.fillStyle = hh; g.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 1.2);
  fogOver(c, p.fogA);
};

P._body = function (p) {
  var d = this.d, r = p.r, bw = r * 2.15 * p.bf, w = Math.ceil((bw * 2 + r * 0.6) * d), h = Math.ceil(r * 3.25 * d);
  var c = mk(w, h), g = c.getContext('2d');
  g.setTransform(d, 0, 0, d, w / 2, -0.55 * r * d);
  p.bsW = w / d; p.bsH = h / d; p.bs_c = c; p.bw = bw;
  // shirt
  var sg = g.createLinearGradient(0, r * 1.4, 0, r * 3.8);
  sg.addColorStop(0, shade(p.shirt, 1.3)); sg.addColorStop(0.3, p.shirt); sg.addColorStop(1, shade(p.shirt, 0.62));
  g.fillStyle = sg; g.beginPath(); g.moveTo(-bw, r * 3.8); g.lineTo(-bw * 0.97, r * 2.3);
  g.bezierCurveTo(-bw * 0.9, r * 1.7, -r * 0.8, r * 1.55, -r * 0.42, r * 1.4);
  g.lineTo(r * 0.42, r * 1.4); g.bezierCurveTo(r * 0.8, r * 1.55, bw * 0.9, r * 1.7, bw * 0.97, r * 2.3);
  g.lineTo(bw, r * 3.8); g.closePath();
  // neck first
  var ng = g.createLinearGradient(-r * 0.3, 0, r * 0.3, 0); ng.addColorStop(0, shade(p.skin, 0.7)); ng.addColorStop(0.5, shade(p.skin, 0.9)); ng.addColorStop(1, shade(p.skin, 0.65));
  g.fillStyle = ng; g.fillRect(-r * 0.3, r * 0.5, r * 0.6, r * 1.1);
  g.fillStyle = 'rgba(30,10,0,.35)'; g.fillRect(-r * 0.3, r * 0.5, r * 0.6, r * 0.28);
  g.fillStyle = sg; g.fill();
  // collar V
  g.fillStyle = shade(p.skin, 0.78); g.beginPath(); g.moveTo(-r * 0.4, r * 1.4); g.lineTo(0, r * 2.05); g.lineTo(r * 0.4, r * 1.4); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-r * 0.4, r * 1.4); g.lineTo(0, r * 2.05); g.lineTo(r * 0.4, r * 1.4); g.stroke();
  // shoulder rim light
  g.strokeStyle = 'rgba(255,240,220,.16)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-bw * 0.95, r * 2.2); g.bezierCurveTo(-bw * 0.9, r * 1.7, -r * 0.8, r * 1.55, -r * 0.42, r * 1.42); g.stroke();
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
  // sound-driven reactions of crowd: voice nudges nodding in supportive mood (cheap, only occasionally)
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
P.pickX = function () { var p = this._nearest(null); return p.x / this.W; };
P._endOvation = function () {
  this.ovation = false;
  for (var i = 0; i < this.ppl.length; i++) { var p = this.ppl[i]; if (!p.walk) p.standT = 0; }
};
P.trigger = function (name, o) {
  o = o || {}; var s = this, i, p, x01 = o.x, res = { x: 0.5 }, n, q;
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
  var hx = x + p.pdx * r, hy = y + p.pdy * r + p.pbd * r * 0.5 - lift, by = y + 0.55 * r + p.pbd * r - lift, bw = p.bw;
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
  var bob = Math.abs(Math.sin(t * 7 + p.ph)) * r * 0.12, by = y + 0.55 * r - bob, bw = p.bw * sc;
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
  // lighting: darken the hall
  var dark = 0.64 * (1 - L.house);
  if (dark > 0.01) { g.globalAlpha = dark; g.fillStyle = '#04050f'; g.fillRect(0, 0, W, s.hallH - 8); g.globalAlpha = 1; }
  g.globalCompositeOperation = 'lighter';
  var amb = 0.55 * (L.house - 0.3);
  if (amb > 0.02) { g.globalAlpha = amb; g.fillStyle = '#40362e'; g.fillRect(0, 0, W, s.hallH - 8); }
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
  g.drawImage(s.sp.exit, sg.x - sg.w / 2, sg.y - sg.h / 2, sg.w, sg.h);
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
};

global.StageScene = StageScene;
})(typeof window !== 'undefined' ? window : this);
