/* =========================================================================
 * puzzles.js — 四關謎題實作（分配律 / 和的平方 / 差的平方 / 平方差）
 * 依賴：data.js、engine.js
 * ========================================================================= */
"use strict";

/* 熱點分派 */
function openHot(n, id) {
  if (n === 1 && id === "blueprint") return puzzleBlueprint();
  if (n === 1 && id === "drawer")    return puzzleDrawer();
  if (n === 2 && id === "frame")     return puzzleSquare();
  if (n === 2 && id === "note")
    return modal(`<h3>教授的筆記</h3>
      <p>紙上「a²+b²」被重重劃掉，旁邊寫著：<br><br>
      <b>「別忘了中間那兩塊——最多人死在這裡。」</b></p>
      <div class="row"><button class="btn" data-x>收起</button></div>`);
}

/* 共用：HTML5 拖曳，把 .tile 放進對應 data-need 的 .slotbox */
function wireDrag(tilesSel, onAllPlaced) {
  const tiles = $$(tilesSel + " .tile");
  const slots = $$(".slotbox");
  let placed = 0;
  tiles.forEach(t => {
    t.addEventListener("dragstart", e => e.dataTransfer.setData("v", t.dataset.v));
    /* 觸控：點選 tile 再點 slot */
    t.addEventListener("click", () => { window.__pick = t; t.style.outline = "3px solid var(--gold)"; });
  });
  slots.forEach(sl => {
    sl.addEventListener("dragover", e => e.preventDefault());
    sl.addEventListener("drop", e => { e.preventDefault(); tryPlace(sl, e.dataTransfer.getData("v")); });
    sl.addEventListener("click", () => { if (window.__pick) { tryPlace(sl, window.__pick.dataset.v); } });
  });
  function tryPlace(sl, v) {
    if (sl.classList.contains("filled")) return;
    if (v === sl.dataset.need) {
      const tile = tiles.find(t => t.dataset.v === v);
      sl.textContent = tile.textContent; sl.style.background = tile.style.background;
      sl.classList.add("filled", "good"); tile.style.visibility = "hidden";
      if (window.__pick) { window.__pick.style.outline = ""; window.__pick = null; }
      SFX.good(); placed++;
      if (placed >= slots.length && onAllPlaced) setTimeout(onAllPlaced, 500);
    } else {
      sl.classList.add("bad"); SFX.err();
      setTimeout(() => sl.classList.remove("bad"), 500);
    }
  }
}

/* ---------- 第一關：分配律 a(b+c)=ab+ac（藍圖拼合） ---------- */
function puzzleBlueprint() {
  const r = ROOMS[0];
  if (S.doneRoom[1]) {
    return modal(`<h3>藍圖已拼合</h3>
      <p>圖上浮現三碼密碼：<b>${r.drawerCode}</b>。到抽屜輸入吧。</p>
      <div class="row"><button class="btn" data-x>好</button></div>`);
  }
  modal(`<h3>拼合藍圖 · 分配律</h3>
    <p style="text-align:center">寬 <b>a</b>、長 <b>(b+c)</b> 的長方形被切成兩塊。<br>
    把碎片拖進正確的格子，讓面積相加 ＝ a(b+c)。</p>
    <div class="dragwrap" id="bpTiles">
      <div class="tile" draggable="true" data-v="ab" style="background:linear-gradient(180deg,#e8c877,#c99a3a)">a·b</div>
      <div class="tile" draggable="true" data-v="ac" style="background:linear-gradient(180deg,#c9a98a,#9c7c56)">a·c</div>
    </div>
    <div class="dragwrap">
      <div class="slotbox" data-need="ab">寬a × 長b</div>
      <div class="slotbox" data-need="ac">寬a × 長c</div>
    </div>
    <div class="row"><button class="btn ghost" data-x>先出去看看</button></div>`);
  wireDrag("#bpTiles", () => {
    S.doneRoom[1] = 1; closeModal();
    good(`藍圖拼好了！a(b+c)=ab+ac。圖上浮現密碼 ${r.drawerCode}。`, innerWidth/2, innerHeight/2);
    const hot = document.querySelector('[data-hot="blueprint"]');
    if (hot) hot.classList.add("solved");
  });
}

/* 第一關：抽屜三碼密碼鎖 */
function puzzleDrawer() {
  const r = ROOMS[0];
  if (!S.doneRoom[1]) {
    return modal(`<h3>上鎖的抽屜</h3>
      <p>三碼數字鎖。密碼似乎和桌上那幅 <b>藍圖</b> 有關——先去把藍圖拼好。</p>
      <div class="row"><button class="btn" data-x>好</button></div>`);
  }
  if (S.doneRoom["1b"]) return gotoNextFrom(1);
  modal(`<h3>輸入抽屜密碼</h3>
    <div class="lock" id="drawerLock"></div>
    <div class="row"><button class="btn" id="drawerOK">開鎖</button><button class="btn ghost" data-x>取消</button></div>`);
  buildReels("drawerLock", 3);
  $("#drawerOK").onclick = () => {
    const code = readReels("drawerLock");
    if (code === r.drawerCode) {
      S.doneRoom["1b"] = 1; SFX.unlock(); closeModal();
      addItem("🔑", "黃銅鑰匙", "抽屜裡的鑰匙，能打開通往第二層的門。");
      good("喀——抽屜彈開了！", innerWidth/2, innerHeight/2);
      setTimeout(() => gotoNextFrom(1), 1400);
    } else { bad($("#drawerLock"), "密碼不對。再看看拼好的藍圖上浮現的數字。"); }
  };
}

