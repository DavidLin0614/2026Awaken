import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBo5iMRonG0rFu6ZuIBJFXzwnWF9xiAKgQ",
    authDomain: "awaken-c5fca.firebaseapp.com",
    projectId: "awaken-c5fca",
    storageBucket: "awaken-c5fca.firebasestorage.app"
};
const app = initializeApp(firebaseConfig); const db = getFirestore(app);

let sysSettings = null, allRecords =[], currentNpcName = "";

document.getElementById('loginBtn').addEventListener('click', () => {
    let name = document.getElementById('npcNameInput').value.trim();
    if (!name) return alert("請輸入您的名稱！");
    currentNpcName = name;
    document.getElementById('npcDisplay').innerText = `身分：${currentNpcName}`;
    document.getElementById('loginOverlay').style.display = "none";
    document.getElementById('mainContainer').style.display = "block";
    renderHistory(); 
});

onSnapshot(doc(db, "settings_2", "global"), (docSnap) => {
    if (docSnap.exists()) {
        sysSettings = docSnap.data();
        const teamSelect = document.getElementById('teamSelect');
        const currentSelected = teamSelect.value;
        teamSelect.innerHTML = "";
        for (let i = 1; i <= sysSettings.numTeams; i++) teamSelect.innerHTML += `<option value="第${i}隊">第 ${i} 隊</option>`;
        if (currentSelected) teamSelect.value = currentSelected;
        calculateLiveScores(); 
    }
});

onSnapshot(collection(db, "record_2"), (snapshot) => {
    allRecords =[]; snapshot.forEach((d) => allRecords.push({ id: d.id, ...d.data() }));
    calculateLiveScores(); renderHistory();
});

function calculateLiveScores() {
    if (!sysSettings) return;
    let teamScores = {}; 
    for (let i = 1; i <= sysSettings.numTeams; i++) teamScores[`第${i}隊`] = sysSettings.teamBaseScores ? (sysSettings.teamBaseScores[`第${i}隊`] || 0) : 0;

    allRecords.forEach(r => {
        if (r.isNPC) {
            if(teamScores[r.team] !== undefined) teamScores[r.team] += r.bonusScore;
        } else if (r.type === 'pk') {
            if(teamScores[r.winner] !== undefined) teamScores[r.winner] += sysSettings.scoreRule.pkWin;
            if(teamScores[r.loser] !== undefined) teamScores[r.loser] += sysSettings.scoreRule.pkLose;
        } else if (r.type === 'coop') {
            if(teamScores[r.teamA] !== undefined) teamScores[r.teamA] += sysSettings.scoreRule.coop;
            if(teamScores[r.teamB] !== undefined) teamScores[r.teamB] += sysSettings.scoreRule.coop;
        }
    });

    let ranked = Object.keys(teamScores).map(t => ({ team: t, score: teamScores[t] })).sort((a, b) => b.score - a.score);
    let tiers = [[], [], [],[]]; let chunkSize = Math.ceil(ranked.length / 4);
    ranked.forEach((item, idx) => tiers[Math.min(Math.floor(idx / chunkSize), 3)].push(item.team));

    document.getElementById('tier1').innerText = tiers[0].join(', ') || '無';
    document.getElementById('tier2').innerText = tiers[1].join(', ') || '無';
    document.getElementById('tier3').innerText = tiers[2].join(', ') || '無';
    document.getElementById('tier4').innerText = tiers[3].join(', ') || '無';
}

function renderHistory() {
    if (!currentNpcName) return;
    const historyDiv = document.getElementById('npcHistory'); historyDiv.innerHTML = ""; 
    let myRecords = allRecords.filter(r => r.isNPC && r.npcName === currentNpcName);
    if (myRecords.length === 0) { historyDiv.innerHTML = "<p style='color: #888;'>目前尚無紀錄</p>"; return; }

    myRecords.reverse().forEach((r) => {
        const item = document.createElement('div'); item.className = 'record-item';
        item.innerHTML = `<span>給 <b>${r.team}</b>：<b style="color:#27ae60;">+${r.bonusScore} 分</b> <br><small style="color:#888;">${r.timestamp}</small></span>
                          <button class="delete-btn" data-id="${r.id}">刪除 ❌</button>`;
        historyDiv.appendChild(item);
    });
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', async (e) => {
        if(confirm("確定要收回這筆加分嗎？")) await deleteDoc(doc(db, "record_2", e.target.getAttribute('data-id')));
    }));
}

document.getElementById('submitBtn').addEventListener('click', async () => {
    const team = document.getElementById('teamSelect').value, bonus = parseInt(document.getElementById('bonusScoreInput').value);
    if (isNaN(bonus) || bonus <= 0) return alert("請輸入有效的加分分數！");
    const now = new Date(), nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    try {
        document.getElementById('submitBtn').innerText = "施放魔法中 ✨...";
        await addDoc(collection(db, "record_2"), { isNPC: true, npcName: currentNpcName, team: team, bonusScore: bonus, timestamp: nowTime });
        document.getElementById('bonusScoreInput').value = ""; document.getElementById('submitBtn').innerText = "送出魔法加分 ✨";
    } catch (error) { alert("發生錯誤！"); document.getElementById('submitBtn').innerText = "送出魔法加分 ✨"; }
});