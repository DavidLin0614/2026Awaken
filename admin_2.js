import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyBo5iMRonG0rFu6ZuIBJFXzwnWF9xiAKgQ", authDomain: "awaken-c5fca.firebaseapp.com", projectId: "awaken-c5fca", storageBucket: "awaken-c5fca.firebasestorage.app" };
const app = initializeApp(firebaseConfig); const db = getFirestore(app);
const urlParams = new URLSearchParams(window.location.search); const currentStation = parseInt(urlParams.get('station')) || 1;

let sysSettings = null, isOccupied = false;
let currentRound = 1, likesA = 0, likesB = 0;

// 🔒 鎖定遮罩
const lockOverlay = document.createElement('div');
lockOverlay.style = "display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); color:white; z-index:9999; flex-direction:column; justify-content:center; align-items:center; font-size:2em; font-weight:bold; backdrop-filter:blur(10px);";
lockOverlay.innerHTML = "🔒<br>輸入已鎖定<br><span style='font-size:0.5em; color:#ccc; margin-top:10px;'>等待總控台開放</span>";
document.body.appendChild(lockOverlay);

// 更新輪次與賽程
function updateRoundUI() {
    document.getElementById('roundText').innerText = `第 ${currentRound} 輪`;
    likesA = 0; likesB = 0; updateLikeUI(); // 換輪次清空讚數

    if (sysSettings && sysSettings.schedule && sysSettings.schedule[currentRound] && sysSettings.schedule[currentRound][currentStation]) {
        const m = sysSettings.schedule[currentRound][currentStation];
        document.getElementById('teamASelect').value = m.a;
        document.getElementById('teamBSelect').value = m.b;
    }
    updateWinnerSelect();
}

// 更新按讚UI與防呆限制
function updateLikeUI() {
    // 🌟 正確抓取 d3_maxLikes
    const max = (sysSettings && sysSettings.d3_maxLikes) ? sysSettings.d3_maxLikes : 3;
    let totalGiven = likesA + likesB;

    document.getElementById('cntA').innerText = `${likesA}`;
    document.getElementById('cntB').innerText = `${likesB}`;
    document.getElementById('totalLikesDisplay').innerText = `${totalGiven} / ${max}`;

    // 超過總和就鎖住
    document.getElementById('likeBtnA').disabled = (!isOccupied || totalGiven >= max);
    document.getElementById('likeBtnB').disabled = (!isOccupied || totalGiven >= max);
}

document.getElementById('prevRoundBtn').addEventListener('click', () => { if (currentRound > 1) { currentRound--; updateRoundUI(); } });
document.getElementById('nextRoundBtn').addEventListener('click', () => { currentRound++; updateRoundUI(); });

// --- 替換這一段 ---
document.getElementById('likeBtnA').addEventListener('click', () => {
    if (!isOccupied) return alert("請切換為🔴闖關中");
    const max = (sysSettings && sysSettings.d3_maxLikes) ? sysSettings.d3_maxLikes : 3;
    if (likesA + likesB < max) {
        likesA++; updateLikeUI();
    } else {
        alert(`❌ 兩隊相加最多只能給 ${max} 個讚！`);
    }
});

document.getElementById('likeBtnB').addEventListener('click', () => {
    if (!isOccupied) return alert("請切換為🔴闖關中");
    const max = (sysSettings && sysSettings.d3_maxLikes) ? sysSettings.d3_maxLikes : 3;
    if (likesA + likesB < max) {
        likesB++; updateLikeUI();
    } else {
        alert(`❌ 兩隊相加最多只能給 ${max} 個讚！`);
    }
});
// --- 替換到這裡 ---

function updateWinnerSelect() {
    const a = document.getElementById('teamASelect').value, b = document.getElementById('teamBSelect').value;
    document.getElementById('winnerSelect').innerHTML = `<option value="${a}">${a}</option><option value="${b}">${b}</option>`;
}
document.getElementById('teamASelect').addEventListener('change', updateWinnerSelect);
document.getElementById('teamBSelect').addEventListener('change', updateWinnerSelect);