/* 數字轉盤（可點擊 ▲▼ 增減） */
function buildReels(hostId, len) {
  const host = document.getElementById(hostId); host.innerHTML = "";
  for (let i = 0; i < len; i++) {
    const reel = el(`<div class="reel">
        <button data-up>▲</button><span class="d" data-d>0</span><button data-dn>▼</button></div>`);
    const d = reel.querySelector("[data-d]");
    reel.querySelector("[data-up]").onclick = () => { SFX.gear(); d.textContent = (Number(d.textContent) + 1) % 10; };
    reel.querySelector("[data-dn]").onclick = () => { SFX.gear(); d.textContent = (Number(d.textContent) + 9) % 10; };
    host.appendChild(reel);
  }
}
function readReels(hostId) {
  return $$("#" + hostId + " [data-d]").map(x => x.textContent).join("");
}

/* 過關轉場：淡出 → 進下一關 / 結局 */
function gotoNextFrom(n) {
  S.doneRoom[n] = 1;
  const cur = $(".scene.on");
  if (cur) cur.classList.remove("on");
  setTimeout(() => {
    if (n < 4) renderRoom(n + 1);
    else showEnding();
  }, 700);
}

/* ---------- 第二關：和的平方 (a+b)²=a²+2ab+b²（面積拼合） ---------- */
function puzzleSquare() {
  if (S.doneRoom[2]) return gotoNextFrom(2);
  modal(`<h3>填滿正方形 · 和的平方</h3>
    <p style="text-align:center">大正方形邊長 <b>(a+b)</b>。把四塊銅板放進對應位置，<br>看看 (a+b)² 到底由哪幾塊組成。</p>
    <div class="dragwrap" id="sqTiles">
      <div class="tile" draggable="true" data-v="a2"  style="background:linear-gradient(180deg,#e8c877,#c99a3a)">a²</div>
      <div class="tile" draggable="true" data-v="ab1" style="background:linear-gradient(180deg,#d8b98a,#b0894f)">ab</div>
      <div class="tile" draggable="true" data-v="ab2" style="background:linear-gradient(180deg,#d8b98a,#b0894f)">ab</div>
      <div class="tile" draggable="true" data-v="b2"  style="background:linear-gradient(180deg,#a9c8bd,#6f9c8c)">b²</div>
    </div>
    <div class="dragwrap" style="width:184px;margin:14px auto;flex-wrap:wrap;gap:4px">
      <div class="slotbox" data-need="a2"  style="width:88px;height:88px">左上</div>
      <div class="slotbox" data-need="ab1" style="width:88px;height:88px">右上</div>
      <div class="slotbox" data-need="ab2" style="width:88px;height:88px">左下</div>
      <div class="slotbox" data-need="b2"  style="width:88px;height:88px">右下</div>
    </div>
    <div class="row"><button class="btn ghost" data-x>先出去看看</button></div>`);
  wireDrag("#sqTiles", () => {
    closeModal();
    good("四塊剛好鋪滿！(a+b)²=a²+2ab+b²，中間正是那兩塊 ab。", innerWidth/2, innerHeight/2);
    const hot = document.querySelector('[data-hot="frame"]'); if (hot) hot.classList.add("solved");
    addItem("📜", "紙條・轉盤密語", "銅框背面刻著：通往暗房的轉盤，密語是『中間兩塊』。");
    setTimeout(() => gotoNextFrom(2), 1500);
  });
}

/* ---------- 第三關：差的平方（燭光照明 + 選號 + 常數項） ---------- */
function initDarkroom() {
  const stage = $("#stage3");
  /* 燭光遮罩：跟隨滑鼠/觸控的鏤空圓 */
  const mask = el('<div class="darkmask" id="darkmask"></div>');
  stage.appendChild(mask);
  /* 牆上殘缺算式 */
  const wall = el(`<div class="hot" id="dkWall"
      style="left:50%;top:44%;width:min(460px,86vw);height:120px;transform:translate(-50%,-50%);font-size:1.4rem;letter-spacing:.04em">
      (a−b)<sup>2</sup> = a<sup>2</sup>
      <span class="signbtn" id="s1" style="width:44px;height:44px;font-size:1.3rem;margin:0 4px">□</span> 2ab
      <span class="signbtn" id="s2" style="width:44px;height:44px;font-size:1.3rem;margin:0 4px">□</span> b<sup>2</sup>
    </div>`);
  stage.appendChild(wall);
  const move = e => {
    const p = e.touches ? e.touches[0] : e;
    mask.style.setProperty("--mx", p.clientX + "px");
    mask.style.setProperty("--my", p.clientY + "px");
    mask.style.setProperty("--r", "150px");
  };
  stage.addEventListener("mousemove", move);
  stage.addEventListener("touchmove", move, { passive: true });
  /* 點號誌切換 −/+ */
  [["s1", 0], ["s2", 1]].forEach(([id, idx]) => {
    $("#" + id).onclick = ev => {
      ev.stopPropagation(); SFX.click();
      const cur = $("#" + id).textContent;
      $("#" + id).textContent = cur === "−" ? "+" : (cur === "+" ? "□" : "−");
      checkSigns();
    };
  });
}

