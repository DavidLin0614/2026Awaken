import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = { /* 你的 config */ };
const app = initializeApp(firebaseConfig); const db = getFirestore(app);

let dataD2 = [], dataD3 = [], dataBonus = [], sysD2 = {}, sysD3 = {};

function calculateTotal() {
    const board = document.getElementById('totalScoreBoard'); board.innerHTML = "";
    let scores = {};
    for(let i=1; i<=15; i++) scores[`第${i}隊`] = { total: 0, d2: 0, d3_wins: 0, d3_loses: 0, likes: 0, bonus: 0 };

    // 1. 計算 D2 (計時/計分排名分 + 讚數)
    // 這裡需要 D2 的排名邏輯... (略，待會統一寫入全域結算函數)

    // 2. 計算 D3 (勝負排名分 + 讚數)
    // ...

    // 3. 計算 額外加分
    dataBonus.forEach(r => { if(scores[r.team]) scores[r.team].bonus += r.val; });

    // 渲染 (按 1-15 隊順序)
    for(let i=1; i<=15; i++) {
        let t = `第${i}隊`;
        board.innerHTML += `
            <div class="score-card">
                <h2>${t}</h2>
                <div class="points">${scores[t].total}</div>
                <div class="detail">D2: ${scores[t].d2} | D3: ${scores[t].d3_wins}勝 | 👍: ${scores[t].likes}</div>
            </div>`;
    }
}
// 監聽所有數據源... (略)