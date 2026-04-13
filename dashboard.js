import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, deleteDoc, doc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
// 系統預設參數 (萬一資料庫沒有資料時的保護)
let sysSettings = {
    password: "123", numTeams: 15, numStations: 15, maxMin: 59, maxScore: 999,
    scoreRule: { top1: 300, top2: 200, top3: 100, base: 50 }, stationConfigs: {},
    isLocked: false, hideMain: false
};

function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// 取得分數通用函式 (相容新舊資料)
function getVal(r) { return r.recordValue !== undefined ? r.recordValue : r.time_seconds; }

// ==========================================
// 1. 監聽全局設定檔
// ==========================================
onSnapshot(doc(db, "settings", "global"), (docSnap) => {
    if (docSnap.exists()) {
        sysSettings = { ...sysSettings, ...docSnap.data() };
    }
    
    // 更新控制按鈕畫面
    const lockBtn = document.getElementById('lockSystemBtn');
    lockBtn.innerText = sysSettings.isLocked ? "🔓 開放輸入\n(目前：鎖定中)" : "🔒 關閉輸入\n(目前：開放中)";
    lockBtn.style.background = sysSettings.isLocked ? "#27ae60" : "#e74c3c";

    const hideBtn = document.getElementById('hideScreenBtn');
    hideBtn.innerText = sysSettings.hideMain ? "📺 恢復大螢幕\n(目前：隱藏中)" : "🙈 隱藏大螢幕\n(目前：正常顯示)";
    hideBtn.style.background = sysSettings.hideMain ? "#27ae60" : "#8e44ad";
});

// ==========================================
// 2. 監聽成績並動態繪製關卡卡片
// ==========================================
onSnapshot(collection(db, "record"), (snapshot) => {
    globalRecords =[];
    snapshot.forEach((d) => globalRecords.push({ id: d.id, ...d.data() }));

    const board = document.getElementById('dashboardBoard');
    board.innerHTML = ""; 

    for (let i = 1; i <= sysSettings.numStations; i++) {
        let stationRecords = globalRecords.filter(r => r.station === i);
        let conf = sysSettings.stationConfigs[i] || { type: 'time', unit: '' };
        let isTime = conf.type === 'time';
        
        let teamBest = {};
        stationRecords.forEach(r => {
            let val = getVal(r);
            if (!teamBest[r.team]) {
                teamBest[r.team] = r;
            } else {
                let currBest = getVal(teamBest[r.team]);
                // 時間越小越好，分數越大越好
                if (isTime ? val < currBest : val > currBest) {
                    teamBest[r.team] = r;
                }
            }
        });

        let uniqueRecords = Object.values(teamBest);
        uniqueRecords.sort((a, b) => isTime ? (getVal(a) - getVal(b)) : (getVal(b) - getVal(a)));

        let top3HTML = '';
        let othersHTML = '';

        uniqueRecords.forEach((r, index) => {
            let timestamp = r.timestamp || "無時間";
            let rankStr = (index < 3) ? `<b style="color:#ffd700;">第 ${index + 1} 名</b>` : `第 ${index + 1} 名`;
            let val = getVal(r);
            let displayVal = isTime ? formatTime(val) : `${val} ${conf.unit}`;
            
            let liHTML = `
                <li>
                    <div class="record-info">
                        ${rankStr}：${r.team} <br>
                        <span style="color:#2ecc71; font-weight:bold;">${displayVal}</span>
                        <div class="timestamp">🕒 ${timestamp}</div>
                    </div>
                    <div class="action-btns">
                        <button class="edit-btn" data-id="${r.id}" data-team="${r.team}">改</button>
                        <button class="del-btn" data-id="${r.id}">刪</button>
                    </div>
                </li>`;

            if (index < 3) top3HTML += liHTML;
            else othersHTML += liHTML;
        });

        if(top3HTML === '') top3HTML = '<li style="color:#aaa;">目前尚無紀錄</li>';
        let detailsHTML = othersHTML ? `<details><summary>查看其他 ${uniqueRecords.length - 3} 隊成績 ▼</summary><ul class="record-list">${othersHTML}</ul></details>` : '';

        // 🌟 加上 dashboard-card 類別來固定高度
        board.innerHTML += `
            <div class="station-card dashboard-card">
                <div class="station-title">第 ${i} 關 <small style="color:#aaa;font-size:0.7em;">(${isTime?'計時':'計分'})</small></div>
                <ul class="record-list">${top3HTML}</ul>
                ${detailsHTML}
            </div>`;
    }

    // 綁定編輯與刪除
    document.querySelectorAll('.del-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if(confirm("確定刪除？")) await deleteDoc(doc(db, "record", e.target.dataset.id));
        });
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const newTotal = prompt(`請輸入 ${e.target.dataset.team} 的「全新數值」\n(計時關卡: 1分30秒請直接輸入 90)\n(計分關卡: 直接輸入分數)`);
            if(newTotal && !isNaN(newTotal)) {
                await updateDoc(doc(db, "record", e.target.dataset.id), {
                    recordValue: parseInt(newTotal), time_seconds: parseInt(newTotal)
                });
            }
        });
    });
});

