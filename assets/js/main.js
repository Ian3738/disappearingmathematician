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

  const cards = ENDING.cards.map(c =>
    `<div class="fc">
       <h3>${c.no} ${c.ti}　<span style="color:var(--gold-dim);font-size:.8rem">${c.pg}</span></h3>
       <div class="f">${c.f.replace(/²/g, "<sup>2</sup>")}</div>
       <p>${c.d}</p>
     </div>`).join("");

  const box = document.getElementById("ending");
  box.innerHTML = `<div class="manu">
      <h1>✦ 教授的最後手稿 ✦</h1>
      <p class="lead">${ENDING.lead.join("<br>")}</p>
      <div class="cards">${cards}</div>
      <div class="rank">
        <div class="t">🏅 ${rank.title}</div>
        <p style="color:#d8cbb0;margin-top:6px">${rank.desc}</p>
        <div class="stat">
          <div>通關時間 <b>${mm}:${ss}</b></div>
          <div>使用提示 <b>${S.hints}</b> 次</div>
        </div>
        <div class="row"><button class="btn" onclick="location.reload()">再玩一次</button></div>
      </div>
    </div>`;
  const cur = $(".scene.on"); if (cur) cur.classList.remove("on");
  box.classList.add("on");
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

/* ---------- 啟動 ---------- */
function boot() {
  initDust();
  document.getElementById("enterBtn").addEventListener("click", () => {
    SFX.click();
    ac(); /* 使用者手勢後解鎖 AudioContext */
    const title = document.getElementById("title");
    title.style.transition = "opacity .8s ease";
    title.style.opacity = "0";
    setTimeout(() => { title.style.display = "none"; S.t0 = Date.now(); renderRoom(1); }, 800);
  });
}
document.addEventListener("DOMContentLoaded", boot);
