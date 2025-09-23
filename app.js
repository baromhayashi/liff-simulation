// app.jsというファイル名で保存してください

// LIFF初期化
liff.init({
    liffId: "あなたのLIFF IDをここに貼り付け" // 後ほどLINE Developersから取得
}).then(() => {
    // ユーザーがLIFFにログインしているか確認
    if (liff.isLoggedIn()) {
        document.getElementById('calculate-button').addEventListener('click', calculate);
    } else {
        // 未ログインの場合はログインを促す
        liff.login();
    }
}).catch((err) => {
    console.error(err);
});

// 計算処理
function calculate() {
    // フォームから値を取得
    const bill = document.getElementById('electricity-bill').value;
    const acRatio = document.getElementById('ac-ratio').value;
    // ...他の入力項目も同様に取得

    // ここに計算ロジックを記述
    // 例: 月間削減額 = 電気代 * 空調比率 * 削減率
    const reductionRate = 0.05; // 削減率を仮で5%に設定
    const monthlySaving = bill * (acRatio / 100) * reductionRate;
    const annualSaving = monthlySaving * 12;

    // 結果を表示
    document.getElementById('monthly-saving').textContent = monthlySaving.toFixed(0);
    document.getElementById('annual-saving').textContent = annualSaving.toFixed(0);
    // ...他の結果も同様に表示

    document.getElementById('result-area').style.display = 'block';
}