// ==========================================
// 3. 系統參數面板邏輯 (開關與儲存)
// ==========================================
document.getElementById('openSettingsBtn').addEventListener('click', () => {
    document.getElementById('set_pwd').value = sysSettings.password;
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
        confHtml += `
        <div class="form-row" style="margin-bottom:10px; align-items:center;">
            <label style="width:60px; color:#ffd700;">第 ${i} 關</label>
            <select id="st_type_${i}" style="flex:1;">
                <option value="time" ${conf.type==='time'?'selected':''}>⏱️ 計時 (越小越好)</option>
                <option value="score" ${conf.type==='score'?'selected':''}>🎯 計分 (越大越好)</option>
            </select>
            <input type="text" id="st_unit_${i}" placeholder="單位(如: 顆)" value="${conf.unit}" style="flex:1;">
        </div>`;
    }
    document.getElementById('stationConfigsContainer').innerHTML = confHtml;
    document.getElementById('settingsModal').style.display = 'flex';
});

document.getElementById('closeSettingsBtn').addEventListener('click', () => {
    document.getElementById('settingsModal').style.display = 'none';
});

document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    let newStations = parseInt(document.getElementById('set_stations').value);
    let configs = {};
    for(let i=1; i<=newStations; i++) {
        configs[i] = {
            type: document.getElementById(`st_type_${i}`) ? document.getElementById(`st_type_${i}`).value : 'time',
            unit: document.getElementById(`st_unit_${i}`) ? document.getElementById(`st_unit_${i}`).value : ''
        };
    }
    
    let newSettings = {
        password: document.getElementById('set_pwd').value,
        numTeams: parseInt(document.getElementById('set_teams').value),
        numStations: newStations,
        maxMin: parseInt(document.getElementById('set_maxMin').value),
        maxScore: parseInt(document.getElementById('set_maxScore').value),
        scoreRule: {
            top1: parseInt(document.getElementById('set_s1').value),
            top2: parseInt(document.getElementById('set_s2').value),
            top3: parseInt(document.getElementById('set_s3').value),
            base: parseInt(document.getElementById('set_sBase').value)
        },
        stationConfigs: configs
    };

    document.getElementById('saveSettingsBtn').innerText = "💾 儲存中...";
    await setDoc(doc(db, "settings", "global"), newSettings, { merge: true });
    document.getElementById('saveSettingsBtn').innerText = "💾 儲存並套用";
    document.getElementById('settingsModal').style.display = 'none';
    alert("✅ 系統參數已更新！大螢幕與關主介面將自動套用新規則。");
});

// ==========================================
// 4. 動態結算營會總成績 (Excel匯出)
// ==========================================
document.getElementById('calcScoreBtn').addEventListener('click', () => {
    let teamScores = {}; 
    for (let i = 1; i <= sysSettings.numTeams; i++) teamScores[`第${i}隊`] = 0;

    for (let i = 1; i <= sysSettings.numStations; i++) {
        let stationRecords = globalRecords.filter(r => r.station === i);
        let conf = sysSettings.stationConfigs[i] || { type: 'time' };
        let isTime = conf.type === 'time';

        let teamBest = {};
        stationRecords.forEach(r => {
            let val = getVal(r);
            if (!teamBest[r.team]) teamBest[r.team] = r;
            else {
                let currBest = getVal(teamBest[r.team]);
                if (isTime ? val < currBest : val > currBest) teamBest[r.team] = r;
            }
        });

        let uniqueRecords = Object.values(teamBest);
        uniqueRecords.sort((a, b) => isTime ? (getVal(a) - getVal(b)) : (getVal(b) - getVal(a)));

        uniqueRecords.forEach((r, index) => {
            if (teamScores[r.team] === undefined) teamScores[r.team] = 0;
            if (index === 0) teamScores[r.team] += sysSettings.scoreRule.top1;
            else if (index === 1) teamScores[r.team] += sysSettings.scoreRule.top2;
            else if (index === 2) teamScores[r.team] += sysSettings.scoreRule.top3;
            else teamScores[r.team] += sysSettings.scoreRule.base;
        });
    }

    let finalRanking = Object.keys(teamScores).map(team => {
        let teamNum = parseInt(team.replace(/[^0-9]/g, '')) || 0;
        return { team: team, teamNum: teamNum, score: teamScores[team] };
    });
    finalRanking.sort((a, b) => a.teamNum - b.teamNum);

    let csvContent = "\uFEFF隊伍名稱,營會總積分\n";
    finalRanking.forEach(item => { csvContent += `${item.team},${item.score}\n`; });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "2026營會_各隊總成績結算表.csv";
    link.click();
});

// 開關控制與一鍵清空
document.getElementById('lockSystemBtn').addEventListener('click', async () => {
    await setDoc(doc(db, "settings", "global"), { isLocked: !sysSettings.isLocked }, { merge: true });
});
document.getElementById('hideScreenBtn').addEventListener('click', async () => {
    await setDoc(doc(db, "settings", "global"), { hideMain: !sysSettings.hideMain }, { merge: true });
});
document.getElementById('clearAllBtn').addEventListener('click', async () => {
    if (prompt("輸入「確認清空」來刪除所有資料：") === "確認清空") {
        for (let r of globalRecords) await deleteDoc(doc(db, "record", r.id));
        alert("✅ 清空完畢！");
    }
});
document.getElementById('exportBtn').addEventListener('click', () => {
    let csvContent = "\uFEFF關卡,隊伍名稱,原始數值,格式化數值,時間\n";
    globalRecords.forEach(r => {
        let conf = sysSettings.stationConfigs[r.station] || { type: 'time', unit: '' };
        let val = getVal(r);
        let display = (conf.type === 'time') ? formatTime(val) : `${val} ${conf.unit}`;
        csvContent += `${r.station},${r.team},${val},${display},${r.timestamp||"無"}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "闖關流水帳.csv";
    link.click();
});