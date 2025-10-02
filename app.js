// =========================
// 設定
// =========================
const LIFF_ID = "YOUR_LIFF_ID_HERE"; // 必要時に設定

// サイズ一覧（LLで統一）
const SIZES = ["S","M","L","LL","3L","4L","5L","6L","7L","8L"];

// 係数（α）
const ALPHA = { S:1, M:1, L:2, LL:3, "3L":5, "4L":8, "5L":13, "6L":21, "7L":34, "8L":55 };

// 基本節電率（方角補正なし）
const BASE_SAVING_RATE = { S:8, M:12, L:16, LL:20, "3L":24, "4L":24, "5L":20, "6L":18, "7L":16, "8L":14 };

// 月別係数（空調電力の季節変動）
const MONTH_COEF = {
  1:1.019, 2:1.019, 3:1.019,
  4:0.934, 5:0.934, 6:0.934,
  7:1.085, 8:1.085, 9:1.085,
  10:0.934, 11:0.934, 12:1.019
};

// 丸め規則（表示直前に適用）
const ceilMoney = (x) => Math.ceil(x);
const roundPct1  = (x) => Math.round(x * 10) / 10;
const ceilMonths = (x) => Math.ceil(x);

// 施工価格・面積上限（固定：ご提示値）
const PRICE = {
  S:16000, M:26000, L:34000, LL:54000, "3L":84000, "4L":92000, "5L":132000, "6L":154000, "7L":178000, "8L":206000
};
const AREA = {
  S:0.8, M:1.3, L:1.7, LL:2.7, "3L":4.2, "4L":4.6, "5L":6.6, "6L":7.7, "7L":8.9, "8L":10.3
};

// ▼ジャンル別の既定空調比率（%）
const GENRE_DEFAULTS = {
  "コンビニエンスストア": 20,
  "パチンコ店": 50,
  "小売店舗（アパレル・雑貨等）": 30,
  "オフィスビル": 45,
  "ホテル・宿泊施設": 45,
  "病院クリニック": 35,
  "学校・教育施設": 25,
  "アミューズメント施設（映画館・ゲームセンター）": 40,
  "フィットネスジム": 35,
  "スーパー・食品小売り": 20,
  "工場（軽工業系）": 15,
  "工場（重工業系）": 10,
  "倉庫物流施設": 10
};

// ▼ジャンル別の既定サイズ（ご指定の表に従う）
const GENRE_SIZE_DEFAULT = {
  "コンビニエンスストア": "3L",
  "パチンコ店": "7L",
  "小売店舗（アパレル・雑貨等）": "L",
  "オフィスビル": "3L",
  "ホテル・宿泊施設": "3L",
  "病院クリニック": "LL",
  "学校・教育施設": "LL",
  "アミューズメント施設（映画館・ゲームセンター）": "5L",
  "フィットネスジム": "4L",
  "スーパー・食品小売り": "5L",
  "工場（軽工業系）": "6L",
  "工場（重工業系）": "7L",
  "倉庫物流施設": "7L"
};

// 既設・施工希望（行追加式）
let existingRows = []; // {id, size, count}
let desiredRows  = []; // {id, size, count}

// =========================
// 初期化
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  renderMonthlyInputs();
  setupBillTypeToggle();

  // ▼ジャンル選択：空調比率は「自動入力しない」／既設サイズの自動反映は継続
  const genreSel = document.getElementById("genre-select");
  // 入力欄のプレースホルダを更新（文言のみ）
  const acInput  = document.getElementById("ac-ratio");
  if (acInput) acInput.placeholder = "例：25（不明な場合は空欄で問題ありません）";

  genreSel.addEventListener("change", () => {
    const g = genreSel.value;
    // ※ここでは acInput.value を設定しない（自動入力しない）
    // 室外機サイズ別台数の自動反映（既定サイズ1台）
    if (GENRE_SIZE_DEFAULT[g]) {
      const sz = GENRE_SIZE_DEFAULT[g];
      existingRows = [{ id: cryptoRandomId(), size: sz, count: 1 }];
      paintExistingRows();
      syncDesiredFromExisting();
    }
  });

  // 施工希望（DOMコンテナ生成）→ 既設（初期同期あり）
  renderDesiredList();
  renderExistingList();

  // 施工希望セクションを非表示（裏では計算に使用）
  const desiredHost = document.getElementById("desired-list");
  const desiredSection = desiredHost ? desiredHost.closest(".form-section") : null;
  if (desiredSection) desiredSection.style.display = "none";

  document.getElementById("add-existing-row").addEventListener("click", () => {
    addExistingRow();
    syncDesiredFromExisting();
  });

  document.getElementById("simulation-form").addEventListener("submit", onSubmit);

  if (window.liff && LIFF_ID && LIFF_ID !== "YOUR_LIFF_ID_HERE") {
    try {
      await liff.init({ liffId: LIFF_ID });
    } catch (e) {
      console.warn("LIFF init failed:", e);
    }
  }
});

