// =========================
// 設定
// =========================
const LIFF_ID = "YOUR_LIFF_ID_HERE"; // 必要時に設定
const SERVER_ENDPOINT = ""; // 例: "https://example.com/api/estimate-request"（未設定なら sendMessages フォールバック）

// サイズ一覧（UIの標準選択肢。内部用に "UNKNOWN" を追加で扱う）
const SIZES = ["S","M","L","LL","3L","4L","5L","6L","7L","8L"];
const UNKNOWN_VALUE = "UNKNOWN"; // 「わからない」の内部値

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

// ▼ジャンル別の既定サイズ
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
let existingRows = []; // {id, size, count} // size は SIZES 値 or "UNKNOWN"
let desiredRows  = []; // {id, size, count}

// =========================
// 初期化
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  renderMonthlyInputs();
  setupBillTypeToggle();

  // ▼空調比率：自動入力しない（placeholderのみ変更）
  const acInput  = document.getElementById("ac-ratio");
  if (acInput) acInput.placeholder = "例：25（不明時は空欄で可）";

  // ▼ジャンル選択：既設サイズのみ自動反映（1台）／空調比率は自動入力しない
  const genreSel = document.getElementById("genre-select");
  genreSel.addEventListener("change", () => {
    const g = genreSel.value;
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

  // 施工希望セクションを非表示（裏の計算では使用）
  const desiredHost = document.getElementById("desired-list");
  const desiredSection = desiredHost ? desiredHost.closest(".form-section") : null;
  if (desiredSection) desiredSection.style.display = "none";

  document.getElementById("add-existing-row").addEventListener("click", () => {
    addExistingRow();
    syncDesiredFromExisting();
  });

  document.getElementById("simulation-form").addEventListener("submit", onSubmit);

  if (window.liff && LIFF_ID && LIFF_ID !== "YOUR_LIFF_ID_HERE") {
    try { await liff.init({ liffId: LIFF_ID }); } catch (e) { console.warn("LIFF init failed:", e); }
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
  addExistingRow();           // 初期行（UNKNOWN 1台）
  syncDesiredFromExisting();  // 初期同期
}
function addExistingRow(){
  const id = cryptoRandomId();
  existingRows.push({ id, size: UNKNOWN_VALUE, count: 1 }); // デフォルト「わからない」
  paintExistingRows();
}
function removeExistingRow(id){
  existingRows = existingRows.filter(r => r.id !== id);
  paintExistingRows();
  syncDesiredFromExisting();
}
function sizeOptionsHtml(current){
  const unknownOpt = `<option value="${UNKNOWN_VALUE}" ${current===UNKNOWN_VALUE?'selected':''}>わからない</option>`;
  const sizeOpts   = SIZES.map(sz => `<option value="${sz}" ${sz===current?'selected':''}>${sz}</option>`).join("");
  return unknownOpt + sizeOpts;
}
function paintExistingRows(){
  const wrap = document.getElementById("existing-rows");
  if (!wrap) return;
  wrap.innerHTML = existingRows.map(r => `
    <div class="row existing-row" id="row-${r.id}">
      <div class="cell size">
        <label>サイズ</label>
        <select id="ex-size-${r.id}">
          ${sizeOptionsHtml(r.size)}
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

  existingRows.forEach(r => {
    qs(`#ex-size-${r.id}`).addEventListener("change", e => { r.size = e.target.value; syncDesiredFromExisting(); });
    qs(`#ex-count-${r.id}`).addEventListener("input", e => {
      const v = Math.max(0, +e.target.value || 0);
      r.count = v; e.target.value = v; syncDesiredFromExisting();
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
  if (!wrap) return;
  wrap.innerHTML = (desiredRows.length ? desiredRows : []).map(r => `
    <div class="row desired-row" id="drow-${r.id}">
      <div class="cell">
        <label>サイズ</label>
        <select id="des-size-${r.id}">
          ${sizeOptionsHtml(r.size)}
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

  // 非表示だが互換のためイベントを付与
  desiredRows.forEach(r => {
    qs(`#des-size-${r.id}`).addEventListener("change", e => r.size = e.target.value);
    qs(`#des-count-${r.id}`).addEventListener("input",  e => { const v = Math.max(0, +e.target.value || 0); r.count = v; e.target.value = v; });
    qs(`#des-del-${r.id}`).addEventListener("click",    () => { desiredRows = desiredRows.filter(x => x.id !== r.id); paintDesiredRows(); });
  });
}

// ===== 既設 → 施工希望 自動同期（UNKNOWN→ジャンル既定サイズ解決） =====
function syncDesiredFromExisting(){
  const genre = gv("genre-select").trim();
  const defaultSize = GENRE_SIZE_DEFAULT[genre] || "L";

  const agg = {}; SIZES.forEach(sz => agg[sz] = 0);
  existingRows.forEach(r => {
    let sz = r.size === UNKNOWN_VALUE ? defaultSize : r.size;
    if (!agg.hasOwnProperty(sz)) agg[sz] = 0;
    agg[sz] += Math.max(0, Number(r.count) || 0);
  });

  const rows = [];
  SIZES.forEach(sz => { if ((agg[sz]||0) > 0) rows.push({ id: cryptoRandomId(), size: sz, count: agg[sz] }); });
  desiredRows = rows;
  paintDesiredRows();
}

// =========================
// 送信（計算ロジック）
// =========================
async function onSubmit(e){
  e.preventDefault();

  const client  = gv("client-name").trim();
  const project = gv("project-name").trim();
  const genre   = gv("genre-select").trim();

  if (!client || !project){ alert("法人・個人名／施設名を入力してください。"); return; }
  if (!genre){ alert("ジャンルを選択してください。"); return; }

  // --- 電気代 ---
  const monthlyMode = qs("#radio-monthly").checked;
  let monthlyBills = [];
  if (monthlyMode){ for (let m=1; m<=12; m++){ monthlyBills.push(+gv(`bill-${m}`) || 0); } }
  else { const avg = +gv("annual-bill") || 0; monthlyBills = Array(12).fill(avg); }

  const provided = monthlyBills.filter(v => v>0);
  const monthlyAvg = provided.length>0 ? (provided.reduce((a,b)=>a+b,0) / provided.length) : 0;
  const completedBills = monthlyBills.map((v, idx) => v>0 ? v : monthlyAvg * (MONTH_COEF[idx+1] || 1));
  const avgBill = completedBills.reduce((a,b)=>a+b,0) / 12;

  // --- 空調比率（入力優先／空欄はジャンル既定）
  const acInputRaw = gv("ac-ratio").trim();
  let acBase;
  if (acInputRaw !== "") acBase = clampPct(+acInputRaw);
  else if (GENRE_DEFAULTS.hasOwnProperty(genre) && GENRE_DEFAULTS[genre] != null) acBase = clampPct(GENRE_DEFAULTS[genre]);
  else { alert("空調比率が未入力です。ジャンルを選択するか、空調比率を入力してください。"); return; }
  const acVariants = [ clampPct(acBase-5), acBase, clampPct(acBase+5) ];

  // --- 既設（UNKNOWN解決） ---
  const existingAgg = aggregateExistingRowsResolved(existingRows, genre);
  const totalUnitsAll = Object.values(existingAgg).reduce((a,b)=>a+(b||0),0);
  if (totalUnitsAll === 0){ alert("室外機サイズ別台数を1件以上入力してください。"); return; }

  // --- 施工希望（内部保持）
  const desired = aggregateDesiredRows(desiredRows);

  // ========== 削減額計算 ==========
  const scenarios = acVariants.map(acPct => {
    const acCostMonthly = avgBill * (acPct/100);
    const validSizes = SIZES.filter(sz => (existingAgg[sz] || 0) > 0);

    const beta = {}; let betaTotal = 0;
    for (const sz of validSizes){
      const units = existingAgg[sz] || 0;
      const ratio = units / totalUnitsAll * 100;
      beta[sz] = (ALPHA[sz] || 0) * ratio;
      betaTotal += beta[sz];
    }
    const sizeAdj = {}; validSizes.forEach(sz => { sizeAdj[sz] = beta[sz] / (betaTotal || 1) * 100; });

    const sizeMonthlyCost = {}; validSizes.forEach(sz => { sizeMonthlyCost[sz] = acCostMonthly * (sizeAdj[sz]/100); });

    const sizeSaving = {}; validSizes.forEach(sz => {
      const rate = BASE_SAVING_RATE[sz] || 0;
      sizeSaving[sz] = sizeMonthlyCost[sz] * (rate/100);
    });

    const totalSaving    = Object.values(sizeSaving).reduce((a,b)=>a+b,0);
    const totalSavingPct = avgBill>0 ? (totalSaving / avgBill * 100) : 0;

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
  const transport = 0;
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

  // ---- レンジ表示用値 ----
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

  // ========== 結果描画（＋問い合わせドロワー） ==========
  const res = qs("#result-content");
  res.innerHTML = `
    <div class="result-block">
      <h3>シミュレーション結果</h3>
      <div class="kv">
        <div><span>導入費用（税別）</span><strong>${fmtYen(introduceCost)}</strong></div>
        <div><span>年間削減額</span><strong>${fmtManYen(annualMin)}～${fmtManYen(annualMax)}</strong></div>
        <div><span>回収期間</span><strong>${monthsMin}ヶ月～${monthsMax}ヶ月</strong></div>
      </div>

      <div style="margin-top:12px;">
        <div>${commentFast}</div>
        <div>${commentAnnual}</div>
        <div style="margin-top:8px; color:#333;">${commentYear}</div>
      </div>

      <div style="margin-top:18px; text-align:center;">
        <div style="font-weight:800; font-size:18px; line-height:1.3;">専門家があなたの施設に最適な</div>
        <div style="font-weight:800; font-size:18px; line-height:1.3;">削減プランを無料ご提案！</div>
      </div>

      <div style="margin-top:12px; text-align:center;">
        <button id="open-inquiry" type="button"
          style="display:inline-flex;align-items:center;justify-content:center;gap:8px;
                 padding:14px 20px;font-size:16px;font-weight:700;color:#fff;border:0;cursor:pointer;
                 border-radius:12px;background:#FF7043;box-shadow:0 6px 16px rgba(255,112,67,0.35);
                 transition:transform .05s ease, box-shadow .15s ease;">
          <span>無料の本見積もり依頼はこちら</span><span aria-hidden="true">＞</span>
        </button>
      </div>

      <!-- 問い合わせドロワー -->
      <div id="inquiry-drawer" style="display:none; position:fixed; left:0; right:0; bottom:0; background:#fff; box-shadow:0 -8px 24px rgba(0,0,0,.12); padding:16px; z-index:9999; border-top-left-radius:16px; border-top-right-radius:16px;">
        <div style="font-weight:700; font-size:16px; margin-bottom:8px;">問い合わせ情報の送信</div>
        <div style="display:grid; gap:8px;">
          <input id="contact-name"  type="text"  placeholder="担当者様のお名前（必須）" style="padding:10px; border:1px solid #ddd; border-radius:10px;">
          <input id="contact-tel"   type="tel"   placeholder="電話番号（任意）"     style="padding:10px; border:1px solid #ddd; border-radius:10px;">
          <input id="contact-mail"  type="email" placeholder="メールアドレス（任意）" style="padding:10px; border:1px solid #ddd; border-radius:10px;">
          <label style="font-size:13px;">
            <input type="checkbox" id="contact-consent"> 個人情報の取扱いに同意します
          </label>
          <div style="display:flex; gap:8px; margin-top:4px;">
            <button id="send-inquiry" class="form-btn" type="button" style="flex:1;">この内容でLINEから問い合わせ</button>
            <button id="close-inquiry" type="button" style="flex:0 0 auto; padding:10px 12px; border:1px solid #ddd; border-radius:10px; background:#fafafa;">閉じる</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // 表示とスクロール
  const resultArea = document.getElementById("result-area");
  resultArea.style.display = "";
  setTimeout(() => { resultArea.scrollIntoView({ behavior:"smooth", block:"start" }); }, 0);

  // ドロワー操作
  const drawer   = document.getElementById("inquiry-drawer");
  const openBtn  = document.getElementById("open-inquiry");
  const closeBtn = document.getElementById("close-inquiry");
  const sendBtn  = document.getElementById("send-inquiry");
  openBtn.onclick  = () => drawer.style.display = "";
  closeBtn.onclick = () => drawer.style.display = "none";

  // 送信
  sendBtn.onclick = async () => {
    const name = gvVal("contact-name"), tel = gvVal("contact-tel"), mail = gvVal("contact-mail");
    const consent = document.getElementById("contact-consent").checked;
    if (!name){ alert("担当者様のお名前を入力してください。"); return; }
    if (!consent){ alert("個人情報の取扱いに同意してください。"); return; }

    // 送信用 payload
    const payload = {
      client: { name: client, facility: project, genre },
      acRatioUsed: acBase,
      bills: {
        monthlyInput: monthlyBills,
        monthlyCompleted: completedBills,
        avgMonthly: Math.ceil(avgBill),
        annualTotal: Math.ceil(completedBills.reduce((a,b)=>a+b,0))
      },
      units: {
        existingResolved: existingAgg, // UNKNOWN解決後
        desired // 内部同期済み
      },
      costs: {
        introduceCost: Math.ceil(introduceCost),
        annualSavingMin: Math.ceil(annualMin),
        annualSavingMax: Math.ceil(annualMax),
        paybackMonthsMin: monthsMin,
        paybackMonthsMax: monthsMax
      },
      contact: { name, tel, mail },
      meta: { timestamp: Date.now() }
    };

    // LIFFプロフィール（任意）
    try {
      if (window.liff && liff.isLoggedIn && liff.isLoggedIn()) {
        const profile = await liff.getProfile();
        payload.line = { userId: profile.userId, displayName: profile.displayName };
      }
    } catch {}

    // サーバPOST or フォールバック（sendMessages）
    try {
      if (SERVER_ENDPOINT) {
        const res = await fetch(SERVER_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type":"application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(String(res.status));
      } else {
        // フォールバック：ユーザー本人に受付控え（要LIFFログイン）
        if (window.liff && liff.isLoggedIn && liff.isLoggedIn() && liff.sendMessages) {
          const msg = [
            `本見積のご依頼を受け付けました。`,
            `施設名：${project}`,
            `ジャンル：${genre}`,
            `導入費用：${fmtYen(introduceCost)}`,
            `年間削減額：${fmtManYen(annualMin)}～${fmtManYen(annualMax)}`,
            `回収期間：${monthsMin}～${monthsMax}ヶ月`,
            `担当者：${name}${tel?`／TEL:${tel}`:""}${mail?`／MAIL:${mail}`:""}`
          ].join("\n");
          await liff.sendMessages([{ type:"text", text: msg }]);
        }
      }
      alert("送信が完了しました。担当よりご連絡いたします。");
      drawer.style.display = "none";
    } catch (err) {
      console.error(err);
      alert("送信に失敗しました。通信状況をご確認のうえ、時間をおいてお試しください。");
    }
  };
}

// =========================
// ヘルパ
// =========================
function gv(id){ return document.getElementById(id).value; }
function gvVal(id){ const el = document.getElementById(id); return el ? el.value.trim() : ""; }
function qs(sel){ return document.querySelector(sel); }
function cryptoRandomId(){ return 'xxxxxx'.replace(/x/g, () => Math.floor(Math.random()*16).toString(16)); }
function clampPct(x){ if (isNaN(x)) return 0; return Math.max(0, Math.min(100, x)); }

/** 既設（UNKNOWN→ジャンル既定サイズに解決して集計） */
function aggregateExistingRowsResolved(rows, genre){
  const resolved = {}; SIZES.forEach(sz => resolved[sz] = 0);
  const defaultSize = GENRE_SIZE_DEFAULT[genre] || "L";
  rows.forEach(r => {
    let sz = r.size === UNKNOWN_VALUE ? defaultSize : r.size;
    if (!resolved.hasOwnProperty(sz)) resolved[sz] = 0;
    resolved[sz] += Math.max(0, Number(r.count) || 0);
  });
  return resolved;
}

/** 行式 -> サイズ合計に集計（施工希望） */
function aggregateDesiredRows(rows){
  const agg = {}; SIZES.forEach(sz => agg[sz] = 0);
  rows.forEach(r => {
    let sz = r.size;
    if (sz === UNKNOWN_VALUE) {
      const genre = gv("genre-select").trim();
      sz = GENRE_SIZE_DEFAULT[genre] || "L";
    }
    if (agg[sz] == null) agg[sz] = 0;
    agg[sz] += Math.max(0, Number(r.count) || 0);
  });
  return agg;
}
