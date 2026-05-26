import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, addDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = { 
    apiKey: "AIzaSyBo5iMRonG0rFu6ZuIBJFXzwnWF9xiAKgQ",
    authDomain: "awaken-c5fca.firebaseapp.com",
    projectId: "awaken-c5fca",
    storageBucket: "awaken-c5fca.firebasestorage.app"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let sysSettings = {};
let recordsD2 = [];
let recordsD3 = [];
let recordsBonus = [];

// 監聽全域設定
onSnapshot(doc(db, "settings_global", "global"), (docSnap) => {
    if (docSnap.exists()) {
        sysSettings = docSnap.data();
        renderMonitors();
        updateScoreSummary();
        updateButtonStatus();
    }
});

// 監聽 D2 資料
onSnapshot(collection(db, "records_d2"), (snapshot) => {
    recordsD2 = [];
    snapshot.forEach(d => recordsD2.push({id: d.id, ...d.data()}));
    renderMonitors();
    updateScoreSummary();
});

// 監聽 D3 資料
onSnapshot(collection(db, "records_d3"), (snapshot) => {
    recordsD3 = [];
    snapshot.forEach(d => recordsD3.push({id: d.id, ...d.data()}));
    renderMonitors();
    updateScoreSummary();
});

// 監聽 額外加分
onSnapshot(collection(db, "records_bonus"), (snapshot) => {
    recordsBonus = [];
    snapshot.forEach(d => recordsBonus.push({id: d.id, ...d.data()}));
    updateScoreSummary();
});

// 渲染監控面板 (D2 & D3)
function renderMonitors() {
    // D2 監控
    const d2Monitor = document.getElementById('d2_monitor');
    d2Monitor.innerHTML = "";
    const d2Stations = sysSettings.numStations_d2 || 10;
    for(let i=1; i<=d2Stations; i++) {
        let status = (sysSettings.d2_status && sysSettings.d2_status[i]) || 'green';
        let stationRecs = recordsD2.filter(r => r.station === i);
        // 此處加入 D2 的 Top 3 邏輯與下拉方塊 (略，稍後補全)
        d2Monitor.innerHTML += `
            <div class="glass-card station-box">
                <div style="font-weight:bold; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:5px;">
                    <span class="status-dot ${status === 'red' ? 'dot-red' : 'dot-green'}"></span>第 ${i} 關
                </div>
                <ul class="record-list" id="d2_list_${i}"></ul>
                <select id="d2_select_${i}" style="margin-top:5px; background:#000; color:#fff; border:none;"></select>
            </div>`;
    }

    // D3 監控
    const d3Monitor = document.getElementById('d3_monitor');
    d3Monitor.innerHTML = "";
    const d3Stations = sysSettings.numStations_d3 || 10;
    for(let i=1; i<=d3Stations; i++) {
        let status = (sysSettings.d3_status && sysSettings.d3_status[i]) || 'green';
        // 此處加入 D3 的最新三筆與輪次邏輯
        d3Monitor.innerHTML += `
            <div class="glass-card station-box">
                <div style="font-weight:bold; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:5px;">
                    <span class="status-dot ${status === 'red' ? 'dot-red' : 'dot-green'}"></span>第 ${i} 關
                </div>
                <div id="d3_round_${i}" style="font-size:0.8em; color:#f1c40f;">輪次讀取中...</div>
                <ul class="record-list" id="d3_list_${i}"></ul>
            </div>`;
    }
}

// 更新按鈕鎖定狀態
function updateButtonStatus() {
    document.getElementById('d2_lockBtn').innerText = sysSettings.d2_locked ? "🔓 開放 D2 輸入" : "🔒 關閉 D2 輸入";
    document.getElementById('d3_lockBtn').innerText = sysSettings.d3_locked ? "🔓 開放 D3 輸入" : "🔒 關閉 D3 輸入";
    document.getElementById('d2_hideBtn').innerText = sysSettings.d2_hidden ? "📺 恢復 D2 展示" : "🙈 隱藏 D2 展示";
    document.getElementById('d3_hideBtn').innerText = sysSettings.d3_hidden ? "📺 恢復 D3 展示" : "🙈 隱藏 D3 展示";
}

// 計算總分摘要 (簡略版)
function updateScoreSummary() {
    const summary = document.getElementById('score_summary');
    summary.innerHTML = "";
    for(let i=1; i<= (sysSettings.numTeams || 15); i++) {
        let t = `第${i}隊`;
        summary.innerHTML += `<div class="glass-card" style="padding:10px;">${t}<br><b style="color:#f1c40f;">0 分</b></div>`;
    }
}