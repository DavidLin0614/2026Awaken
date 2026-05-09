import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBo5iMRonG0rFu6ZuIBJFXzwnWF9xiAKgQ", authDomain: "awaken-c5fca.firebaseapp.com", projectId: "awaken-c5fca", storageBucket: "awaken-c5fca.firebasestorage.app"
};
const app = initializeApp(firebaseConfig); const db = getFirestore(app);

let globalRecords =[];
let sysSettings = { numStations: 15, stationConfigs: {}, hideMain: false, maxMin: 59, maxScore: 999, stationStatus: {} };

function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60); const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
function getVal(r) { return r.recordValue !== undefined ? r.recordValue : r.time_seconds; }

const hideOverlay = document.createElement('div');
hideOverlay.id = "hideOverlay"; hideOverlay.innerHTML = "🏆<br>營會成績結算中<br><span>敬請期待最高榮耀</span>";
document.body.appendChild(hideOverlay);

function renderBoard() {
    const board = document.getElementById("board"); board.innerHTML = ""; 
    let teamLikes = {}; // 計算各隊總讚數

    for (let i = 1; i <= sysSettings.numStations; i++) {
        let stationRecords = globalRecords.filter(r => r.station === i);
        let conf = sysSettings.stationConfigs[i] || { type: 'time', unit: '' };
        let isTime = conf.type === 'time';
        let maxVal = isTime ? ((sysSettings.maxMin * 60) + 59) : sysSettings.maxScore;

        let teamBest = {};
        stationRecords.forEach(r => {
            // 順便統計讚數
            if(!r.isNPC && r.likes > 0) { teamLikes[r.team] = (teamLikes[r.team] || 0) + r.likes; }

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

        // 判斷紅綠燈
        let statusDot = (sysSettings.stationStatus && sysSettings.stationStatus[i] === 'red') ? '🔴' : '🟢';

        board.innerHTML += `
            <div class="station-card">
                <div class="station-title">${statusDot} 第 ${i} 關</div>
                <p>🥇 ${topHtml[0]}</p><p>🥈 ${topHtml[1]}</p><p>🥉 ${topHtml[2]}</p>
            </div>
        `;
    }

    // 🏆 新增：營會讚美大賞區塊
    let likesArr = Object.keys(teamLikes).map(t => ({ team: t, likes: teamLikes[t] })).sort((a,b) => b.likes - a.likes);
    if(likesArr.length > 0) {
        let likesHtml = likesArr.map(item => `<p style="margin:5px 0;">${item.team}：👍 x ${item.likes}</p>`).join('');
        board.innerHTML += `
            <div class="station-card" style="border-color:#1abc9c; background:rgba(26, 188, 156, 0.2);">
                <div class="station-title" style="color:#1abc9c;">🌟 態度讚美榜 🌟</div>
                <div style="max-height:120px; overflow-y:auto; font-size:0.9em;">${likesHtml}</div>
            </div>
        `;
    }
}

onSnapshot(doc(db, "settings", "global"), (docSnap) => {
    if (docSnap.exists()) { sysSettings = { ...sysSettings, ...docSnap.data() }; hideOverlay.style.display = sysSettings.hideMain ? "flex" : "none"; renderBoard(); }
});
onSnapshot(collection(db, "record"), (snapshot) => {
    globalRecords =[]; snapshot.forEach((doc) => globalRecords.push(doc.data())); renderBoard(); 
});