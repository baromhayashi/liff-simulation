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
        e.preventDefault(); // フォームのデフォルト送信をキャンセル
        calculateSimulation();
    });

    document.getElementById('add-unit-button').addEventListener('click', addOutdoorUnitInput);
    addOutdoorUnitInput();

    document.getElementById('bill-input-type').addEventListener('change', (event) => {
        const monthlyInputDiv = document.getElementById('monthly-bill-input');
        const annualInputDiv = document.getElementById('annual-bill-input');
        if (event.target.value === 'monthly') {
            monthlyInputDiv.style.display = 'block';
            annualInputDiv.style.display = 'none';
        } else {
            monthlyInputDiv.style.display = 'none';
            annualInputDiv.style.display = 'block';
        }
    });
    generateMonthlyInputs();
}

function generateMonthlyInputs() {
    const container = document.querySelector('.input_list_month');
    container.innerHTML = '';
    const months = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
    months.forEach(month => {
        const li = document.createElement('li');
        li.innerHTML = `<label for="bill-${month}">${month}の電気代</label><input type="number" id="bill-${month}" placeholder="0" class="input_half"><span>円</span>`;
        container.appendChild(li);
    });
}

function addOutdoorUnitInput() {
    const container = document.getElementById('outdoor-unit-container');
    const unitDiv = document.createElement('div');
    unitDiv.className = 'input_group';
    unitDiv.innerHTML = `
        <div class="input_half_box">
            <select class="select_half unit-size-select">
                <option value="S">S</option><option value="M">M</option><option value="L">L</option><option value="LL">LL</option><option value="3L">3L</option><option value="4L">4L</option><option value="5L">5L</option><option value="6L">6L</option><option value="7L">7L</option><option value="8L">8L</option>
            </select>
            <input type="number" class="input_half unit-count-input" placeholder="0" min="0" required>
            <span>台</span>
        </div>
        <div class="input_half_box">
            <select class="select_half unit-direction-select">
                <option value="南">南面</option><option value="北">北面</option><option value="東">東面</option><option value="西">西面</option>
            </select>
            <span></span>
        </div>
        <button type="button" class="btn remove-btn"><span>×</span></button>
    `;
    container.appendChild(unitDiv);
    unitDiv.querySelector('.remove-btn').addEventListener('click', () => {
        container.removeChild(unitDiv);
    });
}

async function calculateSimulation() {
    const clientName = document.getElementById('client-name').value;
    const projectName = document.getElementById('project-name').value;
    const acRatioInput = parseFloat(document.getElementById('ac-ratio').value);
    const address = document.getElementById('address').value;
    
    // 必須項目のチェック
    if (!clientName || !projectName || !acRatioInput || !address) {
        alert("必須項目をすべて入力してください。");
        return;
    }
    
    let monthlyAvgBill;
    const inputType = document.getElementById('bill-input-type').value;

    if (inputType === 'monthly') {
        const monthlyBills = Array.from(document.querySelectorAll('.input_list_month input')).map(input => parseFloat(input.value) || 0);
        const validMonths = monthlyBills.filter(bill => bill > 0).length;
        if (validMonths === 0) {
            alert("電気代を1ヶ月分以上入力してください。");
            return;
        }
        monthlyAvgBill = monthlyBills.reduce((sum, bill) => sum + bill, 0) / validMonths;
    } else {
        monthlyAvgBill = parseFloat(document.getElementById('annual-bill').value);
    }
    
    if (isNaN(monthlyAvgBill) || monthlyAvgBill <= 0) {
        alert("有効な電気代を入力してください。");
        return;
    }

    const outdoorUnits = Array.from(document.querySelectorAll('.input_outdoor .input_group')).map(group => ({
        size: group.querySelector('.unit-size-select').value,
        count: parseInt(group.querySelector('.unit-count-input').value) || 0,
        direction: group.querySelector('.unit-direction-select').value
    })).filter(unit => unit.count > 0);

    const totalUnits = outdoorUnits.reduce((sum, unit) => sum + unit.count, 0);
    if (totalUnits === 0) {
        alert("室外機の台数を入力してください。");
        return;
    }

    // 導入費用の計算
    const unitCosts = { "S": 30000, "M": 40000, "L": 50000, "LL": 60000, "3L": 70000, "4L": 80000, "5L": 90000, "6L": 100000, "7L": 110000, "8L": 120000 };
    let totalInstallationCost = outdoorUnits.reduce((sum, unit) => sum + (unit.count * (unitCosts[unit.size] || 0)), 0);
    const travelCost = 50000;
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