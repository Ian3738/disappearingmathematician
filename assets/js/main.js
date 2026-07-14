/* =========================================================================
 * main.js — 結局 / 稱號 / 塵埃 / 開場綁定 / 啟動
 * 依賴：data.js、audio.js、engine.js、puzzles.js
 * ========================================================================= */
"use strict";

/* ---------- 結局手稿 + 稱號 ---------- */
function showEnding() {
  if (S.tHandle) { clearInterval(S.tHandle); S.tHandle = null; }
  const total = Date.now() - S.t0;
  const mm = String(Math.floor(total / 60000)).padStart(2, "0");
  const ss = String(Math.floor(total / 1000) % 60).padStart(2, "0");
  const rank = RANKS.find(r => S.hints <= r.max);

  const cards = ENDING.cards.map((c, i) =>
    `<div class="fc" style="animation-delay:${0.15 + i * 0.08}s">
       <h3><span class="no">${c.no}</span>${c.ti}　<span style="color:var(--c-gold-dim);font-size:.78rem">${c.pg}</span></h3>
       <div class="f">${c.f.replace(/²/g, "<sup>2</sup>")}</div>
       <p>${c.d.replace(/²/g, "<sup>2</sup>")}</p>
     </div>`).join("");

  const box = document.getElementById("ending");
  box.innerHTML = `<div class="manu">
      <div class="seal">✦</div>
      <h1>教授的最後手稿</h1>
      <p class="lead">${ENDING.lead.join("<br>")}</p>
      <div class="cards">${cards}</div>
      <div class="rank">
        <div class="medal">🏅</div>
        <div class="t">${rank.title}</div>
        <p class="rdesc">${rank.desc}</p>
        <div class="stat">
          <div class="cell"><div class="k">Clear Time</div><div class="v">${mm}:${ss}</div></div>
          <div class="cell"><div class="k">Hints Used</div><div class="v">${S.hints}</div></div>
        </div>
        <div class="row"><button class="btn big" onclick="location.reload()">↻ 再玩一次</button></div>
      </div>
    </div>`;
  const cur = $(".scene.on"); if (cur) cur.classList.remove("on");
  box.classList.add("on");
  if (typeof BGM !== "undefined") BGM.stop();
  SFX.win();
}

/* ---------- 漂浮塵埃 ---------- */
function initDust() {
  const host = document.getElementById("dust");
  const n = innerWidth < 600 ? 20 : 40;
  for (let i = 0; i < n; i++) {
    const d = document.createElement("i");
    d.style.left = Math.random() * 100 + "%";
    const dur = 12 + Math.random() * 16;
    d.style.animationDuration = dur + "s";
    d.style.animationDelay = -Math.random() * dur + "s";
    const sc = 0.6 + Math.random() * 1.8;
    d.style.transform = `scale(${sc})`;
    d.style.opacity = 0.3 + Math.random() * 0.6;
    host.appendChild(d);
  }
}

/* ---------- 章節過場卡（進入每一關前顯示 1.6 秒） ---------- */
function chapterTransition(room, done) {
  const ct = document.getElementById("chaptrans");
  document.getElementById("ctNo").textContent =
    "CHAPTER " + ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ"][room.id - 1] + " · " + room.en;
  document.getElementById("ctZh").textContent = room.chap.replace(/^第.層 · /, "");
  document.getElementById("ctFormula").innerHTML =
    room.topic + "　" + room.formula.replace(/²/g, "<sup>2</sup>");
  ct.classList.add("on");
  if (typeof SFX !== "undefined") SFX.unlock && SFX.unlock();
  setTimeout(() => {
    ct.classList.remove("on");
    setTimeout(done, 500);
  }, 1600);
}

/* ---------- 資產預載 + 載入畫面 ---------- */
function preloadAssets(done) {
  const box = document.getElementById("loaderPct");
  const urls = [
    "assets/images/sc_gate.webp", "assets/images/sc_study.webp",
    "assets/images/sc_lab.webp", "assets/images/sc_darkroom.webp",
    "assets/images/sc_ending.webp",
    "assets/images/ch_hero.webp", "assets/images/ch_prof.webp", "assets/images/ch_spirit.webp"
  ];
  let loaded = 0;
  const tick = () => {
    loaded++;
    const pct = Math.round(loaded / urls.length * 100);
    if (box) box.textContent = "LOADING · " + pct + "%";
    if (loaded >= urls.length) {
      // 設定標題背景（用 gate 大圖）
      const tb = document.getElementById("titlebg");
      if (tb) tb.style.backgroundImage = "url('assets/images/sc_gate.webp')";
      setTimeout(done, 300);
    }
  };
  urls.forEach(u => {
    const img = new Image();
    img.onload = tick; img.onerror = tick;
    img.src = u;
  });
  // 安全網：最多 6 秒後強制進場
  setTimeout(() => { if (loaded < urls.length) { loaded = urls.length; tick(); } }, 6000);
}

/* ---------- 啟動 ---------- */
function boot() {
  initDust();

  // 預載場景圖，完成後淡出載入畫面
  preloadAssets(() => {
    const loader = document.getElementById("loader");
    if (loader) loader.classList.add("hide");
  });

  // 綁定自訂 Gemini/MusicFX 音訊上傳
  const bgmUpload = document.getElementById("bgmUpload");
  const bgmName = document.getElementById("bgmName");
  if (bgmUpload && bgmName) {
    bgmUpload.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        if (typeof BGM !== "undefined") {
          // 如果先前有建立過 ObjectURL，先釋放以避免記憶體洩漏
          if (BGM.customAudioUrl) {
            try { URL.revokeObjectURL(BGM.customAudioUrl); } catch(err){}
          }
          BGM.customAudioUrl = URL.createObjectURL(file);
          bgmName.innerHTML = `🎵 已匯入：<span style="color:var(--c-gold);font-weight:bold;">${file.name}</span>`;
          SFX.good(); // 播放成功回饋音效
        }
      }
    });
  }

  document.getElementById("enterBtn").addEventListener("click", () => {
    SFX.click();
    ac(); /* 使用者手勢後解鎖 AudioContext */
    if (typeof BGM !== "undefined") BGM.start();
    const title = document.getElementById("title");
    title.style.transition = "opacity .8s ease";
    title.style.opacity = "0";
    setTimeout(() => {
      title.style.display = "none";
      S.t0 = Date.now();
      chapterTransition(ROOMS[0], () => renderRoom(1));
    }, 800);
  });
}
document.addEventListener("DOMContentLoaded", boot);