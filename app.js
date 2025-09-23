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
    addOutdoorUnitInput();
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
    // 必須項目チェック
    const clientName = document.getElementById('client-name').value;
    const projectName = document.getElementById('project-name').value;
    const acRatioInput = parseFloat(document.getElementById('ac-ratio').value);
    const estimatedCost = parseFloat(document.getElementById('estimated-cost').value);

    if (!clientName || !projectName || isNaN(acRatioInput) || isNaN(estimatedCost)) {
        alert("基本情報と空調比率、見積金額は必須項目です。");
        return;
    }

    let monthlyAvgBill;
    const inputType = document.querySelector('input[name="bill-type"]:checked').value;

    if (inputType === 'monthly') {
        const monthlyBills = Array.from(document.querySelectorAll('.monthly-grid input')).map(input => parseFloat(input.value) || 0);
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

    const outdoorUnits = Array.from(document.querySelectorAll('.outdoor-unit-group')).map(group => ({
        size: group.querySelector('.unit-size-select').value,
        count: parseInt(group.querySelector('.unit-count-input').value) || 0,
        direction: group.querySelector('.unit-direction-select').value
    })).filter(unit => unit.count > 0);

    const totalUnits = outdoorUnits.reduce((sum, unit) => sum + unit.count, 0);
    if (totalUnits === 0) {
        alert("室外機の台数を入力してください。");
        return;
    }

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

        const monthlyCoeffs = [1.019, 1.019, 1.019, 0.934, 0.934, 0.934, 1.085, 1.085, 1.085, 0.934, 0.934, 1.019];
        let totalAnnualSaving = 0;
        const overallSavingRate = (totalWeightedSavingRate / totalUnits) * 100;

        monthlyCoeffs.forEach(coeff => {
            const monthlyBill = monthlyAvgBill * coeff;
            totalAnnualSaving += monthlyBill * (overallSavingRate / 100);
        });

        const avgMonthlySaving = totalAnnualSaving / 12;
        const paybackPeriodMonths = Math.ceil(estimatedCost / avgMonthlySaving);
        
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

    resultHTML += `<div class="result-item"><h3>導入費用合計</h3><p>${estimatedCost.toFixed(0)} 円</p></div>`;

    document.getElementById('result-content').innerHTML = resultHTML;
    document.getElementById('result-area').style.display = 'block';
}