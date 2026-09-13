/* TETRIS NEON — 2D, powers, coin store, sound, solo + online */
'use strict';
var $ = function (id) { return document.getElementById(id); };
var COLS = 10, ROWS = 20;
var CLEAR_PTS = [0, 100, 300, 600, 1000];
var BEST_KEY = 'tetrisneon.best', COIN_KEY = 'tetrisneon.coins', BAG_KEY = 'tetrisneon.bag';
var MAXSTOCK = 9;

/* ---------- palettes unlocked by score ---------- */
var TIERS = [
  { at: 0,     name: 'NEON',   accent: '#4CC9F0', cols: ['', '#4CC9F0', '#3A86FF', '#B15CFF', '#F72585', '#FF7A45', '#FFD166', '#7CF67C'] },
  { at: 1200,  name: 'AURORA', accent: '#4EF2C0', cols: ['', '#4EF2C0', '#2BD9A8', '#7CF67C', '#39C6D6', '#B8F36B', '#FFE27A', '#5AC8FA'] },
  { at: 3000,  name: 'CANDY',  accent: '#FF6EC7', cols: ['', '#FF6EC7', '#FF97D6', '#F72585', '#C04AFF', '#FF7AA2', '#FFD1E8', '#9D4EDD'] },
  { at: 6000,  name: 'EMBER',  accent: '#FF9F1C', cols: ['', '#FFB703', '#FB8500', '#FF5714', '#FFD166', '#E5383B', '#FF7A45', '#FFE8A3'] },
  { at: 10000, name: 'ICE',    accent: '#8FD6FF', cols: ['', '#CAF0F8', '#90E0EF', '#48CAE4', '#00B4D8', '#7CA8FF', '#B8D8FF', '#E8F6FF'] },
  { at: 16000, name: 'VOID',   accent: '#B15CFF', cols: ['', '#C77DFF', '#9D4EDD', '#7B2CBF', '#E0AAFF', '#5A189A', '#FF6EC7', '#C0B7FF'] },
  { at: 24000, name: 'GOLD',   accent: '#FFD166', cols: ['', '#FFE9A8', '#FFD166', '#FFC233', '#FFAD00', '#F2A65A', '#FFF3CC', '#E8B400'] }
];
function stageFor(score) { var s = 0; for (var i = 0; i < TIERS.length; i++) if (score >= TIERS[i].at) s = i; return s; }
function palOf(stage) { return TIERS[Math.max(0, Math.min(TIERS.length - 1, stage | 0))]; }

/* ---------- pieces ---------- */
var MATS = {
  1: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  2: [[1,0,0],[1,1,1],[0,0,0]],
  3: [[0,0,1],[1,1,1],[0,0,0]],
  4: [[1,1],[1,1]],
  5: [[0,1,1],[1,1,0],[0,0,0]],
  6: [[0,1,0],[1,1,1],[0,0,0]],
  7: [[1,1,0],[0,1,1],[0,0,0]]
};
function rotM(m) {
  var n = m.length, o = [], y, x;
  for (y = 0; y < n; y++) { o.push([]); for (x = 0; x < n; x++) o[y].push(m[n - 1 - x][y]); }
  return o;
}
var ROT = {};
(function () {
  for (var id in MATS) {
    var m = MATS[id], list = [];
    for (var r = 0; r < 4; r++) {
      var cells = [];
      for (var y = 0; y < m.length; y++) for (var x = 0; x < m.length; x++) if (m[y][x]) cells.push([x, y]);
      list.push(cells);
      m = rotM(m);
    }
    ROT[id] = list;
  }
})();
function cellsOf(id, r) { return ROT[id][r & 3]; }
function widthOf(id, r) {
  var c = cellsOf(id, r), mx = 0;
  for (var i = 0; i < c.length; i++) mx = Math.max(mx, c[i][0]);
  return mx + 1;
}

