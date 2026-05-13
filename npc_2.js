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
    
    // 1. 初始化各隊數據
    let teamStats = {}; 
    for (let i = 1; i <= sysSettings.numTeams; i++) {
        teamStats[`第${i}隊`] = { wins: 0, losses: 0, likes: 0, npcBonus: 0 };
    }

    // 2. 統計即時勝敗、讚數、NPC加分
    allRecords.forEach(r => {
        if (r.isNPC) {
            if(teamStats[r.team]) teamStats[r.team].npcBonus += r.bonusScore;
        } else if (r.isLikeOnly) {
            if(teamStats[r.team]) teamStats[r.team].likes += r.likes;
        } else {
            if(teamStats[r.winner]) teamStats[r.winner].wins += 1;
            if(teamStats[r.loser]) teamStats[r.loser].losses += 1;
        }
    });

    // 3. 依據勝敗排序 (勝多優先 -> 敗少優先)
    let ranked = Object.keys(teamStats).map(t => ({ team: t, ...teamStats[t] }));
    ranked.sort((a, b) => {
        if(b.wins !== a.wins) return b.wins - a.wins;
        return a.losses - b.losses; 
    });

    // 4. 估算即時排名與總分 (處理並列名次)
    let currentRank = 1;
    ranked.forEach((item, index) => {
        // 如果勝敗和上一隊一模一樣，名次並列
        if (index > 0 && item.wins === ranked[index-1].wins && item.losses === ranked[index-1].losses) {
            item.rank = ranked[index-1].rank;
        } else {
            currentRank = index + 1; // 否則按照真實排序給名次
            item.rank = currentRank;
        }
        
        // 抓取總控台設定的該名次分數 (若沒設定預設為0)
        let basePoints = (sysSettings.rankScores && sysSettings.rankScores[item.rank]) ? sysSettings.rankScores[item.rank] : 0;
        let likePoints = item.likes * (sysSettings.likePoints || 0);
        
        // 計算這隊的即時估算總分
        item.estScore = basePoints + likePoints + item.npcBonus;
    });

    // 5. 按照估算總分重新排序，並分發到四個表情區塊
    ranked.sort((a, b) => b.estScore - a.estScore);

    let tiers = [[], [], [],[]]; 
    let chunkSize = Math.ceil(ranked.length / 4);
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