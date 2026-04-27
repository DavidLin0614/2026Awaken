import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, deleteDoc, doc, setDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
let sysSettings = {
    numTeams: 15, numStations: 10,
    scoreRule: { pkWin: 100, pkLose: 50, coop: 80 },
    stationConfigs: {}, teamBaseScores: {}, isLocked: false
};

// 資料庫節點改成 settings_2
onSnapshot(doc(db, "settings_2", "global"), (docSnap) => {
    if (docSnap.exists()) sysSettings = { ...sysSettings, ...docSnap.data() };
    
    document.getElementById('lockSystemBtn').innerText = sysSettings.isLocked ? "🔓 開放輸入\n(目前：鎖定中)" : "🔒 關閉輸入\n(目前：開放中)";
    document.getElementById('lockSystemBtn').style.background = sysSettings.isLocked ? "#27ae60" : "#e74c3c";
});

// 資料庫節點改成 record_2
onSnapshot(collection(db, "record_2"), (snapshot) => {
    globalRecords =[];
    snapshot.forEach((d) => globalRecords.push({ id: d.id, ...d.data() }));

    const board = document.getElementById('dashboardBoard');
    board.innerHTML = ""; 

    for (let i = 1; i <= sysSettings.numStations; i++) {
        let stationRecords = globalRecords.filter(r => r.station === i && !r.isNPC);
        let conf = sysSettings.stationConfigs[i] || { type: 'pk' };
        
        let recordsHTML = '';
        stationRecords.forEach(r => {
            if (r.type === 'pk') {
                recordsHTML += `<li class="pk-record">
                    <div class="record-info">⚔️ PK：<b style="color:#e74c3c;">${r.winner} 勝</b> (vs ${r.loser}) <br><div class="timestamp">🕒 ${r.timestamp||"無"}</div></div>
                    <div class="action-btns"><button class="del-btn" data-id="${r.id}">刪</button></div>
                </li>`;
            } else {
                recordsHTML += `<li class="coop-record">
                    <div class="record-info">🤝 合作：<b>${r.teamA} & ${r.teamB}</b> 成功 <br><div class="timestamp">🕒 ${r.timestamp||"無"}</div></div>
                    <div class="action-btns"><button class="del-btn" data-id="${r.id}">刪</button></div>
                </li>`;
            }
        });

        if(recordsHTML === '') recordsHTML = '<li style="color:#aaa; border-left:none;">目前尚無對戰紀錄</li>';
        let typeLabel = conf.type === 'pk' ? '⚔️ PK制' : '🤝 合作制';

        board.innerHTML += `<div class="station-card dashboard-card"><div class="station-title">第 ${i} 關 <small style="color:#aaa;font-size:0.7em;">(${typeLabel})</small></div><ul class="record-list" style="overflow-y:auto; flex:1;">${recordsHTML}</ul></div>`;
    }

    document.querySelectorAll('.del-btn').forEach(btn => btn.addEventListener('click', async (e) => {
        if(confirm("確定刪除此紀錄？")) await deleteDoc(doc(db, "record_2", e.target.dataset.id));
    }));
});