/* ---------- engine ---------- */
function Engine() { this.reset(); }
Engine.prototype.reset = function () {
  this.grid = [];
  for (var y = 0; y < ROWS; y++) this.grid.push(new Array(COLS).fill(0));
  this.bag = [];
  this.score = 0; this.lines = 0; this.level = 1; this.dead = false;
  this.acc = 0; this.flash = []; this.flashT = 0; this.shake = 0;
  this.stage = 0; this.glow = 0; this.leveled = 0; this.tiered = 0;
  this.energy = 0; this.holdId = 0; this.holdUsed = false;
  this.slowT = 0; this.x2T = 0;
  this.nextId = this.pull();
  this.spawn();
};
Engine.prototype.pull = function () {
  if (!this.bag.length) {
    this.bag = [1, 2, 3, 4, 5, 6, 7];
    for (var i = this.bag.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = this.bag[i];
      this.bag[i] = this.bag[j]; this.bag[j] = t;
    }
  }
  return this.bag.pop();
};
Engine.prototype.spawn = function () {
  var id = this.nextId;
  this.nextId = this.pull();
  this.p = { id: id, r: 0, x: Math.floor((COLS - widthOf(id, 0)) / 2), y: 0 };
  if (this.hits(this.p.x, this.p.y, this.p.r)) this.dead = true;
};
Engine.prototype.hits = function (px, py, r) {
  var c = cellsOf(this.p.id, r);
  for (var i = 0; i < c.length; i++) {
    var x = px + c[i][0], y = py + c[i][1];
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y >= 0 && this.grid[y][x]) return true;
  }
  return false;
};
Engine.prototype.move = function (dx) {
  if (this.dead) return;
  if (!this.hits(this.p.x + dx, this.p.y, this.p.r)) { this.p.x += dx; if (window.Snd) Snd.move(); }
};
Engine.prototype.rotate = function () {
  if (this.dead) return;
  var nr = (this.p.r + 1) & 3, k = [0, -1, 1, -2, 2];
  for (var i = 0; i < k.length; i++) {
    if (!this.hits(this.p.x + k[i], this.p.y, nr)) {
      this.p.x += k[i]; this.p.r = nr;
      if (window.Snd) Snd.rot();
      return;
    }
  }
};
Engine.prototype.soft = function () {
  if (this.dead) return;
  if (!this.hits(this.p.x, this.p.y + 1, this.p.r)) {
    this.p.y++; this.score += 1; this.acc = 0;
    if (window.Snd) Snd.soft();
  } else this.lock();
};
Engine.prototype.hard = function () {
  if (this.dead) return;
  var n = 0;
  while (!this.hits(this.p.x, this.p.y + 1, this.p.r)) { this.p.y++; n++; }
  this.score += n * 2; this.shake = Math.min(9, 3 + n * 0.35);
  if (window.Snd) Snd.drop();
  this.lock();
};
Engine.prototype.ghostY = function () {
  var y = this.p.y;
  while (!this.hits(this.p.x, y + 1, this.p.r)) y++;
  return y;
};
Engine.prototype.retune = function () {
  var lv = Math.max(1 + Math.floor(this.lines / 6), 1 + Math.floor(this.score / 900));
  if (lv > this.level) {
    this.level = lv; this.glow = 1; this.leveled = lv;
    if (window.Snd) { Snd.level(); Snd.tempo(lv); }
  }
  var st = stageFor(this.score);
  if (st > this.stage) {
    this.stage = st; this.tiered = st; this.glow = 1;
    if (window.Snd) Snd.tier();
  }
};
Engine.prototype.clearFull = function (useLevel) {
  var full = [], y;
  for (y = 0; y < ROWS; y++) if (this.grid[y].every(function (v) { return v; })) full.push(y);
  if (!full.length) return 0;
  for (var i = 0; i < full.length; i++) {
    this.grid.splice(full[i], 1);
    this.grid.unshift(new Array(COLS).fill(0));
  }
  this.lines += full.length;
  this.score += CLEAR_PTS[Math.min(4, full.length)] * (useLevel ? this.level : 1) * (this.x2T > 0 ? 2 : 1);
  this.energy = Math.min(100, this.energy + full.length * 16 + (full.length === 4 ? 12 : 0));
  this.flash = full; this.flashT = 0.18;
  if (window.Snd) Snd.clear(full.length);
  return full.length;
};
Engine.prototype.lock = function () {
  var c = cellsOf(this.p.id, this.p.r);
  for (var i = 0; i < c.length; i++) {
    var x = this.p.x + c[i][0], y = this.p.y + c[i][1];
    if (y >= 0 && y < ROWS) this.grid[y][x] = this.p.id;
  }
  if (!this.clearFull(true) && window.Snd) Snd.lock();
  this.energy = Math.min(100, this.energy + 2);
  this.holdUsed = false;
  this.retune();
  this.spawn();
};
Engine.prototype.speed = function () {
  var s = Math.max(0.075, 0.85 * Math.pow(0.905, this.level - 1));
  if (this.slowT > 0) s *= 2.3;
  return s;
};
Engine.prototype.update = function (dt) {
  if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt);
  if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);
  if (this.glow > 0) this.glow = Math.max(0, this.glow - dt * 0.8);
  if (this.slowT > 0) this.slowT = Math.max(0, this.slowT - dt);
  if (this.x2T > 0) this.x2T = Math.max(0, this.x2T - dt);
  if (this.dead) return;
  this.acc += dt;
  var sp = this.speed();
  while (this.acc >= sp) {
    this.acc -= sp;
    if (!this.hits(this.p.x, this.p.y + 1, this.p.r)) this.p.y++;
    else { this.lock(); break; }
  }
};

/* ---------- powers ---------- */
Engine.prototype.doHold = function () {
  if (this.dead || this.holdUsed) return false;
  var cur = this.p.id;
  if (this.holdId) {
    var id = this.holdId;
    this.p = { id: id, r: 0, x: Math.floor((COLS - widthOf(id, 0)) / 2), y: 0 };
  } else this.spawn();
  this.holdId = cur; this.holdUsed = true; this.acc = 0;
  return true;
};
Engine.prototype.doSlow = function () {
  this.slowT = 12; this.glow = 1;
  if (window.Snd) Snd.slow();
  return true;
};
Engine.prototype.doBomb = function () {
  for (var i = 0; i < 2; i++) { this.grid.pop(); this.grid.unshift(new Array(COLS).fill(0)); }
  this.flash = [ROWS - 1, ROWS - 2]; this.flashT = 0.22; this.shake = 8;
  if (window.Snd) Snd.bomb();
  return true;
};
Engine.prototype.doPack = function () {
  for (var x = 0; x < COLS; x++) {
    var stack = [], y;
    for (y = 0; y < ROWS; y++) if (this.grid[y][x]) stack.push(this.grid[y][x]);
    for (y = 0; y < ROWS; y++) {
      var from = y - (ROWS - stack.length);
      this.grid[y][x] = from >= 0 ? stack[from] : 0;
    }
  }
  this.clearFull(true);
  this.shake = 6;
  if (window.Snd) Snd.pack();
  return true;
};
Engine.prototype.doX2 = function () {
  this.x2T = 20; this.glow = 1;
  if (window.Snd) Snd.power();
  return true;
};
Engine.prototype.addGarbage = function (n) {
  for (var i = 0; i < n; i++) {
    var row = new Array(COLS).fill(2), gaps = 1 + Math.floor(Math.random() * 2);
    for (var j = 0; j < gaps; j++) row[Math.floor(Math.random() * COLS)] = 0;
    this.grid.shift(); this.grid.push(row);
  }
  this.shake = 7;
  if (window.Snd) Snd.hit();
  if (this.hits(this.p.x, this.p.y, this.p.r)) this.dead = true;
  return true;
};