// =========================
// UI レンダリング
// =========================
function renderMonthlyInputs(){
  const container = document.getElementById("monthly-grid");
  container.innerHTML = "";
  const months = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  months.forEach((label, i) => {
    const id = `bill-${i+1}`;
    const div = document.createElement("div");
    div.className = "form-group";
    div.innerHTML = `
      <label for="${id}">${label} 電気代【円】</label>
      <input type="number" id="${id}" placeholder="例：100000" min="0" inputmode="numeric" />
    `;
    container.appendChild(div);
  });
}

function setupBillTypeToggle(){
  const monthlyRadio = document.getElementById("radio-monthly");
  const annualRadio  = document.getElementById("radio-annual");
  const monthlyContainer = document.getElementById("monthly-bill-container");
  const annualContainer  = document.getElementById("annual-bill-container");
  function update(){
    if (monthlyRadio.checked){
      monthlyContainer.style.display = "";
      annualContainer.style.display = "none";
    } else {
      monthlyContainer.style.display = "none";
      annualContainer.style.display = "";
    }
  }
  monthlyRadio.addEventListener("change", update);
  annualRadio.addEventListener("change", update);
  update();
}

// ===== 既設：行追加式（方角なし） =====
function renderExistingList(){
  const host = document.getElementById("existing-list");
  host.innerHTML = `<div id="existing-rows"></div>`;
  existingRows = [];
  addExistingRow();           // 初期行
  syncDesiredFromExisting();  // 初期同期
}
function addExistingRow(){
  const id = cryptoRandomId();
  existingRows.push({ id, size: "S", count: 1 });
  paintExistingRows();
}
function removeExistingRow(id){
  existingRows = existingRows.filter(r => r.id !== id);
  paintExistingRows();
  syncDesiredFromExisting();
}
function paintExistingRows(){
  const wrap = document.getElementById("existing-rows");
  if (!wrap) return;
  wrap.innerHTML = existingRows.map(r => `
    <div class="row existing-row" id="row-${r.id}">
      <div class="cell size">
        <label>サイズ</label>
        <select id="ex-size-${r.id}">
          ${SIZES.map(sz => `<option value="${sz}" ${sz===r.size?'selected':''}>${sz}</option>`).join("")}
        </select>
      </div>
      <div class="cell count">
        <label>台数</label>
        <input type="number" id="ex-count-${r.id}" min="0" value="${r.count}" />
      </div>
      <div class="cell actions">
        <button type="button" class="btn btn-danger inline-delete" id="ex-del-${r.id}">削除</button>
      </div>
    </div>
  `).join("");

  // 変更のたびに施工希望へ同期
  existingRows.forEach(r => {
    qs(`#ex-size-${r.id}`).addEventListener("change", e => {
      r.size = e.target.value;
      syncDesiredFromExisting();
    });
    qs(`#ex-count-${r.id}`).addEventListener("input", e => {
      const v = Math.max(0, +e.target.value || 0);
      r.count = v;
      e.target.value = v;
      syncDesiredFromExisting();
    });
    qs(`#ex-del-${r.id}`).addEventListener("click", () => removeExistingRow(r.id));
  });
}

