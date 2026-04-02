import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
// 新增了 doc, setDoc, updateDoc 來做系統設定與修改資料
import { getFirestore, collection, onSnapshot, deleteDoc, doc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBo5iMRonG0rFu6ZuIBJFXzwnWF9xiAKgQ",
    authDomain: "awaken-c5fca.firebaseapp.com",
    projectId: "awaken-c5fca",
    storageBucket: "awaken-c5fca.firebasestorage.app",
    messagingSenderId: "591974678138",
    appId: "1:591974678138:web:edcdde58b833c70da105c3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let globalRecords =[];

function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ==========================================
// 1. 監聽所有資料，並畫出 15 關的詳細方格
// ==========================================
onSnapshot(collection(db, "record"), (snapshot) => {
    globalRecords =[];
    snapshot.forEach((d) => globalRecords.push({ id: d.id, ...d.data() }));

    const board = document.getElementById('dashboardBoard');
    board.innerHTML = ""; 

    for (let i = 1; i <= 15; i++) {
        let stationRecords = globalRecords.filter(r => r.station === i);
        
        // 🔥 同隊只留最佳成績
        let teamBest = {};
        stationRecords.forEach(r => {
            if (!teamBest[r.team] || r.time_seconds < teamBest[r.team].time_seconds) {
                teamBest[r.team] = r;
            }
        });
        let uniqueRecords = Object.values(teamBest);
        uniqueRecords.sort((a, b) => a.time_seconds - b.time_seconds);

        let top3HTML = '';
        let othersHTML = '';

        uniqueRecords.forEach((r, index) => {
            let timestamp = r.timestamp || "舊資料無時間";
            let rankStr = (index < 3) ? `<b style="color:#ffd700;">第 ${index + 1} 名</b>` : `第 ${index + 1} 名`;
            
            let liHTML = `
                <li>
                    <div class="record-info">
                        ${rankStr}：${r.team} <br>
                        <span style="color:#2ecc71; font-weight:bold;">${formatTime(r.time_seconds)}</span>
                        <div class="timestamp">🕒 ${timestamp}</div>
                    </div>
                    <div class="action-btns">
                        <button class="edit-btn" data-id="${r.id}" data-team="${r.team}">改</button>
                        <button class="del-btn" data-id="${r.id}">刪</button>
                    </div>
                </li>
            `;

            if (index < 3) top3HTML += liHTML;
            else othersHTML += liHTML;
        });

        if(top3HTML === '') top3HTML = '<li style="color:#aaa;">目前尚無紀錄</li>';

        let detailsHTML = othersHTML ? `
            <details>
                <summary>查看其他隊伍成績 ▼</summary>
                <ul class="record-list" style="margin-top:10px;">${othersHTML}</ul>
            </details>
        ` : '';

        board.innerHTML += `
            <div class="station-card">
                <div class="station-title">第 ${i} 關</div>
                <ul class="record-list">${top3HTML}</ul>
                ${detailsHTML}
            </div>
        `;
    }

    // 綁定「刪除」與「修改」按鈕的功能
    document.querySelectorAll('.del-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if(confirm("確定要刪除嗎？")) await deleteDoc(doc(db, "record", e.target.dataset.id));
        });
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const teamName = e.target.dataset.team;
            const newTotalSec = prompt(`請輸入 ${teamName} 的「全新總秒數」\n(例如 2分15秒 請直接輸入 135)`);
            if(newTotalSec && !isNaN(newTotalSec)) {
                await updateDoc(doc(db, "record", e.target.dataset.id), {
                    time_seconds: parseInt(newTotalSec)
                });
            }
        });
    });
});

