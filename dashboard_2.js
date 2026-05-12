import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, deleteDoc, doc, setDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyBo5iMRonG0rFu6ZuIBJFXzwnWF9xiAKgQ", authDomain: "awaken-c5fca.firebaseapp.com", projectId: "awaken-c5fca", storageBucket: "awaken-c5fca.firebasestorage.app" };
const app = initializeApp(firebaseConfig); const db = getFirestore(app);

let globalRecords =[];
let sysSettings = { numTeams: 15, numStations: 10, maxLikes: 3, likePoints: 10, rankScores: {}, schedule: {}, stationStatus: {}, isLocked: false };

onSnapshot(doc(db, "settings_2", "global"), (docSnap) => {
    if (docSnap.exists()) sysSettings = { ...sysSettings, ...docSnap.data() };
    document.getElementById('lockSystemBtn').innerText = sysSettings.isLocked ? "🔓 開放輸入\n(目前：鎖定中)" : "🔒 關閉輸入\n(目前：開放中)";
    document.getElementById('lockSystemBtn').style.background = sysSettings.isLocked ? "#27ae60" : "#e74c3c";
});

onSnapshot(collection(db, "record_2"), (snapshot) => {
    globalRecords =[]; snapshot.forEach((d) => globalRecords.push({ id: d.id, ...d.data() }));

    const board = document.getElementById('dashboardBoard'); board.innerHTML = ""; 
    for (let i = 1; i <= sysSettings.numStations; i++) {
        let stationRecords = globalRecords.filter(r => r.station === i && !r.isNPC && !r.isLikeOnly);
        let recordsHTML = '';
        stationRecords.forEach(r => {
            recordsHTML += `<li>
                <div class="record-info">⚔️ <b style="color:#e74c3c;">${r.winner} 勝</b> (vs ${r.loser}) <br><div class="timestamp">🕒 ${r.timestamp||"無"}</div></div>
                <div class="action-btns"><button class="del-btn" data-id="${r.id}">刪</button></div>
            </li>`;
        });
        if(recordsHTML === '') recordsHTML = '<li style="color:#aaa; border-left:none;">目前尚無對戰紀錄</li>';
        board.innerHTML += `<div class="station-card dashboard-card"><div class="station-title">第 ${i} 關</div><ul class="record-list" style="overflow-y:auto; flex:1;">${recordsHTML}</ul></div>`;
    }

    document.querySelectorAll('.del-btn').forEach(btn => btn.addEventListener('click', async (e) => {
        if(confirm("確定刪除此紀錄？")) await deleteDoc(doc(db, "record_2", e.target.dataset.id));
    }));
});

// 📅 匯入賽程表 (支援直式與 Excel 矩陣直接貼上)
document.getElementById('saveScheduleBtn').addEventListener('click', async () => {
    let text = document.getElementById('scheduleInput').value.trim();
    let lines = text.split('\n').map(l => l.trimEnd());
    let newSchedule = {}; 
    
    // 自動判斷是否為 Excel 矩陣格式 (只要有一行開頭是 "第X輪" 就當作矩陣)
    let isMatrix = lines.some(l => l.startsWith('第') && l.includes('輪'));

    if (isMatrix) {
        // 🌟 智慧解析：Excel 矩陣排法
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (line.startsWith('第') && line.includes('輪')) {
                let roundStr = line.split('\t')[0].match(/\d+/);
                if (!roundStr) continue;
                let round = parseInt(roundStr[0]);

                let teamA_cols = line.split('\t');
                let teamB_cols = (lines[i+1] || "").split('\t'); // 抓下一行當隊伍B

                newSchedule[round] = {};
                
                // 從第 1 欄開始抓 (避開第 0 欄的"第X輪")
                for (let col = 1; col < teamA_cols.length; col++) {
                    let valA = teamA_cols[col].trim();
                    let valB = (teamB_cols[col] || "").trim();

                    if (valA && valB) {
                        // 如果只有輸入數字(如 18)，自動變成 "第18隊"
                        let tA = /^\d+$/.test(valA) ? `第${valA}隊` : valA;
                        let tB = /^\d+$/.test(valB) ? `第${valB}隊` : valB;
                        newSchedule[round][col] = { a: tA, b: tB };
                    }
                }
            }
        }
    } else {
        // 舊版直式解析 (防呆備用)
        lines.forEach(line => {
            let cols = line.split('\t'); 
            if(cols.length >= 4) {
                let round = parseInt(cols[0]), station = parseInt(cols[1]);
                let teamA = cols[2].trim(), teamB = cols[3].trim();
                teamA = /^\d+$/.test(teamA) ? `第${teamA}隊` : teamA;
                teamB = /^\d+$/.test(teamB) ? `第${teamB}隊` : teamB;
                if(!isNaN(round) && !isNaN(station)) {
                    if(!newSchedule[round]) newSchedule[round] = {};
                    newSchedule[round][station] = { a: teamA, b: teamB };
                }
            }
        });
    }

    await setDoc(doc(db, "settings_2", "global"), { schedule: newSchedule }, { merge: true });
    alert("✅ 賽程表匯入成功！系統已自動對應各關卡！");
    document.getElementById('scheduleModal').style.display = 'none';
});

