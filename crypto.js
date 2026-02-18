/* =======================================================
   VOLKTRONIC CRYPTO ENGINE v8.0 - MOBILE OPTIMIZED
   ======================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getDatabase, ref, push, set, remove, onChildAdded, onChildRemoved, onValue, onDisconnect 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  databaseURL: "https://volktron-chat-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let USER = "";
let ROOM = "";
let SECRET = "";
let SECURE_ROOM_PATH = ""; 
let roomMessagesRef;

let selectedImageBase64 = null; 
let selectedAudioBase64 = null;
let isRecording = false;
let mediaRecorder;
let audioChunks = [];

const encSel = new Set();
const decSel = new Set();

function makeLayers(element, setObj) {
    if (!element) return;
    for (let i = 1; i <= 10; i++) {
        const btn = document.createElement("div");
        btn.className = "layer";
        btn.innerHTML = `<span>${i < 10 ? '0'+i : i}</span>`;
        
        btn.onclick = () => {
            if (setObj.has(i)) setObj.delete(i);
            else setObj.add(i);
            btn.classList.toggle("active");
        };
        element.appendChild(btn);
    }
}
makeLayers(document.getElementById("encLayers"), encSel);
makeLayers(document.getElementById("decLayers"), decSel);

document.getElementById("imageInput").addEventListener("change", function(e) {
    const file = e.target.files[0];
    const label = document.getElementById("imgLabel");
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) {
        alert("SİSTEM UYARISI: Maksimum 1.5MB yükleyebilirsiniz.");
        this.value = ""; return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        selectedImageBase64 = event.target.result;
        selectedAudioBase64 = null; 
        label.innerHTML = "Görsel Eklendi ✓";
        label.classList.add("active-state");
    };
    reader.readAsDataURL(file);
});

async function toggleAudioRecord() {
    const micBtn = document.getElementById("micBtn");
    
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };
            
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    selectedAudioBase64 = reader.result;
                    selectedImageBase64 = null; 
                    micBtn.innerHTML = "Ses Hazır ✓";
                    micBtn.classList.remove("recording");
                    micBtn.classList.add("active-state");
                };
            };
            
            mediaRecorder.start();
            isRecording = true;
            micBtn.innerHTML = "Kaydediliyor... (Durdur)";
            micBtn.classList.add("recording");
            
        } catch (err) {
            alert("Mikrofon izni alınamadı.");
        }
    } else {
        mediaRecorder.stop();
        isRecording = false;
    }
}
window.toggleAudioRecord = toggleAudioRecord;

let typingTimer;
document.getElementById("message").addEventListener("input", () => {
    if(!SECURE_ROOM_PATH || !USER) return;
    const typingRef = ref(db, "rooms/" + SECURE_ROOM_PATH + "/typing/" + USER);
    set(typingRef, Date.now()); 
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => remove(typingRef), 2000);
});

function enterRoom() {
    USER = document.getElementById("username").value.trim();
    ROOM = document.getElementById("room").value.trim();
    const PIN = document.getElementById("roomPin").value.trim();
    SECRET = document.getElementById("secretKey").value.trim();

    if (!USER || !ROOM || !SECRET || !PIN) {
        alert("Bağlantı reddedildi: Eksik parametreler mevcut.");
        return;
    }

    const roomHash = CryptoJS.MD5(ROOM + "_" + PIN).toString();
    SECURE_ROOM_PATH = ROOM + "_" + roomHash.substring(0, 10);

    document.getElementById("userNameDisplay").textContent = USER;
    document.getElementById("roomNameDisplay").textContent = ROOM;

    document.getElementById("login").classList.add("hidden");
    document.getElementById("chat").classList.remove("hidden");

    startFirebaseListeners();
}

function startFirebaseListeners() {
    // --- ODA İÇİ AKTİFLİK DURUMU ---
    const myPresenceRef = push(ref(db, "rooms/" + SECURE_ROOM_PATH + "/presence"));
    set(myPresenceRef, USER);
    onDisconnect(myPresenceRef).remove();

    const roomPresenceRef = ref(db, "rooms/" + SECURE_ROOM_PATH + "/presence");
    onValue(roomPresenceRef, (snap) => {
        const data = snap.val() || {};
        const count = Object.keys(data).length;
        document.getElementById('onlineCountDisplay').innerText = count;
    });

    // --- YENİ: PLATFORM GENELİ AKTİFLİK DURUMU ---
    const globalPresenceRef = push(ref(db, "global_presence"));
    set(globalPresenceRef, USER);
    onDisconnect(globalPresenceRef).remove();

    const globalPresenceListRef = ref(db, "global_presence");
    onValue(globalPresenceListRef, (snap) => {
        const data = snap.val() || {};
        const count = Object.keys(data).length;
        const platformDisplay = document.getElementById('platformCountDisplay');
        if (platformDisplay) platformDisplay.innerText = count;
    });

    const typingListRef = ref(db, "rooms/" + SECURE_ROOM_PATH + "/typing");
    onValue(typingListRef, (snap) => {
        const data = snap.val() || {};
        const activeWriters = Object.keys(data).filter(user => user !== USER);
        const indicator = document.getElementById("typing-indicator");
        if (activeWriters.length > 0) {
            indicator.textContent = `${activeWriters.join(", ")} yazıyor...`;
            indicator.style.opacity = "1";
        } else {
            indicator.style.opacity = "0";
        }
    });

    roomMessagesRef = ref(db, "rooms/" + SECURE_ROOM_PATH + "/messages");
    
    onChildAdded(roomMessagesRef, (snap) => {
        const data = snap.val() || {};
        const msgKey = snap.key;
        
        const safeUser = data.user || "Bilinmeyen";
        const safeText = data.text || "";
        const time = data.time ? new Date(data.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--";

        const div = document.createElement("div");
        div.id = "msg-" + msgKey; 
        div.className = "msg-box msg " + (safeUser === USER ? "me" : "other");
        
        div.innerHTML = `
            <div class="msg-header">
                <strong>${safeUser}</strong>
                <span>${time}</span>
            </div>
            
            <div class="raw-data mono-font">${safeText}</div>
            
            <div class="action-row">
                <button class="action-btn" onclick="navigator.clipboard.writeText('${safeText}')">Kopyala</button>
                <button class="action-btn" onclick="document.getElementById('cipher').value='${safeText}'">Aktar</button>
                <button class="action-btn solve inline-decrypt-btn">Şifreyi Çöz</button>
            </div>
            <div class="decrypted-view" style="display:none;"></div>
        `;

        const decryptBtn = div.querySelector(".inline-decrypt-btn");
        decryptBtn.onclick = () => {
            const decrypted = removeStrongLayers(safeText, SECRET, decSel);
            const view = div.querySelector(".decrypted-view");
            const raw = div.querySelector(".raw-data");
            const actions = div.querySelector(".action-row");

            if (typeof decrypted === "string" && decrypted.includes("HATA:")) {
                alert("İşlem Başarısız: Katman dizilimi veya anahtar uyuşmazlığı.");
            } else {
                let htmlContent = "";
                
                if (decrypted.startsWith("IMG||")) {
                    const parts = decrypted.split("||"); 
                    htmlContent = `<img src="${parts[1]}" style="max-width:100%; max-height:280px; object-fit:contain; border-radius:8px; margin-bottom:12px; box-shadow:0 0 15px rgba(16,185,129,0.1); display:block;">
                                   <div style="font-size:15px; color:#fff; word-break:break-word;">${parts[2] || ""}</div>`;
                } 
                else if (decrypted.startsWith("AUDIO||")) {
                    const parts = decrypted.split("||");
                    htmlContent = `
                        <div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:8px; display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                            <span style="font-size:20px;">🎧</span>
                            <audio controls src="${parts[1]}" style="height:35px; outline:none; width:100%;"></audio>
                        </div>
                        <div style="font-size:15px; color:#fff; word-break:break-word;">${parts[2] || ""}</div>
                    `;
                }
                else if (decrypted.startsWith("TXT||")) {
                    htmlContent = decrypted.replace("TXT||", "");
                } else {
                    htmlContent = decrypted;
                }

                view.innerHTML = htmlContent;
                view.style.display = "block";
                raw.style.display = "none";
                actions.style.display = "none";

                if (data.burn && data.burn > 0) startBurnTimer(data.burn, msgKey, div);
            }
        };

        const logDiv = document.getElementById("log");
        logDiv.appendChild(div);
        
        // DÜZELTME: Kilitlenme sorununu çözen doğru kapsayıcıyı kaydırma işlemi
        const scrollContainer = document.getElementById("chat-scroll-container");
        if(scrollContainer) {
            setTimeout(() => {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }, 50);
        }
    });

    onChildRemoved(roomMessagesRef, (snap) => {
        const el = document.getElementById("msg-" + snap.key);
        if (el) {
            el.innerHTML = `<div style="color:var(--text-secondary); text-align:center; font-size:13px; font-weight:500; border:1px dashed var(--border-light); padding:16px; border-radius:8px; background:rgba(0,0,0,0.2);">Mesaj imha edildi.</div>`;
            setTimeout(() => el.remove(), 2000);
        }
    });
}

function startBurnTimer(seconds, msgKey, element) {
    let timeLeft = seconds;
    const timerDisplay = document.createElement("div");
    timerDisplay.style.color = "var(--danger)";
    timerDisplay.style.fontSize = "12px";
    timerDisplay.style.fontWeight = "600";
    timerDisplay.style.marginTop = "16px";
    timerDisplay.style.textAlign = "right";
    
    element.appendChild(timerDisplay);

    const interval = setInterval(() => {
        timerDisplay.innerHTML = `Sistemden siliniyor: ${timeLeft}s`;
        timeLeft--;

        if (timeLeft < 0) {
            clearInterval(interval);
            remove(ref(db, "rooms/" + SECURE_ROOM_PATH + "/messages/" + msgKey));
        }
    }, 1000);
}

function applyStrongLayers(text, secret, selectedLayers) {
    let encrypted = text;
    let layers = [...selectedLayers].sort((a, b) => a - b);
    if (layers.length === 0) return CryptoJS.AES.encrypt(encrypted, secret).toString();

    layers.forEach(layer => {
        let layerSpecificKey = secret + "_Salt_L" + layer;
        encrypted = CryptoJS.AES.encrypt(encrypted, layerSpecificKey).toString();
    });
    return encrypted;
}

function removeStrongLayers(ciphertext, secret, selectedLayers) {
    let decrypted = ciphertext;
    let layers = [...selectedLayers].sort((a, b) => b - a);
    
    try {
        if (layers.length === 0) {
            let bytes = CryptoJS.AES.decrypt(decrypted, secret);
            let result = bytes.toString(CryptoJS.enc.Utf8);
            if (!result) throw new Error(); return result;
        }

        layers.forEach(layer => {
            let layerSpecificKey = secret + "_Salt_L" + layer;
            let bytes = CryptoJS.AES.decrypt(decrypted, layerSpecificKey);
            decrypted = bytes.toString(
