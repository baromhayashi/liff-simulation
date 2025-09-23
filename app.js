// 2008161460-54GYvJ9x
// ====== 設定 ======
const liffId = "YOUR_LIFF_ID_HERE";

// ====== 起動処理 ======
document.addEventListener('DOMContentLoaded', () => {
  // 1) UIはLIFFとは独立して初期化（常に実行）
  setupUI();

  // 2) 可能であればLIFF初期化（LINE上でのプロフィール取得など用）
  if (window.liff) {
    liff.init({ liffId })
      .then(() => {
        // ログイン済みかどうかに関わらず、UIは既に初期化済み
        if (!liff.isLoggedIn()) {
          // LINE内で未ログインならログインさせたい場合は有効化
          // liff.login();
        }
      })
      .catch(err => {
        console.warn("LIFF initialization failed (UIは継続します):", err);
      });
  } else {
    console.warn("LIFF SDK not found (UIは継続します)。");
  }
});

// ====== UI初期化 ======
function setupUI() {
  // 送信（シミュレーション計算）
  const form = document.getElementById('simulation-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      calculateSimulation();
    });
  }

  // 室外機追加ボタン
  const addBtn = document.getElementById('add-unit-button');
  if (addBtn) {
    addBtn.addEventListener('click', addOutdoorUnitInput);
  }

  // ラジオ切り替え（毎月 or 年間平均）
  const radios = document.querySelectorAll('input[name="bill-type"]');
  radios.forEach(radio => {
    radio.addEventListener('change', handleBillTypeToggle);
  });

  // 月別入力欄の生成（常時）
  generateMonthlyInputs();

  // 初期表示（選択状態を反映）
  handleBillTypeToggle();

  // 初期の室外機入力行
  addOutdoorUnitInput();
}

// ====== 表示切り替え処理 ======
function handleBillTypeToggle() {
  const selected = document.querySelector('input[name="bill-type"]:checked');
  const monthlyContainer = document.getElementById('monthly-bill-container');
  const annualContainer  = document.getElementById('annual-bill-container');

  if (!monthlyContainer || !annualContainer) return;

  if (selected && selected.value === 'monthly') {
    monthlyContainer.style.display = 'block';
    annualContainer.style.display  = 'none';
    // 必要なら年間平均の必須を外す・月別を任意に 等のバリデーション調整もここで
  } else {
    monthlyContainer.style.display = 'none';
    annualContainer.style.display  = 'block';
  }
}

// ====== 月別入力欄生成 ======
function generateMonthlyInputs() {
  const container = document.querySelector('.monthly-grid');
  if (!container) return;

  container.innerHTML = '';
  const months = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

  months.forEach((month, idx) => {
    const div = document.createElement('div');
    div.className = 'form-group';
    const inputId = `bill-${idx + 1}`;
    div.innerHTML = `
      <label for="${inputId}">${month}</label>
      <input type="number" id="${inputId}" placeholder="円" min="0" inputmode="numeric">
    `;
    container.appendChild(div);
  });
}

// ====== 室外機行の追加 ======
function addOutdoorUnitInput() {
  const container = document.getElementById('outdoor-unit-container');
  if (!container) return;

  const unitDiv = document.createElement('div');
  unitDiv.className = 'outdoor-unit-group';
  unitDiv.innerHTML = `
    <select class="unit-size-select">
      <option value="">選択</option>
      <option value="S">S</option>
      <option value="M">M</option>
      <option value="L">L</option>
      <option value="LL">LL</option>
      <option value="3L">3L</option>
      <option value="4L">4L</option>
      <option value="5L">5L</option>
      <option value="6L">6L</option>
      <option value="7L">7L</option>
      <option value="8L">8L</option>
    </select>
    <input type="number" class="unit-count-input" placeholder="台数" min="0" required>
    <select class="unit-direction-select">
      <option value="">選択</option>
      <option value="南">南面</option>
      <option value="北">北面</option>
      <option value="東">東面</option>
      <option value="西">西面</option>
    </select>
    <button type="button" class="btn remove-btn" aria-label="この行を削除">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" style="width:20px;height:20px;fill:white;">
        <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.7C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-