/* ---------- view/sync ---------- */
Engine.prototype.view = function () {
  var g = [], y;
  for (y = 0; y < ROWS; y++) g.push(this.grid[y].slice());
  var gy = this.ghostY(), c = cellsOf(this.p.id, this.p.r), i;
  if (!this.dead) {
    for (i = 0; i < c.length; i++) {
      var gx2 = this.p.x + c[i][0], gy2 = gy + c[i][1];
      if (gy2 >= 0 && gy2 < ROWS && !g[gy2][gx2]) g[gy2][gx2] = -this.p.id;
    }
    for (i = 0; i < c.length; i++) {
      var px = this.p.x + c[i][0], py = this.p.y + c[i][1];
      if (py >= 0 && py < ROWS) g[py][px] = this.p.id;
    }
  }
  var p = palOf(this.stage);
  return { g: g, flash: this.flash, flashT: this.flashT, shake: this.shake, dead: this.dead,
    cols: p.cols, accent: p.accent, glow: this.glow, slow: this.slowT, x2: this.x2T };
};
Engine.prototype.packet = function () {
  var v = this.view(), s = '';
  for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
    var c = v.g[y][x];
    s += (c < 0 ? 'g' : String(c));
  }
  return { t: 's', g: s, s: this.score, l: this.lines, lv: this.level, st: this.stage, d: this.dead };
};
function unpack(m) {
  var g = [], i = 0, y, x;
  for (y = 0; y < ROWS; y++) {
    var row = [];
    for (x = 0; x < COLS; x++) {
      var ch = m.g.charAt(i++);
      row.push(ch === 'g' ? -1 : (parseInt(ch, 10) || 0));
    }
    g.push(row);
  }
  var p = palOf(m.st || 0);
  return { g: g, flash: [], flashT: 0, shake: 0, dead: !!m.d, cols: p.cols, accent: p.accent, glow: 0 };
}
function emptyView() {
  var g = [], y;
  for (y = 0; y < ROWS; y++) g.push(new Array(COLS).fill(0));
  var p = palOf(0);
  return { g: g, flash: [], flashT: 0, shake: 0, dead: false, cols: p.cols, accent: p.accent, glow: 0 };
}