function checkSigns() {
  const r = ROOMS[2];
  const g1 = $("#s1").textContent, g2 = $("#s2").textContent;
  if (g1 === "□" || g2 === "□") return;
  /* 常見迷思：把差的平方寫成平方差（−、無/末項變號） */
  if (g1 === "−" && g2 === "−") { bad($("#dkWall"), MISCONCEPTION.diffAsDiffSquare); return; }
  if (g1 === r.signAnswer[0] && g2 === r.signAnswer[1]) {
    $("#s1").classList.add("sel"); $("#s2").classList.add("sel");
    good("算式補完：(a−b)²=a²−2ab+b²。", innerWidth/2, innerHeight/2);
    setTimeout(openConstLock, 900);
  } else {
    bad($("#dkWall"), "號誌不對。差的平方：中間 −2ab，末項 +b²（因為 (−b)²=+b²）。");
  }
}

/* 代入 (x−3)² 求常數項 → 數字鎖 */
function openConstLock() {
  const r = ROOMS[2];
  if (S.doneRoom[3]) return gotoNextFrom(3);
  modal(`<h3>密門數字鎖</h3>
    <p style="text-align:center">門上刻著一題：<br>
    將 <b>(x−3)²</b> 展開，它的 <b>常數項</b> 是多少？<br>把答案轉到鎖上。</p>
    <div class="lock" id="constLock"></div>
    <div class="row"><button class="btn" id="constOK">開門</button><button class="btn ghost" data-x>再想想</button></div>`);
  buildReels("constLock", 1);
  $("#constOK").onclick = () => {
    if (readReels("constLock") === r.constTerm) {
      SFX.unlock(); closeModal();
      good("喀啦——密門開了！(x−3)² 的常數項＝(−3)²＝9。", innerWidth/2, innerHeight/2);
      setTimeout(() => gotoNextFrom(3), 1400);
    } else { bad($("#constLock"), "不對。(x−3)²=x²−6x+9，常數項是末項 (−3)²=9。"); }
  };
}

/* ---------- 第四關：平方差速算挑戰（限時 60 秒） ---------- */
function initGate() {
  const r = ROOMS[3];
  const stage = $("#stage4");
  let idx = 0, timeLeft = r.timeLimit, timer = null;
  const box = el(`<div class="calc" id="calcBox">
      <div style="color:var(--gold-dim);font-size:.85rem">塔頂機械鎖 · 平方差速算</div>
      <div class="q" id="calcQ"></div>
      <input id="calcIn" type="tel" inputmode="numeric" placeholder="答案" autocomplete="off">
      <div class="bar"><i id="calcBar" style="width:100%"></i></div>
      <div class="prog" id="calcProg"></div>
      <div class="row" style="margin-top:12px"><button class="btn" id="calcOK">送出</button></div>
    </div>`);
  stage.appendChild(box);

  function render() {
    $("#calcQ").innerHTML = r.calc[idx].q.replace(/²/g, "<sup>2</sup>");
    $("#calcProg").textContent = `第 ${idx + 1} / ${r.calc.length} 題　剩餘 ${timeLeft}s`;
    $("#calcIn").value = ""; $("#calcIn").focus();
  }
  function tick() {
    timeLeft--; $("#calcBar").style.width = (timeLeft / r.timeLimit * 100) + "%";
    $("#calcProg").textContent = `第 ${idx + 1} / ${r.calc.length} 題　剩餘 ${timeLeft}s`;
    if (timeLeft <= 0) { clearInterval(timer); fail(); }
  }
  function fail() {
    bad($("#calcBox"), "時間到！深呼吸，用公式把大數拆小，再試一次。");
    idx = 0; timeLeft = r.timeLimit; setTimeout(start, 800);
  }
  function submit() {
    if (Number($("#calcIn").value) === r.calc[idx].a) {
      SFX.good(); idx++;
      if (idx >= r.calc.length) { clearInterval(timer); win(); return; }
      render();
    } else { bad($("#calcBox"), "算錯了。提示：" + r.calc[idx].hint); }
  }
  function win() {
    good("全部答對！大門緩緩開啟，晨光灑進來……", innerWidth/2, innerHeight/2);
    setTimeout(showEnding, 1600);
  }
  function start() { render(); timer = setInterval(tick, 1000); }
  $("#calcOK").onclick = submit;
  $("#calcIn").addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
  start();
}
