import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
// 多載入 doc 模組來接聽設定
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

const urlParams = new URLSearchParams(window.location.search);
const currentStation = parseInt(urlParams.get('station')) || 1; 
document.getElementById('stationDisplay').innerText = `第 ${currentStation} 關`;

function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ==========================================
// 🔒 接收總控台的「關閉輸入」訊號
// ==========================================
const lockOverlay = document.createElement('div');
lockOverlay.style = "display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); color:white; z-index:9999; flex-direction:column; justify-content:center; align-items:center; font-size:2em; font-weight:bold; text-align:center;";
lockOverlay.innerHTML = "🔒<br>關卡已關閉輸入<br><span style='font-size:0.5em; color:#ccc; margin-top:10px;'>目前正在進行總結算</span>";
document.body.appendChild(lockOverlay);

onSnapshot(doc(db, "settings", "global"), (docSnap) => {
    if (docSnap.exists() && docSnap.data().isLocked) {
        lockOverlay.style.display = "flex";
    } else {
        lockOverlay.style.display = "none";
    }
});

// ==========================================
// 即時顯示本關排行榜 (加入同隊取最佳邏輯)
// ==========================================
onSnapshot(collection(db, "record"), (snapshot) => {
    const allRecords =[];
    snapshot.forEach((d) => allRecords.push({ id: d.id, ...d.data() }));

    let stationRecords = allRecords.filter(r => r.station === currentStation);
    
    // 同隊只留最佳成績
    let teamBest = {};
    stationRecords.forEach(r => {
        if (!teamBest[r.team] || r.time_seconds < teamBest[r.team].time_seconds) {
            teamBest[r.team] = r;
        }
    });
    let uniqueRecords = Object.values(teamBest);
    uniqueRecords.sort((a, b) => a.time_seconds - b.time_seconds);

    const leaderboardDiv = document.getElementById('stationLeaderboard');
    leaderboardDiv.innerHTML = ""; 

    if (uniqueRecords.length === 0) {
        leaderboardDiv.innerHTML = "<p style='color: #888;'>目前尚無成績</p>";
        return;
    }

    uniqueRecords.forEach((record, index) => {
        const item = document.createElement('div');
        item.className = 'record-item';
        item.innerHTML = `
            <span><b>第 ${index + 1} 名</b>：${record.team} <br><small style="color:#555;">(${formatTime(record.time_seconds)})</small></span>
            <button class="delete-btn" data-id="${record.id}">刪除 ❌</button>
        `;
        leaderboardDiv.appendChild(item);
    });

    const deleteBtns = document.querySelectorAll('.delete-btn');
    deleteBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if(confirm("確定要刪除這筆成績嗎？")) {
                await deleteDoc(doc(db, "record", e.target.getAttribute('data-id')));
            }
        });
    });
});

// ==========================================
// 送出按鈕
// ==========================================
document.getElementById('submitBtn').addEventListener('click', async () => {
    const team = document.getElementById('teamSelect').value;
    const min = parseInt(document.getElementById('minInput').value) || 0;
    const sec = parseInt(document.getElementById('secInput').value) || 0;

    if (min === 0 && sec === 0) {
        alert("請輸入花費時間！");
        return;
    }

    const totalSeconds = (min * 60) + sec;
    
    // 🔥 改用 24小時制，單純紀錄 小時:分鐘:秒數
    // 🌟 終極 24 小時制時間寫法 (確保只顯示 HH:mm:ss)
    const now = new Date();
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    try {
        document.getElementById('submitBtn').innerText = "傳送中...";
        await addDoc(collection(db, "record"), {
            station: currentStation,
            team: team,
            time_seconds: totalSeconds,
            timestamp: nowTime  // 只會存入像 "14:30:15" 這樣的格式！
        });
        
        document.getElementById('minInput').value = "";
        document.getElementById('secInput').value = "";
        document.getElementById('submitBtn').innerText = "送出成績 🚀";
    } catch (error) {
        console.error("寫入錯誤：", error);
        alert("發生錯誤，請檢查網路連線！");
        document.getElementById('submitBtn').innerText = "送出成績 🚀";
    }
});