/* =======================================================
   VOLKTRONIC CRYPTO ENGINE v8.2 - FULL SCALE
   ======================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getDatabase, ref, push, set, remove, onChildAdded, onValue, onDisconnect 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    databaseURL: "https://volktron-chat-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// STATE VARIABLES
let USER, ROOM, SECRET, SECURE_ROOM_PATH, roomMessagesRef;
let selectedImageBase64 = null, selectedAudioBase64 = null, isRecording = false, mediaRecorder, audioChunks = [];
const encSel = new Set(), decSel = new Set();

// UI: GENERATE LAYERS
function makeLayers(el, s) {
    if (!el) return;
    for (let i = 1; i <= 10; i++) {
        const d = document.createElement("div");
        d.className = "layer";
        d.innerHTML = `<span>${i < 10 ? '0' + i : i}</span>`;
        d.onclick = () => {
            if (s.has(i)) {
                s.delete(i);
                d.classList.remove("active");
            } else {
                s.add(i);
                d.classList.add("active");
            }
        };
        el.appendChild(d);
    }
}
makeLayers(document.getElementById("encLayers"), encSel);
makeLayers(document.getElementById("decLayers"), decSel);

// MEDIA: IMAGE HANDLING
document.getElementById("imageInput").addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (file && file.size < 1.5 * 1024 * 1024) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            selectedImageBase64 = ev.target.result;
            document.getElementById("imgLabel").innerHTML = "Görsel Hazır ✓";
            document.getElementById("imgLabel").style.color = "var(--accent-primary)";
        };
        reader.readAsDataURL(file);
    } else {
        alert("Dosya çok büyük (Max 1.5MB)");
    }
});

// MEDIA: AUDIO HANDLING
async function toggleAudioRecord() {
    const btn = document.getElementById("micBtn");
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    selectedAudioBase64 = reader.result;
                    btn.innerHTML = "Ses Hazır ✓";
                    btn.classList.remove("recording");
                };
            };
            mediaRecorder.start();
            isRecording = true;
            btn.textContent = "⏺ Durdur";
            btn.classList.add("recording");
        } catch (err) {
            alert("Mikrofon erişimi reddedildi.");
        }
    } else {
        mediaRecorder.stop();
        isRecording = false;
    }
}
window.toggleAudioRecord = toggleAudioRecord;

// ROOM ACCESS
window.enterRoom = () => {
    USER = document.getElementById("username").value.trim();
    ROOM = document.getElementById("room").value.trim();
    SECRET = document.getElementById("secretKey").value.trim();
    const PIN = document.getElementById("roomPin").value.trim();

    if (!USER || !ROOM || !SECRET || !PIN) return alert("Eksik bilgi!");

    // Use MD5 hash of Room + PIN for private path isolation
    const hash = CryptoJS.MD5(ROOM + "_" + PIN).toString().substring(0, 10);
    SECURE_ROOM_PATH = ROOM + "_" + hash;

    document.getElementById("login").classList.add("hidden");
    document.getElementById("chat").classList.remove("hidden");

    startListeners();
};

function startListeners() {
    // 1. Presence (Online Counter)
    const pRef = push(ref(db, "rooms/" + SECURE_ROOM_PATH + "/presence"));
    set(pRef, USER);
    onDisconnect(pRef).remove();
    onValue(ref(db, "rooms/" + SECURE_ROOM_PATH + "/presence"), s => {
        document.getElementById("onlineCountDisplay").textContent = Object.keys(s.val() || {}).length;
    });

    // 2. Typing Indicator
    onValue(ref(db, "rooms/" + SECURE_ROOM_PATH + "/typing"), snap => {
        const data = snap.val() || {};
        const writers = Object.keys(data).filter(k => k !== USER);
        document.getElementById("typing-indicator").style.opacity = writers.length > 0 ? "1" : "0";
    });

    // 3. Message Stream
    roomMessagesRef = ref(db, "rooms/" + SECURE_ROOM_PATH + "/messages");
    onChildAdded(roomMessagesRef, snap => {
        const d = snap.val();
        const div = document.createElement("div");
        div.id = "msg-" + snap.key;
        div.className = "msg-box msg " + (d.user === USER ? "me" : "other");
        div.innerHTML = `
            <div class="msg-header"><strong>${d.user}</strong><span>${new Date(d.time).toLocaleTimeString()}</span></div>
            <div class="raw-data">${d.text}</div>
            <div class="action-row">
                <button class="action-btn" onclick="navigator.clipboard.writeText('${d.text}')">Kopyala</button>
                <button class="action-btn solve inline-decrypt-btn">Şifreyi Çöz</button>
            </div>
            <div class="decrypted-view" style="display:none;"></div>
        `;

        div.querySelector(".inline-decrypt-btn").onclick = () => {
            const res = removeStrongLayers(d.text, SECRET, decSel);
            const view = div.querySelector(".decrypted-view");
            if (res === "HATA") return alert("Hatalı katman veya şifre!");

            if (res.startsWith("IMG||")) {
                const p = res.split("||");
                view.innerHTML = `<img src="${p[1]}"><p style="white-space: pre-wrap;">${p[2]}</p>`;
            } else if (res.startsWith("AUDIO||")) {
                const p = res.split("||");
                view.innerHTML = `<audio controls src="${p[1]}" style="width:100%;"></audio><p style="margin-top:10px;">${p[2]}</p>`;
            } else {
                view.innerHTML = `<p style="white-space: pre-wrap;">${res}</p>`;
            }

            view.style.display = "block";
            div.querySelector(".raw-data").style.display = "none";
            div.querySelector(".action-row").style.display = "none";
            if (d.burn > 0) startBurnTimer(d.burn, snap.key, div);
        };
        document.getElementById("log").appendChild(div);
        document.getElementById("log").scrollTop = document.getElementById("log").scrollHeight;
    });
}

// CRYPTO CORE: MULTI-LAYER AES-256
function applyStrongLayers(text, secret, layers) {
    let encrypted = text;
    let lArray = [...layers].sort((a, b) => a - b);
    if (lArray.length === 0) return CryptoJS.AES.encrypt(encrypted, secret).toString();

    lArray.forEach(ly => {
        encrypted = CryptoJS.AES.encrypt(encrypted, secret + "_L" + ly).toString();
    });
    return encrypted;
}

function removeStrongLayers(ciphertext, secret, layers) {
    let decrypted = ciphertext;
    let lArray = [...layers].sort((a, b) => b - a);
    try {
        if (lArray.length === 0) return CryptoJS.AES.decrypt(decrypted, secret).toString(CryptoJS.enc.Utf8);
        lArray.forEach(ly => {
            let bytes = CryptoJS.AES.decrypt(decrypted, secret + "_L" + ly);
            decrypted = bytes.toString(CryptoJS.enc.Utf8);
        });
        return decrypted || "HATA";
    } catch (e) { return "HATA"; }
}

// ACTIONS
window.encryptAndSend = () => {
    const msg = document.getElementById("message").value;
    const burn = parseInt(document.getElementById("burnTimer").value);
    if (!msg && !selectedImageBase64 && !selectedAudioBase64) return;

    let payload = msg;
    if (selectedImageBase64) payload = "IMG||" + selectedImageBase64 + "||" + msg;
    if (selectedAudioBase64) payload = "AUDIO||" + selectedAudioBase64 + "||" + msg;

    const enc = applyStrongLayers(payload, SECRET, encSel);
    push(roomMessagesRef, { user: USER, text: enc, time: Date.now(), burn: burn });

    // Cleanup
    document.getElementById("message").value = "";
    selectedImageBase64 = null; selectedAudioBase64 = null;
    document.getElementById("imgLabel").textContent = "Fotoğraf";
    document.getElementById("micBtn").textContent = "Ses";
    if (window.innerWidth <= 1024) window.switchMobileTab('chat-panel', 'm-btn-chat');
};

function startBurnTimer(sec, key, el) {
    let t = sec;
    const d = document.createElement("div");
    d.style.cssText = "color:#ef4444; font-size:12px; margin-top:10px; font-weight:700;";
    el.appendChild(d);
    const i = setInterval(() => {
        d.textContent = `İmha ediliyor: ${t}s`;
        if (t-- <= 0) {
            clearInterval(i);
            remove(ref(db, "rooms/" + SECURE_ROOM_PATH + "/messages/" + key));
        }
    }, 1000);
}

window.decryptExternal = () => {
    const raw = document.getElementById("cipher").value;
    const res = removeStrongLayers(raw, SECRET, decSel);
    document.getElementById("result").textContent = res === "HATA" ? "Hata: Anahtar/Katman yanlış." : res;
};

window.triggerPanic = async () => {
    if (confirm("Bu odadaki tüm veriler sonsuza dek silinecek. Onaylıyor musunuz?")) {
        await remove(ref(db, "rooms/" + SECURE_ROOM_PATH));
        location.reload();
    }
};
