import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyBo5iMRonG0rFu6ZuIBJFXzwnWF9xiAKgQ", authDomain: "awaken-c5fca.firebaseapp.com", projectId: "awaken-c5fca", storageBucket: "awaken-c5fca.firebasestorage.app" };
const app = initializeApp(firebaseConfig); const db = getFirestore(app);

let sysSettings = {}, recordsD2 = [], recordsD3 = [], recordsBonus = [], currentNpcName = "";

document.getElementById('loginBtn').addEventListener('click', () => {
    let name = document.getElementById('npcNameInput').value.trim();
    if (!name) return alert("請輸入名稱！");
    currentNpcName = name;
    document.getElementById('npcDisplay').innerText = `身分：${currentNpcName}`;
    document.getElementById('loginOverlay').style.display = "none";
    document.getElementById('mainContainer').style.display = "block";
});

onSnapshot(doc(db, "settings_global", "global"), (snap) => { if(snap.exists()) { sysSettings = snap.data(); calc(); } });
onSnapshot(collection(db, "records_d2"), (snap) => { recordsD2 = []; snap.forEach(d => recordsD2.push(d.data())); calc(); });
onSnapshot(collection(db, "records_d3"), (snap) => { recordsD3 = []; snap.forEach(d => recordsD3.push(d.data())); calc(); });
onSnapshot(collection(db, "records_bonus"), (snap) => { recordsBonus = []; snap.forEach(d => recordsBonus.push(d.data())); calc(); });

function calc() {
    let teams = sysSettings.numTeams || 15;
    let scores = {};
    for(let i=1; i<=teams; i++) scores[`第${i}隊`] = 0;

    let d2Rules = sysSettings.d2_rules || { top1:300, top2:200, top3:100, base:50 };
    for(let i=1; i<= (sysSettings.numStations_d2 || 15); i++) {
        let conf = sysSettings.d2_configs ? sysSettings.d2_configs[i] : { type:'time' };
        let maxVal = (conf.type === 'time') ? ((sysSettings.d2_maxMin||59) * 60 + 59) : (sysSettings.d2_maxScore||999);
        let stRecs = recordsD2.filter(r => r.station === i && !r.isLikeOnly && r.val >= 0 && r.val <= maxVal);
        stRecs.sort((a,b) => conf.type === 'time' ? a.val - b.val : b.val - a.val);
        stRecs.forEach((r, idx) => {
            if(!scores[r.team]) return;
            if(idx === 0) scores[r.team] += d2Rules.top1;
            else if(idx === 1) scores[r.team] += d2Rules.top2;
            else if(idx === 2) scores[r.team] += d2Rules.top3;
            else scores[r.team] += d2Rules.base;
        });
    }
    recordsD2.forEach(r => { if(scores[r.team] && r.likes) scores[r.team] += (r.likes * (sysSettings.d2_likePts||10)); });

    let d3Stats = {};
    for(let i=1; i<=teams; i++) d3Stats[`第${i}隊`] = { wins: 0, losses: 0 };
    recordsD3.forEach(r => {
        if(d3Stats[r.winner]) d3Stats[r.winner].wins++;
        if(d3Stats[r.loser]) d3Stats[r.loser].losses++;
        if(scores[r.teamA] && r.likesA) scores[r.teamA] += (r.likesA * (sysSettings.d3_likePts||10));
        if(scores[r.teamB] && r.likesB) scores[r.teamB] += (r.likesB * (sysSettings.d3_likePts||10));
    });
    let d3Ranked = Object.keys(d3Stats).map(t => ({ team: t, ...d3Stats[t] })).sort((a,b) => b.wins !== a.wins ? b.wins - a.wins : a.losses - b.losses);
    let d3RankScores = sysSettings.d3_rankScores || {};
    let currRank = 1;
    d3Ranked.forEach((item, idx) => {
        if (idx > 0 && item.wins === d3Ranked[idx-1].wins && item.losses === d3Ranked[idx-1].losses) item.rank = d3Ranked[idx-1].rank;
        else { currRank = idx + 1; item.rank = currRank; }
        if(scores[item.team]) scores[item.team] += (d3RankScores[item.rank] || 0);
    });

    recordsBonus.forEach(r => { if(scores[r.team]) scores[r.team] += r.val; });

    let finalRanking = Object.keys(scores).map(t => ({ team: t, total: scores[t] })).sort((a,b) => b.total - a.total);
    
    const board = document.getElementById('simpleLeaderboard'); board.innerHTML = "";
    finalRanking.forEach((item, idx) => {
        board.innerHTML += `<div class="simple-row"><b>第${idx+1}名 ${item.team}</b><span style="color:#f1c40f;">${item.total} 分</span></div>`;
    });

    const tSel = document.getElementById('teamSelect'); const curr = tSel.value; tSel.innerHTML = "";
    for(let i=1; i<=teams; i++) tSel.innerHTML += `<option value="第${i}隊">第 ${i} 隊</option>`;
    if(curr) tSel.value = curr;
}

document.getElementById('submitBtn').addEventListener('click', async () => {
    let team = document.getElementById('teamSelect').value;
    let val = parseInt(document.getElementById('bonusScoreInput').value);
    if(isNaN(val)) return alert("請輸入分數！");
    try {
        await addDoc(collection(db, "records_bonus"), { team, reason: "7/3_NPC加分", val, npc: currentNpcName, timestamp: Date.now() });
        document.getElementById('bonusScoreInput').value = ""; alert("✅ 送出成功！");
    } catch(e) { alert("發生錯誤！"); }
});