// 系統參數設定面板
document.getElementById('openSettingsBtn').addEventListener('click', () => {
    document.getElementById('set_teams').value = sysSettings.numTeams;
    document.getElementById('set_stations').value = sysSettings.numStations;
    document.getElementById('set_pkWin').value = sysSettings.scoreRule.pkWin;
    document.getElementById('set_pkLose').value = sysSettings.scoreRule.pkLose;
    document.getElementById('set_coop').value = sysSettings.scoreRule.coop;

    let confHtml = '';
    for(let i=1; i<=sysSettings.numStations; i++) {
        let conf = sysSettings.stationConfigs[i] || { type: 'pk' };
        confHtml += `<div class="form-row" style="margin-bottom:10px; align-items:center;">
            <label style="width:60px; color:#ffd700;">第 ${i} 關</label>
            <select id="st_type_${i}" style="flex:1;">
                <option value="pk" ${conf.type==='pk'?'selected':''}>⚔️ PK 對抗制</option>
                <option value="coop" ${conf.type==='coop'?'selected':''}>🤝 雙隊合作制</option>
            </select>
        </div>`;
    }
    document.getElementById('stationConfigsContainer').innerHTML = confHtml;
    document.getElementById('settingsModal').style.display = 'flex';
});
document.getElementById('closeSettingsBtn').addEventListener('click', () => document.getElementById('settingsModal').style.display = 'none');
document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    let newStations = parseInt(document.getElementById('set_stations').value);
    let configs = {};
    for(let i=1; i<=newStations; i++) configs[i] = { type: document.getElementById(`st_type_${i}`).value };
    
    let newSettings = {
        numTeams: parseInt(document.getElementById('set_teams').value), numStations: newStations,
        scoreRule: { pkWin: parseInt(document.getElementById('set_pkWin').value), pkLose: parseInt(document.getElementById('set_pkLose').value), coop: parseInt(document.getElementById('set_coop').value) },
        stationConfigs: configs
    };
    document.getElementById('saveSettingsBtn').innerText = "💾 儲存中...";
    await setDoc(doc(db, "settings_2", "global"), newSettings, { merge: true });
    document.getElementById('saveSettingsBtn').innerText = "💾 儲存並套用";
    document.getElementById('settingsModal').style.display = 'none';
});

// 各隊起始總分面板
document.getElementById('openTeamScoresBtn').addEventListener('click', () => {
    let container = document.getElementById('teamScoresContainer');
    container.innerHTML = "";
    for(let i=1; i<=sysSettings.numTeams; i++) {
        let tName = `第${i}隊`;
        let score = sysSettings.teamBaseScores ? (sysSettings.teamBaseScores[tName] || 0) : 0;
        container.innerHTML += `<div class="form-group" style="margin-bottom:5px;"><label>${tName}</label><input type="number" id="base_score_${i}" value="${score}"></div>`;
    }
    document.getElementById('teamScoresModal').style.display = 'flex';
});
document.getElementById('closeTeamScoresBtn').addEventListener('click', () => document.getElementById('teamScoresModal').style.display = 'none');
document.getElementById('saveTeamScoresBtn').addEventListener('click', async () => {
    let newScores = {};
    for(let i=1; i<=sysSettings.numTeams; i++) newScores[`第${i}隊`] = parseInt(document.getElementById(`base_score_${i}`).value) || 0;
    await setDoc(doc(db, "settings_2", "global"), { teamBaseScores: newScores }, { merge: true });
    document.getElementById('teamScoresModal').style.display = 'none';
});

