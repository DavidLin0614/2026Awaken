import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyBo5iMRonG0rFu6ZuIBJFXzwnWF9xiAKgQ", authDomain: "awaken-c5fca.firebaseapp.com", projectId: "awaken-c5fca", storageBucket: "awaken-c5fca.firebasestorage.app" };
const app = initializeApp(firebaseConfig); const db = getFirestore(app);

let sysSettings = { numTeams: 15, numStations_d2: 15, numStations_d3: 10 };
let recordsD2 = [];
let recordsD3 = [];
let recordsBonus = [];

// ==========================================
// 📡 資料庫監聽
// ==========================================
onSnapshot(doc(db, "settings_global", "global"), (docSnap) => {
    if (docSnap.exists()) {
        sysSettings = { ...sysSettings, ...docSnap.data() };
        renderD2Monitor();
        renderD3Monitor();
        renderBonusMonitor();
        updateButtonStatus();
    }
});

onSnapshot(collection(db, "records_d2"), (snapshot) => {
    recordsD2 = []; snapshot.forEach(d => recordsD2.push({id: d.id, ...d.data()}));
    renderD2Monitor();
});

onSnapshot(collection(db, "records_d3"), (snapshot) => {
    recordsD3 = []; snapshot.forEach(d => recordsD3.push({id: d.id, ...d.data()}));
    renderD3Monitor();
});

onSnapshot(collection(db, "records_bonus"), (snapshot) => {
    recordsBonus = []; snapshot.forEach(d => recordsBonus.push({id: d.id, ...d.data()}));
    renderBonusMonitor();
});

// ==========================================
// 🎨 渲染監控畫面
// ==========================================
function renderD2Monitor() {
    const container = document.getElementById('d2_monitor'); container.innerHTML = "";
    for(let i=1; i<=sysSettings.numStations_d2; i++) {
        let status = (sysSettings.d2_status && sysSettings.d2_status[i]) || 'green';
        let recs = recordsD2.filter(r => r.station === i && !r.isLikeOnly).sort((a,b) => b.createdAt - a.createdAt);
        let listHTML = recs.slice(0,3).map(r => `<li><span>${r.team}</span><span>${r.val}</span><button class="del-btn" onclick="window.delD2('${r.id}')">刪</button></li>`).join('');
        
        container.innerHTML += `
            <div class="glass-card station-box">
                <div class="station-title"><span class="status-dot ${status === 'red' ? 'dot-red' : 'dot-green'}"></span>第 ${i} 關</div>
                <ul class="record-list">${listHTML || '<li style="color:#aaa;">尚無成績</li>'}</ul>
                <div style="font-size:0.8em; color:#aaa; margin-top:5px;">共 ${recs.length} 筆紀錄</div>
            </div>`;
    }
}

function renderD3Monitor() {
    const container = document.getElementById('d3_monitor'); container.innerHTML = "";
    for(let i=1; i<=sysSettings.numStations_d3; i++) {
        let status = (sysSettings.d3_status && sysSettings.d3_status[i]) || 'green';
        let recs = recordsD3.filter(r => r.station === i).sort((a,b) => b.createdAt - a.createdAt);
        let latestRound = recs.length > 0 ? recs[0].round : 1;
        let listHTML = recs.slice(0,3).map(r => `<li><span>[輪${r.round}] ${r.winner} 勝</span><button class="del-btn" onclick="window.delD3('${r.id}')">刪</button></li>`).join('');
        
        container.innerHTML += `
            <div class="glass-card station-box">
                <div class="station-title"><span class="status-dot ${status === 'red' ? 'dot-red' : 'dot-green'}"></span>第 ${i} 關</div>
                <div style="color:#f1c40f; margin-bottom:10px;">目前進度：第 ${latestRound} 輪</div>
                <ul class="record-list">${listHTML || '<li style="color:#aaa;">尚無成績</li>'}</ul>
            </div>`;
    }
}

function renderBonusMonitor() {
    const container = document.getElementById('bonus_monitor'); container.innerHTML = "";
    for(let i=1; i<=sysSettings.numTeams; i++) {
        let t = `第${i}隊`;
        let totalBonus = recordsBonus.filter(r => r.team === t).reduce((sum, r) => sum + r.val, 0);
        container.innerHTML += `
            <div style="background:rgba(255,255,255,0.1); padding:10px; border-radius:5px; display:flex; justify-content:space-between; align-items:center;">
                <b>${t}</b>
                <span style="color:#2ecc71;">+${totalBonus} 分</span>
                <button class="btn btn-add" style="padding:5px 10px;" onclick="window.addBonus('${t}')">加分</button>
            </div>`;
    }
}

// ==========================================
// 🖱️ 全域視窗掛載函數
// ==========================================
window.delD2 = async (id) => { if(confirm("刪除？")) await deleteDoc(doc(db, "records_d2", id)); };
window.delD3 = async (id) => { if(confirm("刪除？")) await deleteDoc(doc(db, "records_d3", id)); };
window.addBonus = async (team) => {
    let val = prompt(`請輸入要給 ${team} 增加的分數：`);
    val = parseInt(val);
    if(val && !isNaN(val)) {
        await addDoc(collection(db, "records_bonus"), { team: team, val: val, timestamp: Date.now() });
        alert("✅ 加分成功！");
    }
};

