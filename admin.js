import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyBo5iMRonG0rFu6ZuIBJFXzwnWF9xiAKgQ", authDomain: "awaken-c5fca.firebaseapp.com", projectId: "awaken-c5fca", storageBucket: "awaken-c5fca.firebasestorage.app" };
const app = initializeApp(firebaseConfig); const db = getFirestore(app);
const urlParams = new URLSearchParams(window.location.search); const currentStation = parseInt(urlParams.get('station')) || 1; 

let sysSettings = null, currentConf = null, isOccupied = false, currentSessionLikes = 0;

// 更新按讚 UI
function updateLikeBtnUI() {
    const btn = document.getElementById('instantLikeBtn');
    if(!sysSettings) return;
    const max = sysSettings.maxLikes || 3;
    btn.innerHTML = `送出 👍<br><small>(${currentSessionLikes}/${max})</small>`;
    btn.disabled = (!isOccupied || currentSessionLikes >= max);
    btn.style.background = (btn.disabled) ? "#bdc3c7" : "#f1c40f";
}

const statusBtn = document.getElementById('statusToggleBtn');
statusBtn.addEventListener('click', async () => {
    isOccupied = !isOccupied;
    let newStatus = { ...sysSettings.stationStatus };
    newStatus[currentStation] = isOccupied ? 'red' : 'green';
    statusBtn.innerText = "更新中...";
    if (isOccupied) currentSessionLikes = 0; // 開啟闖關時歸零
    await updateDoc(doc(db, "settings", "global"), { stationStatus: newStatus });
});

// 按讚邏輯 (暫存，不立刻寫入資料庫)
document.getElementById('instantLikeBtn').addEventListener('click', () => {
    const max = sysSettings.maxLikes || 3;
    if (!isOccupied) return alert("❌ 請先切換為「🔴 闖關中」！");
    if (currentSessionLikes >= max) return alert("❌ 已達本輪按讚上限！");
    currentSessionLikes++;
    updateLikeBtnUI();
});

onSnapshot(doc(db, "settings", "global"), (docSnap) => {
    if (docSnap.exists()) {
        sysSettings = docSnap.data();
        isOccupied = (sysSettings.stationStatus && sysSettings.stationStatus[currentStation] === 'red');
        statusBtn.className = isOccupied ? "status-btn status-red" : "status-btn status-green";
        statusBtn.innerText = isOccupied ? "🔴 闖關中 (點擊切換為空關)" : "🟢 目前為空關 (點擊切換為闖關中)";
        updateLikeBtnUI();

        const teamSelect = document.getElementById('teamSelect');
        const currentSelected = teamSelect.value; teamSelect.innerHTML = "";
        for (let i = 1; i <= sysSettings.numTeams; i++) teamSelect.innerHTML += `<option value="第${i}隊">第 ${i} 隊</option>`;
        if (currentSelected) teamSelect.value = currentSelected;

        currentConf = sysSettings.stationConfigs[currentStation] || { type: 'time', unit: '' };
        document.getElementById('stationDisplay').innerText = `第 ${currentStation} 關 (${currentConf.type==='time'?'⏱️計時':'🎯計分'})`;
        if (currentConf.type === 'time') {
            document.getElementById('timeInputGroup').style.display = "block"; document.getElementById('scoreInputGroup').style.display = "none";
        } else {
            document.getElementById('timeInputGroup').style.display = "none"; document.getElementById('scoreInputGroup').style.display = "block";
        }
    }
});

// 修改紀錄載入 (顯示 val)
onSnapshot(collection(db, "record"), (snapshot) => {
    let stationRecords = [];
    snapshot.forEach((d) => {
        let r = d.data();
        if(r.station === currentStation && !r.isLikeOnly) stationRecords.push({ id: d.id, ...r });
    });
    stationRecords.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
    const leaderboardDiv = document.getElementById('stationLeaderboard'); leaderboardDiv.innerHTML = "";
    stationRecords.forEach((r) => {
        let display = (currentConf.type === 'time') ? `${Math.floor(r.val/60)}分${r.val%60}秒` : `${r.val}`;
        const item = document.createElement('div'); item.className = 'record-item';
        item.innerHTML = `<span><b>${r.team}</b> (👍x${r.likes||0})<br><small>${display}</small></span><button class="delete-btn" data-id="${r.id}">刪除</button>`;
        leaderboardDiv.appendChild(item);
    });
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', async (e) => {
        if(confirm("確定刪除？")) await deleteDoc(doc(db, "record", e.target.dataset.id));
    }));
});

// 送出成績
document.getElementById('submitBtn').addEventListener('click', async () => {
    if (!isOccupied) return alert("❌ 請先切換為「🔴 闖關中」！");
    const team = document.getElementById('teamSelect').value;
    let finalValue = 0;
    if (currentConf.type === 'time') {
        const min = parseInt(document.getElementById('minInput').value) || 0, sec = parseInt(document.getElementById('secInput').value) || 0;
        if (min > sysSettings.maxMin) return alert(`❌ 超過上限 ${sysSettings.maxMin} 分鐘！`);
        finalValue = (min * 60) + sec;
    } else {
        finalValue = parseInt(document.getElementById('scoreInput').value) || 0;
        if (finalValue > sysSettings.maxScore) return alert(`❌ 超過上限 ${sysSettings.maxScore} 分！`);
    }

    try {
        await addDoc(collection(db, "record"), { 
            station: currentStation, team: team, val: finalValue, likes: currentSessionLikes, createdAt: Date.now() 
        });
        document.getElementById('minInput').value = ""; document.getElementById('secInput').value = ""; document.getElementById('scoreInput').value = "";
        statusBtn.click(); // 自動切換回綠燈
        alert("✅ 送出成功！");
    } catch (e) { alert("錯誤！"); }
});