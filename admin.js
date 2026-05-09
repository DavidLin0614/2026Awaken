import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyBo5iMRonG0rFu6ZuIBJFXzwnWF9xiAKgQ", authDomain: "awaken-c5fca.firebaseapp.com", projectId: "awaken-c5fca", storageBucket: "awaken-c5fca.firebasestorage.app" };
const app = initializeApp(firebaseConfig); const db = getFirestore(app);
const urlParams = new URLSearchParams(window.location.search); const currentStation = parseInt(urlParams.get('station')) || 1; 

let sysSettings = null, currentConf = null, isOccupied = false;
function getVal(r) { return r.recordValue !== undefined ? r.recordValue : r.time_seconds; }

const statusBtn = document.getElementById('statusToggleBtn');
statusBtn.addEventListener('click', async () => {
    isOccupied = !isOccupied;
    let newStatus = { ...sysSettings.stationStatus };
    newStatus[currentStation] = isOccupied ? 'red' : 'green';
    statusBtn.innerText = "更新中...";
    await updateDoc(doc(db, "settings", "global"), { stationStatus: newStatus });
});

// 同步選單隊伍名稱到按讚按鈕上
const teamSelect = document.getElementById('teamSelect');
const likeTeamName = document.getElementById('likeTeamName');
teamSelect.addEventListener('change', (e) => { likeTeamName.innerText = e.target.value; });

// 🌟 一鍵送出讚 (獨立紀錄，不影響闖關時間)
document.getElementById('instantLikeBtn').addEventListener('click', async () => {
    const team = teamSelect.value;
    const now = new Date(); const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const btn = document.getElementById('instantLikeBtn');

    try {
        btn.innerText = "傳送中..."; btn.disabled = true;
        // 送出一筆「純按讚」的特殊紀錄
        await addDoc(collection(db, "record"), { station: currentStation, team: team, likes: 1, isLikeOnly: true, timestamp: nowTime });
        
        btn.innerText = `✅ 成功給 ${team} 1 個 👍`;
        btn.style.background = "#2ecc71"; btn.style.color = "white";
        
        // 1.5 秒後恢復按鈕狀態
        setTimeout(() => {
            btn.innerHTML = `送出 1 個 👍 (給 <span id="likeTeamName">${teamSelect.value}</span>)`;
            btn.style.background = "#f1c40f"; btn.style.color = "#333"; btn.disabled = false;
        }, 1500);
    } catch (error) { alert("發生錯誤！"); btn.disabled = false; }
});

onSnapshot(doc(db, "settings", "global"), (docSnap) => {
    if (docSnap.exists()) {
        sysSettings = docSnap.data();
        isOccupied = (sysSettings.stationStatus && sysSettings.stationStatus[currentStation] === 'red');
        if(isOccupied) {
            statusBtn.className = "status-btn status-red"; statusBtn.innerText = "🔴 闖關中 (點擊切換為空關)";
        } else {
            statusBtn.className = "status-btn status-green"; statusBtn.innerText = "🟢 目前為空關 (點擊切換為闖關中)";
        }

        const currentSelected = teamSelect.value; teamSelect.innerHTML = "";
        for (let i = 1; i <= sysSettings.numTeams; i++) teamSelect.innerHTML += `<option value="第${i}隊">第 ${i} 隊</option>`;
        if (currentSelected) teamSelect.value = currentSelected;
        likeTeamName.innerText = teamSelect.value; 

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
    // 🌟 這裡過濾掉「純按讚」紀錄，不要顯示在排行榜裡干擾關主
    let stationRecords = allRecords.filter(r => r.station === currentStation && !r.isLikeOnly);
    const leaderboardDiv = document.getElementById('stationLeaderboard'); leaderboardDiv.innerHTML = ""; 
    
    if(stationRecords.length === 0) { leaderboardDiv.innerHTML = "<p style='color: #888;'>目前尚無成績</p>"; return; }
    
    stationRecords.reverse().forEach((r) => {
        let val = getVal(r); let display = (currentConf.type === 'time') ? `${Math.floor(val/60)}分${val%60}秒` : `${val} ${currentConf.unit}`;
        const item = document.createElement('div'); item.className = 'record-item';
        item.innerHTML = `<span><b>${r.team}</b><br><small style="color:#555;">(${display})</small></span><button class="delete-btn" data-id="${r.id}">刪除</button>`;
        leaderboardDiv.appendChild(item);
    });

    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', async (e) => {
        if(confirm("確定要刪除這筆成績嗎？")) await deleteDoc(doc(db, "record", e.target.getAttribute('data-id')));
    }));
});

// 送出正式成績 (拔除了 currentLikes)
document.getElementById('submitBtn').addEventListener('click', async () => {
    const team = teamSelect.value;
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
        await addDoc(collection(db, "record"), { station: currentStation, team: team, recordValue: finalValue, time_seconds: finalValue, timestamp: nowTime });
        
        document.getElementById('minInput').value = ""; document.getElementById('secInput').value = ""; document.getElementById('scoreInput').value = "";
        if(isOccupied) document.getElementById('statusToggleBtn').click(); 

        document.getElementById('submitBtn').innerText = "送出最終成績 🚀";
    } catch (error) { alert("發生錯誤！"); document.getElementById('submitBtn').innerText = "送出最終成績 🚀"; }
});