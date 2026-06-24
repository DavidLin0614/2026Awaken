import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyBo5iMRonG0rFu6ZuIBJFXzwnWF9xiAKgQ", authDomain: "awaken-c5fca.firebaseapp.com", projectId: "awaken-c5fca", storageBucket: "awaken-c5fca.firebasestorage.app" };
const app = initializeApp(firebaseConfig); const db = getFirestore(app);

let globalRecords = []; let sysSettings = { numTeams: 15, d3_hidden: false, schedule: {}, d3_maxRounds: 7 };

const hideOverlay = document.createElement('div');
hideOverlay.id = "hideOverlay"; hideOverlay.innerHTML = "🏆<br>營會成績結算中<br><span style='font-size:0.5em;'>敬請期待最高榮耀</span>";
document.body.appendChild(hideOverlay);

function renderLeaderboard() {
    const board = document.getElementById("leaderboard"); board.innerHTML = ""; 
    let teamStats = {}; 
    for(let i=1; i<=sysSettings.numTeams; i++) teamStats[`第${i}隊`] = { wins: 0, losses: 0, likes: 0 };

    globalRecords.forEach(r => {
        if (r.isLikeOnly) { if(teamStats[r.team]) teamStats[r.team].likes += r.likes; } 
        else if (!r.isNPC) {
            if(teamStats[r.winner]) teamStats[r.winner].wins += 1;
            if(teamStats[r.loser]) teamStats[r.loser].losses += 1;
        }
    });

    let ranked = Object.keys(teamStats).map(t => ({ team: t, ...teamStats[t] }));
    ranked.sort((a, b) => { if(b.wins !== a.wins) return b.wins - a.wins; return a.losses - b.losses; });

    // 🌟 修正的密集排名 (Dense Rank：1,1,1,2,3)
    let currRank = 1;
    ranked.forEach((item, index) => {
        if (index > 0) {
            if (item.wins !== ranked[index-1].wins || item.losses !== ranked[index-1].losses) currRank++;
        }
        item.rank = currRank;

        let teamLastRound = 0;
        globalRecords.forEach(r => {
            if((r.teamA === item.team || r.teamB === item.team) && r.round > teamLastRound) teamLastRound = r.round;
        });

        // 🌟 強制鎖定在最高輪次
        let nextRound = teamLastRound + 1;
        let maxR = sysSettings.d3_maxRounds || 7;
        if(nextRound > maxR) nextRound = maxR; 

        let nextStationText = "讀取中";
        if(sysSettings.schedule && sysSettings.schedule[nextRound]) {
            for(let st in sysSettings.schedule[nextRound]) {
                if(sysSettings.schedule[nextRound][st].a === item.team || sysSettings.schedule[nextRound][st].b === item.team) {
                    nextStationText = `第 ${st} 關`; break;
                }
            }
        }

        let rankStr = item.rank <= 3 ? ["🥇","🥈","🥉"][item.rank-1] : item.rank;
        
        board.innerHTML += `
            <div class="leaderboard-row">
                <div class="rank-badge">${rankStr}</div>
                <div class="team-name">${item.team}</div>
                <div class="next-station">${nextStationText}</div>
                <div class="win-loss">${item.wins} 勝 ${item.losses} 敗</div>
                <div class="likes">👍x${item.likes}</div>
            </div>
        `;
    });
}

onSnapshot(doc(db, "settings_global", "global"), (docSnap) => {
    if (docSnap.exists()) { 
        sysSettings = { ...sysSettings, ...docSnap.data() }; 
        if(hideOverlay) hideOverlay.style.display = sysSettings.d3_hidden ? "flex" : "none"; 
        renderLeaderboard(); 
    }
});
onSnapshot(collection(db, "records_d3"), (snapshot) => {
    globalRecords = []; snapshot.forEach((doc) => globalRecords.push(doc.data())); renderLeaderboard(); 
});