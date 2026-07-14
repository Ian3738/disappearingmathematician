/* =========================================================================
 * engine.js — 遊戲引擎（場景 / 對話 / HUD / 物品欄 / 彈窗 / 提示）
 * 依賴：data.js、audio.js
 * ========================================================================= */
"use strict";

/* 全域狀態（僅存記憶體，不用 localStorage） */
const S = {
  scene: "title", room: 1, hints: 0, inv: [],
  t0: 0, tHandle: null, muted: false, doneRoom: {}
};

/* 便捷工具 */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
function el(html) {
  const d = document.createElement("div");
  d.innerHTML = html.trim();
  return d.firstElementChild;
}
function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

/* 計時器 */
function startTimer() {
  if (S.tHandle) return;
  if (!S.t0) S.t0 = Date.now();
  S.tHandle = setInterval(() => {
    const t = $("#timer");
    if (t) t.textContent = fmtTime(Date.now() - S.t0);
  }, 500);
}

/* ---------- 場景外殼 ---------- */
const scenesRoot = () => $("#scenes");

function renderRoom(n) {
  const r = ROOMS[n - 1];
  S.room = n; S.scene = "room" + n;
  scenesRoot().querySelectorAll(".scene").forEach(x => x.remove());
  const sc = el(
    `<div class="scene on" id="room${n}" style="background-image:url('${r.bg}')">
       <div class="stage" id="stage${n}"></div>
     </div>`);
  scenesRoot().appendChild(sc);
  const stage = $("#stage" + n);

  /* 熱點 */
  r.hots.forEach(h => {
    const box = el(
      `<button class="hot" data-hot="${h.id}"
         style="left:${h.x};top:${h.y};width:${h.w};height:${h.h};transform:translate(-50%,-50%)">
         <span class="lbl">${h.label}</span><span class="tag">${h.tag}</span></button>`);
    box.addEventListener("click", () => { SFX.click(); openHot(n, h.id); });
    stage.appendChild(box);
  });

  stage.appendChild(el(hudHTML(r)));
  stage.appendChild(el(invHTML()));
  wireHUD(n);
  refreshInv();
  startTimer();

  /* 進場對話，結束後初始化該關的特殊互動 */
  playDialogue(r.intro, () => {
    if (n === 3) initDarkroom();
    if (n === 4) initGate();
  });
}

/* ---------- 視覺小說對話 ---------- */
function playDialogue(seq, done) {
  let i = 0;
  const layer = el(
    `<div class="dlg on" id="dlg">
       <img class="portrait" id="dlgImg" alt="">
       <div class="bubble">
         <div class="who" id="dlgWho"></div>
         <div class="say" id="dlgSay"></div>
         <div class="next">▼ 點擊繼續</div>
       </div>
     </div>`);
  $(".scene.on").appendChild(layer);
  function step() {
    if (i >= seq.length) { layer.remove(); if (done) done(); return; }
    const line = seq[i++], c = CHARS[line.who];
    $("#dlgImg").src = c.img;
    $("#dlgWho").textContent = c.name;
    $("#dlgSay").innerHTML = line.say;
    SFX.paper();
  }
  layer.addEventListener("click", () => { SFX.click(); step(); });
  step();
}

/* ---------- HUD ---------- */
function hudHTML(r) {
  /* 關卡進度圓點：已完成=on、當前=cur */
  let dots = "";
  for (let i = 1; i <= 4; i++) {
    const cls = S.doneRoom[i] ? "p on" : (i === r.id ? "p cur" : "p");
    dots += `<span class="${cls}"></span>`;
  }
  return `<div class="hud">
      <div class="chapbadge">
        <div class="no">${["Ⅰ","Ⅱ","Ⅲ","Ⅳ"][r.id - 1]}</div>
        <div class="txt">
          <div class="zh">${r.chap.replace(/^第.層 · /,"")}</div>
          <span class="en">${r.en} · ${r.topic}</span>
        </div>
        <div class="progress">${dots}</div>
      </div>
      <div class="tools">
        <div class="timer" id="timer">00:00</div>
        <button class="tool" id="tNotes" title="線索筆記">📖</button>
        <button class="tool" id="tHint"  title="提示">💡</button>
        <button class="tool" id="tMute"  title="靜音">${S.muted ? "🔇" : "🔊"}</button>
      </div>
    </div>`;
}
function wireHUD(n) {
  $("#tNotes").onclick = () => { SFX.click(); openNotes(); };
  $("#tHint").onclick  = () => { SFX.click(); openHint(n); };
  $("#tMute").onclick  = e => { S.muted = !S.muted; e.currentTarget.textContent = S.muted ? "🔇" : "🔊"; };
}

