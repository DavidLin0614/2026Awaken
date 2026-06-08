import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyBo5iMRonG0rFu6ZuIBJFXzwnWF9xiAKgQ", authDomain: "awaken-c5fca.firebaseapp.com", projectId: "awaken-c5fca", storageBucket: "awaken-c5fca.firebasestorage.app" };
const app = initializeApp(firebaseConfig); const db = getFirestore(app);

let sysSettings = {}, recordsD2 = [], recordsD3 = [], recordsBonus = [], currentNpcName = "";

const eventsMap = {
    "7/2": ["開幕式", "大破冰", "小隊時間", "晚會", "講員額外", "額外增減"],
    "7/3": ["早場", "大破冰", "晚會", "NPC加分", "講員額外", "額外增減"],
    "7/4": ["下午場", "晚場", "NPC", "講員額外", "額外增減"],
    "7/5": ["早場", "小隊任務", "見證", "講員", "講員額外", "額外增減"]
};
const daySel = document.getElementById('daySelect'), evtSel = document.getElementById('eventSelect');
Object.keys(eventsMap).forEach(d => daySel.innerHTML += `<option value="${d}">${d}</option>`);
daySel.addEventListener('change', () => {
    evtSel.innerHTML = "";
    eventsMap[daySel.value].forEach(e => evtSel.innerHTML += `<option value="${e}">${e}</option>`);
});
daySel.dispatchEvent(new Event('change'));

document.getElementById('loginBtn').addEventListener('click', () => {
    let name = document.getElementById('npcNameInput').value.trim();
    if (!name) return alert("請輸入名稱！");
    currentNpcName = name;
    document.getElementById('npcDisplay').innerText = `身分：${currentNpcName}`;
    document.getElementById('loginOverlay').style.display = "none";
    document.getElementById('mainContainer').style.display = "block";
    renderHistory();
});

onSnapshot(doc(db, "settings_global", "global"), (snap) => { if(snap.exists()) { sysSettings = snap.data(); calcAndRender(); } });
onSnapshot(collection(db, "records_d2"), (snap) => { recordsD2 = []; snap.forEach(d => recordsD2.push(d.data())); calcAndRender(); });
onSnapshot(collection(db, "records_d3"), (snap) => { recordsD3 = []; snap.forEach(d => recordsD3.push(d.data())); calcAndRender(); });
onSnapshot(collection(db, "records_bonus"), (snap) => { 
    recordsBonus = []; snap.forEach(d => recordsBonus.push({id: d.id, ...d.data()})); 
    calcAndRender(); renderHistory(); 
});

