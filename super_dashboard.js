import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, setDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = { /* 你的 config */ };
const app = initializeApp(firebaseConfig); const db = getFirestore(app);

let sysD2 = {}, sysD3 = {};

// 1. 監聽 D2 狀態 (燈號)
onSnapshot(doc(db, "settings", "global"), (docSnap) => {
    if (docSnap.exists()) {
        sysD2 = docSnap.data();
        const d2Container = document.getElementById('d2Monitor');
        d2Container.innerHTML = "";
        for (let i = 1; i <= (sysD2.numStations || 10); i++) {
            let status = (sysD2.stationStatus && sysD2.stationStatus[i]) || 'green';
            d2Container.innerHTML += `<div class="mini-card ${status}">第 ${i} 關<br>${status === 'red' ? '🔴 闖關中' : '🟢 空關'}</div>`;
        }
    }
});

// 2. 監聽 D3 狀態 (目前的輪次)
onSnapshot(collection(db, "record_2"), (snapshot) => {
    const d3Container = document.getElementById('d3Monitor');
    d3Container.innerHTML = "";
    let stationRounds = {};
    snapshot.forEach(d => {
        let r = d.data();
        if(!stationRounds[r.station] || r.round > stationRounds[r.station]) {
            stationRounds[r.station] = r.round;
        }
    });
    for(let i=1; i<=15; i++) {
        let r = stationRounds[i] || 0;
        d3Container.innerHTML += `<div class="mini-card" style="border-left-color:#e74c3c;">第 ${i} 關<br>📍 第 ${r} 輪</div>`;
    }
});

// 3. 生成全場加分列表
const bonusContainer = document.getElementById('bonusContainer');
for(let i=1; i<=15; i++) {
    bonusContainer.innerHTML += `
        <div class="bonus-row">
            <b>第 ${i} 隊</b>
            <input type="number" id="bonus_${i}" placeholder="加分">
            <button class="btn btn-add" onclick="window.giveBonus(${i})">確認加分</button>
        </div>`;
}

window.giveBonus = async (teamNum) => {
    let val = parseInt(document.getElementById(`bonus_${teamNum}`).value);
    if(!val) return;
    await addDoc(collection(db, "record_bonus"), { team: `第${teamNum}隊`, val: val, timestamp: Date.now() });
    document.getElementById(`bonus_${teamNum}`).value = "";
    alert(`✅ 已為第${teamNum}隊 加 ${val} 分`);
};

// ... 其他鎖定與儲存設定邏輯 (略)