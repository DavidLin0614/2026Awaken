import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyBo5iMRonG0rFu6ZuIBJFXzwnWF9xiAKgQ", authDomain: "awaken-c5fca.firebaseapp.com", projectId: "awaken-c5fca", storageBucket: "awaken-c5fca.firebasestorage.app" };
const app = initializeApp(firebaseConfig); const db = getFirestore(app);

let globalRecords = []; let sysSettings = { numTeams: 15, numStations_d2: 15, d2_hidden: false, d2_status: {}, d2_configs: {} };

const hideOverlay = document.createElement('div');
hideOverlay.id = "hideOverlay"; hideOverlay.innerHTML = "🏆<br>營會成績結算中<br><span style='font-size:0.5em;'>敬請期待最高榮耀</span>";
document.body.appendChild(hideOverlay);

function formatTime(totalSeconds) { const m = Math.floor(totalSeconds / 60); const s = totalSeconds % 60; return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; }

function renderBoard() {
    const board = document.getElementById("board"); board.innerHTML = ""; 
    let teamLikes = {}; 
    
    // 🌟 嚴格只初始化到設定的隊伍數
    for(let i=1; i<=sysSettings.numTeams; i++) teamLikes[`第${i}隊`] = 0;
    
    globalRecords.forEach(r => { 
        // 🌟 嚴格過濾：只採計設定內的隊伍 (無視第15隊的假資料)
        if(!r.isNPC && r.likes > 0 && teamLikes[r.team] !== undefined) {
            teamLikes[r.team] += r.likes; 
        }
    });

    let maxStations = sysSettings.numStations_d2 || 15;
    for (let i = 1; i <= maxStations; i++) {
        let stationRecords = globalRecords.filter(r => r.station === i && !r.isLikeOnly);
        let conf = sysSettings.d2_configs ? (sysSettings.d2_configs[i] || { type: 'time', unit: '' }) : { type: 'time', unit: '' };
        let isTime = conf.type === 'time';
        let maxVal = isTime ? ((sysSettings.d2_maxMin * 60) + 59) : sysSettings.d2_maxScore;

        let teamBest = {};
        stationRecords.forEach(r => {
            // 🌟 嚴格過濾：超過設定隊伍數的資料直接無視
            let tNum = parseInt(r.team.replace(/[^0-9]/g, ''));
            if (tNum > sysSettings.numTeams) return;

            if (r.val > maxVal || r.val < 0) return;
            if (!teamBest[r.team]) teamBest[r.team] = r;
            else {
                let curr = teamBest[r.team].val;
                if (isTime ? r.val < curr : r.val > curr) teamBest[r.team] = r;
            }
        });
        
        let uniqueRecords = Object.values(teamBest).sort((a, b) => isTime ? (a.val - b.val) : (b.val - a.val));
        
        let medals = ["🥇", "🥈", "🥉"];
        let topHtml =[];
        for(let j=0; j<3; j++) {
            if(uniqueRecords[j]) {
                let display = isTime ? formatTime(uniqueRecords[j].val) : `${uniqueRecords[j].val} ${conf.unit}`;
                topHtml.push(`<div class="rank-row"><span class="rank-icon">${medals[j]}</span><span class="rank-text">${uniqueRecords[j].team} (${display})</span></div>`);
            } else {
                topHtml.push(`<div class="rank-row"><span class="rank-icon">${medals[j]}</span><span class="rank-text" style="color:#aaa;">尚未產生</span></div>`);
            }
        }

        let status = (sysSettings.d2_status && sysSettings.d2_status[i] === 'red') ? 'dot-red' : 'dot-green';

        board.innerHTML += `
            <div class="station-card">
                <div class="station-title">
                    <span class="status-dot ${status}"></span>
                    <span>第 ${i} 關</span>
                    <span></span>
                </div>
                ${topHtml[0]}${topHtml[1]}${topHtml[2]}
            </div>
        `;
    }

    let teamNames = Object.keys(teamLikes).sort((a, b) => parseInt(a.replace(/[^0-9]/g, '')) - parseInt(b.replace(/[^0-9]/g, '')));
    let chunkedTeams = [];
    for (let i = 0; i < teamNames.length; i += 4) chunkedTeams.push(teamNames.slice(i, i + 4));

    chunkedTeams.forEach(chunk => {
        let likesHtml = chunk.map(t => `<p style="margin: 8px 0; color:#f1c40f; font-weight:bold; font-size:1.15em;">${t}：👍 x ${teamLikes[t]}</p>`).join('');
        board.innerHTML += `<div class="station-card" style="justify-content: center;"><div>${likesHtml}</div></div>`;
    });
}

onSnapshot(doc(db, "settings_global", "global"), (docSnap) => {
    if (docSnap.exists()) { 
        sysSettings = { ...sysSettings, ...docSnap.data() }; 
        if(hideOverlay) hideOverlay.style.display = sysSettings.d2_hidden ? "flex" : "none"; 
        renderBoard(); 
    }
});

onSnapshot(collection(db, "records_d2"), (snapshot) => {
    globalRecords = []; snapshot.forEach((doc) => globalRecords.push(doc.data())); renderBoard(); 
});