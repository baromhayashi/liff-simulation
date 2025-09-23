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

// 丸め規則
const ceilMoney = (x) => Math.ceil(x);
const roundPct1  = (x) => Math.round(x * 10) / 10; // 小数1桁四捨五入
const ceilMonths = (x) => Math.ceil(x);

// =========================
// 初期化
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  renderMonthlyInputs();
  setupBillTypeToggle();

  renderExistingTable();
  renderDesiredTable();
  renderPriceAreaTable();

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

function renderExistingTable(){
  const host = document.getElementById("existing-table");
  host.innerHTML = `
    <div class="table-scroll">
      <table class="table">
        <thead>
          <tr><th>サイズ</th><th>南</th><th>北</th><th>東</th><th>西</th><th>合計</th></tr>
        </thead>
        <tbody>
          ${SIZES.map(sz => `
            <tr>
              <td>${sz}</td>
              <td><input type="number" min="0" id="ex-${sz}-南" value="0" /></td>
              <td><input type="number" min="0" id="ex-${sz}-北" value="0" /></td>
              <td><input type="number" min="0" id="ex-${sz}-東" value="0" /></td>
              <td><input type="number" min="0" id="ex-${sz}-西" value="0" /></td>
              <td><input type="number" min="0" id="ex-${sz}-sum" value="0" disabled /></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    <small>※各行の方角合計は自動計算し、矛盾があれば警告します。</small>
  `;
  // 合計の自動更新
  SIZES.forEach(sz => {
    ["南","北","東","西"].forEach(o => {
      document.getElementById(`ex-${sz}-${o}`).addEventListener("input", () => {
        const s = ["南","北","東","西"].reduce((acc, oo) => acc + (+val(`ex-${sz}-${oo}`) || 0), 0);
        document.getElementById(`ex-${sz}-sum`).value = s;
      });
    });
  });
}

function renderDesiredTable(){
  const host = document.getElementById("desired-table");
  host.innerHTML = `
    <div class="table-scroll">
      <table class="table">
        <thead><tr><th>サイズ</th><th>施工希望台数</th></tr></thead>
        <tbody>
          ${SIZES.map(sz => `
            <tr>
              <td>${sz}</td>
              <td><input type="number" min="0" id="des-${sz}" value="0" /></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderPriceAreaTable(){
  const host = document.getElementById("price-area-table");
  host.innerHTML = `
    <div class="table-scroll">
      <table class="table">
        <thead>
          <tr><th>サイズ</th><th>パッケージ価格（税別）</th><th>面積上限（㎡/台）</th></tr>
        </thead>
        <tbody>
          ${SIZES.map(sz => `
            <tr>
              <td>${sz}</td>
              <td><input type="number" min="0" id="price-${sz}" placeholder="例：150000" /></td>
              <td><input type="number" min="0" step="0.1" id="area-${sz}" placeholder="例：5.0" /></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// =========================
// 送信
// =========================
function onSubmit(e){
  e.preventDefault();

  const client  = val("client-name").trim();
  const project = val("project-name").trim();
  if (!client || !project){
    alert("クライアント名／案件名を入力してください。");
    return;
  }

  // --- 電気代 ---
  const monthlyMode = document.getElementById("radio-monthly").checked;
  let monthlyBills = [];
  if (monthlyMode){
    for (let m=1; m<=12; m++){
      const v = +val(`bill-${m}`) || 0;
      monthlyBills.push(v);
    }
  } else {
    const avg = +val("annual-bill") || 0;
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
  const acBase = clampPct(+val("ac-ratio"));
  const acVariants = [
    clampPct(acBase - 5),
    acBase,
    clampPct(acBase + 5),
  ];

  // --- 既設 台数入力の取得（サイズ×方角） ---
  const existing = {};
  for (const sz of SIZES){
    existing[sz] = {};
    let sum = 0;
    for (const o of ["南","北","東","西"]){
      const n = Math.max(0, +val(`ex-${sz}-${o}`) || 0);
      existing[sz][o] = n;
      sum += n;
    }
    const cellSum = +val(`ex-${sz}-sum`);
    if (cellSum !== sum){
      alert(`既設台数：サイズ ${sz} の方角合計が一致しません（計算:${sum} ≠ 表示:${cellSum}）。修正してください。`);
      return;
    }
  }

  // --- 施工希望 台数 ---
  const desired = {};
  for (const sz of SIZES){
    desired[sz] = Math.max(0, +val(`des-${sz}`) || 0);
  }

  // --- 価格・面積上限 ---
  const price = {}, area = {};
  for (const sz of SIZES){
    price[sz] = Math.max(0, +val(`price-${sz}`) || 0);
    area[sz]  = Math.max(0, +val(`area-${sz}`)  || 0);
  }

  // --- 交通・宿泊 前提 ---
  const fuelCost = Math.max(0, +val("fuel-cost") || 170);
  const fuelEff  = Math.max(0.1, +val("fuel-eff") || 10);
  const distanceKm = Math.max(0, +val("distance-km") || 0);

  // ========== 削減額計算 ==========
  const scenarios = acVariants.map(acPct => {
    // 空調費（月） = 月間平均電気代 × 空調比率
    const acCostMonthly = avgBill * (acPct/100);

    // 台数比率 → サイズ補正
    const totalUnits = SIZES.reduce((acc, sz) => {
      const s = sumOrient(existing[sz]);
      return acc + s;
    }, 0);

    // 「設置台数が0のサイズは抜き」
    const validSizes = SIZES.filter(sz => sumOrient(existing[sz]) > 0);

    // 定数β
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
        if (n>0){
          sumRates += adjustByOrientation(base, o) * n;
        }
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
      acCostMonthly,
      sizeAdj,
      sizeMonthlyCost,
      sizeWeightedRate,
      sizeSaving,
      totalSaving,
      totalSavingPct,
      annualSaving,
      monthlySavingAvg
    };
  });

  // ========== 導入費用（税別） ==========
  // 総塗布面積 = Σ(面積上限 × 施工希望台数)
  const totalArea = SIZES.reduce((acc, sz) => acc + (area[sz] * (desired[sz]||0)), 0);

  // 生産性：8.4㎡ / 人・日（=16.8㎡ / 2人・日）
  const personDaysNeeded = totalArea>0 ? Math.ceil(totalArea / 8.4) : 0;

  // 人数（上限4人、下限1人。現実運用のため最低2人にしたい場合はMath.max(2,...)へ変更可）
  const crew = Math.min(4, Math.max(1, personDaysNeeded)); // 需要が少ない日でも最低1人

  // 施工日数 = ceil(必要な人日 / 人数)
  const workDays = personDaysNeeded>0 ? Math.ceil(personDaysNeeded / crew) : 0;

  // 清掃・養生費
  const cleanFee = workDays <= 1 ? 80000 : 100000;

  // 予備費
  const miscFee = 60000 + 10000 * workDays;

  // 交通費：日毎に往復、車両1台、燃費・燃料単価から 1kmあたり(燃料単価/燃費)
  const perKmCost = fuelCost / fuelEff; // 例：17円/km
  const transport = (distanceKm * 2) * workDays * perKmCost;

  // 宿泊費：泊数 = max(日数−1,0) × 人数 × 10,000
  const nights = Math.max(workDays - 1, 0);
  const lodgingUnit = Math.max(0, +val("lodging-perperson") || 10000);
  const lodging = nights * crew * lodgingUnit;

  // 本体価格合計（パッケージ×台数）
  const packageSum = SIZES.reduce((acc, sz) => acc + (price[sz] * (desired[sz]||0)), 0);

  // 導入費用（税別、簡易）
  const introduceCost = packageSum + cleanFee + miscFee + transport + lodging;

  // ========== 回収年数（3パターン） ==========
  const resultRows = scenarios.map(sc => {
    const monthsPayback = sc.monthlySavingAvg>0 ? introduceCost / sc.monthlySavingAvg : Infinity;
    return {
      acPct: sc.acPct,
      monthlySaving: ceilMoney(sc.monthlySavingAvg),     // 表示時：切上げ
      annualSaving:  ceilMoney(sc.annualSaving),         // 表示時：切上げ
      savingPct:     roundPct1(sc.totalSavingPct),       // 表示時：小数1桁
      paybackMonths: Number.isFinite(monthsPayback) ? ceilMonths(monthsPayback) : null
    };
  });

  // ========== 結果描画 ==========
  const res = document.getElementById("result-content");
  res.innerHTML = `
    <div class="result-block">
      <h3>前提まとめ</h3>
      <div class="kv">
        <div><span>月間平均電気代（補完後）</span><strong>${fmtYen(avgBill)}</strong></div>
        <div><span>総塗布面積</span><strong>${roundPct1(totalArea)} ㎡</strong></div>
        <div><span>必要人日</span><strong>${personDaysNeeded} 人日</strong></div>
        <div><span>施工人数</span><strong>${crew} 人</strong></div>
        <div><span>施工日数</span><strong>${workDays} 日</strong></div>
        <div><span>交通距離（往復/日）</span><strong>${roundPct1(distanceKm*2)} km</strong></div>
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

  document.getElementById("result-area").style.display = "";
}

// =========================
// ヘルパ
// =========================
function val(id){ return document.getElementById(id).value; }
function sumOrient(obj){ return ["南","北","東","西"].reduce((a,o)=>a + (obj[o]||0), 0); }
function clampPct(x){
  if (isNaN(x)) return 0;
  return Math.max(0, Math.min(100, x));
}
function fmtYen(x){
  const n = ceilMoney(+x || 0);
  return n.toLocaleString("ja-JP") + " 円";
}
