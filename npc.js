import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
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

let sysSettings = null;
let allRecords =[];
let currentNpcName = "";

function getVal(r) { return r.recordValue !== undefined ? r.recordValue : r.time_seconds; }

// ==========================================
// 1. NPC 登入系統
// ==========================================
document.getElementById('loginBtn').addEventListener('click', () => {
    let name = document.getElementById('npcNameInput').value.trim();
    if (!name) return alert("請輸入您的名稱！");
    currentNpcName = name;
    document.getElementById('npcDisplay').innerText = `身分：${currentNpcName}`;
    document.getElementById('loginOverlay').style.display = "none";
    document.getElementById('mainContainer').style.display = "block";
    renderHistory(); // 登入後重繪個人歷史
});

// ==========================================
// 2. 監聽設定與資料，即時運算戰況
// ==========================================
onSnapshot(doc(db, "settings", "global"), (docSnap) => {
    if (docSnap.exists()) {
        sysSettings = docSnap.data();
        
        // 動態產生隊伍選單
        const teamSelect = document.getElementById('teamSelect');
        const currentSelected = teamSelect.value;
        teamSelect.innerHTML = "";
        for (let i = 1; i <= sysSettings.numTeams; i++) {
            teamSelect.innerHTML += `<option value="第${i}隊">第 ${i} 隊</option>`;
        }
        if (currentSelected) teamSelect.value = currentSelected;

        calculateLiveScores(); // 設定改變時重新計算戰況
    }
});

onSnapshot(collection(db, "record"), (snapshot) => {
    allRecords =[];
    snapshot.forEach((d) => allRecords.push({ id: d.id, ...d.data() }));
    calculateLiveScores(); 
    renderHistory();
});

// ==========================================
// 3. 核心大腦：即時計算所有隊伍總分並分流
// ==========================================
function calculateLiveScores() {
    if (!sysSettings || allRecords.length === 0) return;

    let teamScores = {}; 
    for (let i = 1; i <= sysSettings.numTeams; i++) {
        let tName = `第${i}隊`;
        teamScores[tName] = sysSettings.teamBaseScores ? (sysSettings.teamBaseScores[tName] || 0) : 0;
    }

    // 計算關卡分
    for (let i = 1; i <= sysSettings.numStations; i++) {
        let stationRecords = allRecords.filter(r => r.station === i && !r.isNPC);
        let conf = sysSettings.stationConfigs[i] || { type: 'time' };
        let isTime = conf.type === 'time';
        let maxVal = isTime ? ((sysSettings.maxMin * 60) + 59) : sysSettings.maxScore;

        let teamBest = {};
        stationRecords.forEach(r => {
            let val = getVal(r);
            if (val > maxVal || val < 0) return; 
            if (!teamBest[r.team]) teamBest[r.team] = r;
            else {
                let currBest = getVal(teamBest[r.team]);
                if (isTime ? val < currBest : val > currBest) teamBest[r.team] = r;
            }
        });

        let uniqueRecords = Object.values(teamBest).sort((a, b) => isTime ? (getVal(a) - getVal(b)) : (getVal(b) - getVal(a)));
        uniqueRecords.forEach((r, index) => {
            if (teamScores[r.team] === undefined) teamScores[r.team] = 0;
            if (index === 0) teamScores[r.team] += sysSettings.scoreRule.top1;
            else if (index === 1) teamScores[r.team] += sysSettings.scoreRule.top2;
            else if (index === 2) teamScores[r.team] += sysSettings.scoreRule.top3;
            else teamScores[r.team] += sysSettings.scoreRule.base;
        });
    }

    // 加入其他 NPC 的加分
    allRecords.filter(r => r.isNPC).forEach(r => {
        if(teamScores[r.team] !== undefined) teamScores[r.team] += r.bonusScore;
    });

    // 排序並分配 4 個階層 (上, 中上, 中下, 下)
    let ranked = Object.keys(teamScores).map(t => ({ team: t, score: teamScores[t] })).sort((a, b) => b.score - a.score);
    
    let tiers = [[], [], [],[]];
    let chunkSize = Math.ceil(ranked.length / 4); // 均分四等份，例如 15隊 -> 每份 4 隊，最後一份 3 隊
    
    ranked.forEach((item, idx) => {
        let tIdx = Math.min(Math.floor(idx / chunkSize), 3); // 確保不會超過 array index 3
        tiers[tIdx].push(item.team);
    });

    document.getElementById('tier1').innerText = tiers[0].join(', ') || '無';
    document.getElementById('tier2').innerText = tiers[1].join(', ') || '無';
    document.getElementById('tier3').innerText = tiers[2].join(', ') || '無';
    document.getElementById('tier4').innerText = tiers[3].join(', ') || '無';
}

// ==========================================
// 4. 繪製牧者個人的加分歷史
// ==========================================
function renderHistory() {
    if (!currentNpcName) return;
    
    const historyDiv = document.getElementById('npcHistory');
    historyDiv.innerHTML = ""; 

    // 只抓取「這個 NPC」的紀錄
    let myRecords = allRecords.filter(r => r.isNPC && r.npcName === currentNpcName);

    if (myRecords.length === 0) {
        historyDiv.innerHTML = "<p style='color: #888;'>目前尚無紀錄</p>";
        return;
    }

    // 倒序顯示 (最新在最上面)
    myRecords.reverse().forEach((r) => {
        const item = document.createElement('div');
        item.className = 'record-item';
        item.innerHTML = `
            <span>給 <b>${r.team}</b>：<b style="color:#27ae60;">+${r.bonusScore} 分</b> <br><small style="color:#888;">${r.timestamp}</small></span>
            <button class="delete-btn" data-id="${r.id}">刪除 ❌</button>
        `;
        historyDiv.appendChild(item);
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if(confirm("確定要收回這筆加分嗎？")) await deleteDoc(doc(db, "record", e.target.getAttribute('data-id')));
        });
    });
}

// ==========================================
// 5. 送出加分
// ==========================================
document.getElementById('submitBtn').addEventListener('click', async () => {
    const team = document.getElementById('teamSelect').value;
    const bonus = parseInt(document.getElementById('bonusScoreInput').value);

    if (isNaN(bonus) || bonus <= 0) return alert("請輸入有效的加分分數！");

    const now = new Date();
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    try {
        document.getElementById('submitBtn').innerText = "施放魔法中 ✨...";
        
        // 🌟 寫入特殊的 NPC 紀錄
        await addDoc(collection(db, "record"), {
            isNPC: true,
            station: 0, // 標示為 0 避免跟一般關卡混淆
            npcName: currentNpcName,
            team: team,
            bonusScore: bonus,   
            timestamp: nowTime
        });
        
        document.getElementById('bonusScoreInput').value = "";
        document.getElementById('submitBtn').innerText = "送出魔法加分 ✨";
        alert(`✅ 成功為 ${team} 加上 ${bonus} 分！`);
    } catch (error) {
        alert("發生錯誤，請檢查網路連線！");
        document.getElementById('submitBtn').innerText = "送出魔法加分 ✨";
    }
});