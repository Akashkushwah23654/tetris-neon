/* TETRIS NEON — fully synthesised sound + music (no files, works offline) */
(function () {
  'use strict';
  var SFX_KEY = 'tetrisneon.sfx', MUS_KEY = 'tetrisneon.mus';
  var ac = null, master = null, sfxBus = null, musBus = null;
  var sfx = true, mus = true;
  try {
    if (localStorage.getItem(SFX_KEY) === '0') sfx = false;
    if (localStorage.getItem(MUS_KEY) === '0') mus = false;
  } catch (e) {}

  function init() {
    if (ac) return ac;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    musBus = ac.createGain(); musBus.gain.value = 0.22; musBus.connect(master);
    return ac;
  }
  function resume() {
    init();
    if (ac && ac.state === 'suspended') ac.resume();
  }
  function save() {
    try {
      localStorage.setItem(SFX_KEY, sfx ? '1' : '0');
      localStorage.setItem(MUS_KEY, mus ? '1' : '0');
    } catch (e) {}
  }

  function tone(opt) {
    if (!sfx || !init()) return;
    var t0 = ac.currentTime + (opt.delay || 0);
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = opt.type || 'square';
    o.frequency.setValueAtTime(opt.f || 440, t0);
    if (opt.f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, opt.f2), t0 + (opt.d || 0.1));
    var v = opt.v == null ? 0.3 : opt.v;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (opt.d || 0.1));
    o.connect(g); g.connect(sfxBus);
    o.start(t0); o.stop(t0 + (opt.d || 0.1) + 0.02);
  }
  function noise(opt) {
    if (!sfx || !init()) return;
    var d = opt.d || 0.2, t0 = ac.currentTime + (opt.delay || 0);
    var len = Math.floor(ac.sampleRate * d);
    var buf = ac.createBuffer(1, len, ac.sampleRate), data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var s = ac.createBufferSource(); s.buffer = buf;
    var f = ac.createBiquadFilter();
    f.type = opt.lp ? 'lowpass' : 'bandpass';
    f.frequency.setValueAtTime(opt.f || 900, t0);
    if (opt.f2) f.frequency.exponentialRampToValueAtTime(Math.max(60, opt.f2), t0 + d);
    var g = ac.createGain();
    g.gain.setValueAtTime(opt.v == null ? 0.35 : opt.v, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    s.connect(f); f.connect(g); g.connect(sfxBus);
    s.start(t0); s.stop(t0 + d + 0.02);
  }
  function arp(notes, step, type, v, d) {
    notes.forEach(function (f, i) {
      tone({ f: f, d: d || 0.12, type: type || 'square', v: v || 0.26, delay: i * (step || 0.06) });
    });
  }
  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  /* ---------- background music: Korobeiniki-flavoured loop ---------- */
  var LEAD = [76,71,72,74,72,71,69,69,72,76,74,72,71,71,72,74,76,72,69,69,0,0,
              74,77,81,79,77,76,0,72,76,74,72,71,71,72,74,76,72,69,69,0,0,0];
  var BASS = [45,45,52,52,44,44,52,52,45,45,52,52,44,44,52,52,
              45,45,52,52,44,44,52,52,45,45,52,52,44,44,52,52];
  var timer = null, step = 0, bpm = 124, playing = false;

  function voice(f, d, type, v, bus) {
    if (!init()) return;
    var t0 = ac.currentTime;
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g); g.connect(bus || musBus);
    o.start(t0); o.stop(t0 + d + 0.03);
  }
  function tick() {
    if (!playing || !mus) return;
    var n = LEAD[step % LEAD.length];
    if (n) voice(midi(n), 0.16, 'square', 0.3);
    var b = BASS[step % BASS.length];
    if (step % 2 === 0 && b) voice(midi(b - 12), 0.22, 'triangle', 0.34);
    if (step % 4 === 2) voice(1200, 0.03, 'square', 0.05);
    step++;
  }
  function schedule() {
    if (timer) clearInterval(timer);
    timer = setInterval(tick, (60 / bpm) * 1000 / 2);
  }
  function music(on, level) {
    init();
    if (on && mus) {
      resume();
      if (level) tempo(level);
      playing = true;
      schedule();
    } else {
      playing = false;
      if (timer) { clearInterval(timer); timer = null; }
    }
  }
  function tempo(level) {
    bpm = Math.min(190, 124 + (Math.max(1, level || 1) - 1) * 3.2);
    if (playing) schedule();
  }

  window.Snd = {
    init: init,
    resume: resume,
    music: music,
    tempo: tempo,
    sfxOn: function () { return sfx; },
    musOn: function () { return mus; },
    toggleSfx: function () { sfx = !sfx; save(); if (sfx) { resume(); tone({ f: 700, d: 0.08, v: 0.22 }); } return sfx; },
    toggleMus: function () { mus = !mus; save(); music(mus, 1); return mus; },

    move: function () { tone({ f: 220, d: 0.04, type: 'square', v: 0.13 }); },
    rot:  function () { tone({ f: 420, f2: 620, d: 0.07, type: 'square', v: 0.16 }); },
    soft: function () { tone({ f: 170, d: 0.035, type: 'triangle', v: 0.12 }); },
    drop: function () { noise({ f: 900, f2: 140, d: 0.16, v: 0.3 }); tone({ f: 180, f2: 70, d: 0.13, type: 'sawtooth', v: 0.22 }); },
    lock: function () { tone({ f: 150, f2: 110, d: 0.07, type: 'square', v: 0.2 }); },
    clear: function (n) {
      if (n >= 4) arp([midi(72), midi(76), midi(79), midi(84), midi(88)], 0.055, 'square', 0.3, 0.16);
      else arp([midi(72), midi(76), midi(79)].slice(0, Math.max(2, n)), 0.05, 'square', 0.26, 0.12);
      noise({ f: 2200, f2: 600, d: 0.2, v: 0.16 });
    },
    level: function () { arp([midi(69), midi(73), midi(76), midi(81)], 0.07, 'triangle', 0.3, 0.18); },
    tier:  function () { arp([midi(72), midi(77), midi(81), midi(84), midi(89)], 0.065, 'sawtooth', 0.22, 0.2); },
    power: function () { tone({ f: 300, f2: 1200, d: 0.2, type: 'sawtooth', v: 0.22 }); },
    bomb:  function () { noise({ f: 400, f2: 60, d: 0.4, v: 0.42, lp: true }); tone({ f: 90, f2: 40, d: 0.32, type: 'sawtooth', v: 0.28 }); },
    slow:  function () { tone({ f: 700, f2: 200, d: 0.36, type: 'sine', v: 0.26 }); },
    pack:  function () { noise({ f: 700, f2: 200, d: 0.26, v: 0.3, lp: true }); tone({ f: 240, f2: 150, d: 0.2, type: 'triangle', v: 0.2 }); },
    attack:function () { tone({ f: 200, f2: 950, d: 0.22, type: 'square', v: 0.26 }); noise({ f: 1600, f2: 500, d: 0.22, v: 0.18 }); },
    hit:   function () { noise({ f: 300, f2: 80, d: 0.3, v: 0.36, lp: true }); },
    hold:  function () { tone({ f: 520, f2: 320, d: 0.1, type: 'triangle', v: 0.2 }); },
    click: function () { tone({ f: 640, d: 0.05, type: 'square', v: 0.16 }); },
    coin:  function () { arp([midi(84), midi(91)], 0.07, 'square', 0.26, 0.13); },
    deny:  function () { tone({ f: 190, f2: 120, d: 0.14, type: 'sawtooth', v: 0.2 }); },
    win:   function () { arp([midi(72), midi(76), midi(79), midi(84), midi(88), midi(91)], 0.1, 'square', 0.3, 0.25); },
    lose:  function () { arp([midi(69), midi(65), midi(62), midi(57)], 0.13, 'sawtooth', 0.26, 0.3); },
    over:  function () { arp([midi(72), midi(68), midi(64), midi(60)], 0.12, 'triangle', 0.26, 0.3); }
  };
})();
