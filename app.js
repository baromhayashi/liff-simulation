// 2008161460-54GYvJ9x
const liffId = "YOUR_LIFF_ID_HERE";

document.addEventListener('DOMContentLoaded', () => {
    liff.init({ liffId: liffId })
        .then(() => {
            if (liff.isLoggedIn()) {
                initializeApp();
            } else {
                liff.login();
            }
        })
        .catch(err => {
            console.error("LIFF initialization failed", err);
        });
});

function initializeApp() {
    document.getElementById('simulation-form').addEventListener('submit', (e) => {
        e.preventDefault();
        calculateSimulation();
    });

    document.getElementById('add-unit-button').addEventListener('click', addOutdoorUnitInput);
    
    // ラジオボタンの変更イベントを監視
    document.querySelectorAll('input[name="bill-type"]').forEach(radio => {
        radio.addEventListener('change', (event) => {
            const monthlyContainer = document.getElementById('monthly-bill-container');
            const annualContainer = document.getElementById('annual-bill-container');
            if (event.target.value === 'monthly') {
                monthlyContainer.style.display = 'block';
                annualContainer.style.display = 'none';
            } else {
                monthlyContainer.style.display = 'none';
                annualContainer.style.display = 'block';
            }
        });
    });
    
    // 初期表示として月ごとの入力欄を生成
    generateMonthlyInputs();
    addOutdoorUnitInput(); // 最初の1つを最初から表示
}

function generateMonthlyInputs() {
    const container = document.querySelector('.monthly-grid');
    container.innerHTML = '';
    const months = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
    months.forEach(month => {
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `<label for="bill-${month}">${month}</label><input type="number" id="bill-${month}" placeholder="円" min="0">`;
        container.appendChild(div);
    });
}

function addOutdoorUnitInput() {
    const container = document.getElementById('outdoor-unit-container');
    const unitDiv = document.createElement('div');
    unitDiv.className = 'outdoor-unit-group';
    unitDiv.innerHTML = `
        <select class="unit-size-select">
            <option value="">選択</option>
            <option value="S">S</option><option value="M">M</option><option value="L">L</option><option value="LL">LL</option><option value="3L">3L</option><option value="4L">4L</option><option value="5L">5L</option><option value="6L">6L</option><option value="7L">7L</option><option value="8L">8L</option>
        </select>
        <input type="number" class="unit-count-input" placeholder="台数" min="0" required>
        <select class="unit-direction-select">
            <option value="">選択</option>
            <option value="南">南面</option><option value="北">北面</option><option value="東">東面</option><option value="西">西面</option>
        </select>
        <button type="button" class="btn remove-btn">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" style="width: 20px; height: 20px; fill: white;"><path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.7C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/></svg>
        </button>
    `;
    container.appendChild(unitDiv);
    unitDiv.querySelector('.remove-btn').addEventListener('click', () => {
        container.removeChild(unitDiv);
    });
}

async function calculateSimulation() {
    // 省略：計算ロジックは前回と同じです。
}