function updateButtonStatus() {
    document.getElementById('d2_lockBtn').innerText = sysSettings.d2_locked ? "🔓 開放 D2 輸入" : "🔒 關閉 D2 輸入";
    document.getElementById('d2_lockBtn').style.background = sysSettings.d2_locked ? "#27ae60" : "#e74c3c";
    document.getElementById('d2_hideBtn').innerText = sysSettings.d2_hidden ? "📺 恢復 D2 展示" : "🙈 隱藏 D2 展示";
    
    document.getElementById('d3_lockBtn').innerText = sysSettings.d3_locked ? "🔓 開放 D3 輸入" : "🔒 關閉 D3 輸入";
    document.getElementById('d3_lockBtn').style.background = sysSettings.d3_locked ? "#27ae60" : "#e74c3c";
    document.getElementById('d3_hideBtn').innerText = sysSettings.d3_hidden ? "📺 恢復 D3 展示" : "🙈 隱藏 D3 展示";
}

// ==========================================
// 🔘 按鈕事件綁定
// ==========================================
// D2 開關與清空
document.getElementById('d2_lockBtn').addEventListener('click', async () => await setDoc(doc(db, "settings_global", "global"), { d2_locked: !sysSettings.d2_locked }, { merge: true }));
document.getElementById('d2_hideBtn').addEventListener('click', async () => await setDoc(doc(db, "settings_global", "global"), { d2_hidden: !sysSettings.d2_hidden }, { merge: true }));
document.getElementById('d2_clearBtn').addEventListener('click', async () => { if(prompt("輸入「確認」清空D2")==="確認") recordsD2.forEach(r => deleteDoc(doc(db, "records_d2", r.id))); });

// D3 開關與清空
document.getElementById('d3_lockBtn').addEventListener('click', async () => await setDoc(doc(db, "settings_global", "global"), { d3_locked: !sysSettings.d3_locked }, { merge: true }));
document.getElementById('d3_hideBtn').addEventListener('click', async () => await setDoc(doc(db, "settings_global", "global"), { d3_hidden: !sysSettings.d3_hidden }, { merge: true }));
document.getElementById('d3_clearBtn').addEventListener('click', async () => { if(prompt("輸入「確認」清空D3")==="確認") recordsD3.forEach(r => deleteDoc(doc(db, "records_d3", r.id))); });

// 開啟 Modals
document.getElementById('d2_setBtn').addEventListener('click', () => {
    document.getElementById('set_d2_stations').value = sysSettings.numStations_d2 || 15;
    document.getElementById('set_d2_maxMin').value = sysSettings.d2_maxMin || 59;
    document.getElementById('set_d2_maxScore').value = sysSettings.d2_maxScore || 999;
    document.getElementById('modal_d2_settings').style.display = 'flex';
});
document.getElementById('d3_setBtn').addEventListener('click', () => {
    document.getElementById('set_d3_stations').value = sysSettings.numStations_d3 || 10;
    document.getElementById('modal_d3_settings').style.display = 'flex';
});
document.getElementById('d3_scheduleBtn').addEventListener('click', () => document.getElementById('modal_d3_schedule').style.display = 'flex');
document.getElementById('score_setBtn').addEventListener('click', () => {
    document.getElementById('set_global_teams').value = sysSettings.numTeams || 15;
    document.getElementById('set_global_maxLikes').value = sysSettings.maxLikes || 3;
    document.getElementById('set_global_likePts').value = sysSettings.likePoints || 10;
    document.getElementById('modal_score_settings').style.display = 'flex';
});

// 儲存設定
document.getElementById('save_d2_settings').addEventListener('click', async () => {
    await setDoc(doc(db, "settings_global", "global"), { 
        numStations_d2: parseInt(document.getElementById('set_d2_stations').value),
        d2_maxMin: parseInt(document.getElementById('set_d2_maxMin').value),
        d2_maxScore: parseInt(document.getElementById('set_d2_maxScore').value)
    }, { merge: true });
    document.getElementById('modal_d2_settings').style.display = 'none';
});
document.getElementById('save_d3_settings').addEventListener('click', async () => {
    await setDoc(doc(db, "settings_global", "global"), { 
        numStations_d3: parseInt(document.getElementById('set_d3_stations').value)
    }, { merge: true });
    document.getElementById('modal_d3_settings').style.display = 'none';
});
document.getElementById('save_global_settings').addEventListener('click', async () => {
    await setDoc(doc(db, "settings_global", "global"), { 
        numTeams: parseInt(document.getElementById('set_global_teams').value),
        maxLikes: parseInt(document.getElementById('set_global_maxLikes').value),
        likePoints: parseInt(document.getElementById('set_global_likePts').value)
    }, { merge: true });
    document.getElementById('modal_score_settings').style.display = 'none';
});

// 解析 D3 賽程表
document.getElementById('save_d3_schedule').addEventListener('click', async () => {
    let text = document.getElementById('scheduleInput').value.trim();
    let lines = text.split('\n').map(l => l.trimEnd());
    let newSchedule = {}; 
    let isMatrix = lines.some(l => l.startsWith('第') && l.includes('輪'));

    if (isMatrix) {
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (line.startsWith('第') && line.includes('輪')) {
                let roundMatch = line.split('\t')[0].match(/\d+/);
                if (!roundMatch) continue;
                let round = parseInt(roundMatch[0]);
                let teamA_cols = line.split('\t');
                let teamB_cols = (lines[i+1] || "").split('\t'); 
                newSchedule[round] = {};
                for (let col = 1; col < teamA_cols.length; col++) {
                    let valA = teamA_cols[col] ? teamA_cols[col].trim() : "";
                    let valB = teamB_cols[col] ? teamB_cols[col].trim() : "";
                    if (valA && valB) {
                        let tA = /^\d+$/.test(valA) ? `第${valA}隊` : valA;
                        let tB = /^\d+$/.test(valB) ? `第${valB}隊` : valB;
                        newSchedule[round][col] = { a: tA, b: tB };
                    }
                }
            }
        }
    }
    await setDoc(doc(db, "settings_global", "global"), { schedule: newSchedule }, { merge: true });
    alert("✅ 賽程表匯入成功！");
    document.getElementById('modal_d3_schedule').style.display = 'none';
});