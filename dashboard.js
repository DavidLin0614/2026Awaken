import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, deleteDoc, doc, setDoc, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
    numTeams: 15, numStations: 15, maxMin: 59, maxScore: 999,
    scoreRule: { top1: 300, top2: 200, top3: 100, base: 50 }, stationConfigs: {},
    isLocked: false, hideMain: false, teamBaseScores: {} // 🌟 新增各隊起始總分
};

function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
function getVal(r) { return r.recordValue !== undefined ? r.recordValue : r.time_seconds; }

onSnapshot(doc(db, "settings", "global"), (docSnap) => {
    if (docSnap.exists()) sysSettings = { ...sysSettings, ...docSnap.data() };
    
    document.getElementById('lockSystemBtn').innerText = sysSettings.isLocked ? "🔓 開放輸入\n(目前：鎖定中)" : "🔒 關閉輸入\n(目前：開放中)";
    document.getElementById('lockSystemBtn').style.background = sysSettings.isLocked ? "#27ae60" : "#e74c3c";
    document.getElementById('hideScreenBtn').innerText = sysSettings.hideMain ? "📺 恢復大螢幕\n(目前：隱藏中)" : "🙈 隱藏大螢幕\n(目前：正常顯示)";
    document.getElementById('hideScreenBtn').style.background = sysSettings.hideMain ? "#27ae60" : "#8e44ad";
});

onSnapshot(collection(db, "record"), (snapshot) => {
    globalRecords =[];
    snapshot.forEach((d) => globalRecords.push({ id: d.id, ...d.data() }));

    const board = document.getElementById('dashboardBoard');
    board.innerHTML = ""; 

    for (let i = 1; i <= sysSettings.numStations; i++) {
        let stationRecords = globalRecords.filter(r => r.station === i && !r.isNPC); // 排除牧者加分紀錄
        let conf = sysSettings.stationConfigs[i] || { type: 'time', unit: '' };
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

        let uniqueRecords = Object.values(teamBest);
        uniqueRecords.sort((a, b) => isTime ? (getVal(a) - getVal(b)) : (getVal(b) - getVal(a)));

        let top3HTML = '', othersHTML = '';
        uniqueRecords.forEach((r, index) => {
            let rankStr = (index < 3) ? `<b style="color:#ffd700;">第 ${index + 1} 名</b>` : `第 ${index + 1} 名`;
            let val = getVal(r);
            let displayVal = isTime ? formatTime(val) : `${val} ${conf.unit}`;
            let liHTML = `<li>
                <div class="record-info">${rankStr}：${r.team} <br><span style="color:#2ecc71; font-weight:bold;">${displayVal}</span><div class="timestamp">🕒 ${r.timestamp||"無"}</div></div>
                <div class="action-btns"><button class="edit-btn" data-id="${r.id}" data-team="${r.team}">改</button><button class="del-btn" data-id="${r.id}">刪</button></div>
            </li>`;
            if (index < 3) top3HTML += liHTML; else othersHTML += liHTML;
        });

        if(top3HTML === '') top3HTML = '<li style="color:#aaa;">目前尚無紀錄</li>';
        let detailsHTML = othersHTML ? `<details><summary>查看其他 ${uniqueRecords.length - 3} 隊 ▼</summary><ul class="record-list">${othersHTML}</ul></details>` : '';

        board.innerHTML += `<div class="station-card dashboard-card"><div class="station-title">第 ${i} 關 <small style="color:#aaa;font-size:0.7em;">(${isTime?'計時':'計分'})</small></div><ul class="record-list">${top3HTML}</ul>${detailsHTML}</div>`;
    }

    document.querySelectorAll('.del-btn').forEach(btn => btn.addEventListener('click', async (e) => {
        if(confirm("確定刪除？")) await deleteDoc(doc(db, "record", e.target.dataset.id));
    }));
    document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', async (e) => {
        const newTotal = prompt(`請輸入 ${e.target.dataset.team} 的「全新數值」`);
        if(newTotal && !isNaN(newTotal)) await updateDoc(doc(db, "record", e.target.dataset.id), { recordValue: parseInt(newTotal), time_seconds: parseInt(newTotal) });
    }));
});

