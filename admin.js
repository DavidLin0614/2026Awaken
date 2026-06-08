import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyBo5iMRonG0rFu6ZuIBJFXzwnWF9xiAKgQ", authDomain: "awaken-c5fca.firebaseapp.com", projectId: "awaken-c5fca", storageBucket: "awaken-c5fca.firebasestorage.app" };
const app = initializeApp(firebaseConfig); const db = getFirestore(app);
const urlParams = new URLSearchParams(window.location.search); const currentStation = parseInt(urlParams.get('station')) || 1;

let sysSettings = { d2_status: {}, d2_configs: {}, numTeams: 15, d2_maxLikes: 3, d2_maxMin: 59, d2_maxScore: 999 };
let currentConf = { type: 'time', unit: '' };
let isOccupied = false, sessionLikes = 0;

const lockOverlay = document.createElement('div');
lockOverlay.style = "display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); color:white; z-index:9999; flex-direction:column; justify-content:center; align-items:center; font-size:2em; font-weight:bold; backdrop-filter:blur(10px);";
lockOverlay.innerHTML = "🔒<br>輸入已鎖定<br><span style='font-size:0.5em; color:#ccc; margin-top:10px;'>等待總控台開放</span>";
document.body.appendChild(lockOverlay);

function updateLikeUI() {
    const btn = document.getElementById('instantLikeBtn');
    const max = sysSettings.d2_maxLikes || 3;
    btn.innerHTML = `送出 👍<br><small>(${sessionLikes}/${max})</small>`;
    btn.disabled = (!isOccupied || sessionLikes >= max);
    btn.style.background = (btn.disabled) ? "#bdc3c7" : "#f1c40f";
}

document.getElementById('statusToggleBtn').addEventListener('click', async () => {
    isOccupied = !isOccupied;
    let newStatus = { ...sysSettings.d2_status };
    newStatus[currentStation] = isOccupied ? 'red' : 'green';
    document.getElementById('statusToggleBtn').innerText = "更新中...";
    if (isOccupied) sessionLikes = 0;
    await updateDoc(doc(db, "settings_global", "global"), { d2_status: newStatus });
});

document.getElementById('instantLikeBtn').addEventListener('click', () => {
    if (!isOccupied) return alert("❌ 請先切換為「🔴 闖關中」！");
    sessionLikes++; updateLikeUI();
});

onSnapshot(doc(db, "settings_global", "global"), (docSnap) => {
    // 🌟 極強防呆：如果文檔存在就覆蓋，不存在就用預設值
    if (docSnap.exists()) sysSettings = { ...sysSettings, ...docSnap.data() };
    
    lockOverlay.style.display = sysSettings.d2_locked ? "flex" : "none";
    isOccupied = (sysSettings.d2_status && sysSettings.d2_status[currentStation] === 'red');
    
    const sBtn = document.getElementById('statusToggleBtn');
    sBtn.className = isOccupied ? "status-btn status-red" : "status-btn status-green";
    sBtn.innerText = isOccupied ? "🔴 闖關中 (點擊切換空關)" : "🟢 目前為空關 (點擊開始)";
    updateLikeUI();

    const tSelect = document.getElementById('teamSelect');
    const currSel = tSelect.value; tSelect.innerHTML = "";
    for (let i = 1; i <= (sysSettings.numTeams || 15); i++) tSelect.innerHTML += `<option value="第${i}隊">第 ${i} 隊</option>`;
    if (currSel) tSelect.value = currSel;

    currentConf = (sysSettings.d2_configs && sysSettings.d2_configs[currentStation]) ? sysSettings.d2_configs[currentStation] : { type: 'time', unit: '' };
    document.getElementById('stationDisplay').innerText = `第 ${currentStation} 關 (${currentConf.type==='time'?'⏱️計時':'🎯計分'})`;
    
    if (currentConf.type === 'time') {
        document.getElementById('timeInputGroup').style.display = "block"; document.getElementById('scoreInputGroup').style.display = "none";
    } else {
        document.getElementById('timeInputGroup').style.display = "none"; document.getElementById('scoreInputGroup').style.display = "block";
        document.getElementById('scoreLabel').innerText = `獲得數值 (單位: ${currentConf.unit||''}):`;
    }
});

onSnapshot(collection(db, "records_d2"), (snapshot) => {
    const board = document.getElementById('stationLeaderboard'); board.innerHTML = "";
    let records = []; snapshot.forEach(d => records.push({ id: d.id, ...d.data() }));

    let stRecs = records.filter(r => r.station === currentStation && !r.isLikeOnly).sort((a, b) => b.createdAt - a.createdAt);
    if (stRecs.length === 0) { board.innerHTML = "<p style='color:#888;'>尚無成績</p>"; return; }

    stRecs.forEach(r => {
        let display = (currentConf && currentConf.type === 'time') ? `${Math.floor(r.val / 60)}分${r.val % 60}秒` : `${r.val}`;
        const item = document.createElement('div'); item.className = 'record-item';
        item.innerHTML = `<span><b>${r.team}</b> (👍x${r.likes||0})<br><small style="color:#aaa;">${display}</small></span><button class="delete-btn" data-id="${r.id}">刪除</button>`;
        board.appendChild(item);
    });
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', async (e) => {
        if (confirm("刪除？")) await deleteDoc(doc(db, "records_d2", e.target.getAttribute('data-id')));
    }));
});

document.getElementById('minInput').addEventListener('input', function () {
    let max = sysSettings.d2_maxMin || 59; if (parseInt(this.value) > max) this.value = max;
});
document.getElementById('scoreInput').addEventListener('input', function () {
    let max = sysSettings.d2_maxScore || 999; if (parseInt(this.value) > max) this.value = max;
});

document.getElementById('submitBtn').addEventListener('click', async () => {
    if (!isOccupied) return alert("❌ 請切換為「🔴 闖關中」才能送出成績！");
    const team = document.getElementById('teamSelect').value;
    let val = 0;
    
    if (currentConf.type === 'time') {
        const min = parseInt(document.getElementById('minInput').value) || 0, sec = parseInt(document.getElementById('secInput').value) || 0;
        if (min === 0 && sec === 0) return alert("請輸入時間！");
        val = (min * 60) + sec;
    } else {
        val = parseInt(document.getElementById('scoreInput').value);
        if (isNaN(val)) return alert("請輸入數值！");
    }

    try {
        document.getElementById('submitBtn').disabled = true;
        await addDoc(collection(db, "records_d2"), { station: currentStation, team, val, likes: sessionLikes, createdAt: Date.now() });
        document.getElementById('minInput').value = ""; document.getElementById('secInput').value = ""; document.getElementById('scoreInput').value = "";
        document.getElementById('statusToggleBtn').click(); 
        alert("✅ 送出成功！");
    } catch (error) { alert("發生錯誤"); }
    document.getElementById('submitBtn').disabled = false;
});