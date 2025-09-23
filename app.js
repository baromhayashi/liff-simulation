// 2008161460-54GYvJ9x
// -------------- 設定 --------------
const LIFF_ID = "YOUR_LIFF_ID_HERE"; // 本番は環境に合わせて設定

// -------------- 初期化 --------------
document.addEventListener("DOMContentLoaded", async () => {
  // 月別入力欄を先に用意（LIFF未ログインでもUIは動く）
  generateMonthlyInputs();

  // ラジオ切り替えのハンドラ登録
  setupBillTypeToggle();

  // 屋外機追加ボタン
  document.getElementById("add-outdoor-unit").addEventListener("click", addOutdoorUnitInput);

  // 送信処理
  document.getElementById("simulation-form").addEventListener("submit", (e) => {
    e.preventDefault();
    calculateSimulation();
  });

  // LIFFが使える環境なら初期化（UI表示とは独立）
  if (window.liff && LIFF_ID && LIFF_ID !== "YOUR_LIFF_ID_HERE") {
    try {
      await liff.init({ liffId: LIFF_ID });
      if (!liff.isLoggedIn()) {
        // ログインさせたい場合のみ有効化
        // liff.login();
      }
    } catch (err) {
      console.error("LIFF initialization failed:", err);
    }
  }
});

// -------------- 入力UI：電気代 --------------
function setupBillTypeToggle() {
  const monthlyRadio = document.getElementById("radio-monthly");
  const annualRadio = document.getElementById("radio-annual");
  const monthlyContainer = document.getElementById("monthly-bill-container");
  const annualContainer = document.getElementById("annual-bill-container");

  function updateVisibility() {
    if (monthlyRadio.checked) {
      monthlyContainer.style.display = "";
      annualContainer.style.display = "none";
    } else {
      monthlyContainer.style.display = "none";
      annualContainer.style.display = "";
    }
  }

  monthlyRadio.addEventListener("change", updateVisibility);
  annualRadio.addEventListener("change", updateVisibility);
  updateVisibility(); // 初期反映
}

function generateMonthlyInputs() {
  const container = document.getElementById("monthly-grid");
  container.innerHTML = "";

  const months = [
    "1月","2月","3月","4月","5月","6月",
    "7月","8月","9月","10月","11月","12月"
  ];

  months.forEach((label, idx) => {
    const id = `bill-${idx + 1}`;
    const div = document.createElement("div");
    div.className = "form-group";
    div.innerHTML = `
      <label for="${id}">${label}</label>
      <input type="number" id="${id}" placeholder="円" min="0" inputmode="numeric" />
    `;
    container.appendChild(div);
  });
}

// -------------- 入力UI：屋外機 --------------
function addOutdoorUnitInput() {
  const container = document.getElementById("outdoor-unit-container");
  const unitDiv = document.createElement("div");
  unitDiv.className = "outdoor-unit-group";
  unitDiv.innerHTML = `
    <select class="unit-size-select" required>
      <option value="">選択</option>
      <option value="S">S</option>
      <option value="M">M</option>
      <option value="L">L</option>
      <option value="2L">2L</option>
      <option value="3L">3L</option>
      <option value="4L">4L</option>
      <option value="5L">5L</option>
      <option value="6L">6L</option>
      <option value="7L">7L</option>
      <option value="8L">8L</option>
    </select>

    <input type="number" class="unit-count-input" placeholder="台数" min="0" required />

    <select class="unit-direction-select" required>
      <option value="">選択</option>
      <option value="南">南面</option>
      <option value="北">北面</option>
      <option value="東">東面</option>
      <option value="西">西面</option>
    </select>

    <button type="button" class="btn remove-btn" aria-label="この屋外機行を削除">削除</button>
  `;
  container.appendChild(unitDiv);

  unitDiv.querySelector(".remove-btn").addEventListener("click", () => {
    container.removeChild(unitDiv);
  });
}

// -------------- 計算（ダミー実装例） --------------
function calculateSimulation() {
  // 必須チェック（例：クライアント名・案件名・空調比率）
  const client = document.getElementById("client-name").value.trim();
  const project = document.getElementById("project-name").value.trim();
  const acRatio = Number(document.getElementById("ac-ratio").value);

  if (!client || !project || Number.isNaN(acRatio)) {
    alert("必須項目が未入力です。");
    return;
  }

  // 電気代の取り出し
  const monthlySelected = document.getElementById("radio-monthly").checked;

  let monthlyBills = [];
  if (monthlySelected) {
    for (let i = 1; i <= 12; i++) {
      const v = Number(document.getElementById(`bill-${i}`).value || 0);
      monthlyBills.push(v);
    }
  } else {
    const avg = Number(document.getElementById("annual-bill").value || 0);
    monthlyBills = Array(12).fill(avg);
  }

  // ここに実際の計算ロジックを実装
  const annual = monthlyBills.reduce((a, b) => a + b, 0);
  const savingRate = Math.max(0, Math.min(100, acRatio)) / 100; // 仮の節約率＝空調比率
  const estimatedSaving = Math.round(annual * savingRate * 0.2); // 仮：空調由来の20%削減

  const introduceCost = 1000000; // 仮の導入費
  const paybackYears = estimatedSaving > 0 ? (introduceCost / estimatedSaving) : Infinity;

  const resultArea = document.getElementById("result-area");
  const resultContent = document.getElementById("result-content");
  resultContent.innerHTML = `
    <div class="result-row"><span>年間電気代（合計）</span><strong>${annual.toLocaleString()} 円</strong></div>
    <div class="result-row"><span>想定削減額（年）</span><strong>${estimatedSaving.toLocaleString()} 円</strong></div>
    <div class="result-row"><span>導入費用（仮）</span><strong>${introduceCost.toLocaleString()} 円</strong></div>
    <div class="result-row"><span>投資回収年数（目安）</span><strong>${Number.isFinite(paybackYears) ? paybackYears.toFixed(1) + " 年" : "算出不可"}</strong></div>
  `;
  resultArea.style.display = "";
}