// 系統參數設定面板
document.getElementById('openSettingsBtn').addEventListener('click', () => {
    document.getElementById('set_teams').value = sysSettings.numTeams;
    document.getElementById('set_stations').value = sysSettings.numStations;
    document.getElementById('set_maxMin').value = sysSettings.maxMin;
    document.getElementById('set_maxScore').value = sysSettings.maxScore;
    document.getElementById('set_s1').value = sysSettings.scoreRule.top1;
    document.getElementById('set_s2').value = sysSettings.scoreRule.top2;
    document.getElementById('set_s3').value = sysSettings.scoreRule.top3;
    document.getElementById('set_sBase').value = sysSettings.scoreRule.base;

    let confHtml = '';
    for(let i=1; i<=sysSettings.numStations; i++) {
        let conf = sysSettings.stationConfigs[i] || { type: 'time', unit: '' };
        confHtml += `<div class="form-row" style="margin-bottom:10px; align-items:center;">
            <label style="width:60px; color:#ffd700;">第 ${i} 關</label>
            <select id="st_type_${i}" style="flex:1;"><option value="time" ${conf.type==='time'?'selected':''}>⏱️ 計時</option><option value="score" ${conf.type==='score'?'selected':''}>🎯 計分</option></select>
            <input type="text" id="st_unit_${i}" placeholder="單位" value="${conf.unit}" style="flex:1;">
        </div>`;
    }
    document.getElementById('stationConfigsContainer').innerHTML = confHtml;
    document.getElementById('settingsModal').style.display = 'flex';
});
document.getElementById('closeSettingsBtn').addEventListener('click', () => document.getElementById('settingsModal').style.display = 'none');
document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    let newStations = parseInt(document.getElementById('set_stations').value);
    let configs = {};
    for(let i=1; i<=newStations; i++) configs[i] = { type: document.getElementById(`st_type_${i}`).value, unit: document.getElementById(`st_unit_${i}`).value };
    
    let newSettings = {
        numTeams: parseInt(document.getElementById('set_teams').value), numStations: newStations, maxMin: parseInt(document.getElementById('set_maxMin').value), maxScore: parseInt(document.getElementById('set_maxScore').value),
        scoreRule: { top1: parseInt(document.getElementById('set_s1').value), top2: parseInt(document.getElementById('set_s2').value), top3: parseInt(document.getElementById('set_s3').value), base: parseInt(document.getElementById('set_sBase').value) },
        stationConfigs: configs
    };
    document.getElementById('saveSettingsBtn').innerText = "💾 儲存中...";
    await setDoc(doc(db, "settings", "global"), newSettings, { merge: true });
    document.getElementById('saveSettingsBtn').innerText = "💾 儲存並套用";
    document.getElementById('settingsModal').style.display = 'none';
});

// 🌟 各隊起始總分面板
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
    document.getElementById('saveTeamScoresBtn').innerText = "💾 儲存中...";
    await setDoc(doc(db, "settings", "global"), { teamBaseScores: newScores }, { merge: true });
    document.getElementById('saveTeamScoresBtn').innerText = "💾 儲存總分";
    document.getElementById('teamScoresModal').style.display = 'none';
});

