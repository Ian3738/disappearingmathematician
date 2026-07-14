/* =========================================================================
 * audio.js — Web Audio API 程式合成音效與懸疑背景音樂
 * 匯出全域 SFX 與 BGM；平滑淡入淡出、低音鋪墊、不協和弦輪播與心跳脈衝
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

/* =========================================================================
 * BGM — 懸疑氛圍配樂（Procedural Ambient BGM）
 * ========================================================================= */
const BGM = {
  isPlaying: false,
  mainGain: null,
  bassOsc: null,
  bassLfo: null,
  padGain: null,
  delayNode: null,
  intervals: [],
  activeOscs: [],
  chordIndex: 0,
  chords: [
    [130.81, 185.00, 233.08, 311.13], // C3, F#3, Bb3, Eb4 (不和諧減和弦級張力)
    [103.83, 155.56, 196.00, 246.94], // G#2, D#3, G3, B3 (大七/小調交織，神祕莫測)
    [116.54, 164.81, 220.00, 293.66], // A#2, E3, A3, D4 (三度增幅懸疑)
    [110.00, 146.83, 196.00, 233.08]  // A2, D3, G3, Bb3 (沉重壓抑、無法化解)
  ],
  customAudioUrl: "assets/audio/bgm.mp3",
  customAudioEl: null,

  start() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    // 檢查是否有使用者自訂上傳的 Gemini/MusicFX 音訊
    if (this.customAudioUrl) {
      try {
        this.customAudioEl = new Audio(this.customAudioUrl);
        this.customAudioEl.loop = true;
        this.customAudioEl.volume = S.muted ? 0.0001 : 0.8;
        this.customAudioEl.play().catch(e => console.error("Custom BGM play failed", e));

        // 監聽靜音狀態定時器 (連動自訂音訊的音量)
        const muteChecker = setInterval(() => {
          if (!this.customAudioEl) return;
          const targetVal = S.muted ? 0.0001 : 0.8;
          const currentVal = this.customAudioEl.volume;
          const diff = targetVal - currentVal;
          if (Math.abs(diff) > 0.05) {
            this.customAudioEl.volume = currentVal + Math.sign(diff) * 0.05;
          } else {
            this.customAudioEl.volume = targetVal;
          }
        }, 100);
        this.intervals.push(muteChecker);
        return;
      } catch (err) {
        console.error("Failed to play custom audio, falling back to procedural BGM", err);
      }
    }

    const c = ac(); if (!c) return;
    
    // 建立主控 Gain 節點並連接至目的地
    this.mainGain = c.createGain();
    this.mainGain.gain.setValueAtTime(S.muted ? 0.0001 : 0.8, c.currentTime);
    this.mainGain.connect(c.destination);

    // 建立懸疑 Pad 用的 Gain
    this.padGain = c.createGain();
    this.padGain.gain.setValueAtTime(0.8, c.currentTime);
    this.padGain.connect(this.mainGain);

    // 1. 低音持續鋪墊 (Low Bass Drone) — 55Hz (A1) 加上 0.07Hz 極慢 LFO 調幅
    try {
      this.bassOsc = c.createOscillator();
      this.bassOsc.type = "sine";
      this.bassOsc.frequency.value = 55;

      const bassFilter = c.createBiquadFilter();
      bassFilter.type = "lowpass";
      bassFilter.frequency.value = 110;

      const bassGain = c.createGain();
      bassGain.gain.value = 0.06;

      this.bassLfo = c.createOscillator();
      this.bassLfo.frequency.value = 0.07; // 每 14 秒一個週期

      const lfoGain = c.createGain();
      lfoGain.gain.value = 0.03; // 調幅深度

      this.bassLfo.connect(lfoGain);
      lfoGain.connect(bassGain.gain);
      
      this.bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(this.mainGain);

      this.bassOsc.start();
      this.bassLfo.start();
    } catch(e) { console.error("Bass Drone fail", e); }

    // 2. 建立空間延遲反饋迴路 (Echo Delay Loop)，給高音金屬敲擊使用
    try {
      this.delayNode = c.createDelay(2.0);
      this.delayNode.delayTime.value = 0.6; // 600ms 延遲
      
      const delayFeedback = c.createGain();
      delayFeedback.gain.value = 0.45; // 45% 反饋

      this.delayNode.connect(delayFeedback);
      delayFeedback.connect(this.delayNode);
      this.delayNode.connect(this.mainGain);
    } catch(e) { console.error("Delay init fail", e); }

    // 3. 觸發第一次懸疑 Pad 和聲，並啟動 12 秒輪播
    this.playNextChord();
    const chordTimer = setInterval(() => this.playNextChord(), 12000);
    this.intervals.push(chordTimer);

    // 4. 定時隨機金屬敲擊音 (每 6~11 秒)
    const bellScheduler = () => {
      if (!this.isPlaying) return;
      this.playEerieBell();
      const nextDelay = 6000 + Math.random() * 5000;
      const t = setTimeout(bellScheduler, nextDelay);
      this.intervals.push(t);
    };
    bellScheduler();

    // 5. 心跳感壓迫脈衝 (每 1.1 秒，55 BPM)
    const heartbeatTimer = setInterval(() => this.playHeartbeat(), 1100);
    this.intervals.push(heartbeatTimer);

    // 6. 監聽靜音狀態定時器 (每 200 毫秒平滑淡入淡出)
    const muteChecker = setInterval(() => {
      if (!this.mainGain) return;
      const targetVal = S.muted ? 0.0001 : 0.8;
      const now = c.currentTime;
      // 使用 linearRampToValueAtTime 平滑變更音量
      this.mainGain.gain.setValueAtTime(this.mainGain.gain.value, now);
      this.mainGain.gain.linearRampToValueAtTime(targetVal, now + 0.4);
    }, 200);
    this.intervals.push(muteChecker);
  },

  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    
    // 清除所有定時器
    this.intervals.forEach(t => {
      clearInterval(t);
      clearTimeout(t);
    });
    this.intervals = [];

    // 停止自訂音訊播放
    if (this.customAudioEl) {
      try {
        const audio = this.customAudioEl;
        this.customAudioEl = null;
        // 平滑淡出自訂音訊
        let fadeInterval = setInterval(() => {
          if (audio.volume > 0.05) {
            audio.volume -= 0.05;
          } else {
            audio.pause();
            clearInterval(fadeInterval);
          }
        }, 50);
      } catch(e) {}
    }

    const c = ac(); if (!c) return;
    const now = c.currentTime;

    // 平滑淡出主音量
    if (this.mainGain) {
      try {
        this.mainGain.gain.setValueAtTime(this.mainGain.gain.value, now);
        this.mainGain.gain.linearRampToValueAtTime(0.0001, now + 1.5);
      } catch(e) {}
    }

    // 1.5 秒後徹底釋放與停止節點
    setTimeout(() => {
      try {
        if (this.bassOsc) { this.bassOsc.stop(); this.bassOsc.disconnect(); }
        if (this.bassLfo) { this.bassLfo.stop(); this.bassLfo.disconnect(); }
        this.activeOscs.forEach(item => {
          try { item.osc.stop(); item.osc.disconnect(); item.gain.disconnect(); } catch(e){}
        });
        this.activeOscs = [];
        if (this.mainGain) this.mainGain.disconnect();
        this.mainGain = null;
        this.bassOsc = null;
        this.bassLfo = null;
        this.padGain = null;
        this.delayNode = null;
      } catch(e) {}
    }, 1600);
  },

  playNextChord() {
    const c = ac(); if (!c) return;
    const now = c.currentTime;
    const fadeTime = 4.5; // 4.5 秒淡入淡出交叉

    // 漸暗並清除舊和弦
    const oldOscs = this.activeOscs;
    this.activeOscs = [];
    oldOscs.forEach(item => {
      try {
        item.gain.gain.setValueAtTime(item.gain.gain.value, now);
        item.gain.gain.linearRampToValueAtTime(0.0001, now + fadeTime);
        setTimeout(() => {
          try {
            item.osc.stop();
            item.osc.disconnect();
            item.gain.disconnect();
          } catch(e){}
        }, fadeTime * 1000 + 100);
      } catch(e){}
    });

    if (!this.isPlaying) return;

    // 選擇新和弦
    const notes = this.chords[this.chordIndex];
    this.chordIndex = (this.chordIndex + 1) % this.chords.length;

    // 漸亮新和弦
    notes.forEach(freq => {
      try {
        const osc = c.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;

        const filter = c.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 350; // 濾除高頻，使和弦溫暖柔和、不刺耳

        const gainNode = c.createGain();
        gainNode.gain.setValueAtTime(0.0001, now);
        
        // 音量隨關卡難度 (S.room) 微幅上升，增加後期壓迫感
        const currentRoom = (typeof S !== "undefined" && S.room) ? S.room : 1;
        const targetVol = (0.015 + Math.random() * 0.01) * (1 + (currentRoom - 1) * 0.12);
        
        gainNode.gain.linearRampToValueAtTime(targetVol, now + fadeTime);

        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.padGain);

        osc.start(now);
        this.activeOscs.push({ osc, gain: gainNode });
      } catch(e) {}
    });
  },

  playEerieBell() {
    if (S.muted) return;
    const c = ac(); if (!c) return;
    const now = c.currentTime;

    const baseFreqs = [880, 1047, 1318.51, 1568, 2093]; // A5, C6, E6, G6, C7
    const baseFreq = baseFreqs[Math.floor(Math.random() * baseFreqs.length)];
    // 使用非整數倍頻率（1.0、1.618 黃金比例、2.24）疊加出不和諧的金屬敲擊感
    const freqs = [baseFreq, baseFreq * 1.618, baseFreq * 2.24];

    freqs.forEach((freq, idx) => {
      try {
        const osc = c.createOscillator();
        const gainNode = c.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);

        gainNode.gain.setValueAtTime(0.0001, now);
        // 主頻音量稍大，泛音稍弱
        const factor = idx === 0 ? 1.0 : (idx === 1 ? 0.4 : 0.2);
        const maxVol = 0.018 * factor * (0.8 + Math.random() * 0.4);
        
        gainNode.gain.linearRampToValueAtTime(maxVol, now + 0.006);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);

        osc.connect(gainNode);
        // 直接輸出
        gainNode.connect(this.mainGain);
        // 同時送入延遲迴路，製造恐怖的圖書館空間回音
        if (this.delayNode) {
          gainNode.connect(this.delayNode);
        }

        osc.start(now);
        osc.stop(now + 1.6);
      } catch(e) {}
    });
  },

  playHeartbeat() {
    if (S.muted) return;
    const c = ac(); if (!c) return;
    const now = c.currentTime;
    
    const currentRoom = (typeof S !== "undefined" && S.room) ? S.room : 1;
    // 心跳強度隨關卡推進而變強 (1.0 -> 1.5 倍)
    const factor = 1 + (currentRoom - 1) * 0.15;

    // 雙重跳動
    this.thump(now, 0.08 * factor);
    this.thump(now + 0.26, 0.04 * factor); // 第二聲較輕、稍有延遲
  },

  thump(time, vol) {
    const c = ac(); if (!c) return;
    try {
      const osc = c.createOscillator();
      const gainNode = c.createGain();

      osc.type = "sine";
      // 快速向極低頻俯衝 (60Hz -> 10Hz) 模擬心臟肌肉的收縮撞擊音
      osc.frequency.setValueAtTime(60, time);
      osc.frequency.exponentialRampToValueAtTime(10, time + 0.14);

      gainNode.gain.setValueAtTime(0.0001, time);
      gainNode.gain.linearRampToValueAtTime(vol, time + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);

      osc.connect(gainNode);
      gainNode.connect(this.mainGain);

      osc.start(time);
      osc.stop(time + 0.15);
    } catch(e) {}
  }
};