// 🏆 結算成績
document.getElementById('calcScoreBtn').addEventListener('click', () => {
    let teamScores = {}; 
    for (let i = 1; i <= sysSettings.numTeams; i++) teamScores[`第${i}隊`] = sysSettings.teamBaseScores[`第${i}隊`] || 0;

    globalRecords.forEach(r => {
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

    let finalRanking = Object.keys(teamScores).map(team => ({ team: team, teamNum: parseInt(team.replace(/[^0-9]/g, '')), score: teamScores[team] }));
    finalRanking.sort((a, b) => a.teamNum - b.teamNum);

    let csvContent = "\uFEFF隊伍名稱,雙隊伍賽制結算總分\n";
    finalRanking.forEach(item => { csvContent += `${item.team},${item.score}\n`; });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "雙隊伍賽制_PK合作結算表.csv"; link.click();
});

// 手動新增資料
document.getElementById('openAddRecordBtn').addEventListener('click', () => {
    const stSelect = document.getElementById('add_station'); stSelect.innerHTML = "";
    for(let i=1; i<=sysSettings.numStations; i++) { let conf = sysSettings.stationConfigs[i] || {type:'pk'}; stSelect.innerHTML += `<option value="${i}">第 ${i} 關 (${conf.type==='pk'?'⚔️':'🤝'})</option>`; }
    
    const teamOpts = Array.from({length: sysSettings.numTeams}, (_, i) => `<option value="第${i+1}隊">第 ${i+1} 隊</option>`).join('');
    document.getElementById('add_teamA').innerHTML = teamOpts; document.getElementById('add_teamB').innerHTML = teamOpts;
    
    stSelect.dispatchEvent(new Event('change'));
    document.getElementById('addRecordModal').style.display = 'flex';
});

function updateWinnerOpts() {
    const tA = document.getElementById('add_teamA').value, tB = document.getElementById('add_teamB').value;
    document.getElementById('add_winner').innerHTML = `<option value="${tA}">${tA}</option><option value="${tB}">${tB}</option>`;
}
document.getElementById('add_teamA').addEventListener('change', updateWinnerOpts);
document.getElementById('add_teamB').addEventListener('change', updateWinnerOpts);

document.getElementById('add_station').addEventListener('change', (e) => {
    const conf = sysSettings.stationConfigs[e.target.value] || {type:'pk'};
    document.getElementById('add_winnerGroup').style.display = conf.type === 'pk' ? "block" : "none";
    updateWinnerOpts();
});

document.getElementById('closeAddRecordBtn').addEventListener('click', () => document.getElementById('addRecordModal').style.display = 'none');

document.getElementById('saveNewRecordBtn').addEventListener('click', async () => {
    const st = parseInt(document.getElementById('add_station').value);
    const teamA = document.getElementById('add_teamA').value;
    const teamB = document.getElementById('add_teamB').value;
    if(teamA === teamB) return alert("❌ 兩支隊伍不能選一樣的！");

    const conf = sysSettings.stationConfigs[st] || {type:'pk'};
    const now = new Date(), nowTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')} (補登)`;
    
    let recordData = { station: st, teamA: teamA, teamB: teamB, type: conf.type, timestamp: nowTime };
    if (conf.type === 'pk') {
        const winner = document.getElementById('add_winner').value;
        recordData.winner = winner;
        recordData.loser = (winner === teamA) ? teamB : teamA;
    }

    document.getElementById('saveNewRecordBtn').innerText = "🚀 傳送中...";
    await addDoc(collection(db, "record_2"), recordData);
    document.getElementById('saveNewRecordBtn').innerText = "🚀 確認新增";
    document.getElementById('addRecordModal').style.display = 'none';
});

document.getElementById('lockSystemBtn').addEventListener('click', async () => await setDoc(doc(db, "settings_2", "global"), { isLocked: !sysSettings.isLocked }, { merge: true }));
document.getElementById('clearAllBtn').addEventListener('click', async () => {
    if (prompt("輸入「確認清空」來刪除所有資料：") === "確認清空") {
        for (let r of globalRecords) await deleteDoc(doc(db, "record_2", r.id)); alert("✅ 清空完畢！");
    }
});
document.getElementById('exportBtn').addEventListener('click', () => {
    let csvContent = "\uFEFF類別,關卡/NPC,隊伍A,隊伍B,模式,結果/加分,時間\n";
    globalRecords.forEach(r => {
        if(r.isNPC) {
            csvContent += `牧者加分,${r.npcName},${r.team},-,-,+${r.bonusScore} 分,${r.timestamp||"無"}\n`;
        } else if (r.type === 'pk') {
            csvContent += `闖關紀錄,第${r.station}關,${r.teamA},${r.teamB},PK,${r.winner} 勝,${r.timestamp||"無"}\n`;
        } else {
            csvContent += `闖關紀錄,第${r.station}關,${r.teamA},${r.teamB},合作,雙方皆加分,${r.timestamp||"無"}\n`;
        }
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "雙隊伍賽制_流水帳紀錄.csv"; link.click();
});