import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyBo5iMRonG0rFu6ZuIBJFXzwnWF9xiAKgQ", authDomain: "awaken-c5fca.firebaseapp.com", projectId: "awaken-c5fca", storageBucket: "awaken-c5fca.firebasestorage.app" };
const app = initializeApp(firebaseConfig); const db = getFirestore(app);

const urlParams = new URLSearchParams(window.location.search);
const currentStation = parseInt(urlParams.get('station')) || 1; 

let sysSettings = null, sessionLikes = 0;

// 自動更新勝負下拉選單
function updateWinnerSelect() {
    const a = document.getElementById('teamASelect').value, b = document.getElementById('teamBSelect').value;
    document.getElementById('winnerSelect').innerHTML = `<option value="${a}">${a}</option><option value="${b}">${b}</option>`;
}
document.getElementById('teamASelect').addEventListener('change', updateWinnerSelect);
document.getElementById('teamBSelect').addEventListener('change', updateWinnerSelect);

// 賽程連動：當輪次改變，自動填入隊伍
document.getElementById('roundSelect').addEventListener('change', (e) => {
    const round = e.target.value;
    if(sysSettings.schedule && sysSettings.schedule[round] && sysSettings.schedule[round][currentStation]) {
        const match = sysSettings.schedule[round][currentStation];
        document.getElementById('teamASelect').value = match.a;
        document.getElementById('teamBSelect').value = match.b;
        updateWinnerSelect();
    }
    sessionLikes = 0; updateLikeBtnUI(); // 換一輪後重置按讚數
});

function updateLikeBtnUI() {
    const btn = document.getElementById('instantLikeBtn');
    const max = sysSettings ? sysSettings.maxLikes : 3;
    btn.innerHTML = `送出 👍<br><small>(${sessionLikes}/${max})</small>`;
    btn.disabled = sessionLikes >= max;
}

onSnapshot(doc(db, "settings_2", "global"), (docSnap) => {
    if (docSnap.exists()) {
        sysSettings = docSnap.data();
        document.getElementById('stationDisplay').innerText = `第 ${currentStation} 關 (⚔️ PK對抗)`;

        // 初始化輪次選單
        const roundSelect = document.getElementById('roundSelect');
        const currentRound = roundSelect.value; roundSelect.innerHTML = "";
        const rounds = Object.keys(sysSettings.schedule || {}).sort((a,b) => a-b);
        rounds.forEach(r => roundSelect.innerHTML += `<option value="${r}">第 ${r} 輪</option>`);
        if(currentRound) roundSelect.value = currentRound;

        // 初始化隊伍選單
        const tA = document.getElementById('teamASelect'), tB = document.getElementById('teamBSelect');
        const currA = tA.value, currB = tB.value;
        tA.innerHTML = ""; tB.innerHTML = "";
        for (let i = 1; i <= sysSettings.numTeams; i++) {
            let opt = `<option value="第${i}隊">第 ${i} 隊</option>`;
            tA.innerHTML += opt; tB.innerHTML += opt;
        }
        if (currA) tA.value = currA; if (currB) tB.value = currB;
        
        // 如果目前沒選過，觸發一次賽程帶入
        if(!currentRound) roundSelect.dispatchEvent(new Event('change'));
        updateLikeBtnUI();
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

// 送出按讚
document.getElementById('instantLikeBtn').addEventListener('click', async () => {
    const teamA = document.getElementById('teamASelect').value; // 這邊建議問一下要給誰，或是直接預設隊伍A，這邊我讓它跳窗問
    const target = confirm(`點擊「確定」給 ${teamA} 讚，點擊「取消」給另一隊讚？`) ? teamA : document.getElementById('teamBSelect').value;
    
    await addDoc(collection(db, "record_2"), { station: currentStation, team: target, likes: 1, isLikeOnly: true, timestamp: "👍讚賞" });
    sessionLikes++; updateLikeBtnUI();
});

// 送出成績
document.getElementById('submitBtn').addEventListener('click', async () => {
    const teamA = document.getElementById('teamASelect').value, teamB = document.getElementById('teamBSelect').value;
    if (teamA === teamB) return alert("❌ 不能選兩支一樣的隊伍！");
    const winner = document.getElementById('winnerSelect').value;
    const now = new Date(), nowTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    try {
        await addDoc(collection(db, "record_2"), { station: currentStation, teamA, teamB, winner, loser: (winner === teamA ? teamB : teamA), timestamp: nowTime });
        alert("✅ 戰績送出成功！");
    } catch (error) { alert("發生錯誤！"); }
});