// ===== 施工希望：行追加式（自動反映／非表示で保持） =====
function renderDesiredList(){
  const host = document.getElementById("desired-list");
  host.innerHTML = `<div id="desired-rows"></div>`;
  paintDesiredRows();
}
function paintDesiredRows(){
  const wrap = document.getElementById("desired-rows");
  if (!wrap) return; // 安全策
  // 非表示でも裏で保持するため、DOMは更新しておく（ユーザーには見えない）
  wrap.innerHTML = (desiredRows.length ? desiredRows : []).map(r => `
    <div class="row desired-row" id="drow-${r.id}">
      <div class="cell">
        <label>サイズ</label>
        <select id="des-size-${r.id}">
          ${SIZES.map(sz => `<option value="${sz}" ${sz===r.size?'selected':''}>${sz}</option>`).join("")}
        </select>
      </div>
      <div class="cell">
        <label>台数</label>
        <input type="number" id="des-count-${r.id}" min="0" value="${r.count}" />
      </div>
      <div class="cell actions">
        <button type="button" class="btn btn-danger" id="des-del-${r.id}">削除</button>
      </div>
    </div>
  `).join("");

  // 手動編集は不要だが、互換のためイベントは付与（非表示なので実質操作不可）
  desiredRows.forEach(r => {
    qs(`#des-size-${r.id}`).addEventListener("change", e => r.size = e.target.value);
    qs(`#des-count-${r.id}`).addEventListener("input",  e => { const v = Math.max(0, +e.target.value || 0); r.count = v; e.target.value = v; });
    qs(`#des-del-${r.id}`).addEventListener("click",    () => { desiredRows = desiredRows.filter(x => x.id !== r.id); paintDesiredRows(); });
  });
}

// ===== 既設 → 施工希望 自動同期 =====
function syncDesiredFromExisting(){
  // 既設をサイズごとに集計
  const agg = {}; SIZES.forEach(sz => agg[sz] = 0);
  existingRows.forEach(r => { agg[r.size] += Math.max(0, Number(r.count) || 0); });

  // 集計結果から施工希望の行を再構成（サイズ順、台数>0のみ）
  const rows = [];
  SIZES.forEach(sz => {
    const c = agg[sz];
    if (c > 0) rows.push({ id: cryptoRandomId(), size: sz, count: c });
  });
  desiredRows = rows;
  paintDesiredRows();
}

