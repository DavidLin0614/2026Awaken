import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
// 多載入 doc 模組來接聽設定
import { getFirestore, collection, onSnapshot, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ==========================================
// 📺 接收總控台的「隱藏大螢幕」訊號
// ==========================================
// 先在網頁上動態建立一個「遮罩」
const hideOverlay = document.createElement('div');
hideOverlay.style = "display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); color:#ffd700; z-index:9999; flex-direction:column; justify-content:center; align-items:center; font-size:4em; font-weight:bold; text-shadow: 2px 2px 10px rgba(0,0,0,1); backdrop-filter: blur(10px);";
hideOverlay.innerHTML = "🏆<br>營會成績結算中<br><span style='font-size:0.4em; color:white;'>敬請期待最高榮耀</span>";
document.body.appendChild(hideOverlay);

onSnapshot(doc(db, "settings", "global"), (docSnap) => {
    if (docSnap.exists() && docSnap.data().hideMain) {
        hideOverlay.style.display = "flex"; // 顯示遮罩
    } else {
        hideOverlay.style.display = "none"; // 隱藏遮罩
    }
});

// ==========================================
// 🌟 排行榜顯示 (加入「同隊取最佳成績」邏輯)
// ==========================================
onSnapshot(collection(db, "record"), (snapshot) => {
    const allRecords =[];
    snapshot.forEach((doc) => allRecords.push(doc.data()));

    const board = document.getElementById("board");
    board.innerHTML = ""; 

    for (let i = 1; i <= 15; i++) {
        let stationRecords = allRecords.filter(record => record.station === i);
        
        // 🔥 神級演算法：同隊只留最佳成績
        let teamBest = {};
        stationRecords.forEach(r => {
            // 如果這隊還沒紀錄過，或是這次的秒數比之前紀錄的還要少（更快）
            if (!teamBest[r.team] || r.time_seconds < teamBest[r.team].time_seconds) {
                teamBest[r.team] = r; 
            }
        });
        
        // 把過濾好的成績拿出來，重新由快到慢排序
        let uniqueRecords = Object.values(teamBest);
        uniqueRecords.sort((a, b) => a.time_seconds - b.time_seconds);

        let top1 = uniqueRecords[0] ? `${uniqueRecords[0].team} (${formatTime(uniqueRecords[0].time_seconds)})` : "尚未產生";
        let top2 = uniqueRecords[1] ? `${uniqueRecords[1].team} (${formatTime(uniqueRecords[1].time_seconds)})` : "尚未產生";
        let top3 = uniqueRecords[2] ? `${uniqueRecords[2].team} (${formatTime(uniqueRecords[2].time_seconds)})` : "尚未產生";

        board.innerHTML += `
            <div class="station-card">
                <div class="station-title">第 ${i} 關</div>
                <p>🥇 ${top1}</p>
                <p>🥈 ${top2}</p>
                <p>🥉 ${top3}</p>
            </div>
        `;
    }
});