/* ---------- 物品欄 ---------- */
function invHTML() {
  let slots = "";
  for (let i = 0; i < 6; i++) {
    const it = S.inv[i];
    slots += `<div class="slot ${it ? "has" : ""}">${it ? it.icon : ""}</div>`;
  }
  return `<div class="inv"><span class="lab">物品</span>${slots}</div>`;
}
function refreshInv() {
  const bar = $(".inv"); if (!bar) return;
  bar.querySelectorAll(".slot").forEach((sl, i) => {
    const it = S.inv[i];
    if (it) {
      sl.classList.add("has"); sl.textContent = it.icon;
      sl.onclick = () => { SFX.click(); modal(
        `<h3>${it.name}</h3>
         <div style="font-size:3rem;text-align:center;margin:12px">${it.icon}</div>
         <p>${it.desc}</p><div class="row"><button class="btn" data-x>收起</button></div>`); };
    } else { sl.classList.remove("has"); sl.textContent = ""; sl.onclick = null; }
  });
}
function addItem(icon, name, desc) {
  if (S.inv.find(x => x.name === name)) return;
  S.inv.push({ icon, name, desc });
  refreshInv(); SFX.unlock(); toast("獲得物品：" + name, "ok");
}

/* ---------- 彈窗 / toast / 金色粒子 ---------- */
function modal(html) {
  $("#sheet").innerHTML = '<button class="sheet-x" aria-label="關閉">✕</button>' + html;
  $("#modal").classList.add("on");
  SFX.paper();
  $("#sheet").querySelector(".sheet-x").onclick = () => { SFX.click(); closeModal(); };
  $("#sheet").querySelectorAll("[data-x]").forEach(b => b.onclick = () => { SFX.click(); closeModal(); });
}
function closeModal() { $("#modal").classList.remove("on"); }

function toast(msg, kind) {
  const t = el(`<div class="toast ${kind || ""}">${msg}</div>`);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); },
    kind === "err" ? 3800 : 2000);
}
function sparks(x, y) {
  for (let i = 0; i < 18; i++) {
    const s = el('<div class="spark"></div>');
    s.style.left = x + "px"; s.style.top = y + "px";
    document.body.appendChild(s);
    const a = Math.random() * 6.28, r = 34 + Math.random() * 60;
    s.animate(
      [{ transform: "translate(0,0) scale(1)", opacity: 1 },
       { transform: `translate(${Math.cos(a) * r}px,${Math.sin(a) * r - 30}px) scale(0)`, opacity: 0 }],
      { duration: 820, easing: "ease-out" });
    setTimeout(() => s.remove(), 840);
  }
}

/* 診斷式回饋 */
function good(msg, cx, cy) { SFX.win(); toast(msg || "正確。", "ok"); if (cx != null) sparks(cx, cy); }
function bad(node, msg) {
  SFX.err(); toast(msg || "再想想。", "err");
  if (node) { node.style.animation = "none"; void node.offsetWidth; node.style.animation = "shake .5s"; }
}

/* ---------- 線索筆記本 ---------- */
function openNotes() {
  let body = ROOMS.filter(r => S.doneRoom[r.id]).map(r =>
    `<div class="fc"><h3>${r.topic}　<span style="color:var(--c-gold-dim);font-size:.78rem">${r.page}</span></h3>
       <div class="f">${r.formula.replace(/²/g,"<sup>2</sup>")}</div></div>`).join("");
  if (!body) body = "<p style='text-align:center;color:var(--c-gold-dim)'>還沒有解開任何機關。<br>解開後，公式會記錄在這裡。</p>";
  modal(`<h3>📖 線索筆記本</h3><div class="cards">${body}</div>
         <div class="row"><button class="btn" data-x>闔上</button></div>`);
}

/* ---------- 三段式提示 ---------- */
function openHint(n) {
  const arr = HINTS[n] || ["幻影：再觀察一下場景。"];
  const lv = Math.min(S.hints, arr.length - 1);
  modal(`<h3>💡 守關幻影的提示</h3>
    <p>${arr[lv]}</p>
    <p style="color:var(--c-gold-dim);font-size:.8rem;text-align:center;margin-top:10px">
      已求助 ${S.hints + 1} 次（會影響最終稱號，但不阻止你前進）</p>
    <div class="row">
      ${lv < arr.length - 1 ? '<button class="btn ghost" id="moreHint">再給明白一點</button>' : ""}
      <button class="btn" data-x>知道了</button>
    </div>`);
  S.hints++;
  const mh = $("#moreHint");
  if (mh) mh.onclick = () => { closeModal(); openHint(n); };
}
