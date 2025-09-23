// =========================
// 設定
// =========================
const LIFF_ID = "YOUR_LIFF_ID_HERE"; // 必要時に設定

// サイズ一覧（LLで統一）
const SIZES = ["S","M","L","LL","3L","4L","5L","6L","7L","8L"];

// 係数（α）
const ALPHA = { S:1, M:1, L:2, LL:3, "3L":5, "4L":8, "5L":13, "6L":21, "7L":34, "8L":55 };

// 基本節電率（南面）
const BASE_SAVING_RATE = { S:8, M:12, L:16, LL:20, "3L":24, "4L":24, "5L":20, "6L":18, "7L":16, "8L":14 };

// 方角補正（北：50%減、東西：20%減）
function adjustByOrientation(base, orientation){
  if (orientation === "北") return base * 0.5;
  if (orientation === "東" || orientation === "西") return base * 0.8;
  return base; // 南
}

// 月別係数（空調電力の季節変動）
const MONTH_COEF = {
  1:1.019, 2:1.019, 3:1.019,
  4:0.934, 5:0.934, 6:0.934,
  7:1.085, 8:1.085, 9:1.085,
  10:0.934, 11:0.934, 12:1.019
};

// 丸め規則（表示直前に適用）
const ceilMoney = (x) => Math.ceil(x);
const roundPct1  = (x) => Math.round(x * 10) / 10; // 小数1桁四捨五入
const ceilMonths = (x) => Math.ceil(x);

// ▼「施工価格早見表」の固定テーブル（税別）※ご提示値を採用
const PRICE = { // 単価[円/台]
  S:16000, M:26000, L:34000, LL:54000, "3L":84000, "4L":92000, "5L":132000, "6L":154000, "7L":178000, "8L":206000
};
const AREA = {  // 面積上限[㎡/台]
  S:0.8, M:1.3, L:1.7, LL:2.7, "3L":4.2, "4L":4.6, "5L":6.6, "6L":7.7, "7L":8.9, "8L":10.3
};

// 既設：行追加式データ
let existingRows = []; // {id, size, count, orientation}
let desiredRows  = []; // {id, size, count}

// =========================
// 初期化
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  renderMonthlyInputs();
  setupBillTypeToggle();

  // 既設（サイズ/台数/方角）
  renderExistingList();
  document.getElementById("add-existing-row").addEventListener("click", addExistingRow);

  // 施工希望（サイズ/台数）— デフォルトで1行
  renderDesiredList();
  document.getElementById("add-desired-row").addEventListener("click", addDesiredRow);

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

// ===== 既設：行追加式 =====
function renderExistingList(){
  const host = document.getElementById("existing-list");
  host.innerHTML = `<div id="existing-rows"></div>`;
  existingRows = []; // 初期化
  addExistingRow();  // 初期行
}

function addExistingRow(){
  const id = cryptoRandomId();
  existingRows.push({ id, size: "S", count: 1, orientation: "南" });
  paintExistingRows();
}

function removeExistingRow(id){
  existingRows = existingRows.filter(r => r.id !== id);
  paintExistingRows();
}

function paintExistingRows(){
  const wrap = document.getElementById("existing-rows");
  wrap.innerHTML = existingRows.map(r => `
    <div class="row existing-row" id="row-${r.id}">
      <div class="cell">
        <label>サイズ</label>
        <select id="ex-size-${r.id}">
          ${SIZES.map(sz => `<option value="${sz}" ${sz===r.size?'selected':''}>${sz}</option>`).join("")}
        </select>
      </div>
      <div class="cell">
        <label>台数</label>
        <input type="number" id="ex-count-${r.id}" min="0" value="${r.count}" />
      </div>
      <div class="cell">
        <label>設置方角</label>
        <select id="ex-ori-${r.id}">
          ${["南","北","東","西"].map(o => `<option value="${o}" ${o===r.orientation?'selected':''}>${o}面</option>`).join("")}
        </select>
      </div>
      <div class="cell actions">
        <button type="button" class="btn btn-danger" id="ex-del-${r.id}">削除</button>
      </div>
    </div>
  `).join("");

  // イベント付与
  existingRows.forEach(r => {
    qs(`#ex-size-${r.id}`).addEventListener("change", e => r.size = e.target.value);
    qs(`#ex-count-${r.id}`).addEventListener("input", e => {
      const v = Math.max(0, +e.target.value || 0); r.count = v; e.target.value = v;
    });
    qs(`#ex-ori-${r.id}`).addEventListener("change", e => r.orientation = e.target.value);
    qs(`#ex-del-${r.id}`).addEventListener("click", () => removeExistingRow(r.id));
  });
}

