import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
let sysSettings = { numStations: 15, stationConfigs: {}, hideMain: false, maxMin: 59, maxScore: 999 };

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

    for (let i = 1; i <= sysSettings.numStations; i++) {
        let stationRecords = globalRecords.filter(r => r.station === i);
        let conf = sysSettings.stationConfigs[i] || { type: 'time', unit: '' };
        let isTime = conf.type === 'time';
        
        // 🌟 核心防呆極限值設定
        let maxVal = isTime ? ((sysSettings.maxMin * 60) + 59) : sysSettings.maxScore;

        let teamBest = {};
        stationRecords.forEach(r => {
            let val = getVal(r);
            // 🌟 防呆：如果數值大於極限值，或是小於0的錯誤資料，直接無視它！
            if (val > maxVal || val < 0) return;

            if (!teamBest[r.team]) teamBest[r.team] = r;
            else {
                let currBest = getVal(teamBest[r.team]);
                if (isTime ? val < currBest : val > currBest) teamBest[r.team] = r;
            }
        });
        
        let uniqueRecords = Object.values(teamBest);
        uniqueRecords.sort((a, b) => isTime ? (getVal(a) - getVal(b)) : (getVal(b) - getVal(a)));

        let topHtml =[];
        for(let j = 0; j < 3; j++) {
            if(uniqueRecords[j]) {
                let val = getVal(uniqueRecords[j]);
                let display = isTime ? formatTime(val) : `${val} ${conf.unit}`;
                topHtml.push(`${uniqueRecords[j].team} (${display})`);
            } else {
                topHtml.push("尚未產生");
            }
        }

        board.innerHTML += `
            <div class="station-card">
                <div class="station-title">第 ${i} 關</div>
                <p>🥇 ${topHtml[0]}</p>
                <p>🥈 ${topHtml[1]}</p>
                <p>🥉 ${topHtml[2]}</p>
            </div>
        `;
    }
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