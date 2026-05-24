import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyBo5iMRonG0rFu6ZuIBJFXzwnWF9xiAKgQ", authDomain: "awaken-c5fca.firebaseapp.com", projectId: "awaken-c5fca", storageBucket: "awaken-c5fca.firebasestorage.app" };
const app = initializeApp(firebaseConfig); const db = getFirestore(app);

let globalRecords = []; 
let sysSettings = { numTeams: 15, hideMain: false, schedule: {} };

const hideOverlay = document.createElement('div');
hideOverlay.id = "hideOverlay"; hideOverlay.innerHTML = "🏆<br>營會成績結算中<br><span>敬請期待最高榮耀</span>";
document.body.appendChild(hideOverlay);

function renderLeaderboard() {
    const board = document.getElementById("leaderboard"); 
    board.innerHTML = ""; 
    
    let teamStats = {}; 
    for(let i=1; i<=sysSettings.numTeams; i++) {
        teamStats[`第${i}隊`] = { wins: 0, losses: 0, likes: 0 };
    }

    // 1. 統計勝負與讚數
    globalRecords.forEach(r => {
        if (r.isLikeOnly) {
            if(teamStats[r.team]) teamStats[r.team].likes += r.likes;
        } else if (!r.isNPC) {
            if(teamStats[r.winner]) teamStats[r.winner].wins += 1;
            if(teamStats[r.loser]) teamStats[r.loser].losses += 1;
        }
    });

    // 2. 排序：勝多優先 -> 敗少優先
    let ranked = Object.keys(teamStats).map(t => ({ team: t, ...teamStats[t] }));
    ranked.sort((a, b) => {
        if(b.wins !== a.wins) return b.wins - a.wins;
        return a.losses - b.losses; 
    });

    // 3. 處理並列名次並生成 HTML
    let currentRank = 1;
    ranked.forEach((item, index) => {
        if (index > 0 && item.wins === ranked[index-1].wins && item.losses === ranked[index-1].losses) {
            item.rank = ranked[index-1].rank;
        } else {
            currentRank = index + 1;
            item.rank = currentRank;
        }

        // --- 🌟 計算「下一關」邏輯 ---
        let teamLastRound = 0;
        globalRecords.forEach(r => {
            // 檢查該紀錄是否屬於此隊伍，且包含輪次資訊
            if((r.teamA === item.team || r.teamB === item.team) && r.round) {
                if(r.round > teamLastRound) teamLastRound = r.round;
            }
        });

        let nextRound = teamLastRound + 1;
        let nextStationText = "🏁 已完賽";
        
        if(sysSettings.schedule && sysSettings.schedule[nextRound]) {
            for(let st in sysSettings.schedule[nextRound]) {
                let match = sysSettings.schedule[nextRound][st];
                if(match.a === item.team || match.b === item.team) {
                    nextStationText = `👉 下一關：第 ${st} 關`;
                    break;
                }
            }
        }
        // --- 🌟 計算結束 ---

        let rankClass = ""; let rankStr = `${item.rank}`;
        if(item.rank === 1) { rankClass = "top1"; rankStr = "🥇"; }
        else if(item.rank === 2) { rankClass = "top2"; rankStr = "🥈"; }
        else if(item.rank === 3) { rankClass = "top3"; rankStr = "🥉"; }

        let likeStr = item.likes > 0 ? `👍 x ${item.likes}` : `<span style="color:#555;">👍 x 0</span>`;

        board.innerHTML += `
            <div class="leaderboard-row ${rankClass}">
                <div class="rank-badge">${rankStr}</div>
                <div class="team-name">
                    ${item.team}
                    <div style="font-size:0.5em; color:#aaa; font-weight:normal; margin-top:5px;">${nextStationText}</div>
                </div>
                <div class="win-loss">${item.wins} 勝 ${item.losses} 敗</div>
                <div class="likes">${likeStr}</div>
            </div>
        `;
    });
} // <--- renderLeaderboard 結束的花括號在這裡

onSnapshot(doc(db, "settings_2", "global"), (docSnap) => {
    if (docSnap.exists()) { 
        sysSettings = { ...sysSettings, ...docSnap.data() }; 
        if(hideOverlay) hideOverlay.style.display = sysSettings.hideMain ? "flex" : "none"; 
        renderLeaderboard(); 
    }
});

onSnapshot(collection(db, "record_2"), (snapshot) => {
    globalRecords = []; 
    snapshot.forEach((doc) => globalRecords.push(doc.data())); 
    renderLeaderboard(); 
});