// 燈號控制
const statusBtn = document.getElementById('statusToggleBtn');
statusBtn.addEventListener('click', async () => {
    isOccupied = !isOccupied;
    let newStatus = { ...sysSettings.d3_status };
    newStatus[currentStation] = isOccupied ? 'red' : 'green';
    statusBtn.innerText = "更新中...";
    if (isOccupied) { likesA = 0; likesB = 0; } // 切換紅燈清空
    await updateDoc(doc(db, "settings_global", "global"), { d3_status: newStatus });
});

onSnapshot(doc(db, "settings_global", "global"), (docSnap) => {
    if (docSnap.exists()) {
        sysSettings = docSnap.data();
        lockOverlay.style.display = sysSettings.d3_locked ? "flex" : "none";

        isOccupied = (sysSettings.d3_status && sysSettings.d3_status[currentStation] === 'red');
        statusBtn.className = isOccupied ? "status-btn status-red" : "status-btn status-green";
        statusBtn.innerText = isOccupied ? "🔴 闖關中 (點擊切換空關)" : "🟢 目前為空關 (點擊開始)";
        updateLikeUI();

        document.getElementById('stationDisplay').innerText = `第 ${currentStation} 關 (⚔️ PK對抗)`;
        const tA = document.getElementById('teamASelect'), tB = document.getElementById('teamBSelect');
        if (tA.options.length === 0) {
            for (let i = 1; i <= (sysSettings.numTeams || 15); i++) {
                let opt = `<option value="第${i}隊">第 ${i} 隊</option>`;
                tA.innerHTML += opt; tB.innerHTML += opt;
            }
            updateRoundUI(); // 初次載入
        }
    }
});

onSnapshot(collection(db, "records_d3"), (snapshot) => {
    const board = document.getElementById('stationLeaderboard'); board.innerHTML = "";
    let records = []; snapshot.forEach(d => records.push({ id: d.id, ...d.data() }));

    let stRecs = records.filter(r => r.station === currentStation).sort((a, b) => b.createdAt - a.createdAt);
    if (stRecs.length === 0) { board.innerHTML = "<p style='color:#888;'>尚無成績</p>"; return; }

    stRecs.forEach(r => {
        const item = document.createElement('div'); item.className = 'record-item';
        item.innerHTML = `<span>[輪${r.round}] <b>${r.winner} 勝</b><br><small style="color:#aaa;">(👍${r.likesA} vs 👍${r.likesB})</small></span><button class="btn btn-danger" style="padding:5px;" data-id="${r.id}">刪除</button>`;
        board.appendChild(item);
    });
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', async (e) => {
        if (confirm("刪除？")) await deleteDoc(doc(db, "records_d3", e.target.getAttribute('data-id')));
    }));
});

document.getElementById('submitBtn').addEventListener('click', async () => {
    if (!isOccupied) return alert("❌ 請切換為「🔴 闖關中」才能送出！");
    const teamA = document.getElementById('teamASelect').value, teamB = document.getElementById('teamBSelect').value;
    if (teamA === teamB) return alert("❌ 隊伍不能相同！");
    const winner = document.getElementById('winnerSelect').value;

    try {
        document.getElementById('submitBtn').disabled = true;
        await addDoc(collection(db, "records_d3"), {
            station: currentStation, round: currentRound, teamA, teamB, winner,
            loser: (winner === teamA ? teamB : teamA),
            likesA, likesB, createdAt: Date.now()
        });
        statusBtn.click(); // 自動切換為綠燈
        alert("✅ 送出成功！即將自動跳至下一輪");
        currentRound++; updateRoundUI(); // 自動跳轉下一輪
    } catch (error) { alert("發生錯誤"); }
    document.getElementById('submitBtn').disabled = false;
});