// ==========================================
// 2. 超強演算法：結算營會總成績！
// ==========================================
document.getElementById('calcScoreBtn').addEventListener('click', () => {
    let teamScores = {}; 

    for (let i = 1; i <= 15; i++) {
        let stationRecords = globalRecords.filter(r => r.station === i);
        stationRecords.sort((a, b) => a.time_seconds - b.time_seconds);

        // 同一隊在同一關如果玩兩次，只取最好的成績！
        let seenTeams = new Set();
        let uniqueRecords =[];
        stationRecords.forEach(r => {
            if (!seenTeams.has(r.team)) {
                seenTeams.add(r.team);
                uniqueRecords.push(r);
            }
        });

        // 依序給分：第一名300, 第二名200, 第三名100, 其他參加獎50
        uniqueRecords.forEach((r, index) => {
            if (!teamScores[r.team]) teamScores[r.team] = 0;
            if (index === 0) teamScores[r.team] += 300;
            else if (index === 1) teamScores[r.team] += 200;
            else if (index === 2) teamScores[r.team] += 100;
            else teamScores[r.team] += 50;
        });
    }

    // 轉換成陣列並從高分排到低分
    let finalRanking = Object.keys(teamScores).map(team => {
        return { team: team, score: teamScores[team] };
    });
    finalRanking.sort((a, b) => b.score - a.score);

    // 顯示結果視窗
    let msg = "🏆 2026 營會總冠軍排行榜 🏆\n========================\n\n";
    finalRanking.forEach((item, index) => {
        msg += `第 ${index + 1} 名：【${item.team}】 👉 ${item.score} 分\n`;
    });
    alert(msg);
});

// ==========================================
// 3. 系統開關與權限控制 (鎖定與隱藏螢幕)
// ==========================================
const systemDocRef = doc(db, "settings", "global");

onSnapshot(systemDocRef, (docSnap) => {
    let state = docSnap.exists() ? docSnap.data() : { isLocked: false, hideMain: false };
    window.systemState = state; 

    const lockBtn = document.getElementById('lockSystemBtn');
    // 🌟 加入 \n 強制在括號前換行
    lockBtn.innerText = state.isLocked ? "🔓 開放輸入\n(目前：鎖定中)" : "🔒 關閉輸入\n(目前：開放中)";
    lockBtn.style.background = state.isLocked ? "#27ae60" : "#e74c3c";

    const hideBtn = document.getElementById('hideScreenBtn');
    // 🌟 加入 \n 強制在括號前換行
    hideBtn.innerText = state.hideMain ? "📺 恢復大螢幕\n(目前：結算隱藏中)" : "🙈 隱藏大螢幕\n(目前：正常顯示)";
    hideBtn.style.background = state.hideMain ? "#27ae60" : "#8e44ad";
});

// ==========================================
// 4. 匯出 Excel (跟之前一樣)
// ==========================================
document.getElementById('exportBtn').addEventListener('click', () => {
    if (globalRecords.length === 0) return alert("目前無資料！");
    let csvContent = "\uFEFF關卡,隊伍名稱,總秒數,格式化時間,紀錄時間\n";
    globalRecords.forEach(r => {
        let ts = r.timestamp || "無";
        csvContent += `${r.station},${r.team},${r.time_seconds},${formatTime(r.time_seconds)},${ts}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "營會成績總表.csv";
    link.click();
});

// ==========================================
// 5. 核彈級功能：一鍵清空所有資料
// ==========================================
document.getElementById('clearAllBtn').addEventListener('click', async () => {
    // 終極防呆：要求輸入指定文字才能刪除，避免不小心按到
    const check = prompt("⚠️ 警告！這將會永久刪除「所有」關卡的成績！\n如果你確定要清空，請在下方輸入「確認清空」：");
    
    if (check === "確認清空") {
        document.getElementById('clearAllBtn').innerText = "🧹 瘋狂清除中...";
        
        // 用迴圈把 globalRecords 裡面的資料一筆一筆刪除
        for (let record of globalRecords) {
            await deleteDoc(doc(db, "record", record.id));
        }
        
        alert("✅ 所有測試資料已全部清空！我們準備好迎接正式營會了！");
        document.getElementById('clearAllBtn').innerText = "💣 一鍵清空測試資料";
    } else if (check !== null) {
        alert("輸入錯誤，取消清空動作。");
    }
});