// ===== 施工希望：行追加式（デフォルト1行） =====
function renderDesiredList(){
  const host = document.getElementById("desired-list");
  host.innerHTML = `<div id="desired-rows"></div>`;
  desiredRows = []; // 初期化
  addDesiredRow();  // 初期行（表示済みの状態）
}

function addDesiredRow(){
  const id = cryptoRandomId();
  desiredRows.push({ id, size: "S", count: 1 });
  paintDesiredRows();
}

function removeDesiredRow(id){
  desiredRows = desiredRows.filter(r => r.id !== id);
  paintDesiredRows();
}

function paintDesiredRows(){
  const wrap = document.getElementById("desired-rows");
  wrap.innerHTML = desiredRows.map(r => `
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

  // イベント付与
  desiredRows.forEach(r => {
    qs(`#des-size-${r.id}`).addEventListener("change", e => r.size = e.target.value);
    qs(`#des-count-${r.id}`).addEventListener("input", e => {
      const v = Math.max(0, +e.target.value || 0); r.count = v; e.target.value = v;
    });
    qs(`#des-del-${r.id}`).addEventListener("click", () => removeDesiredRow(r.id));
  });
}

// =========================
/* 送信 */
// =========================
function onSubmit(e){
  e.preventDefault();

  const client  = gv("client-name").trim();
  const project = gv("project-name").trim();
  if (!client || !project){
    alert("クライアント名／案件名を入力してください。");
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

  // 月間平均（実額がある月はそれで平均。欠損のみ除外）
  const provided = monthlyBills.filter(v => v>0);
  const monthlyAvg = provided.length>0
    ? (provided.reduce((a,b)=>a+b,0) / provided.length)
    : 0;

  // 欠損は平均×季節係数で補完
  const completedBills = monthlyBills.map((v, idx) => {
    if (v>0) return v;
    const m = idx+1;
    return monthlyAvg * MONTH_COEF[m];
  });

  const avgBill = completedBills.reduce((a,b)=>a+b,0) / 12; // 真の月間平均

  // --- 空調比率（3パターン） ---
  const acBase = clampPct(+gv("ac-ratio"));
  const acVariants = [ clampPct(acBase-5), acBase, clampPct(acBase+5) ];

  // --- 既設（行）→ サイズ×方角 集計 ---
  const existing = aggregateExistingRows(existingRows);
  const totalUnitsAll = SIZES.reduce((acc, sz) => acc + sumOrient(existing[sz] || {}), 0);
  if (totalUnitsAll === 0){
    alert("室外機サイズ別台数・設置方角を1件以上入力してください。");
    return;
  }

  // --- 施工希望（行）→ サイズ合計 集計 ---
  const desired = aggregateDesiredRows(desiredRows);

  // ========== 削減額計算 ==========
  const scenarios = acVariants.map(acPct => {
    // 空調費（月） = 月間平均電気代 × 空調比率
    const acCostMonthly = avgBill * (acPct/100);

    // 台数比率 → 定数β
    const totalUnits = SIZES.reduce((acc, sz) => acc + sumOrient(existing[sz] || {}), 0);
    const validSizes = SIZES.filter(sz => sumOrient(existing[sz] || {}) > 0);

    const beta = {};
    let betaTotal = 0;
    for (const sz of validSizes){
      const units  = sumOrient(existing[sz]);
      const ratio  = units / totalUnits * 100; // 台数比率[%]
      beta[sz]     = (ALPHA[sz] || 0) * ratio; // 定数β
      betaTotal   += beta[sz];
    }

    // サイズ補正[%]
    const sizeAdj = {};
    for (const sz of validSizes){
      sizeAdj[sz] = beta[sz] / (betaTotal || 1) * 100;
    }

    // サイズ別 月間電気代（= 空調費 × サイズ補正）
    const sizeMonthlyCost = {};
    for (const sz of validSizes){
      sizeMonthlyCost[sz] = acCostMonthly * (sizeAdj[sz]/100);
    }

    // サイズ別 加重平均節電率（方角別台数で加重）
    const sizeWeightedRate = {};
    for (const sz of validSizes){
      const base = BASE_SAVING_RATE[sz] || 0;
      const counts = existing[sz];
      const total = sumOrient(counts);
      let sumRates = 0;
      for (const o of ["南","北","東","西"]){
        const n = counts[o] || 0;
        if (n>0){ sumRates += adjustByOrientation(base, o) * n; }
      }
      const w = total>0 ? (sumRates / total) : 0;
      sizeWeightedRate[sz] = w; // %
    }

    // サイズ別節電額
    const sizeSaving = {};
    for (const sz of validSizes){
      sizeSaving[sz] = sizeMonthlyCost[sz] * (sizeWeightedRate[sz]/100);
    }

    // 合計節電額・全体節電率
    const totalSaving = Object.values(sizeSaving).reduce((a,b)=>a+b,0);
    const totalSavingPct = avgBill>0 ? (totalSaving / avgBill * 100) : 0;

    // 年間想定削減額（各月：平均×月係数×全体節電率）
    let annualSaving = 0;
    for (let m=1; m<=12; m++){
      const monthBase = avgBill * (MONTH_COEF[m] || 1);
      annualSaving += monthBase * (totalSavingPct/100);
    }
    const monthlySavingAvg = annualSaving / 12;

    return {
      acPct,
      totalSavingPct,
      annualSaving,
      monthlySavingAvg
    };
  });

  // ========== 導入費用（税別） ==========
  // 総塗布面積 = Σ(面積上限 × 施工希望台数)
  const totalArea = SIZES.reduce((acc, sz) => acc + (AREA[sz] * (desired[sz]||0)), 0);

  // 生産性：8.4㎡ / 人・日（=16.8㎡ / 2人・日）
  const personDaysNeeded = totalArea>0 ? Math.ceil(totalArea / 8.4) : 0;

  // 人数（上限4人、下限1人）
  const crew = Math.min(4, Math.max(1, personDaysNeeded));

  // 施工日数 = ceil(必要な人日 / 人数)
  const workDays = personDaysNeeded>0 ? Math.ceil(personDaysNeeded / crew) : 0;

  // 清掃・養生費（固定）
  const cleanFee = workDays <= 1 ? 80000 : 100000;

  // 予備費（固定式）
  const miscFee = 60000 + 10000 * workDays;

  // 交通費：フロントでは 0 円（住所→距離の算出はサーバ側で実施を想定）
  const transport = 0;

  // 宿泊費：泊数 = max(日数−1,0) × 人数 × 10,000
  const nights = Math.max(workDays - 1, 0);
  const lodging = nights * crew * 10000;

  // 本体価格合計（パッケージ×台数）— 固定単価テーブル PRICE を使用
  const packageSum = SIZES.reduce((acc, sz) => acc + (PRICE[sz] * (desired[sz]||0)), 0);

  // 導入費用（税別、簡易）
  const introduceCost = packageSum + cleanFee + miscFee + transport + lodging;

  // ========== 回収年数（3パターン） ==========
  const resultRows = scenarios.map(sc => {
    const monthsPayback = sc.monthlySavingAvg>0 ? introduceCost / sc.monthlySavingAvg : Infinity;
    return {
      acPct: sc.acPct,
      savingPct: roundPct1(sc.totalSavingPct),
      monthlySaving: ceilMoney(sc.monthlySavingAvg),
      annualSaving:  ceilMoney(sc.annualSaving),
      paybackMonths: Number.isFinite(monthsPayback) ? ceilMonths(monthsPayback) : null
    };
  });

  // ========== 結果描画 ==========
  const res = qs("#result-content");
  res.innerHTML = `
    <div class="result-block">
      <h3>前提まとめ</h3>
      <div class="kv">
        <div><span>月間平均電気代（補完後）</span><strong>${fmtYen(avgBill)}</strong></div>
        <div><span>総塗布面積</span><strong>${roundPct1(totalArea)} ㎡</strong></div>
        <div><span>必要人日</span><strong>${personDaysNeeded} 人日</strong></div>
        <div><span>施工人数</span><strong>${crew} 人</strong></div>
        <div><span>施工日数</span><strong>${workDays} 日</strong></div>
      </div>
    </div>

    <div class="result-block">
      <h3>導入費用（税別）</h3>
      <div class="kv">
        <div><span>本体価格（合計）</span><strong>${fmtYen(packageSum)}</strong></div>
        <div><span>清掃・養生費</span><strong>${fmtYen(cleanFee)}</strong></div>
        <div><span>予備費</span><strong>${fmtYen(miscFee)}</strong></div>
        <div><span>交通費</span><strong>${fmtYen(transport)}</strong></div>
        <div><span>宿泊費</span><strong>${fmtYen(lodging)}</strong></div>
        <div class="total"><span>導入費用（税別）</span><strong>${fmtYen(introduceCost)}</strong></div>
      </div>
    </div>

    <div class="result-block">
      <h3>削減額と回収期間（空調比率 3パターン）</h3>
      <div class="table-scroll">
        <table class="table">
          <thead>
            <tr><th>空調比率</th><th>全体節電率</th><th>月間削減額</th><th>年間削減額</th><th>回収期間</th></tr>
          </thead>
          <tbody>
            ${resultRows.map(r => `
              <tr>
                <td>${r.acPct}%</td>
                <td>${r.savingPct}%</td>
                <td>${fmtYen(r.monthlySaving)}</td>
                <td>${fmtYen(r.annualSaving)}</td>
                <td>${r.paybackMonths !== null ? r.paybackMonths + " か月" : "算出不可"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <small>※金額は表示時に切り上げ。％は小数1桁四捨五入。期間（か月）は切り上げ。</small>
    </div>
  `;

  qs("#result-area").style.display = "";
}

// =========================
// ヘルパ
// =========================
function gv(id){ return document.getElementById(id).value; }
function qs(sel){ return document.querySelector(sel); }
function cryptoRandomId(){ return 'xxxxxx'.replace(/x/g, () => Math.floor(Math.random()*16).toString(16)); }
function sumOrient(obj){ return ["南","北","東","西"].reduce((a,o)=>a + (obj?.[o]||0), 0); }
function clampPct(x){ if (isNaN(x)) return 0; return Math.max(0, Math.min(100, x)); }
function fmtYen(x){ const n = ceilMoney(+x || 0); return n.toLocaleString("ja-JP") + " 円"; }

/** 行式 -> サイズ×方角に集計（既設） */
function aggregateExistingRows(rows){
  const agg = {}; SIZES.forEach(sz => { agg[sz] = { 南:0, 北:0, 東:0, 西:0 }; });
  rows.forEach(r => {
    const sz = r.size; const ori = r.orientation; const c = Math.max(0, Number(r.count) || 0);
    if (!agg[sz]) agg[sz] = { 南:0, 北:0, 東:0, 西:0 };
    if (agg[sz][ori] === undefined) agg[sz][ori] = 0;
    agg[sz][ori] += c;
  });
  return agg;
}

/** 行式 -> サイズ合計に集計（施工希望） */
function aggregateDesiredRows(rows){
  const agg = {}; SIZES.forEach(sz => agg[sz] = 0);
  rows.forEach(r => {
    const sz = r.size; const c = Math.max(0, Number(r.count) || 0);
    if (agg[sz] === undefined) agg[sz] = 0;
    agg[sz] += c;
  });
  return agg;
}
