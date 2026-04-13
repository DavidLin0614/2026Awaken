import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

const urlParams = new URLSearchParams(window.location.search);
const currentStation = parseInt(urlParams.get('station')) || 1; 

let sysSettings = null;
let currentConf = null;

function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
function getVal(r) { return r.recordValue !== undefined ? r.recordValue : r.time_seconds; }

// ==========================================
// 🔒 密碼與系統狀態驗證
// ==========================================
document.getElementById('loginBtn').addEventListener('click', () => {
    if (!sysSettings) return alert("系統載入中，請稍後");
    if (document.getElementById('adminPwd').value === sysSettings.password) {
        document.getElementById('pwdOverlay').style.display = "none";
        document.getElementById('mainContainer').style.display = "block";
    } else {
        alert("❌ 密碼錯誤，請詢問總控台！");
    }
});

const lockOverlay = document.createElement('div');
lockOverlay.style = "display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); color:white; z-index:9999; flex-direction:column; justify-content:center; align-items:center; font-size:2em; font-weight:bold; text-align:center;";
lockOverlay.innerHTML = "🔒<br>關卡已關閉輸入<br><span style='font-size:0.5em; color:#ccc; margin-top:10px;'>目前正在進行總結算</span>";
document.body.appendChild(lockOverlay);

// ==========================================
// ⚙️ 監聽全局設定 (動態生成隊伍、切換輸入框)
// ==========================================
onSnapshot(doc(db, "settings", "global"), (docSnap) => {
    if (docSnap.exists()) {
        sysSettings = docSnap.data();
        
        // 1. 系統鎖定畫面
        lockOverlay.style.display = sysSettings.isLocked ? "flex" : "none";

        // 2. 如果密碼被改了，強制踢回登入畫面
        if (document.getElementById('mainContainer').style.display === "block" && document.getElementById('adminPwd').value !== sysSettings.password) {
            alert("⚠️ 系統密碼已更改，請重新登入！");
            document.getElementById('pwdOverlay').style.display = "flex";
            document.getElementById('mainContainer').style.display = "none";
            document.getElementById('adminPwd').value = "";
        }

        // 3. 動態產生隊伍下拉選單
        const teamSelect = document.getElementById('teamSelect');
        const currentSelected = teamSelect.value;
        teamSelect.innerHTML = "";
        for (let i = 1; i <= sysSettings.numTeams; i++) {
            teamSelect.innerHTML += `<option value="第${i}隊">第 ${i} 隊</option>`;
        }
        if (currentSelected) teamSelect.value = currentSelected;

        // 4. 動態切換 計時/計分 介面
        currentConf = sysSettings.stationConfigs[currentStation] || { type: 'time', unit: '' };
        document.getElementById('stationDisplay').innerText = `第 ${currentStation} 關 (${currentConf.type==='time'?'⏱️計時':'🎯計分'})`;
        
        if (currentConf.type === 'time') {
            document.getElementById('timeInputGroup').style.display = "block";
            document.getElementById('scoreInputGroup').style.display = "none";
            document.getElementById('secInput').setAttribute('max', '59'); // 秒數防呆
        } else {
            document.getElementById('timeInputGroup').style.display = "none";
            document.getElementById('scoreInputGroup').style.display = "block";
            document.getElementById('scoreLabel').innerText = `獲得數值 (單位: ${currentConf.unit})：`;
        }
    }
});

// ==========================================
// 📊 本關所有紀錄 (關主檢視用)
// ==========================================
onSnapshot(collection(db, "record"), (snapshot) => {
    if (!currentConf) return;
    const allRecords =[];
    snapshot.forEach((d) => allRecords.push({ id: d.id, ...d.data() }));

    let stationRecords = allRecords.filter(r => r.station === currentStation);
    let isTime = currentConf.type === 'time';
    
    let teamBest = {};
    stationRecords.forEach(r => {
        let val = getVal(r);
        if (!teamBest[r.team]) teamBest[r.team] = r;
        else {
            if (isTime ? val < getVal(teamBest[r.team]) : val > getVal(teamBest[r.team])) teamBest[r.team] = r;
        }
    });

    let uniqueRecords = Object.values(teamBest);
    uniqueRecords.sort((a, b) => isTime ? (getVal(a) - getVal(b)) : (getVal(b) - getVal(a)));

    const leaderboardDiv = document.getElementById('stationLeaderboard');
    leaderboardDiv.innerHTML = ""; 

    if (uniqueRecords.length === 0) {
        leaderboardDiv.innerHTML = "<p style='color: #888;'>目前尚無成績</p>";
        return;
    }

    uniqueRecords.forEach((r, index) => {
        let val = getVal(r);
        let display = isTime ? formatTime(val) : `${val} ${currentConf.unit}`;
        let rankColor = index < 3 ? "#ffd700" : "#333";
        let rankText = index < 3 ? `第 ${index + 1} 名` : `第 ${index + 1} 名`;

        const item = document.createElement('div');
        item.className = 'record-item';
        item.innerHTML = `
            <span><b style="color:${rankColor};">${rankText}</b>：${r.team} <br><small style="color:#555;">(${display})</small></span>
            <button class="delete-btn" data-id="${r.id}">刪除 ❌</button>
        `;
        leaderboardDiv.appendChild(item);
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if(confirm("確定要刪除這筆成績嗎？")) await deleteDoc(doc(db, "record", e.target.getAttribute('data-id')));
        });
    });
});

// ==========================================
// 🚀 送出成績 (加入防呆驗證)
// ==========================================
document.getElementById('submitBtn').addEventListener('click', async () => {
    const team = document.getElementById('teamSelect').value;
    let finalValue = 0;
    let isTime = currentConf.type === 'time';

    if (isTime) {
        const min = parseInt(document.getElementById('minInput').value) || 0;
        const sec = parseInt(document.getElementById('secInput').value) || 0;
        
        if (min === 0 && sec === 0) return alert("請輸入花費時間！");
        if (sec > 59) return alert("❌ 秒數不能超過 59 秒！");
        if (min > sysSettings.maxMin) return alert(`❌ 分鐘數不能超過總控台設定的 ${sysSettings.maxMin} 分鐘！`);
        
        finalValue = (min * 60) + sec;
    } else {
        const score = parseInt(document.getElementById('scoreInput').value);
        if (isNaN(score)) return alert("請輸入數值！");
        if (score > sysSettings.maxScore) return alert(`❌ 數值不能超過總控台設定的最大值 ${sysSettings.maxScore}！`);
        
        finalValue = score;
    }

    const now = new Date();
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    try {
        document.getElementById('submitBtn').innerText = "傳送中...";
        await addDoc(collection(db, "record"), {
            station: currentStation,
            team: team,
            recordValue: finalValue,   // 🌟 統一儲存新版數值
            time_seconds: finalValue,  // 兼容舊版的欄位
            timestamp: nowTime
        });
        
        document.getElementById('minInput').value = "";
        document.getElementById('secInput').value = "";
        document.getElementById('scoreInput').value = "";
        document.getElementById('submitBtn').innerText = "送出成績 🚀";
    } catch (error) {
        alert("發生錯誤，請檢查網路！");
        document.getElementById('submitBtn').innerText = "送出成績 🚀";
    }
});