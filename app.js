import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyBo5iMRonG0rFu6ZuIBJFXzwnWF9xiAKgQ", authDomain: "awaken-c5fca.firebaseapp.com", projectId: "awaken-c5fca", storageBucket: "awaken-c5fca.firebasestorage.app" };
const app = initializeApp(firebaseConfig); const db = getFirestore(app);

let globalRecords =[]; 
let sysSettings = { numStations: 15, stationConfigs: {}, hideMain: false, maxMin: 59, maxScore: 999, stationStatus: {} };

function formatTime(totalSeconds) { 
    const m = Math.floor(totalSeconds / 60); 
    const s = totalSeconds % 60; 
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; 
}
function getVal(r) { return r.recordValue !== undefined ? r.recordValue : r.time_seconds; }

const hideOverlay = document.createElement('div');
hideOverlay.id = "hideOverlay"; 
hideOverlay.innerHTML = "🏆<br>營會成績結算中<br><span>敬請期待最高榮耀</span>";
document.body.appendChild(hideOverlay);

function renderBoard() {
    const board = document.getElementById("board"); 
    board.innerHTML = ""; 
    
    // 預設所有隊伍讚數為 0
    let teamLikes = {}; 
    for(let i=1; i<=sysSettings.numTeams; i++) teamLikes[`第${i}隊`] = 0;

    globalRecords.forEach(r => {
        if(!r.isNPC && r.likes > 0) { teamLikes[r.team] += r.likes; }
    });

    for (let i = 1; i <= sysSettings.numStations; i++) {
        // 🌟 排除掉「純按讚」的紀錄，避免破壞時間成績邏輯
        let stationRecords = globalRecords.filter(r => r.station === i && !r.isLikeOnly);
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
        
        let uniqueRecords = Object.values(teamBest).sort((a, b) => isTime ? (getVal(a) - getVal(b)) : (getVal(b) - getVal(a)));
        let topHtml =[];
        for(let j = 0; j < 3; j++) {
            if(uniqueRecords[j]) {
                let val = getVal(uniqueRecords[j]);
                topHtml.push(`${uniqueRecords[j].team} (${isTime ? formatTime(val) : `${val} ${conf.unit}`})`);
            } else topHtml.push("尚未產生");
        }

        let statusDot = (sysSettings.stationStatus && sysSettings.stationStatus[i] === 'red') ? '🔴' : '🟢';

        board.innerHTML += `
            <div class="station-card">
                <div class="station-title">${statusDot} 第 ${i} 關</div>
                <p>🥇 ${topHtml[0]}</p><p>🥈 ${topHtml[1]}</p><p>🥉 ${topHtml[2]}</p>
            </div>
        `;
    }

    // 🌟 產出按讚框框，每 4 隊一個框框，沒有標題
    let teamNames = Object.keys(teamLikes).sort((a, b) => parseInt(a.replace(/[^0-9]/g, '')) - parseInt(b.replace(/[^0-9]/g, '')));
    let chunkedTeams =[];
    for (let i = 0; i < teamNames.length; i += 4) chunkedTeams.push(teamNames.slice(i, i + 4));

    chunkedTeams.forEach(chunk => {
        let likesHtml = chunk.map(t => `<p style="margin: 8px 0; color:#f1c40f; font-weight:bold; text-shadow:1px 1px 2px #000; font-size:1.15em;">${t}：👍 x ${teamLikes[t]}</p>`).join('');
        board.innerHTML += `
            <div class="station-card" style="border-color:#f1c40f; justify-content: center;">
                <div>${likesHtml}</div>
            </div>
        `;
    });
}

onSnapshot(doc(db, "settings", "global"), (docSnap) => {
    if (docSnap.exists()) { 
        sysSettings = { ...sysSettings, ...docSnap.data() }; 
        hideOverlay.style.display = sysSettings.hideMain ? "flex" : "none"; 
        renderBoard(); 
    }
});

onSnapshot(collection(db, "record"), (snapshot) => {
    globalRecords =[]; 
    snapshot.forEach((doc) => globalRecords.push(doc.data())); 
    renderBoard(); 
});