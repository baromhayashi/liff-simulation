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
    // フォーム送信ボタンのイベントリスナー
    document.getElementById('calculate-button').addEventListener('click', calculateSimulation);

    // 室外機追加ボタンのイベントリスナー
    document.getElementById('add-unit-button').addEventListener('click', addOutdoorUnitInput);
    addOutdoorUnitInput(); // 最初の1つを最初から表示

    // 電気代入力方法の切り替え
    document.getElementById('bill-input-type').addEventListener('change', (event) => {
        const monthlyInputDiv = document.getElementById('monthly-bill-input');
        const annualInputDiv = document.getElementById('annual-bill-input');
        if (event.target.value === 'monthly') {
            monthlyInputDiv.style.display = 'block';
            annualInputDiv.style.display = 'none';
            generateMonthlyInputs();
        } else {
            monthlyInputDiv.style.display = 'none';
            annualInputDiv.style.display = 'block';
        }
    });
    generateMonthlyInputs();
}

// 月ごとの入力欄を生成
function generateMonthlyInputs() {
    const container = document.getElementById('monthly-bill-input');
    container.innerHTML = '';
    const months = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
    months.forEach(month => {
        const div = document.createElement('div');
        div.className = 'form-group monthly-bill';
        div.innerHTML = `<label for="bill-${month}">${month}の電気代 (円)</label><input type="number" id="bill-${month}" placeholder="例: 10000" min="0">`;
        container.appendChild(div);
    });
}

// 動的な入力フォームを追加
function addOutdoorUnitInput() {
    const container = document.getElementById('outdoor-unit-container');
    const unitDiv = document.createElement('div');
    unitDiv.className = 'outdoor-unit-group';
    unitDiv.innerHTML = `
        <select class="unit-size-select">
            <option value="S">S</option><option value="M">M</option><option value="L">L</option><option value="LL">LL</option><option value="3L">3L</option><option value="4L">4L</option><option value="5L">5L</option><option value="6L">6L</option><option value="7L">7L</option><option value="8L">8L</option>
        </select>
        <input type="number" class="unit-count-input" placeholder="台数" min="0" required>
        <select class="unit-direction-select">
            <option value="南">南面</option><option value="北">北面</option><option value="東">東面</option><option value="西">西面</option>
        </select>
        <button type="button" class="btn remove-btn">削除</button>
    `;
    container.appendChild(unitDiv);
    unitDiv.querySelector('.remove-btn').addEventListener('click', () => {
        container.removeChild(unitDiv);
    });
}

async function calculateSimulation() {
    // ユーザー情報の取得
    const clientName = document.getElementById('client-name').value;
    const projectName = document.getElementById('project-name').value;
    const acRatioInput = parseFloat(document.getElementById('ac-ratio').value);
    const address = document.getElementById('address').value;

    let monthlyAvgBill;
    const inputType = document.getElementById('bill-input-type').value;

    if (inputType === 'monthly') {
        const monthlyBills = Array.from(document.querySelectorAll('.monthly-bill input')).map(input => parseFloat(input.value) || 0);
        const validMonths = monthlyBills.filter(bill => bill > 0).length;
        const totalBill = monthlyBills.reduce((sum, bill) => sum + bill, 0);
        
        if (validMonths === 0) {
            alert("電気代を1ヶ月分以上入力してください。");
            return;
        }
        
        monthlyAvgBill = totalBill / validMonths;
    } else {
        monthlyAvgBill = parseFloat(document.getElementById('annual-bill').value);
    }
    
    if (isNaN(monthlyAvgBill) || monthlyAvgBill <= 0) {
        alert("有効な電気代を入力してください。");
        return;
    }

    const outdoorUnits = Array.from(document.querySelectorAll('.outdoor-unit-group')).map(group => ({
        size: group.querySelector('.unit-size-select').value,
        count: parseInt(group.querySelector('.unit-count-input').value) || 0,
        direction: group.querySelector('.unit-direction-select').value
    })).filter(unit => unit.count > 0);

    const totalUnits = outdoorUnits.reduce((sum, unit) => sum + unit.count, 0);

    // 導入費用の計算
    const unitCosts = { "S": 30000, "M": 40000, "L": 50000, "LL": 60000, "3L": 70000, "4L": 80000, "5L": 90000, "6L": 100000, "7L": 110000, "8L": 120000 };
    let totalInstallationCost = outdoorUnits.reduce((sum, unit) => sum + (unit.count * (unitCosts[unit.size] || 0)), 0);
    const travelCost = 50000; // 住所からの交通費はAPIが必要なため、仮の値
    totalInstallationCost += travelCost;

    // 各サイズの係数 (α) と節電率の定義
    const alphaFactors = { "S": 1, "M": 1, "L": 2, "LL": 3, "3L": 5, "4L": 8, "5L": 13, "6L": 21, "7L": 34, "8L": 55 };
    const baseSavingRates = { "S": 0.08, "M": 0.12, "L": 0.16, "LL": 0.20, "3L": 0.24, "4L": 0.24, "5L": 0.20, "6L": 0.18, "7L": 0.16, "8L": 0.14 };
    
    let resultHTML = '';
    const acRatios = [acRatioInput - 5, acRatioInput, acRatioInput + 5];

    acRatios.forEach(currentAcRatio => {
        if (currentAcRatio < 0) return;

        let totalWeightedSavingRate = 0;
        let totalBeta = 0;

        outdoorUnits.forEach(unit => {
            let savingRate = baseSavingRates[unit.size];
            switch (unit.direction) {
                case '北':
                    savingRate *= 0.5;
                    break;
                case '東':
                case '西':
                    savingRate *= 0.8;
                    break;
            }
            totalWeightedSavingRate += savingRate * unit.count;
            totalBeta += alphaFactors[unit.size] * unit.count;
        });

        // 償却期間算出
        const monthlyCoeffs = [1.019, 1.019, 1.019, 0.934, 0.934, 0.934, 1.085, 1.085, 1.085, 0.934, 0.934, 1.019];
        let totalAnnualSaving = 0;
        const overallSavingRate = (totalWeightedSavingRate / totalUnits) * 100;

        monthlyCoeffs.forEach(coeff => {
            const monthlyBill = monthlyAvgBill * coeff;
            totalAnnualSaving += monthlyBill * (overallSavingRate / 100);
        });

        const avgMonthlySaving = totalAnnualSaving / 12;
        const paybackPeriodMonths = Math.ceil(totalInstallationCost / avgMonthlySaving);
        
        const annualSaving = totalAnnualSaving;
        const monthlySaving = totalAnnualSaving / 12;

        resultHTML += `
            <div class="result-item">
                <h3>空調比率 ${currentAcRatio}% の場合</h3>
                <p>月間削減金額: ${Math.ceil(monthlySaving)} 円</p>
                <p>年間削減金額: ${Math.ceil(annualSaving)} 円</p>
                <p>全体節電率: ${overallSavingRate.toFixed(1)} %</p>
                <p>投資回収期間: ${paybackPeriodMonths} ヶ月</p>
            </div>
        `;
    });

    resultHTML += `<div class="result-item"><h3>導入費用合計</h3><p>${totalInstallationCost.toFixed(0)} 円</p></div>`;

    document.getElementById('result-content').innerHTML = resultHTML;
    document.getElementById('result-area').style.display = 'block';
}