// =========================
// 送信（計算ロジック）
// =========================
function onSubmit(e){
  e.preventDefault();

  const client  = gv("client-name").trim();
  const project = gv("project-name").trim();
  const genre   = gv("genre-select").trim();

  // 必須チェック
  if (!client || !project){
    alert("法人・個人名／施設名を入力してください。");
    return;
  }
  if (!genre){
    alert("ジャンルを選択してください。");
    return;
  }

  // --- 電気代 ---
  const monthlyMode = qs("#radio-monthly").checked;
  let monthlyBills = [];
  if (monthlyMode){
    for (let m=1; m<=12; m++){
      const v = +gv(`bill-${m}`) || 0;
      monthlyBills.push(v);
    }
  } else {
    const avg = +gv("annual-bill") || 0;
    monthlyBills = Array(12).fill(avg);
  }

  // 実入力がある月だけで平均 → 欠損は季節係数で補完
  const provided = monthlyBills.filter(v => v>0);
  const monthlyAvg = provided.length>0 ? (provided.reduce((a,b)=>a+b,0) / provided.length) : 0;
  const completedBills = monthlyBills.map((v, idx) => v>0 ? v : monthlyAvg * (MONTH_COEF[idx+1] || 1));
  const avgBill = completedBills.reduce((a,b)=>a+b,0) / 12;

  // --- 空調比率（ジャンル自動適用：入力があれば優先。ただし「自動入力」はしない） ---
  const acInputRaw = gv("ac-ratio").trim();
  let acBase;
  if (acInputRaw !== "") {
    acBase = clampPct(+acInputRaw);
  } else if (GENRE_DEFAULTS.hasOwnProperty(genre) && GENRE_DEFAULTS[genre] != null) {
    acBase = clampPct(GENRE_DEFAULTS[genre]); // 入力欄は空のままでも内部適用
  } else {
    alert("空調比率が未入力です。ジャンルを選択するか、空調比率を入力してください。");
    return;
  }
  const acVariants = [ clampPct(acBase-5), acBase, clampPct(acBase+5) ];

  // --- 既設（行）→ サイズ合計 集計（方角なし） ---
  const existing = aggregateExistingRows(existingRows); // {size: count}
  const totalUnitsAll = SIZES.reduce((acc, sz) => acc + (existing[sz] || 0), 0);
  if (totalUnitsAll === 0){
    alert("室外機サイズ別台数を1件以上入力してください。");
    return;
  }

  // --- 施工希望（行）→ サイズ合計 集計（非表示だが内部保持） ---
  const desired = aggregateDesiredRows(desiredRows);

  // ========== 削減額計算（方角補正なし） ==========
  const scenarios = acVariants.map(acPct => {
    const acCostMonthly = avgBill * (acPct/100);

    const validSizes = SIZES.filter(sz => (existing[sz] || 0) > 0);
    const beta = {};
    let betaTotal = 0;

    for (const sz of validSizes){
      const units = existing[sz] || 0;
      const ratio = units / totalUnitsAll * 100; // 台数比率[%]
      beta[sz] = (ALPHA[sz] || 0) * ratio;
      betaTotal += beta[sz];
    }

    const sizeAdj = {};
    for (const sz of validSizes){
      sizeAdj[sz] = beta[sz] / (betaTotal || 1) * 100;
    }

    const sizeMonthlyCost = {};
    for (const sz of validSizes){
      sizeMonthlyCost[sz] = acCostMonthly * (sizeAdj[sz]/100);
    }

    const sizeSaving = {};
    for (const sz of validSizes){
      const rate = BASE_SAVING_RATE[sz] || 0;
      sizeSaving[sz] = sizeMonthlyCost[sz] * (rate/100);
    }

    const totalSaving = Object.values(sizeSaving).reduce((a,b)=>a+b,0);
    const totalSavingPct = avgBill>0 ? (totalSaving / avgBill * 100) : 0;

    // 年間想定削減額
    let annualSaving = 0;
    for (let m=1; m<=12; m++){ annualSaving += (avgBill * (MONTH_COEF[m] || 1)) * (totalSavingPct/100); }
    const monthlySavingAvg = annualSaving / 12;

    return { acPct, totalSavingPct, annualSaving, monthlySavingAvg };
  });

  // ========== 導入費用（税別） ==========
  const totalArea = SIZES.reduce((acc, sz) => acc + (AREA[sz] * (desired[sz]||0)), 0);
  const personDaysNeeded = totalArea>0 ? Math.ceil(totalArea / 8.4) : 0;
  const crew = Math.min(4, Math.max(1, personDaysNeeded));
  const workDays = personDaysNeeded>0 ? Math.ceil(personDaysNeeded / crew) : 0;
  const cleanFee = workDays <= 1 ? 80000 : 100000;
  const miscFee = 60000 + 10000 * workDays;
  const transport = 0; // サーバ側で上書き予定
  const nights = Math.max(workDays - 1, 0);
  const lodging = nights * crew * 10000;
  const packageSum = SIZES.reduce((acc, sz) => acc + (PRICE[sz] * (desired[sz]||0)), 0);
  const introduceCost = packageSum + cleanFee + miscFee + transport + lodging;

  // ========== 回収年数（3パターン） ==========
  const resultRows = scenarios.map(sc => {
    const monthsPayback = sc.monthlySavingAvg>0 ? introduceCost / sc.monthlySavingAvg : Infinity;
    return {
      acPct: sc.acPct,
      savingPct: roundPct1(sc.totalSavingPct),
      monthlySaving:  ceilMoney(sc.monthlySavingAvg),
      annualSaving:   ceilMoney(sc.annualSaving),
      paybackMonths:  Number.isFinite(monthsPayback) ? ceilMonths(monthsPayback) : null
    };
  });

  // ---- レンジ表記用の整形（前回版のまま） ----
  const annuals   = resultRows.map(r => r.annualSaving).filter(Number.isFinite);
  const monthsArr = resultRows.map(r => r.paybackMonths).filter(v => v != null);

  const annualMin = Math.min(...annuals);
  const annualMax = Math.max(...annuals);
  const monthsMin = Math.min(...monthsArr);
  const monthsMax = Math.max(...monthsArr);

  const fmtYen = (x) => (Math.ceil(+x || 0)).toLocaleString("ja-JP") + "円";
  const fmtManYen = (x) => Math.floor((+x || 0) / 10000).toLocaleString("ja-JP") + "万円";

  const commentFast   = `👉 最短${monthsMin}ヶ月で投資回収！`;
  const commentAnnual = `👉 年間${fmtManYen(annualMax)}以上の削減効果も期待できます！`;
  const yearsWithin   = Math.ceil(monthsMin / 12);
  const commentYear   = `📌 最短${yearsWithin}年以内に投資回収 → その後はずっとプラス効果！`;
  // --------------------------------------------

  // ========== 結果描画（レンジ表記＋一言コメント＋CTA） ==========
  const res = qs("#result-content");
  res.innerHTML = `
    <div class="result-block">
      <h3>シミュレーション結果</h3>
      <div class="kv">
        <div><span>導入費用（税別）</span><strong>${fmtYen(introduceCost)}</strong></div>
        <div><span>年間削減額</span><strong>${fmtManYen(annualMin)}～${fmtManYen(annualMax)}</strong></div>
        <div><span>回収期間</span><strong>${monthsMin}ヶ月～${monthsMax}ヶ月</strong></div>
      </div>

      <!-- 一言コメント群（ボタンより上） -->
      <div style="margin-top:12px;">
        <div>${commentFast}</div>
        <div>${commentAnnual}</div>
        <div style="margin-top:8px; color:#333;">${commentYear}</div>
      </div>

      <!-- 小見出し（2行・強調） -->
      <div style="margin-top:18px; text-align:center;">
        <div style="font-weight:800; font-size:18px; line-height:1.3;">専門家があなたの施設に最適な</div>
        <div style="font-weight:800; font-size:18px; line-height:1.3;">削減プランを無料ご提案！</div>
      </div>

      <!-- CTA：本見積依頼ボタン -->
      <div style="margin-top:12px; text-align:center;">
        <a
          class="cta-estimate"
          href="https://xs161700.xsrv.jp/terano-tech/contact/"
          target="_blank" rel="noopener"
          style="
            display:inline-flex; align-items:center; justify-content:center; gap:8px;
            padding:14px 20px; font-size:16px; font-weight:700;
            color:#fff; text-decoration:none; border-radius:12px;
            background:#FF7043; box-shadow: 0 6px 16px rgba(255,112,67,0.35);
            transition: transform .05s ease, box-shadow .15s ease;
          "
          onmouseover="this.style.boxShadow='0 8px 20px rgba(255,112,67,0.45)';"
          onmouseout="this.style.boxShadow='0 6px 16px rgba(255,112,67,0.35)';"
          onmousedown="this.style.transform='translateY(1px)';"
          onmouseup="this.style.transform='translateY(0)';"
        >
          <span>無料の本見積もり依頼はこちら</span>
          <span aria-hidden="true">＞</span>
        </a>
      </div>
    </div>
  `;

  // 結果セクションを表示してスムーズスクロール
  const resultArea = document.getElementById("result-area");
  resultArea.style.display = "";
  setTimeout(() => {
    resultArea.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
}

// =========================
// ヘルパ
// =========================
function gv(id){ return document.getElementById(id).value; }
function qs(sel){ return document.querySelector(sel); }
function cryptoRandomId(){ return 'xxxxxx'.replace(/x/g, () => Math.floor(Math.random()*16).toString(16)); }
function clampPct(x){ if (isNaN(x)) return 0; return Math.max(0, Math.min(100, x)); }

/** 行式 -> サイズ合計に集計（既設） */
function aggregateExistingRows(rows){
  const agg = {}; SIZES.forEach(sz => agg[sz] = 0);
  rows.forEach(r => {
    const sz = r.size; const c = Math.max(0, Number(r.count) || 0);
    if (agg[sz] == null) agg[sz] = 0;
    agg[sz] += c;
  });
  return agg;
}

/** 行式 -> サイズ合計に集計（施工希望） */
function aggregateDesiredRows(rows){
  const agg = {}; SIZES.forEach(sz => agg[sz] = 0);
  rows.forEach(r => {
    const sz = r.size; const c = Math.max(0, Number(r.count) || 0);
    if (agg[sz] == null) agg[sz] = 0;
    agg[sz] += c;
  });
  return agg;
}
