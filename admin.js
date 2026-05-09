import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBo5iMRonG0rFu6ZuIBJFXzwnWF9xiAKgQ", authDomain: "awaken-c5fca.firebaseapp.com", projectId: "awaken-c5fca", storageBucket: "awaken-c5fca.firebasestorage.app"
};
const app = initializeApp(firebaseConfig); const db = getFirestore(app);
const urlParams = new URLSearchParams(window.location.search); const currentStation = parseInt(urlParams.get('station')) || 1; 

let sysSettings = null, currentConf = null, currentLikes = 0, isOccupied = false;
function getVal(r) { return r.recordValue !== undefined ? r.recordValue : r.time_seconds; }

// 處理狀態按鈕切換
const statusBtn = document.getElementById('statusToggleBtn');
statusBtn.addEventListener('click', async () => {
    isOccupied = !isOccupied;
    let newStatus = { ...sysSettings.stationStatus };
    newStatus[currentStation] = isOccupied ? 'red' : 'green';
    statusBtn.innerText = "更新中...";
    await updateDoc(doc(db, "settings", "global"), { stationStatus: newStatus });
});

// 處理給讚按鈕
document.getElementById('btnPlusLike').addEventListener('click', () => {
    if(currentLikes < (sysSettings.maxLikes || 3)) { currentLikes++; document.getElementById('likeCount').innerText = currentLikes; }
});
document.getElementById('btnMinusLike').addEventListener('click', () => {
    if(currentLikes > 0) { currentLikes--; document.getElementById('likeCount').innerText = currentLikes; }
});

onSnapshot(doc(db, "settings", "global"), (docSnap) => {
    if (docSnap.exists()) {
        sysSettings = docSnap.data();
        
        // 更新空關狀態按鈕
        isOccupied = (sysSettings.stationStatus && sysSettings.stationStatus[currentStation] === 'red');
        if(isOccupied) {
            statusBtn.className = "status-btn status-red"; statusBtn.innerText = "🔴 闖關中 (點擊切換為空關)";
        } else {
            statusBtn.className = "status-btn status-green"; statusBtn.innerText = "🟢 目前為空關 (點擊切換為闖關中)";
        }

        const teamSelect = document.getElementById('teamSelect'); const currentSelected = teamSelect.value; teamSelect.innerHTML = "";
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

onSnapshot(collection(db, "record"), (snapshot) => {
    if (!currentConf) return; const allRecords =[]; snapshot.forEach((d) => allRecords.push({ id: d.id, ...d.data() }));
    let stationRecords = allRecords.filter(r => r.station === currentStation);
    const leaderboardDiv = document.getElementById('stationLeaderboard'); leaderboardDiv.innerHTML = ""; 
    
    if(stationRecords.length === 0) { leaderboardDiv.innerHTML = "<p style='color: #888;'>目前尚無成績</p>"; return; }
    
    // 列出所有紀錄 (最新的在上面)
    stationRecords.reverse().forEach((r) => {
        let val = getVal(r); let display = (currentConf.type === 'time') ? `${Math.floor(val/60)}分${val%60}秒` : `${val} ${currentConf.unit}`;
        let likesHtml = r.likes > 0 ? ` <span style="color:#e67e22;font-size:0.8em;">(👍x${r.likes})</span>` : "";
        
        const item = document.createElement('div'); item.className = 'record-item';
        item.innerHTML = `<span><b>${r.team}</b> ${likesHtml}<br><small style="color:#555;">(${display})</small></span><button class="delete-btn" data-id="${r.id}">刪除</button>`;
        leaderboardDiv.appendChild(item);
    });

    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', async (e) => {
        if(confirm("確定要刪除這筆成績嗎？")) await deleteDoc(doc(db, "record", e.target.getAttribute('data-id')));
    }));
});

document.getElementById('submitBtn').addEventListener('click', async () => {
    const team = document.getElementById('teamSelect').value;
    let finalValue = 0; let isTime = currentConf.type === 'time';

    if (isTime) {
        const min = parseInt(document.getElementById('minInput').value) || 0, sec = parseInt(document.getElementById('secInput').value) || 0;
        if (min === 0 && sec === 0) return alert("請輸入花費時間！");
        if (sec > 59) return alert("❌ 秒數不能超過 59 秒！");
        if (min > sysSettings.maxMin) return alert(`❌ 分鐘數不能超過 ${sysSettings.maxMin}！`);
        finalValue = (min * 60) + sec;
    } else {
        const score = parseInt(document.getElementById('scoreInput').value);
        if (isNaN(score)) return alert("請輸入數值！");
        if (score > sysSettings.maxScore) return alert(`❌ 數值不能超過 ${sysSettings.maxScore}！`);
        finalValue = score;
    }

    const now = new Date(); const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    try {
        document.getElementById('submitBtn').innerText = "傳送中...";
        await addDoc(collection(db, "record"), { station: currentStation, team: team, recordValue: finalValue, time_seconds: finalValue, likes: currentLikes, timestamp: nowTime });
        
        // 送出後清空並切換回綠燈
        document.getElementById('minInput').value = ""; document.getElementById('secInput').value = ""; document.getElementById('scoreInput').value = "";
        currentLikes = 0; document.getElementById('likeCount').innerText = "0";
        if(isOccupied) document.getElementById('statusToggleBtn').click(); // 自動變回空關

        document.getElementById('submitBtn').innerText = "送出成績與讚賞 🚀";
    } catch (error) { alert("發生錯誤！"); document.getElementById('submitBtn').innerText = "送出成績與讚賞 🚀"; }
});