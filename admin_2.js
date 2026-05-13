import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyBo5iMRonG0rFu6ZuIBJFXzwnWF9xiAKgQ", authDomain: "awaken-c5fca.firebaseapp.com", projectId: "awaken-c5fca", storageBucket: "awaken-c5fca.firebasestorage.app" };
const app = initializeApp(firebaseConfig); const db = getFirestore(app);
const urlParams = new URLSearchParams(window.location.search);
const currentStation = parseInt(urlParams.get('station')) || 1; 

let sysSettings = null;
let sessionLikes = 0; // 紀錄本輪共給了幾個讚

function updateWinnerSelect() {
    const a = document.getElementById('teamASelect').value, b = document.getElementById('teamBSelect').value;
    document.getElementById('winnerSelect').innerHTML = `<option value="${a}">${a}</option><option value="${b}">${b}</option>`;
}
document.getElementById('teamASelect').addEventListener('change', updateWinnerSelect);
document.getElementById('teamBSelect').addEventListener('change', updateWinnerSelect);

// 🌟 更新兩個正方形按讚按鈕的狀態
function updateLikeUI() {
    const max = sysSettings ? (sysSettings.maxLikes || 3) : 3;
    const btnA = document.getElementById('likeBtnA');
    const btnB = document.getElementById('likeBtnB');
    
    document.getElementById('countA').innerText = `${sessionLikes}/${max}`;
    document.getElementById('countB').innerText = `${sessionLikes}/${max}`;

    if (sessionLikes >= max) {
        btnA.disabled = true; btnB.disabled = true;
    } else {
        btnA.disabled = false; btnB.disabled = false;
    }
}

// 🌟 獨立抽出給讚的發送邏輯
async function sendLike(team) {
    const max = sysSettings ? (sysSettings.maxLikes || 3) : 3;
    if(sessionLikes >= max) return;

    try {
        await addDoc(collection(db, "record_2"), { station: currentStation, team: team, likes: 1, isLikeOnly: true, timestamp: "👍讚賞" });
        sessionLikes++;
        updateLikeUI();
    } catch (e) { alert("發生錯誤，請檢查網路連線"); }
}

document.getElementById('likeBtnA').addEventListener('click', () => { sendLike(document.getElementById('teamASelect').value); });
document.getElementById('likeBtnB').addEventListener('click', () => { sendLike(document.getElementById('teamBSelect').value); });

let lastSeenRound = 0; // 紀錄目前畫面的輪次，避免重複觸發

onSnapshot(doc(db, "settings_2", "global"), (docSnap) => {
    if (docSnap.exists()) {
        sysSettings = docSnap.data();
        document.getElementById('stationDisplay').innerText = `第 ${currentStation} 關 (⚔️ PK對抗)`;

        // 🌟 1. 取得總控台設定的目前輪次
        let round = sysSettings.currentRound || 1;
        document.getElementById('roundDisplay').innerText = `📅 目前進行：第 ${round} 輪`;

        // 🌟 2. 確保隊伍選單有選項
        const tA = document.getElementById('teamASelect'), tB = document.getElementById('teamBSelect');
        if (tA.options.length === 0) {
            for (let i = 1; i <= sysSettings.numTeams; i++) {
                let opt = `<option value="第${i}隊">第 ${i} 隊</option>`;
                tA.innerHTML += opt; tB.innerHTML += opt;
            }
        }

        // 🌟 3. 如果輪次真的有切換，才自動帶入賽程表並重置按讚
        if (lastSeenRound !== round) {
            lastSeenRound = round;
            sessionLikes = 0; // 換輪次，讚數歸零
            
            // 自動帶入賽程隊伍
            if(sysSettings.schedule && sysSettings.schedule[round] && sysSettings.schedule[round][currentStation]) {
                const match = sysSettings.schedule[round][currentStation];
                tA.value = match.a;
                tB.value = match.b;
            }
            updateWinnerSelect(); // 更新獲勝方選項
            updateLikeUI();       // 更新按讚按鈕狀態
        }
    }
});

onSnapshot(collection(db, "record_2"), (snapshot) => {
    const leaderboardDiv = document.getElementById('stationLeaderboard'); leaderboardDiv.innerHTML = ""; 
    let records = []; snapshot.forEach(d => records.push({id: d.id, ...d.data()}));
    
    records.filter(r => r.station === currentStation && !r.isNPC && !r.isLikeOnly).reverse().forEach(r => {
        const item = document.createElement('div'); item.className = 'record-item';
        item.innerHTML = `<span><b>${r.winner} 勝</b> (vs ${r.loser}) <br><small style="color:#888;">${r.timestamp||""}</small></span><button class="delete-btn" data-id="${r.id}">刪除</button>`;
        leaderboardDiv.appendChild(item);
    });
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', async (e) => {
        if(confirm("確定要刪除這筆成績嗎？")) await deleteDoc(doc(db, "record_2", e.target.getAttribute('data-id')));
    }));
});

// 🌟 送出對戰勝負成績
document.getElementById('submitBtn').addEventListener('click', async () => {
    const teamA = document.getElementById('teamASelect').value, teamB = document.getElementById('teamBSelect').value;
    if (teamA === teamB) return alert("❌ 不能選兩支一樣的隊伍！");
    const winner = document.getElementById('winnerSelect').value;
    const now = new Date(), nowTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    try {
        document.getElementById('submitBtn').innerText = "傳送中...";
        await addDoc(collection(db, "record_2"), { 
            station: currentStation, 
            teamA, 
            teamB, 
            winner, 
            loser: (winner === teamA ? teamB : teamA), 
            timestamp: nowTime 
        });
        document.getElementById('submitBtn').innerText = "送出對戰勝負 🚀";
        alert("✅ 戰績送出成功！");
    } catch (error) { 
        alert("發生錯誤！"); 
        document.getElementById('submitBtn').innerText = "送出對戰勝負 🚀";
    }
});