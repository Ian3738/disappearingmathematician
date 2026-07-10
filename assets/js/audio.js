/* =========================================================================
 * audio.js — Web Audio API 程式合成音效（不使用任何外部音檔）
 * 匯出全域 SFX；靜音狀態讀 engine.js 的 S.muted（呼叫時才存取，載入順序無虞）
 * ========================================================================= */
"use strict";

let __AC = null;
function ac() {
  if (!__AC) { try { __AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  return __AC;
}

/* 單一振盪音 */
function tone(freq, dur, type = "sine", vol = 0.16, when = 0, slideTo) {
  if (typeof S !== "undefined" && S.muted) return;
  const c = ac(); if (!c) return;
  const t = c.currentTime + when;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  o.connect(g); g.connect(c.destination);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.03);
}

/* 白噪音爆發（翻紙質感） */
function noise(dur = 0.18, vol = 0.2) {
  if (typeof S !== "undefined" && S.muted) return;
  const c = ac(); if (!c) return;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  const s = c.createBufferSource(); s.buffer = buf;
  const g = c.createGain(); g.gain.value = vol;
  s.connect(g); g.connect(c.destination); s.start();
}

/* 對外音效介面（方法名對齊 engine.js / puzzles.js） */
const SFX = {
  click()  { tone(430, 0.07, "triangle", 0.10); },
  paper()  { noise(0.18, 0.20); },
  gear()   { tone(150, 0.16, "sawtooth", 0.10); tone(110, 0.22, "sawtooth", 0.08, 0.06); },
  unlock() { tone(680, 0.08, "square", 0.12); tone(1020, 0.14, "square", 0.10, 0.08); },
  err()    { tone(140, 0.30, "sawtooth", 0.16, 0, 70); },
  good()   { [659, 880].forEach((f, i) => tone(f, 0.16, "sine", 0.10, i * 0.08)); },
  win()    { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.26, "triangle", 0.15, i * 0.11)); },
  tick()   { tone(880, 0.05, "square", 0.06); }
};
