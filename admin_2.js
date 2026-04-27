import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBo5iMRonG0rFu6ZuIBJFXzwnWF9xiAKgQ",
    authDomain: "awaken-c5fca.firebaseapp.com",
    projectId: "awaken-c5fca",
    storageBucket: "awaken-c5fca.firebasestorage.app"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const urlParams = new URLSearchParams(window.location.search);
const currentStation = parseInt(urlParams.get('station')) || 1; 

let sysSettings = null;
let currentConf = null;

const lockOverlay = document.createElement('div');
lockOverlay.style = "display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); color:white; z-index:9999; flex-direction:column; justify-content:center; align-items:center; font-size:2em; font-weight:bold; text-align:center;";
lockOverlay.innerHTML = "🔒<br>關卡已關閉輸入<br><span style='font-size:0.5em; color:#ccc; margin-top:10px;'>目前正在進行總結算</span>";
document.body.appendChild(lockOverlay);

function updateWinnerSelect() {
    const a = document.getElementById('teamASelect').value;
    const b = document.getElementById('teamBSelect').value;
    document.getElementById('winnerSelect').innerHTML = `<option value="${a}">${a}</option><option value="${b}">${b}</option>`;
}

document.getElementById('teamASelect').addEventListener('change', updateWinnerSelect);
document.getElementById('teamBSelect').addEventListener('change', updateWinnerSelect);

onSnapshot(doc(db, "settings_2", "global"), (docSnap) => {
    if (docSnap.exists()) {
        sysSettings = docSnap.data();
        lockOverlay.style.display = sysSettings.isLocked ? "flex" : "none";

        const tA = document.getElementById('teamASelect'), tB = document.getElementById('teamBSelect');
        const currA = tA.value, currB = tB.value;
        tA.innerHTML = ""; tB.innerHTML = "";
        for (let i = 1; i <= sysSettings.numTeams; i++) {
            let opt = `<option value="第${i}隊">第 ${i} 隊</option>`;
            tA.innerHTML += opt; tB.innerHTML += opt;
        }
        if (currA) tA.value = currA; if (currB) tB.value = currB;
        if (!currA && !currB && sysSettings.numTeams >= 2) { tA.selectedIndex = 0; tB.selectedIndex = 1; }

        currentConf = sysSettings.stationConfigs[currentStation] || { type: 'pk' };
        
        const badge = document.getElementById('stationDisplay');
        if (currentConf.type === 'pk') {
            badge.innerText = `第 ${currentStation} 關 (⚔️ PK對抗)`;
            badge.className = "station-badge pk";
            document.getElementById('winnerGroup').style.display = "block";
        } else {
            badge.innerText = `第 ${currentStation} 關 (🤝 雙隊合作)`;
            badge.className = "station-badge coop";
            document.getElementById('winnerGroup').style.display = "none";
        }
        updateWinnerSelect();
    }
});

onSnapshot(collection(db, "record_2"), (snapshot) => {
    const leaderboardDiv = document.getElementById('stationLeaderboard');
    leaderboardDiv.innerHTML = ""; 
    let count = 0;

    snapshot.forEach((d) => {
        let r = { id: d.id, ...d.data() };
        if (r.station !== currentStation || r.isNPC) return;
        count++;
        
        let content = r.type === 'pk' ? `<b style="color:#e74c3c;">${r.winner} 勝</b> (vs ${r.loser})` : `<b>${r.teamA} & ${r.teamB}</b> 合作成功`;
        
        const item = document.createElement('div');
        item.className = `record-item ${r.type}`;
        item.innerHTML = `<span>${content} <br><small style="color:#888;">${r.timestamp||""}</small></span><button class="delete-btn" data-id="${r.id}">刪除 ❌</button>`;
        leaderboardDiv.appendChild(item);
    });

    if (count === 0) leaderboardDiv.innerHTML = "<p style='color: #888;'>目前尚無成績</p>";

    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', async (e) => {
        if(confirm("確定要刪除這筆成績嗎？")) await deleteDoc(doc(db, "record_2", e.target.getAttribute('data-id')));
    }));
});

document.getElementById('submitBtn').addEventListener('click', async () => {
    const teamA = document.getElementById('teamASelect').value;
    const teamB = document.getElementById('teamBSelect').value;

    if (teamA === teamB) return alert("❌ 隊伍A和隊伍B不能選一樣的！");

    const now = new Date();
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    let recordData = { station: currentStation, teamA: teamA, teamB: teamB, type: currentConf.type, timestamp: nowTime };
    
    if (currentConf.type === 'pk') {
        let winner = document.getElementById('winnerSelect').value;
        recordData.winner = winner;
        recordData.loser = (winner === teamA) ? teamB : teamA;
    }

    try {
        document.getElementById('submitBtn').innerText = "傳送中...";
        await addDoc(collection(db, "record_2"), recordData);
        document.getElementById('submitBtn').innerText = "送出成績 🚀";
    } catch (error) { alert("發生錯誤，請檢查網路！"); document.getElementById('submitBtn').innerText = "送出成績 🚀"; }
});