/* ---------- renderer ---------- */
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function shade(hex, f) {
  var n = parseInt(hex.slice(1), 16);
  var r = Math.round(Math.min(255, ((n >> 16) & 255) * f));
  var g = Math.round(Math.min(255, ((n >> 8) & 255) * f));
  var b = Math.round(Math.min(255, (n & 255) * f));
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}
function fit(cv) {
  var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  var w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  }
  var ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx: ctx, w: w, h: h };
}
function drawCell(ctx, x, y, s, color, ghost) {
  var pad = Math.max(1, s * 0.075), r = Math.max(2, s * 0.2);
  if (ghost) {
    ctx.save();
    rr(ctx, x + pad, y + pad, s - pad * 2, s - pad * 2, r);
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = Math.max(1, s * 0.07); ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.save();
  var gr = ctx.createLinearGradient(x, y, x, y + s);
  gr.addColorStop(0, shade(color, 1.28));
  gr.addColorStop(1, shade(color, 0.72));
  rr(ctx, x + pad, y + pad, s - pad * 2, s - pad * 2, r);
  ctx.fillStyle = gr;
  ctx.shadowColor = color; ctx.shadowBlur = s * 0.5;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = Math.max(1, s * 0.05); ctx.stroke();
  rr(ctx, x + pad * 2.1, y + pad * 2.1, (s - pad * 4.2), (s - pad * 4.2) * 0.34, r * 0.6);
  ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fill();
  ctx.restore();
}
function drawBoard(cv, st, mini) {
  var f = fit(cv), ctx = f.ctx, W = f.w, H = f.h;
  if (!W || !H) return;
  var outer = Math.round(Math.min(W, H) * (mini ? 0.05 : 0.055));
  var cell = Math.floor(Math.min((W - outer * 2) / COLS, (H - outer * 2) / ROWS));
  var bw = cell * COLS, bh = cell * ROWS;
  var ox = Math.round((W - bw) / 2), oy = Math.round((H - bh) / 2);
  var accent = st.accent || '#4CC9F0';
  ctx.save();
  if (st.shake > 0.2) ctx.translate((Math.random() - .5) * st.shake, (Math.random() - .5) * st.shake);

  var fr = Math.max(5, cell * 0.5);
  ctx.save();
  rr(ctx, ox - fr, oy - fr, bw + fr * 2, bh + fr * 2, fr * 0.9);
  var bgg = ctx.createLinearGradient(ox, oy - fr, ox, oy + bh);
  bgg.addColorStop(0, 'rgba(255,255,255,.05)');
  bgg.addColorStop(1, 'rgba(0,0,0,.35)');
  ctx.fillStyle = bgg; ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = mini ? 1.4 : 2.2;
  ctx.shadowColor = accent; ctx.shadowBlur = (mini ? 8 : 18) * (1 + (st.glow || 0));
  ctx.stroke();
  ctx.restore();

  ctx.save();
  rr(ctx, ox, oy, bw, bh, Math.max(3, cell * 0.18));
  ctx.fillStyle = 'rgba(4,4,10,.82)'; ctx.fill(); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,.045)'; ctx.lineWidth = 1;
  for (var gx = 1; gx < COLS; gx++) {
    ctx.beginPath(); ctx.moveTo(ox + gx * cell + .5, oy); ctx.lineTo(ox + gx * cell + .5, oy + bh); ctx.stroke();
  }
  for (var gy = 1; gy < ROWS; gy++) {
    ctx.beginPath(); ctx.moveTo(ox, oy + gy * cell + .5); ctx.lineTo(ox + bw, oy + gy * cell + .5); ctx.stroke();
  }
  var cols = st.cols || palOf(0).cols;
  for (var y = 0; y < ROWS; y++) {
    for (var x = 0; x < COLS; x++) {
      var v = st.g[y][x];
      if (!v) continue;
      var cx = ox + x * cell, cy = oy + y * cell;
      if (v < 0) { if (!mini) drawCell(ctx, cx, cy, cell, cols[Math.abs(v)] || accent, true); }
      else drawCell(ctx, cx, cy, cell, cols[v] || accent, false);
    }
  }
  if (st.flashT > 0 && st.flash && st.flash.length) {
    ctx.fillStyle = 'rgba(255,255,255,' + (st.flashT * 3.2).toFixed(2) + ')';
    for (var i = 0; i < st.flash.length; i++) ctx.fillRect(ox, oy + st.flash[i] * cell, bw, cell);
  }
  ctx.restore();

  if (!mini) {
    var L = Math.max(12, cell * 1.1);
    ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.shadowColor = accent; ctx.shadowBlur = 14;
    var p = [[ox - fr, oy - fr, 1, 1], [ox + bw + fr, oy - fr, -1, 1],
             [ox - fr, oy + bh + fr, 1, -1], [ox + bw + fr, oy + bh + fr, -1, -1]];
    for (var k = 0; k < p.length; k++) {
      ctx.beginPath();
      ctx.moveTo(p[k][0] + p[k][2] * L, p[k][1]);
      ctx.lineTo(p[k][0], p[k][1]);
      ctx.lineTo(p[k][0], p[k][1] + p[k][3] * L);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}
function drawNext(cv, id, stage) {
  var f = fit(cv), ctx = f.ctx, W = f.w, H = f.h;
  if (!W || !H || !id) return;
  var c = cellsOf(id, 0), mnx = 9, mny = 9, mxx = 0, mxy = 0, i;
  for (i = 0; i < c.length; i++) {
    mnx = Math.min(mnx, c[i][0]); mxx = Math.max(mxx, c[i][0]);
    mny = Math.min(mny, c[i][1]); mxy = Math.max(mxy, c[i][1]);
  }
  var w = mxx - mnx + 1, h = mxy - mny + 1;
  var s = Math.floor(Math.min((W - 12) / w, (H - 16) / h));
  var ox = (W - s * w) / 2, oy = (H - s * h) / 2 + 3;
  var cols = palOf(stage || 0).cols;
  for (i = 0; i < c.length; i++) {
    drawCell(ctx, ox + (c[i][0] - mnx) * s, oy + (c[i][1] - mny) * s, s, cols[id], false);
  }
}

/* ---------- wallet & bag (saved on the device) ---------- */
function num(k) { try { return parseInt(localStorage.getItem(k) || '0', 10) || 0; } catch (e) { return 0; } }
var best = num(BEST_KEY), coins = num(COIN_KEY);
try { if (localStorage.getItem(COIN_KEY) === null) { coins = 80; localStorage.setItem(COIN_KEY, '80'); } } catch (e) {}
var bag = (function () {
  var r = { slow: 0, bomb: 0, pack: 0, atk: 0 };
  try {
    var o = JSON.parse(localStorage.getItem(BAG_KEY) || '{}');
    for (var k in r) r[k] = Math.max(0, Math.min(MAXSTOCK, parseInt(o[k], 10) || 0));
  } catch (e) {}
  return r;
})();
function saveAll() {
  try {
    localStorage.setItem(BEST_KEY, String(best));
    localStorage.setItem(COIN_KEY, String(coins));
    localStorage.setItem(BAG_KEY, JSON.stringify(bag));
  } catch (e) {}
}
function bagTotal() { return bag.slow + bag.bomb + bag.pack + bag.atk; }
function refreshWallet() {
  $('bestScore').textContent = best;
  $('coinsMenu').textContent = coins;
  $('coinsStore').textContent = coins;
  $('bagMenu').textContent = bagTotal();
  var cg = $('coinsGame');
  if (cg) cg.textContent = coins;
}
/* spend exactly one unit of a bought power and save immediately */
function consume(key) {
  bag[key] = Math.max(0, (parseInt(bag[key], 10) || 0) - 1);
  saveAll();
  refreshWallet();
  return bag[key];
}

/* ---------- store ---------- */
var SHOP = [
  { key: 'slow', icon: '⏱', name: 'Slow-mo', price: 15, desc: 'Gravity slows down for 12 seconds.' },
  { key: 'pack', icon: '⇊', name: 'Pack',    price: 18, desc: 'Collapses all gaps, clears any full row.' },
  { key: 'bomb', icon: '◉', name: 'Bomb',    price: 22, desc: 'Blows away the bottom 2 rows.' },
  { key: 'atk',  icon: '✦', name: 'Attack',  price: 28, desc: '2 junk rows to your rival (x2 score in solo).' }
];
var PRICE = { slow: 15, pack: 18, bomb: 22, atk: 28 };
var BUNDLE = { price: 60, desc: '2 of every power — worth 166 coins' };
function buyItem(it, qty, cost) {
  if (bag[it.key] + qty > MAXSTOCK) {
    if (window.Snd) Snd.deny();
    return toast('Bag is full (max ' + MAXSTOCK + ' of each)');
  }
  if (coins < cost) {
    if (window.Snd) Snd.deny();
    return toast('Need ' + (cost - coins) + ' more coins — one quick run is enough');
  }
  coins -= cost;
  bag[it.key] += qty;
  saveAll(); refreshWallet(); renderStore();
  if (window.Snd) Snd.coin();
  toast(it.name + ' x' + qty + ' bought · in bag: ' + bag[it.key]);
}
function renderStore() {
  var host = $('storeList');
  if (!host) return;
  host.innerHTML = '';
  SHOP.forEach(function (it) {
    var tri = it.price * 3 - Math.round(it.price * 0.6);
    var row = document.createElement('div');
    row.className = 'srow';
    row.innerHTML = '<div class="sicon">' + it.icon + '</div>' +
      '<div class="sinfo"><b>' + it.name + ' <span class="own">IN BAG: ' + bag[it.key] + '</span></b>' +
      '<small>' + it.desc + '</small></div>' +
      '<div class="bcol">' +
      '<button class="buy">' + it.price + ' ◆</button>' +
      '<button class="buy alt">x3 · ' + tri + ' ◆</button></div>';
    var b = row.querySelectorAll('button');
    b[0].disabled = coins < it.price || bag[it.key] >= MAXSTOCK;
    b[0].addEventListener('click', function () { buyItem(it, 1, it.price); });
    b[1].disabled = coins < tri || bag[it.key] + 3 > MAXSTOCK;
    b[1].addEventListener('click', function () { buyItem(it, 3, tri); });
    host.appendChild(row);
  });
  var bn = document.createElement('div');
  bn.className = 'srow bundle';
  bn.innerHTML = '<div class="sicon">★</div>' +
    '<div class="sinfo"><b>Starter bundle</b><small>' + BUNDLE.desc + '</small></div>' +
    '<div class="bcol"><button class="buy">' + BUNDLE.price + ' ◆</button></div>';
  var bb = bn.querySelector('button');
  bb.disabled = coins < BUNDLE.price;
  bb.addEventListener('click', function () {
    if (coins < BUNDLE.price) {
      if (window.Snd) Snd.deny();
      return toast('Need ' + (BUNDLE.price - coins) + ' more coins');
    }
    coins -= BUNDLE.price;
    SHOP.forEach(function (it) { bag[it.key] = Math.min(MAXSTOCK, bag[it.key] + 2); });
    saveAll(); refreshWallet(); renderStore();
    if (window.Snd) Snd.coin();
    toast('Starter bundle unlocked — 2 of every power!');
  });
  host.appendChild(bn);
}
function award(score, won, level, lines) {
  var earned = Math.floor(score / 20) + Math.max(0, (level || 1) - 1) * 5 +
    Math.floor((lines || 0) / 2) + (won ? 100 : 0);
  if (earned > 0) { coins += earned; saveAll(); refreshWallet(); }
  return earned;
}

/* ---------- screens & helpers ---------- */
var mode = 'solo', A = null, B = null, remote = null, remoteScore = 0, ended = false, netTick = 0;
var peer = null, conn = null, myCode = '', searching = false;
var paused = false, lastT = 0;
function show(id) {
  ['menu', 'store', 'game'].forEach(function (s) { $(s).classList.toggle('on', s === id); });
}
var toastT = null;
function toast(msg) {
  var t = $('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(function () { t.classList.remove('on'); }, 2100);
}
function banner(title, sub) {
  var el = $('levelup');
  el.innerHTML = title + (sub ? '<span>' + sub + '</span>' : '');
  el.classList.remove('on');
  void el.offsetWidth;
  el.classList.add('on');
}
function overlay(title, text, btn, opts) {
  opts = opts || {};
  $('ovlTitle').innerHTML = title;
  $('ovlText').innerHTML = text || '';
  $('ovlBtn').textContent = btn || 'Resume';
  $('ovlBtn').style.display = btn ? '' : 'none';
  $('ovlSpin').style.display = opts.spin ? '' : 'none';
  $('ovlBtn2').style.display = opts.alt ? '' : 'none';
  $('ovlBtn3').style.display = opts.store ? '' : 'none';
  if (opts.alt) $('ovlBtn2').textContent = opts.alt;
  $('ovlTitle').className = opts.win ? 'win' : '';
  $('ovl').classList.add('on');
}
function hideOverlay() { $('ovl').classList.remove('on'); }
function setLed(state, txt) {
  $('led').className = 'dotled' + (state === 'ok' ? ' ok' : state === 'bad' ? ' bad' : '');
  $('ledTxt').textContent = txt;
}

/* ---------- powers UI ---------- */
var POWERS = [
  { id: 'pHold', key: null,   cost: 0,  label: 'HOLD',    run: function () { return A.doHold(); } },
  { id: 'pSlow', key: 'slow', cost: 35, label: 'SLOW-MO', run: function () { return A.doSlow(); } },
  { id: 'pBomb', key: 'bomb', cost: 55, label: 'BOMB',    run: function () { return A.doBomb(); } },
  { id: 'pPack', key: 'pack', cost: 45, label: 'PACK',    run: function () { return A.doPack(); } },
  { id: 'pAtk',  key: 'atk',  cost: 70, label: 'ATTACK',  run: function () { return useAttack(); } }
];
function useAttack() {
  if (mode === 'solo') return A.doX2();
  if (window.Snd) Snd.attack();
  if (mode === 'local' && B) B.addGarbage(2);
  else send({ t: 'atk', n: 2 });
  return true;
}
function firePower(pw) {
  if (ended || !A || A.dead) return;
  if (pw.id === 'pHold') {
    if (A.holdUsed) { if (window.Snd) Snd.deny(); return toast('Hold already used for this piece'); }
    if (A.doHold()) { banner('HOLD', ''); if (window.Snd) Snd.hold(); }
    return;
  }
  var stock = pw.key ? (parseInt(bag[pw.key], 10) || 0) : 0;
  var fromBag = stock > 0;
  if (!fromBag && A.energy < pw.cost) {
    if (window.Snd) Snd.deny();
    return toast(pw.label + ' is 0 — buy it in the Store for ' + (PRICE[pw.key] || '') + ' coins');
  }
  if (!pw.run()) return;
  var left = -1;
  if (fromBag) left = consume(pw.key);
  else A.energy = Math.max(0, A.energy - pw.cost);
  var label = (pw.id === 'pAtk' && mode === 'solo') ? 'DOUBLE SCORE' : pw.label;
  banner(label, fromBag ? (left + ' left in bag') : (pw.id === 'pAtk' && mode !== 'solo' ? '2 junk rows sent' : ''));
  if (fromBag) toast(pw.label + ' used · ' + left + ' left in your bag');
  refreshPowers();
}
POWERS.forEach(function (pw) {
  $(pw.id).addEventListener('click', function () { firePower(pw); });
});
function refreshPowers() {
  if (!A) return;
  var e = Math.round(A.energy);
  $('nrgFill').style.width = e + '%';
  $('nrgTxt').textContent = e + '%';
  POWERS.forEach(function (pw) {
    var el = $(pw.id);
    var stock = pw.key ? (parseInt(bag[pw.key], 10) || 0) : 0;
    var ok = (pw.id === 'pHold')
      ? (!A.holdUsed && !A.dead)
      : (!A.dead && (stock > 0 || A.energy >= pw.cost));
    el.classList.toggle('off', !ok);
    el.classList.toggle('ready', ok && pw.cost > 0);
    el.classList.toggle('has', stock > 0);
    var cnt = el.querySelector('.cnt');
    if (cnt) {
      var want = 'x' + stock;
      if (cnt.textContent !== want) cnt.textContent = want;
    }
    var sm = el.querySelector('small');
    if (sm && pw.cost) {
      var lbl = stock > 0 ? String(stock) : (A.energy >= pw.cost ? 'ready' : '0');
      if (sm.textContent !== lbl) sm.textContent = lbl;
      sm.className = stock > 0 ? 'ct' : '';
    }
  });
  var chips = '';
  if (A.slowT > 0) chips += '<span class="fxchip">SLOW-MO ' + Math.ceil(A.slowT) + 's</span>';
  if (A.x2T > 0) chips += '<span class="fxchip">SCORE x2 ' + Math.ceil(A.x2T) + 's</span>';
  var fx = $('fxrow');
  if (fx.innerHTML !== chips) fx.innerHTML = chips;
}

/* ---------- game flow ---------- */
function startGame(m, nameA, nameB) {
  mode = m; ended = false; paused = false; remote = null; remoteScore = 0;
  A = new Engine();
  B = (m === 'local') ? new Engine() : null;
  document.body.classList.toggle('solo', m === 'solo');
  $('nameA').textContent = nameA || 'YOU';
  $('nameB').textContent = nameB || 'RIVAL';
  $('miniTag').textContent = m === 'local' ? 'Player 2' : 'Rival';
  $('btnPause').style.display = m === 'online' ? 'none' : '';
  $('pAtk').querySelector('b').textContent = m === 'solo' ? 'x2' : 'ATTACK';
  $('kbdhint').textContent = m === 'local'
    ? 'P1: A D W S + Space · powers 1-4 · C hold   |   P2: arrows + Enter · powers 7-0 · / hold'
    : 'Keys: arrows + Space drop · C hold · 1 slow · 2 bomb · 3 pack · 4 ' + (m === 'solo' ? 'x2' : 'attack') + ' · P pause · M music';
  hideOverlay();
  show('game');
  refreshWallet();
  refreshPowers();
  if (window.Snd) { Snd.resume(); Snd.tempo(1); Snd.music(true, 1); }
  lastT = 0;
  requestAnimationFrame(loop);
}
function finish() {
  if (ended) return;
  ended = true;
  if (window.Snd) Snd.music(false);
  var myScore = A.score, other = (mode === 'local' && B) ? B.score : remoteScore;
  if (mode === 'solo') {
    var isBest = myScore > best;
    if (isBest) { best = myScore; saveAll(); }
    var got = award(myScore, false, A.level, A.lines);
    overlay(isBest ? 'NEW BEST!' : 'GAME OVER',
      'Score <b>' + myScore + '</b> · level <b>' + A.level + '</b> · ' + A.lines + ' lines<br>' +
      'Earned <b>' + got + ' ◆</b> · balance <b>' + coins + ' ◆</b>',
      'Play again', { win: isBest, store: true });
    if (window.Snd) { if (isBest) Snd.win(); else Snd.over(); }
  } else {
    var win = myScore > other, draw = myScore === other;
    if (mode === 'online') send({ t: 'over', s: myScore });
    var got2 = award(myScore, win, A.level, A.lines);
    overlay(draw ? 'DRAW' : (win ? 'YOU WIN!' : 'YOU LOSE'),
      'You <b>' + myScore + '</b> vs rival <b>' + other + '</b><br>' +
      'Earned <b>' + got2 + ' ◆</b> · balance <b>' + coins + ' ◆</b>',
      'Play again', { win: win || draw, store: true });
    if (window.Snd) { if (win || draw) Snd.win(); else Snd.lose(); }
  }
}
function loop(now) {
  if (!$('game').classList.contains('on')) return;
  requestAnimationFrame(loop);
  var dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0;
  lastT = now;
  if (!paused && !ended && A) {
    A.update(dt);
    if (A.leveled) { banner('LEVEL ' + A.leveled, 'speed up'); A.leveled = 0; }
    if (A.tiered) { banner(palOf(A.stage).name + ' UNLOCKED', 'new colours'); A.tiered = 0; }
    if (B) B.update(dt);
  }
  drawBoard($('cvA'), A ? A.view() : emptyView(), false);
  drawNext($('cvNext'), A ? A.nextId : 0, A ? A.stage : 0);
  drawNext($('cvHold'), A ? A.holdId : 0, A ? A.stage : 0);
  refreshPowers();
  if (mode !== 'solo') drawBoard($('cvB'), B ? B.view() : (remote || emptyView()), true);
  if (A) {
    $('scoreA').textContent = A.score;
    $('linesA').textContent = A.lines;
    $('levelA').textContent = A.level;
    $('palA').textContent = palOf(A.stage).name;
  }
  if (mode === 'local' && B) {
    $('scoreB').textContent = B.score;
    $('subB').textContent = B.lines + ' lines · lvl ' + B.level;
  } else if (mode === 'online') {
    $('scoreB').textContent = remoteScore;
  } else {
    $('scoreB').textContent = best;
    $('nameB').textContent = 'BEST';
    $('subB').textContent = 'your record';
  }
  if (mode === 'online' && conn && conn.open && A) {
    netTick += dt;
    if (netTick > 0.1) { netTick = 0; send(A.packet()); }
  }
  if (!ended && A && A.dead) {
    if (mode === 'local' && B && !B.dead) { /* wait for player 2 */ }
    else finish();
  }
  if (!ended && mode === 'local' && B && B.dead && A && A.dead) finish();
}
function togglePause() {
  if (mode === 'online' || ended || !A) return;
  paused = !paused;
  if (window.Snd) Snd.music(!paused, A.level);
  if (paused) overlay('Paused', 'Take a breath.', 'Resume');
  else hideOverlay();
}

/* ---------- input ---------- */
function act(fn) { if (!paused && !ended && A) fn(); }
function hold(el, fn) {
  var t = null, iv = null;
  function start(e) {
    e.preventDefault();
    act(fn);
    t = setTimeout(function () { iv = setInterval(function () { act(fn); }, 70); }, 220);
  }
  function stop() { clearTimeout(t); clearInterval(iv); }
  el.addEventListener('touchstart', start, { passive: false });
  el.addEventListener('mousedown', start);
  ['touchend', 'touchcancel', 'mouseup', 'mouseleave'].forEach(function (ev) { el.addEventListener(ev, stop); });
}
hold($('bLeft'), function () { A.move(-1); });
hold($('bRight'), function () { A.move(1); });
hold($('bDown'), function () { A.soft(); });
$('bRot').addEventListener('click', function () { act(function () { A.rotate(); }); });
$('bDrop').addEventListener('click', function () { act(function () { A.hard(); }); });
$('btnPause').addEventListener('click', togglePause);
$('btnExit').addEventListener('click', function () {
  ended = true; killNet();
  if (window.Snd) Snd.music(false);
  show('menu'); refreshWallet();
});
document.addEventListener('keydown', function (e) {
  var k = (e.key || '').toLowerCase();
  if (k === 'm' && window.Snd) { Snd.toggleMus(); soundLabels(); return; }
  if (!$('game').classList.contains('on')) return;
  if (k === ' ' || k.indexOf('arrow') === 0) e.preventDefault();
  if (k === 'p') { togglePause(); return; }
  if (k === 'c') { firePower(POWERS[0]); return; }
  if (k === '1') { firePower(POWERS[1]); return; }
  if (k === '2') { firePower(POWERS[2]); return; }
  if (k === '3') { firePower(POWERS[3]); return; }
  if (k === '4') { firePower(POWERS[4]); return; }
  if (paused || ended || !A) return;
  if (mode === 'local') {
    if (k === 'a') A.move(-1);
    else if (k === 'd') A.move(1);
    else if (k === 'w') A.rotate();
    else if (k === 's') A.soft();
    else if (k === ' ') A.hard();
    if (B && !B.dead) {
      if (k === 'arrowleft') B.move(-1);
      else if (k === 'arrowright') B.move(1);
      else if (k === 'arrowup') B.rotate();
      else if (k === 'arrowdown') B.soft();
      else if (k === 'enter') B.hard();
      else if (k === '/') B.doHold();
      else if (k === '7') p2power(B, 'slow', 35, 'SLOW-MO');
      else if (k === '8') p2power(B, 'bomb', 55, 'BOMB');
      else if (k === '9') p2power(B, 'pack', 45, 'PACK');
      else if (k === '0') p2attack();
    }
    return;
  }
  if (k === 'arrowleft') A.move(-1);
  else if (k === 'arrowright') A.move(1);
  else if (k === 'arrowup') A.rotate();
  else if (k === 'arrowdown') A.soft();
  else if (k === ' ') A.hard();
});
function p2power(eng, key, cost, label) {
  if (eng.energy >= cost) {
    eng.energy -= cost;
    if (key === 'slow') eng.doSlow(); else if (key === 'bomb') eng.doBomb(); else eng.doPack();
    banner('P2 ' + label, '');
  } else if (bag[key] > 0) {
    if (key === 'slow') eng.doSlow(); else if (key === 'bomb') eng.doBomb(); else eng.doPack();
    banner('P2 ' + label, consume(key) + ' left in bag');
  } else if (window.Snd) Snd.deny();
}
function p2attack() {
  if (B.energy >= 70) { B.energy -= 70; A.addGarbage(2); banner('P2 ATTACK', '2 junk rows to you'); }
  else if (bag.atk > 0) { A.addGarbage(2); banner('P2 ATTACK', consume('atk') + ' left in bag'); }
  else if (window.Snd) Snd.deny();
}
/* swipe gestures */
(function () {
  var sx = 0, sy = 0, st = 0, moved = false, el = $('stageA');
  el.addEventListener('touchstart', function (e) {
    var t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); moved = false;
  }, { passive: true });
  el.addEventListener('touchmove', function (e) {
    var t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) {
      act(function () { A.move(dx > 0 ? 1 : -1); }); sx = t.clientX; moved = true;
    } else if (dy > 48 && Math.abs(dy) > Math.abs(dx)) {
      act(function () { A.hard(); }); sy = t.clientY; moved = true;
    }
  }, { passive: true });
  el.addEventListener('touchend', function () {
    if (!moved && Date.now() - st < 260) act(function () { A.rotate(); });
  });
})();

/* ---------- overlay buttons ---------- */
$('ovlBtn').addEventListener('click', function () {
  if (paused && !ended) { togglePause(); return; }
  if (ended) {
    if (mode === 'online') { send({ t: 'again' }); startGame('online', 'YOU', 'RIVAL'); }
    else startGame(mode, mode === 'local' ? 'PLAYER 1' : 'YOU', mode === 'local' ? 'PLAYER 2' : 'RIVAL');
    return;
  }
  hideOverlay();
});
$('ovlBtn2').addEventListener('click', function () { killNet(); startGame('solo', 'YOU', 'BEST'); });
$('ovlBtn3').addEventListener('click', function () {
  ended = true; killNet();
  if (window.Snd) Snd.music(false);
  renderStore(); refreshWallet(); show('store');
});

/* ---------- networking ---------- */
var PREFIX = 'tetrisneonv1-', QUEUE_SLOTS = 8, ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function netAvailable() { return !window.PEER_FAILED && typeof window.Peer === 'function'; }
function send(m) { try { if (conn && conn.open) conn.send(m); } catch (e) {} }
function killNet() {
  searching = false;
  try { if (conn) conn.close(); } catch (e) {}
  try { if (peer) peer.destroy(); } catch (e) {}
  conn = null; peer = null;
}
function wire(c) {
  if (conn && conn.open) { try { c.close(); } catch (e) {} return; }
  conn = c;
  c.on('data', function (m) {
    if (!m || !m.t) return;
    if (m.t === 's') {
      remote = unpack(m); remoteScore = m.s;
      $('subB').textContent = m.l + ' lines · lvl ' + m.lv;
      if (m.d && !ended && A) finish();
    } else if (m.t === 'atk') {
      if (A && !A.dead) { A.addGarbage(m.n || 1); banner('INCOMING!', (m.n || 1) + ' junk rows'); }
    } else if (m.t === 'over') {
      remoteScore = m.s;
      if (!ended) finish();
    } else if (m.t === 'again') {
      if (ended) startGame('online', 'YOU', 'RIVAL');
    }
  });
  c.on('close', function () {
    if (!ended) { ended = true; overlay('Rival left', 'The connection closed.', 'Back to menu', { alt: 'Play solo instead' }); }
  });
  c.on('open', function () { toast('Connected! Good luck.'); startGame('online', 'YOU', 'RIVAL'); });
  if (c.open) { toast('Connected!'); startGame('online', 'YOU', 'RIVAL'); }
}
function needNet() {
  if (netAvailable()) return true;
  A = new Engine();
  show('game');
  overlay('No internet', 'Online play needs a connection. Solo and same-phone 2-player work offline.', 'Back to menu', { alt: 'Play solo instead' });
  ended = true;
  return false;
}
/* Try (or retry) loading the online module before any online action. */
function withNet(fn) {
  if (netAvailable()) { fn(); return; }
  if (!window.loadPeer) { needNet(); return; }
  ended = false;
  A = new Engine();
  show('game');
  overlay('Connecting\u2026', 'Loading the online module\u2026', '', { spin: true, alt: 'Play solo instead' });
  window.loadPeer(function (ok) {
    if (ok && netAvailable()) {
      setLed('ok', 'Online play ready');
      hideOverlay();
      fn();
    } else {
      setLed('bad', 'Offline \u2014 solo & same-phone work');
      ended = true;
      overlay('No internet', 'Could not reach the matchmaking server.<br>Check your connection, or try again in a moment.', 'Back to menu', { alt: 'Play solo instead' });
    }
  });
}
function hostRoom() {
  if (!needNet()) return;
  myCode = '';
  for (var i = 0; i < 4; i++) myCode += ALPHA.charAt(Math.floor(Math.random() * ALPHA.length));
  killNet();
  ended = false;
  A = new Engine();
  show('game');
  overlay('<span class="code">' + myCode + '</span>', 'Share this code. Waiting for your rival…', '', { spin: true, alt: 'Play solo instead' });
  peer = new Peer(PREFIX + myCode);
  peer.on('connection', wire);
  peer.on('error', function (err) {
    if (err && err.type === 'unavailable-id') { hostRoom(); return; }
    ended = true;
    overlay('Could not host', 'Try again in a moment.', 'Back to menu', { alt: 'Play solo instead' });
  });
}
function joinRoom(code) {
  if (!needNet()) return;
  killNet();
  ended = false;
  A = new Engine();
  show('game');
  overlay('Joining ' + code, 'Connecting to the room…', '', { spin: true, alt: 'Play solo instead' });
  peer = new Peer();
  peer.on('open', function () { wire(peer.connect(PREFIX + code, { reliable: true })); });
  peer.on('error', function () {
    ended = true;
    overlay('Room not found', 'Check the code and try again.', 'Back to menu', { alt: 'Play solo instead' });
  });
}
function findRandom(tries) {
  if (!needNet()) return;
  tries = tries || 0;
  if (tries === 0) {
    killNet(); ended = false; searching = true;
    A = new Engine();
    show('game');
    overlay('Searching…', 'Looking for another player online.', '', { spin: true, alt: 'Play solo instead' });
  }
  if (!searching) return;
  if (tries > 16) {
    searching = false; ended = true;
    overlay('Nobody online right now', 'Try a private room, or play solo.', 'Back to menu', { alt: 'Play solo instead' });
    return;
  }
  var slot = PREFIX + 'Q' + (tries % QUEUE_SLOTS);
  var p = new Peer(slot);
  peer = p;
  p.on('open', function () { p.on('connection', function (c) { searching = false; wire(c); }); });
  p.on('error', function (err) {
    if (err && err.type === 'unavailable-id') {
      try { p.destroy(); } catch (e) {}
      var g = new Peer();
      peer = g;
      g.on('open', function () { searching = false; wire(g.connect(slot, { reliable: true })); });
      g.on('error', function () { setTimeout(function () { findRandom(tries + 1); }, 400); });
    } else setTimeout(function () { findRandom(tries + 1); }, 500);
  });
}

/* ---------- menu wiring ---------- */
$('btnSolo').addEventListener('click', function () { killNet(); startGame('solo', 'YOU', 'BEST'); });
$('btnLocal').addEventListener('click', function () { killNet(); startGame('local', 'PLAYER 1', 'PLAYER 2'); });
$('btnHost').addEventListener('click', function () { withNet(hostRoom); });
$('btnRandom').addEventListener('click', function () { withNet(function () { findRandom(0); }); });
$('btnJoin').addEventListener('click', function () {
  var c = ($('codeIn').value || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (c.length !== 4) return toast('Enter the 4-letter room code');
  withNet(function () { joinRoom(c); });
});
$('codeIn').addEventListener('input', function () {
  this.value = this.value.toUpperCase().replace(/[^A-Z]/g, '');
});
$('btnStore').addEventListener('click', function () { renderStore(); refreshWallet(); show('store'); });
$('btnStoreBack').addEventListener('click', function () { refreshWallet(); show('menu'); });

/* ---------- sound toggles ---------- */
function soundLabels() {
  if (!window.Snd) return;
  $('btnMus').textContent = '♫ Music: ' + (Snd.musOn() ? 'on' : 'off');
  $('btnSfx').textContent = '♪ Sound: ' + (Snd.sfxOn() ? 'on' : 'off');
  $('btnMute').textContent = Snd.musOn() ? '♫' : '♬';
  $('btnMute').style.opacity = Snd.musOn() ? '1' : '.45';
}
$('btnMus').addEventListener('click', function () { if (window.Snd) { Snd.toggleMus(); soundLabels(); } });
$('btnSfx').addEventListener('click', function () { if (window.Snd) { Snd.toggleSfx(); soundLabels(); } });
$('btnMute').addEventListener('click', function () {
  if (!window.Snd) return;
  var on = Snd.toggleMus();
  if (on && !paused && !ended) Snd.music(true, A ? A.level : 1);
  soundLabels();
  toast(on ? 'Music on' : 'Music off');
});
['btnSolo', 'btnLocal', 'btnHost', 'btnRandom', 'btnJoin', 'btnStore', 'btnStoreBack'].forEach(function (id) {
  $(id).addEventListener('click', function () { if (window.Snd) { Snd.resume(); Snd.click(); } });
});

/* ---------- install prompt ---------- */
var deferred = null;
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault(); deferred = e; $('btnInstall').style.display = '';
});
$('btnInstall').addEventListener('click', function () {
  if (deferred) { deferred.prompt(); deferred = null; $('btnInstall').style.display = 'none'; }
  else toast('Use your browser menu → Install app / Add to Home Screen');
});

/* ---------- boot ---------- */
refreshWallet();
renderStore();
soundLabels();
function pingNet() {
  if (netAvailable()) { setLed('ok', 'Online play ready'); return; }
  setLed('', 'Checking connection\u2026');
  if (window.loadPeer) {
    window.loadPeer(function (ok) {
      setLed(ok ? 'ok' : 'bad', ok ? 'Online play ready' : 'Offline \u2014 solo & same-phone work');
    });
  } else setLed('bad', 'Offline \u2014 solo & same-phone work');
}
setTimeout(pingNet, 700);
window.addEventListener('online', pingNet);
window.addEventListener('offline', function () { setLed('bad', 'Offline \u2014 solo & same-phone work'); });
$('led').parentNode.addEventListener('click', pingNet);
if (location.hash === '#solo') startGame('solo', 'YOU', 'BEST');
if (location.hash === '#local') startGame('local', 'PLAYER 1', 'PLAYER 2');
if (location.hash === '#store') { renderStore(); show('store'); }
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
