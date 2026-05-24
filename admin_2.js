import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = { /* 你的 config */ };
const app = initializeApp(firebaseConfig); const db = getFirestore(app);
const urlParams = new URLSearchParams(window.location.search); const currentStation = parseInt(urlParams.get('station')) || 1; 

let sysSettings = null, currentRound = 1, likesA = 0, likesB = 0;

window.changeRound = (val) => {
    currentRound += val; if(currentRound < 1) currentRound = 1;
    updateUIForRound();
};

function updateUIForRound() {
    document.getElementById('roundText').innerText = `第 ${currentRound} 輪`;
    likesA = 0; likesB = 0; // 🌟 換輪次按讚重置
    updateLikeCounts();
    if(sysSettings && sysSettings.schedule && sysSettings.schedule[currentRound] && sysSettings.schedule[currentRound][currentStation]) {
        const m = sysSettings.schedule[currentRound][currentStation];
        document.getElementById('teamASelect').value = m.a;
        document.getElementById('teamBSelect').value = m.b;
        updateWinnerSelect();
    }
}

function updateLikeCounts() {
    document.getElementById('lA').innerText = likesA;
    document.getElementById('lB').innerText = likesB;
}

function updateWinnerSelect() {
    const a = document.getElementById('teamASelect').value, b = document.getElementById('teamBSelect').value;
    document.getElementById('winnerSelect').innerHTML = `<option value="${a}">${a}</option><option value="${b}">${b}</option>`;
}

document.getElementById('teamASelect').addEventListener('change', updateWinnerSelect);
document.getElementById('teamBSelect').addEventListener('change', updateWinnerSelect);
document.getElementById('likeA').addEventListener('click', () => { if(likesA < 3) { likesA++; updateLikeCounts(); } });
document.getElementById('likeB').addEventListener('click', () => { if(likesB < 3) { likesB++; updateLikeCounts(); } });

onSnapshot(doc(db, "settings_2", "global"), (docSnap) => {
    if (docSnap.exists()) {
        sysSettings = docSnap.data();
        document.getElementById('stationDisplay').innerText = `第 ${currentStation} 關`;
        const tA = document.getElementById('teamASelect'), tB = document.getElementById('teamBSelect');
        tA.innerHTML = ""; tB.innerHTML = "";
        for (let i = 1; i <= sysSettings.numTeams; i++) {
            let opt = `<option value="第${i}隊">第 ${i} 隊</option>`;
            tA.innerHTML += opt; tB.innerHTML += opt;
        }
        updateUIForRound();
    }
});

onSnapshot(collection(db, "record_2"), (snapshot) => {
    let records = [];
    snapshot.forEach(d => { if(d.data().station === currentStation) records.push({id: d.id, ...d.data()}); });
    records.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
    const board = document.getElementById('stationLeaderboard'); board.innerHTML = "";
    records.forEach(r => {
        const item = document.createElement('div'); item.className = 'record-item';
        item.style = "background:#eee; padding:10px; margin-bottom:5px; border-radius:5px; display:flex; justify-content:space-between;";
        item.innerHTML = `<span>輪${r.round}: <b>${r.winner} 勝</b> (vs ${r.loser}) <small>👍A:${r.likesA} B:${r.likesB}</small></span><button onclick="window.del('${r.id}')">刪</button>`;
        board.appendChild(item);
    });
});

window.del = async (id) => { if(confirm("刪除？")) await deleteDoc(doc(db, "record_2", id)); };

document.getElementById('submitBtn').addEventListener('click', async () => {
    const teamA = document.getElementById('teamASelect').value, teamB = document.getElementById('teamBSelect').value;
    const winner = document.getElementById('winnerSelect').value;
    const loser = (winner === teamA) ? teamB : teamA;
    try {
        await addDoc(collection(db, "record_2"), { 
            station: currentStation, round: currentRound, teamA, teamB, winner, loser, likesA, likesB, createdAt: Date.now() 
        });
        alert("✅ 送出成功！自動跳轉下一輪");
        changeRound(1); // 🌟 自動跳下一輪
    } catch (e) { alert("錯誤！"); }
});