// 結算營會總成績 (加入起始分與 NPC 加分)
document.getElementById('calcScoreBtn').addEventListener('click', () => {
    let teamScores = {}; 
    for (let i = 1; i <= sysSettings.numTeams; i++) {
        let tName = `第${i}隊`;
        teamScores[tName] = sysSettings.teamBaseScores ? (sysSettings.teamBaseScores[tName] || 0) : 0;
    }

    // 結算關卡積分
    for (let i = 1; i <= sysSettings.numStations; i++) {
        let stationRecords = globalRecords.filter(r => r.station === i && !r.isNPC);
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

    // 🌟 結算 NPC 加分
    globalRecords.filter(r => r.isNPC).forEach(r => {
        if(teamScores[r.team] !== undefined) teamScores[r.team] += r.bonusScore;
    });

    let finalRanking = Object.keys(teamScores).map(team => {
        let teamNum = parseInt(team.replace(/[^0-9]/g, '')) || 0;
        return { team: team, teamNum: teamNum, score: teamScores[team] };
    });
    finalRanking.sort((a, b) => a.teamNum - b.teamNum);

    let csvContent = "\uFEFF隊伍名稱,營會最終總積分\n";
    finalRanking.forEach(item => { csvContent += `${item.team},${item.score}\n`; });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "2026營會_各隊總成績結算表.csv";
    link.click();
});

// 手動新增資料 (略，維持原樣即可)
document.getElementById('openAddRecordBtn').addEventListener('click', () => {
    const stSelect = document.getElementById('add_station'); stSelect.innerHTML = "";
    for(let i = 1; i <= sysSettings.numStations; i++) { let conf = sysSettings.stationConfigs[i] || {type:'time'}; stSelect.innerHTML += `<option value="${i}">第 ${i} 關 (${conf.type === 'time' ? '⏱️' : '🎯'})</option>`; }
    const tmSelect = document.getElementById('add_team'); tmSelect.innerHTML = "";
    for(let i = 1; i <= sysSettings.numTeams; i++) tmSelect.innerHTML += `<option value="第${i}隊">第 ${i} 隊</option>`;
    stSelect.dispatchEvent(new Event('change')); 
    document.getElementById('addRecordModal').style.display = 'flex';
});
document.getElementById('closeAddRecordBtn').addEventListener('click', () => document.getElementById('addRecordModal').style.display = 'none');
document.getElementById('add_station').addEventListener('change', (e) => {
    const st = parseInt(e.target.value); const conf = sysSettings.stationConfigs[st] || {type:'time', unit:''};
    if (conf.type === 'time') { document.getElementById('add_timeGroup').style.display = "block"; document.getElementById('add_scoreGroup').style.display = "none"; } 
    else { document.getElementById('add_timeGroup').style.display = "none"; document.getElementById('add_scoreGroup').style.display = "block"; document.getElementById('add_scoreLabel').innerText = `🎯 獲得數值 (單位: ${conf.unit})`; }
});
document.getElementById('saveNewRecordBtn').addEventListener('click', async () => {
    const st = parseInt(document.getElementById('add_station').value), team = document.getElementById('add_team').value;
    const conf = sysSettings.stationConfigs[st] || {type:'time'}; let isTime = conf.type === 'time', finalValue = 0;
    if (isTime) {
        const min = parseInt(document.getElementById('add_min').value) || 0, sec = parseInt(document.getElementById('add_sec').value) || 0;
        if (min === 0 && sec === 0) return alert("請輸入花費時間！");
        if (sec > 59) return alert("❌ 秒數不能超過 59！");
        if (min > sysSettings.maxMin) return alert(`❌ 分鐘不能超過 ${sysSettings.maxMin}！`);
        finalValue = min * 60 + sec;
    } else {
        const score = parseInt(document.getElementById('add_score').value);
        if (isNaN(score) || score > sysSettings.maxScore) return alert(`❌ 數值錯誤或超過 ${sysSettings.maxScore}！`);
        finalValue = score;
    }
    const now = new Date(), nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    try {
        document.getElementById('saveNewRecordBtn').innerText = "🚀 傳送中...";
        await addDoc(collection(db, "record"), { station: st, team: team, recordValue: finalValue, time_seconds: finalValue, timestamp: nowTime + " (補登)" });
        document.getElementById('saveNewRecordBtn').innerText = "🚀 確認新增"; document.getElementById('addRecordModal').style.display = 'none';
    } catch (err) { alert("發生錯誤！"); document.getElementById('saveNewRecordBtn').innerText = "🚀 確認新增"; }
});

document.getElementById('lockSystemBtn').addEventListener('click', async () => await setDoc(doc(db, "settings", "global"), { isLocked: !sysSettings.isLocked }, { merge: true }));
document.getElementById('hideScreenBtn').addEventListener('click', async () => await setDoc(doc(db, "settings", "global"), { hideMain: !sysSettings.hideMain }, { merge: true }));
document.getElementById('clearAllBtn').addEventListener('click', async () => {
    if (prompt("輸入「確認清空」來刪除所有資料：") === "確認清空") {
        for (let r of globalRecords) await deleteDoc(doc(db, "record", r.id)); alert("✅ 清空完畢！");
    }
});
document.getElementById('exportBtn').addEventListener('click', () => {
    let csvContent = "\uFEFF類別,關卡/NPC,隊伍名稱,原始數值/加分,格式化數值,時間\n";
    globalRecords.forEach(r => {
        if(r.isNPC) {
            csvContent += `牧者加分,${r.npcName},${r.team},${r.bonusScore},+${r.bonusScore} 分,${r.timestamp||"無"}\n`;
        } else {
            let conf = sysSettings.stationConfigs[r.station] || { type: 'time', unit: '' };
            let val = getVal(r);
            let display = (conf.type === 'time') ? formatTime(val) : `${val} ${conf.unit}`;
            csvContent += `闖關紀錄,第${r.station}關,${r.team},${val},${display},${r.timestamp||"無"}\n`;
        }
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "營會全紀錄流水帳.csv"; link.click();
});