// 🏆 設定名次給分
document.getElementById('openRankScoresBtn').addEventListener('click', () => {
    let container = document.getElementById('rankScoresContainer'); container.innerHTML = "";
    for(let i=1; i<=sysSettings.numTeams; i++) {
        let score = sysSettings.rankScores ? (sysSettings.rankScores[i] || 0) : 0;
        container.innerHTML += `<div class="form-group" style="margin-bottom:5px;"><label>第 ${i} 名得分</label><input type="number" id="rank_score_${i}" value="${score}"></div>`;
    }
    document.getElementById('rankScoresModal').style.display = 'flex';
});
document.getElementById('closeRankScoresBtn').addEventListener('click', () => { document.getElementById('rankScoresModal').style.display = 'none'; });
document.getElementById('saveRankScoresBtn').addEventListener('click', async () => {
    let newScores = {};
    for(let i=1; i<=sysSettings.numTeams; i++) newScores[i] = parseInt(document.getElementById(`rank_score_${i}`).value) || 0;
    await setDoc(doc(db, "settings_2", "global"), { rankScores: newScores }, { merge: true });
    document.getElementById('rankScoresModal').style.display = 'none';
});

// ⚙️ 基礎設定
document.getElementById('openSettingsBtn').addEventListener('click', () => {
    document.getElementById('set_teams').value = sysSettings.numTeams;
    document.getElementById('set_stations').value = sysSettings.numStations;
    document.getElementById('set_maxLikes').value = sysSettings.maxLikes || 3;
    document.getElementById('set_likePoints').value = sysSettings.likePoints || 10;
    document.getElementById('settingsModal').style.display = 'flex';
});
document.getElementById('closeSettingsBtn').addEventListener('click', () => document.getElementById('settingsModal').style.display = 'none');
document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    let newSettings = {
        numTeams: parseInt(document.getElementById('set_teams').value), numStations: parseInt(document.getElementById('set_stations').value),
        maxLikes: parseInt(document.getElementById('set_maxLikes').value), likePoints: parseInt(document.getElementById('set_likePoints').value)
    };
    await setDoc(doc(db, "settings_2", "global"), newSettings, { merge: true });
    document.getElementById('settingsModal').style.display = 'none';
});

