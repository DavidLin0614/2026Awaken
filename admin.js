import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyBo5iMRonG0rFu6ZuIBJFXzwnWF9xiAKgQ", authDomain: "awaken-c5fca.firebaseapp.com", projectId: "awaken-c5fca", storageBucket: "awaken-c5fca.firebasestorage.app" };
const app = initializeApp(firebaseConfig); const db = getFirestore(app);
const urlParams = new URLSearchParams(window.location.search); const currentStation = parseInt(urlParams.get('station')) || 1; 

const lockOverlay = document.createElement('div');
lockOverlay.style = "display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); color:white; z-index:9999; flex-direction:column; justify-content:center; align-items:center; font-size:2em; font-weight:bold; text-align:center; backdrop-filter:blur(10px);";
lockOverlay.innerHTML = "🔒<br>關卡已關閉輸入<br><span style='font-size:0.5em; color:#ccc; margin-top:10px;'>目前正在進行總結算</span>";
document.body.appendChild(lockOverlay);

let sysSettings = null, currentConf = null, isOccupied = false, sessionLikes = 0;
function getVal(r) { return r.recordValue !== undefined ? r.recordValue : r.time_seconds; }

function updateLikeBtnUI() {
    const btn = document.getElementById('instantLikeBtn');
    if(!sysSettings) return;
    const max = sysSettings.maxLikes || 3;
    btn.innerHTML = `送出 👍<br><small>(${sessionLikes}/${max})</small>`;
    if (!isOccupied || sessionLikes >= max) {
        btn.disabled = true; btn.style.background = "#bdc3c7";
    } else {
        btn.disabled = false; btn.style.background = "#f1c40f"; btn.style.color = "#333";
    }
}

const statusBtn = document.getElementById('statusToggleBtn');
statusBtn.addEventListener('click', async () => {
    isOccupied = !isOccupied;
    let newStatus = { ...sysSettings.stationStatus };
    newStatus[currentStation] = isOccupied ? 'red' : 'green';
    statusBtn.innerText = "更新中...";
    if (isOccupied) sessionLikes = 0; 
    await updateDoc(doc(db, "settings", "global"), { stationStatus: newStatus });
});

document.getElementById('instantLikeBtn').addEventListener('click', async () => {
    if (!isOccupied) return alert("❌ 請先切換為「闖關中」才能給讚！");
    const max = sysSettings.maxLikes || 3;
    if (sessionLikes >= max) return alert("❌ 已達本關按讚上限！");

    const team = document.getElementById('teamSelect').value;
    const now = new Date(), nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const btn = document.getElementById('instantLikeBtn');

    try {
        btn.innerHTML = "傳送中...<br><small>請稍候</small>"; btn.disabled = true;
        // 🌟 加入 createdAt: Date.now() 確保精準排序
        await addDoc(collection(db, "record"), { station: currentStation, team: team, likes: 1, isLikeOnly: true, timestamp: nowTime, createdAt: Date.now() });
        sessionLikes++; 
        btn.innerHTML = `✅ 成功！<br><small>給予 ${team}</small>`;
        btn.style.background = "#2ecc71"; btn.style.color = "white";
        setTimeout(() => { updateLikeBtnUI(); }, 1200);
    } catch (error) { alert("發生錯誤！"); updateLikeBtnUI(); }
});

onSnapshot(doc(db, "settings", "global"), (docSnap) => {
    if (docSnap.exists()) {
        sysSettings = docSnap.data();

        // 🌟 核心：根據資料庫的 isLocked 狀態切換顯示
        lockOverlay.style.display = sysSettings.isLocked ? "flex" : "none";
        
        isOccupied = (sysSettings.stationStatus && sysSettings.stationStatus[currentStation] === 'red');
        if(isOccupied) {
            statusBtn.className = "status-btn status-red"; statusBtn.innerText = "🔴 闖關中 (點擊切換為空關)";
        } else {
            statusBtn.className = "status-btn status-green"; statusBtn.innerText = "🟢 目前為空關 (點擊切換為闖關中)";
        }
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
            document.getElementById('timeInputGroup').style.display = "none"; document.getElementById('scoreInputGroup').style.display = "block"; document.getElementById('scoreLabel').innerText = `獲得數值 (單位: ${currentConf.unit})：`;
        }
    }
});

