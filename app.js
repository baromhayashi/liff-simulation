// 2008161460-54GYvJ9x
const liffId = "YOUR_LIFF_ID_HERE";

document.addEventListener('DOMContentLoaded', () => {
    // LIFF初期化
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
}

// 動的な入力フォームを追加する関数
function addOutdoorUnitInput() {
    const container = document.getElementById('outdoor-unit-container');
    const unitDiv = document.createElement('div');
    unitDiv.className = 'outdoor-unit-group';
    unitDiv.innerHTML = `
        <select class="unit-size-select">
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
        <select class="unit-direction-select">
            <option value="南">南面</option>
            <option value="北">北面</option>
            <option value="東">東面</option>
            <option value="西">西面</option>
        </select>
        <input type="number" class="unit-count-input" placeholder="台数" min="1" value="1" required>
    `;
    container.appendChild(unitDiv);
}

// メインの計算ロジック
async function calculateSimulation() {
    // 入力値の取得
    const bill = parseFloat(document.getElementById('electricity-bill').value);
    const acRatioInput = parseFloat(document.getElementById('ac-ratio').value);
    const address = document.getElementById('address').value;

    const outdoorUnits = Array.from(document.querySelectorAll('.outdoor-unit-group')).map(group => ({
        size: group.querySelector('.unit-size-select').value,
        direction: group.querySelector('.unit-direction-select').value,
        count: parseInt(group.querySelector('.unit-count-input').value)
    }));
    
    // 交通費の計算（簡易版。実際は外部APIが必要）
    // 住所から交通費を算出するロジックは実装が複雑なため、今回は仮の値を使用
    const travelCost = 50000; 
    
    // 室外機の総台数を計算
    const totalUnits = outdoorUnits.reduce((sum, unit) => sum + unit.count, 0);

    // 各サイズの係数 (α) と節電率の定義
    const alphaFactors = { "S": 1, "M": 1, "L": 2, "LL": 3, "3L": 5, "4L": 8, "5L": 13, "6L": 21, "7L": 34, "8L": 55 };
    const baseSavingRates = { "S": 0.08, "M": 0.12, "L": 0.16, "LL": 0.20, "3L": 0.24, "4L": 0.24, "5L": 0.20, "6L": 0.18, "7L": 0.16, "8L": 0.14 };
    
    // 計算結果を表示するHTMLを生成
    let resultHTML = '';

    // 空調比率3パターンを計算
    const acRatios = [acRatioInput - 5, acRatioInput, acRatioInput + 5];

    acRatios.forEach(currentAcRatio => {
        if (currentAcRatio < 0) return; // マイナス比率は計算しない

        let totalBeta = 0;
        let totalMonthlySaving = 0;
        let totalWeightedSavingRate = 0;

        outdoorUnits.forEach(unit => {
            // 各サイズごとの定数(β)を算出
            const beta = alphaFactors[unit.size] * unit.count;
            totalBeta += beta;

            // 各方向の節電率を計算
            let savingRate = baseSavingRates[unit.size];
            switch (unit.direction) {
                case '北':
                    savingRate *= 0.5; // 50%減
                    break;
                case '東':
                case '西':
                    savingRate *= 0.8; // 20%減
                    break;
                default:
                    // 南面はそのまま
            }

            // 加重平均節電率を計算
            totalWeightedSavingRate += savingRate * unit.count;

            // サイズ別月間電気代と節電額を計算 (ここは簡略化)
            // 実際は、複雑な計算が必要なため、ここでは加重平均節電率を使用
        });
        
        // 全体節電率
        const overallSavingRate = (totalWeightedSavingRate / totalUnits) * 100;

        // 月間平均削減額 (空調比率、全体節電率を使用)
        const monthlySaving = (bill * (currentAcRatio / 100)) * (overallSavingRate / 100);

        // 導入費用を計算
        // ここでは全室外機が同じ単価と仮定
        const unitCost = 100000; // 仮の単価
        const totalInstallationCost = totalUnits * unitCost + travelCost;

        // 償却期間の計算
        const paybackPeriodMonths = Math.ceil(totalInstallationCost / monthlySaving);

        resultHTML += `
            <div class="result-item">
                <h3>空調比率 ${currentAcRatio}% の場合</h3>
                <p>月間削減金額: ${monthlySaving.toFixed(0)} 円</p>
                <p>年間削減金額: ${Math.ceil(monthlySaving * 12)} 円</p>
                <p>投資回収期間: ${paybackPeriodMonths} ヶ月</p>
                <p>全体節電率: ${overallSavingRate.toFixed(1)} %</p>
            </div>
        `;
    });

    // 導入費用も表示
    resultHTML += `<div class="result-item"><h3>導入費用合計</h3><p>${totalInstallationCost.toFixed(0)} 円</p></div>`;

    document.getElementById('result-content').innerHTML = resultHTML;
    document.getElementById('result-area').style.display = 'block';
}