// 🏆 結算成績 (算勝負 -> 排名 -> 依名次給分 -> 加讚數/NPC分)
document.getElementById('calcScoreBtn').addEventListener('click', () => {
    let teamStats = {}; 
    for (let i = 1; i <= sysSettings.numTeams; i++) {
        teamStats[`第${i}隊`] = { wins: 0, losses: 0, likes: 0, npcBonus: 0 };
    }

    globalRecords.forEach(r => {
        if (r.isNPC) {
            if(teamStats[r.team]) teamStats[r.team].npcBonus += r.bonusScore;
        } else if (r.isLikeOnly) {
            if(teamStats[r.team]) teamStats[r.team].likes += r.likes;
        } else {
            if(teamStats[r.winner]) teamStats[r.winner].wins += 1;
            if(teamStats[r.loser]) teamStats[r.loser].losses += 1;
        }
    });

    // 依據勝場數排名 (勝多優先，若勝場同則敗場少優先)
    let ranked = Object.keys(teamStats).map(t => ({ team: t, ...teamStats[t] }));
    ranked.sort((a, b) => {
        if(b.wins !== a.wins) return b.wins - a.wins;
        return a.losses - b.losses; 
    });

    let finalRanking = ranked.map((item, index) => {
        let rank = index + 1;
        let basePoints = sysSettings.rankScores[rank] || 0;
        let likePoints = item.likes * (sysSettings.likePoints || 0);
        let finalScore = basePoints + likePoints + item.npcBonus;
        return { rank, ...item, basePoints, finalScore };
    });

    let csvContent = "\uFEFF勝率排名,隊伍名稱,勝,敗,基礎排名分,獲得讚數,NPC加分,最終總積分\n";
    finalRanking.forEach(item => { 
        csvContent += `第${item.rank}名,${item.team},${item.wins},${item.losses},${item.basePoints},${item.likes},${item.npcBonus},${item.finalScore}\n`; 
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "純PK戰績結算表.csv"; link.click();
});

// 手動新增與清空
document.getElementById('openAddRecordBtn').addEventListener('click', () => {
    const stSelect = document.getElementById('add_station'); stSelect.innerHTML = "";
    for(let i=1; i<=sysSettings.numStations; i++) stSelect.innerHTML += `<option value="${i}">第 ${i} 關</option>`;
    const teamOpts = Array.from({length: sysSettings.numTeams}, (_, i) => `<option value="第${i+1}隊">第 ${i+1} 隊</option>`).join('');
    document.getElementById('add_teamA').innerHTML = teamOpts; document.getElementById('add_teamB').innerHTML = teamOpts;
    document.getElementById('addRecordModal').style.display = 'flex';
});
function updateWinnerOpts() {
    const tA = document.getElementById('add_teamA').value, tB = document.getElementById('add_teamB').value;
    document.getElementById('add_winner').innerHTML = `<option value="${tA}">${tA}</option><option value="${tB}">${tB}</option>`;
}
document.getElementById('add_teamA').addEventListener('change', updateWinnerOpts); document.getElementById('add_teamB').addEventListener('change', updateWinnerOpts);
document.getElementById('closeAddRecordBtn').addEventListener('click', () => document.getElementById('addRecordModal').style.display = 'none');

document.getElementById('saveNewRecordBtn').addEventListener('click', async () => {
    const st = parseInt(document.getElementById('add_station').value);
    const teamA = document.getElementById('add_teamA').value, teamB = document.getElementById('add_teamB').value;
    if(teamA === teamB) return alert("❌ 兩支隊伍不能選一樣的！");
    const winner = document.getElementById('add_winner').value;
    
    await addDoc(collection(db, "record_2"), { station: st, teamA: teamA, teamB: teamB, winner: winner, loser: (winner === teamA ? teamB : teamA), timestamp: "補登紀錄" });
    document.getElementById('addRecordModal').style.display = 'none';
});

document.getElementById('lockSystemBtn').addEventListener('click', async () => await setDoc(doc(db, "settings_2", "global"), { isLocked: !sysSettings.isLocked }, { merge: true }));
document.getElementById('clearAllBtn').addEventListener('click', async () => {
    if (prompt("輸入「確認清空」來刪除所有資料：") === "確認清空") {
        for (let r of globalRecords) await deleteDoc(doc(db, "record_2", r.id)); alert("✅ 清空完畢！");
    }
});