// 🌟 重新撰寫的紀錄載入與排序邏輯
onSnapshot(collection(db, "record"), (snapshot) => {
    const allRecords =[]; 
    snapshot.forEach((d) => allRecords.push({ id: d.id, ...d.data() }));
    
    let stationRecords = allRecords.filter(r => r.station === currentStation && !r.isLikeOnly);
    
    // 🌟 嚴格依照時間排序：越晚建立的排在越上面 (數字越大越上面)
    stationRecords.sort((a, b) => {
        let timeA = a.createdAt || 0;
        let timeB = b.createdAt || 0;
        if (timeA !== timeB) return timeB - timeA;
        return (b.timestamp || "").localeCompare(a.timestamp || ""); // 如果沒有 createdAt，備用字串比較
    });

    const leaderboardDiv = document.getElementById('stationLeaderboard'); 
    leaderboardDiv.innerHTML = ""; 
    
    if(stationRecords.length === 0) { 
        leaderboardDiv.innerHTML = "<p style='color: #888;'>目前尚無成績</p>"; return; 
    }
    
    let conf = currentConf || { type: 'time', unit: '' }; // 防呆設定
    
    stationRecords.forEach((r) => {
        let val = getVal(r); let display = (conf.type === 'time') ? `${Math.floor(val/60)}分${val%60}秒` : `${val} ${conf.unit}`;
        const item = document.createElement('div'); item.className = 'record-item';
        item.innerHTML = `<span><b>${r.team}</b><br><small style="color:#555;">(${display})</small></span><button class="delete-btn" data-id="${r.id}">刪除</button>`;
        leaderboardDiv.appendChild(item);
    });

    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', async (e) => {
        if(confirm("確定要刪除這筆成績嗎？")) await deleteDoc(doc(db, "record", e.target.getAttribute('data-id')));
    }));
});

document.getElementById('submitBtn').addEventListener('click', async () => {
    if (!isOccupied) return alert("❌ 請先點擊上方按鈕切換為「🔴 闖關中」，才能送出成績！");

    const team = document.getElementById('teamSelect').value;
    let finalValue = 0; let isTime = (currentConf && currentConf.type === 'time');

    if (isTime) {
        const min = parseInt(document.getElementById('minInput').value) || 0, sec = parseInt(document.getElementById('secInput').value) || 0;
        if (min === 0 && sec === 0) return alert("請輸入花費時間！");
        if (sec > 59) return alert("❌ 秒數不能超過 59 秒！");
        if (min > (sysSettings?sysSettings.maxMin:59)) return alert(`❌ 分鐘數超過上限！`);
        finalValue = (min * 60) + sec;
    } else {
        const score = parseInt(document.getElementById('scoreInput').value);
        if (isNaN(score)) return alert("請輸入數值！");
        finalValue = score;
    }

    const now = new Date(); const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    try {
        document.getElementById('submitBtn').innerHTML = "傳送中...<br><small>請稍候</small>"; document.getElementById('submitBtn').disabled = true;
        // 🌟 加入 createdAt
        await addDoc(collection(db, "record"), { station: currentStation, team: team, recordValue: finalValue, time_seconds: finalValue, timestamp: nowTime, createdAt: Date.now() });
        
        document.getElementById('minInput').value = ""; document.getElementById('secInput').value = ""; document.getElementById('scoreInput').value = "";
        document.getElementById('statusToggleBtn').click(); 

        document.getElementById('submitBtn').innerHTML = "送出成績<br>🚀"; document.getElementById('submitBtn').disabled = false;
    } catch (error) { 
        alert("發生錯誤！"); 
        document.getElementById('submitBtn').innerHTML = "送出成績<br>🚀"; document.getElementById('submitBtn').disabled = false; 
    }
});