// 🌟 100% 完全對齊總控台的 Excel 欄位算分邏輯
function calcAndRender() {
    let teams = sysSettings.numTeams || 15;
    let scores = {};
    const cols = [
        "7/2_開幕式", "7/2_大破冰", "7/2_小隊時間", "7/2_晚會", "7/2_講員額外", "7/2_額外增減",
        "7/3_早場", "7/3_大破冰", "7/3_晚會", "7/3_NPC加分", "d2_main", "7/3_講員額外", "7/3_額外增減",
        "7/4_下午場", "7/4_晚場", "7/4_NPC", "d3_main", "7/4_講員額外", "7/4_額外增減",
        "7/5_早場", "7/5_小隊任務", "7/5_見證", "7/5_講員", "7/5_講員額外", "7/5_額外增減"
    ];

    for(let i=1; i<=teams; i++) {
        scores[`第${i}隊`] = { total: 0 };
        cols.forEach(c => scores[`第${i}隊`][c] = 0);
    }

    let d2Rules = sysSettings.d2_rules || { top1:300, top2:200, top3:100, base:50 };
    let d2LikePts = sysSettings.d2_likePts || 10;
    
    for(let i=1; i<= (sysSettings.numStations_d2 || 15); i++) {
        let conf = sysSettings.d2_configs ? sysSettings.d2_configs[i] : { type:'time' };
        let maxVal = (conf.type === 'time') ? ((sysSettings.d2_maxMin||59) * 60 + 59) : (sysSettings.d2_maxScore||999);
        let stRecs = recordsD2.filter(r => r.station === i && !r.isLikeOnly && r.val >= 0 && r.val <= maxVal);
        
        let teamBest = {};
        stRecs.forEach(r => {
            if (!teamBest[r.team]) teamBest[r.team] = r.val;
            else {
                if (conf.type === 'time') teamBest[r.team] = Math.min(teamBest[r.team], r.val);
                else teamBest[r.team] = Math.max(teamBest[r.team], r.val);
            }
        });

        let uniqueRecs = Object.keys(teamBest).map(t => ({ team: t, val: teamBest[t] }));
        uniqueRecs.sort((a,b) => conf.type === 'time' ? a.val - b.val : b.val - a.val);

        uniqueRecs.forEach((r, idx) => {
            if(!scores[r.team]) return;
            if(idx === 0) scores[r.team].d2_main += d2Rules.top1;
            else if(idx === 1) scores[r.team].d2_main += d2Rules.top2;
            else if(idx === 2) scores[r.team].d2_main += d2Rules.top3;
            else scores[r.team].d2_main += d2Rules.base;
        });
    }
    recordsD2.forEach(r => { if(scores[r.team] && r.likes) scores[r.team].d2_main += (r.likes * d2LikePts); });

    let d3LikePts = sysSettings.d3_likePts || 10;
    let d3Stats = {};
    for(let i=1; i<=teams; i++) d3Stats[`第${i}隊`] = { wins: 0, losses: 0 };
    recordsD3.forEach(r => {
        if(d3Stats[r.winner]) d3Stats[r.winner].wins++;
        if(d3Stats[r.loser]) d3Stats[r.loser].losses++;
        if(scores[r.teamA] && r.likesA) scores[r.teamA].d3_main += (r.likesA * d3LikePts);
        if(scores[r.teamB] && r.likesB) scores[r.teamB].d3_main += (r.likesB * d3LikePts);
    });

    let d3Ranked = Object.keys(d3Stats).map(t => ({ team: t, ...d3Stats[t] })).sort((a,b) => b.wins !== a.wins ? b.wins - a.wins : a.losses - b.losses);
    let d3RankScores = sysSettings.d3_rankScores || {};
    let currRank = 1;
    d3Ranked.forEach((item, idx) => {
        if (idx > 0 && item.wins === d3Ranked[idx-1].wins && item.losses === d3Ranked[idx-1].losses) item.rank = d3Ranked[idx-1].rank;
        else { currRank = idx + 1; item.rank = currRank; }
        if(scores[item.team]) scores[item.team].d3_main += (d3RankScores[item.rank] || 0);
    });

    recordsBonus.forEach(r => { 
        if(scores[r.team] && scores[r.team][r.reason] !== undefined) {
            scores[r.team][r.reason] += r.val;
        } else if (scores[r.team] && r.npc) {
            scores[r.team]["7/3_NPC加分"] += r.val;
        }
    });

    let finalRanking = Object.keys(scores).map(t => {
        let s = scores[t];
        s.total = cols.reduce((sum, c) => sum + s[c], 0);
        return { team: t, total: s.total };
    }).sort((a,b) => b.total - a.total);
    
    const board = document.getElementById('simpleLeaderboard'); board.innerHTML = "";
    finalRanking.forEach((item, idx) => {
        board.innerHTML += `<div class="score-item">第${idx+1}名 ${item.team} <span>${item.total} 分</span></div>`;
    });

    const tSel = document.getElementById('teamSelect'); const curr = tSel.value; tSel.innerHTML = "";
    for(let i=1; i<=teams; i++) tSel.innerHTML += `<option value="第${i}隊">第 ${i} 隊</option>`;
    if(curr) tSel.value = curr;
}

function renderHistory() {
    if(!currentNpcName) return;
    const historyDiv = document.getElementById('npcHistory'); historyDiv.innerHTML = "";
    let myRecs = recordsBonus.filter(r => r.npc === currentNpcName).sort((a,b) => b.timestamp - a.timestamp);
    if(myRecs.length === 0) { historyDiv.innerHTML = "<p style='color:#888;'>尚無紀錄</p>"; return; }
    
    myRecs.forEach(r => {
        historyDiv.innerHTML += `
            <div class="history-item">
                <div><b>${r.team}</b> <small style="color:#aaa;">(${r.reason})</small><br><span style="color:#f1c40f;">${r.val > 0 ? '+'+r.val : r.val} 分</span></div>
                <button class="btn btn-danger" style="padding:5px;" onclick="window.delNpcRec('${r.id}')">刪除</button>
            </div>`;
    });
}
window.delNpcRec = async (id) => { if(confirm("刪除此紀錄？")) await deleteDoc(doc(db, "records_bonus", id)); };

document.getElementById('submitBtn').addEventListener('click', async () => {
    let team = document.getElementById('teamSelect').value;
    let reason = `${document.getElementById('daySelect').value}_${document.getElementById('eventSelect').value}`;
    let val = parseInt(document.getElementById('bonusScoreInput').value);
    if(isNaN(val)) return alert("請輸入分數！");
    try {
        await addDoc(collection(db, "records_bonus"), { team, reason, val, npc: currentNpcName, timestamp: Date.now() });
        document.getElementById('bonusScoreInput').value = ""; alert("✅ 送出成功！");
    } catch(e) { alert("發生錯誤！"); }
});