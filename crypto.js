/* =======================================================
   VOLKTRONIC CRYPTO ENGINE v9.1 - KESİN ÇÖZÜM SÜRÜMÜ
   ======================================================= */

// Firebase başlatmasını güvenli hale getirdik. Çökerse sistemi kilitletmez.
let db;
try {
    const firebaseConfig = {
      databaseURL: "https://volktron-chat-default-rtdb.firebaseio.com/"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    db = firebase.database();
} catch (error) {
    console.error("Sistem hatası: Veritabanına ulaşılamadı. (Adblock kapatın)", error);
}

let USER = "";
let ROOM = "";
let SECRET = "";
let SECURE_ROOM_PATH = ""; 
let roomMessagesRef;
let windowListenersActive = false;

let selectedImageBase64 = null; 
let selectedAudioBase64 = null;
let isRecording = false;
let mediaRecorder;
let audioChunks = [];

const encSel = new Set();
const decSel = new Set();

// Modal ve Sekme Fonksiyonları HTML tarafından %100 ulaşılsın diye window objesine sabitlendi
window.openModal = function(id) { document.getElementById(id).classList.add('active'); };
window.closeModal = function(id) { document.getElementById(id).classList.remove('active'); };

window.switchMobileTab = function(panelId, btnId) {
    if(window.innerWidth > 1024) return; 

    // Klavye açıksa önce onu kapatır
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur(); 
    }

    // CSS display:none yapısı için class değişimleri (Burası mobilde tıklanamama sorununu bitirir)
    document.querySelectorAll('.workspace-panel').forEach(p => p.classList.remove('active-tab'));
    document.getElementById(panelId).classList.add('active-tab');
    
    document.querySelectorAll('.m-nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(btnId).classList.add('active');

    if(panelId === 'chat-panel') {
        setTimeout(() => {
            const scrollContainer = document.getElementById("chat-scroll-container");
            if(scrollContainer) { scrollContainer.scrollTop = scrollContainer.scrollHeight; }
        }, 50); 
    }
};

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

// Sayfa yüklenince katmanları anında oluştur
document.addEventListener("DOMContentLoaded", () => {
    makeLayers(document.getElementById("encLayers"), encSel);
    makeLayers(document.getElementById("decLayers"), decSel);
});

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

window.toggleAudioRecord = async function() {
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
};

// PC'yi kasan Yazıyor... (Typing) özelliğinin Optimizasyonu
let typingClearTimer;
let lastTypingTime = 0;
document.getElementById("message").addEventListener("input", () => {
    if(!SECURE_ROOM_PATH || !USER || !db) return;
    
    const now = Date.now();
    if (now - lastTypingTime > 1500) { // PC'nin donmaması için istek sayısını azalttık
        db.ref("rooms/" + SECURE_ROOM_PATH + "/typing/" + USER).set(now);
        lastTypingTime = now;
    }
    
    clearTimeout(typingClearTimer);
    typingClearTimer = setTimeout(() => db.ref("rooms/" + SECURE_ROOM_PATH + "/typing/" + USER).remove(), 2500);
});

document.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !document.getElementById('login').classList.contains('hidden')) {
        window.enterRoom();
    }
});

// GİRİŞ FONKSİYONU - BOZULMASI İMKANSIZ HALE GETİRİLDİ
window.enterRoom = function() {
    USER = document.getElementById("username").value.trim();
    ROOM = document.getElementById("room").value.trim();
    const PIN = document.getElementById("roomPin").value.trim();
    SECRET = document.getElementById("secretKey").value.trim();

    if (!USER || !ROOM || !SECRET || !PIN) {
        alert("Bağlantı reddedildi: Lütfen tüm alanları doldurun.");
        return;
    }

    if (!db) {
        alert("Ağ uyarısı: Veritabanı ile iletişim kurulamadı. Güvenli bağlantı başlatılamıyor.");
        return;
    }

    const roomHash = CryptoJS.MD5(ROOM + "_" + PIN).toString();
    SECURE_ROOM_PATH = ROOM + "_" + roomHash.substring(0, 10);

    document.getElementById("userNameDisplay").textContent = USER;
    document.getElementById("roomNameDisplay").textContent = ROOM;

    document.getElementById("login").classList.add("hidden");
    document.getElementById("chat").classList.remove("hidden");

    if (!windowListenersActive) {
        startFirebaseListeners();
        windowListenersActive = true;
    }
};

function startFirebaseListeners() {
    const myPresenceRef = db.ref("rooms/" + SECURE_ROOM_PATH + "/presence").push();
    myPresenceRef.set(USER);
    myPresenceRef.onDisconnect().remove();

    const roomPresenceRef = db.ref("rooms/" + SECURE_ROOM_PATH + "/presence");
    roomPresenceRef.on('value', (snap) => {
        const data = snap.val() || {};
        document.getElementById('onlineCountDisplay').innerText = Object.keys(data).length;
    });

    const globalPresenceRef = db.ref("global_presence").push();
    globalPresenceRef.set(USER);
    globalPresenceRef.onDisconnect().remove();

    const globalPresenceListRef = db.ref("global_presence");
    globalPresenceListRef.on('value', (snap) => {
        const data = snap.val() || {};
        const platformDisplay = document.getElementById('platformCountDisplay');
        if (platformDisplay) platformDisplay.innerText = Object.keys(data).length;
    });

    const typingListRef = db.ref("rooms/" + SECURE_ROOM_PATH + "/typing");
    typingListRef.on('value', (snap) => {
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

    roomMessagesRef = db.ref("rooms/" + SECURE_ROOM_PATH + "/messages");
    
    roomMessagesRef.on('child_added', (snap) => {
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
                <button class="action-btn" onclick="document.getElementById('cipher').value='${safeText}'; if(window.innerWidth<=1024) window.switchMobileTab('decoder-panel', 'm-btn-dec');">Aktar</button>
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

        document.getElementById("log").appendChild(div);
        
        const scrollContainer = document.getElementById("chat-scroll-container");
        if(scrollContainer) {
            setTimeout(() => {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }, 50);
        }
    });

    roomMessagesRef.on('child_removed', (snap) => {
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
            db.ref("rooms/" + SECURE_ROOM_PATH + "/messages/" + msgKey).remove();
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
            decrypted = bytes.toString(CryptoJS.enc.Utf8);
            if (!decrypted) throw new Error();
        });
        return decrypted;
    } catch (error) {
        return "HATA: Çözülemedi";
    }
}

window.encryptAndSend = function() {
    if (!db) { alert("Bağlantı hatası"); return; }
    
    const msgInput = document.getElementById("message");
    const burnTime = parseInt(document.getElementById("burnTimer").value);
    const textVal = msgInput.value.trim();

    if (!textVal && !selectedImageBase64 && !selectedAudioBase64) {
        alert("Lütfen iletilecek veriyi girin."); return;
    }

    let payload = "";
    if (selectedAudioBase64) payload = "AUDIO||" + selectedAudioBase64 + "||" + textVal;
    else if (selectedImageBase64) payload = "IMG||" + selectedImageBase64 + "||" + textVal;
    else payload = "TXT||" + textVal;

    const encryptedPayload = applyStrongLayers(payload, SECRET, encSel);

    roomMessagesRef.push({ user: USER, text: encryptedPayload, time: Date.now(), burn: burnTime });

    msgInput.value = "";
    selectedImageBase64 = null;
    selectedAudioBase64 = null;
    
    const imgLbl = document.getElementById("imgLabel");
    imgLbl.innerHTML = "🖼️ Dosya"; 
    imgLbl.classList.remove("active-state");
    
    const micBtn = document.getElementById("micBtn");
    micBtn.innerHTML = "🎤 Ses"; 
    micBtn.classList.remove("active-state");

    if(window.innerWidth <= 1024) {
        window.switchMobileTab('chat-panel', 'm-btn-chat');
    }
};

window.decryptExternal = function() {
    const cipherText = document.getElementById("cipher").value.trim();
    const resultDiv = document.getElementById("result");

    if (!cipherText) { resultDiv.textContent = "RAW verisi bekleniyor..."; return; }

    const plainText = removeStrongLayers(cipherText, SECRET, decSel);

    if (plainText.includes("HATA:")) {
        resultDiv.innerHTML = "Veri Bütünlüğü Sağlanamadı.<br><br>Katman dizilimi veya Master Key hatalı.";
        resultDiv.style.color = "var(--danger)";
    } else {
        let cleanText = plainText;
        if (cleanText.startsWith("IMG||")) cleanText = "[Görsel formatı algılandı - Ortadaki panelden çözünüz]";
        else if (cleanText.startsWith("AUDIO||")) cleanText = "[Ses formatı algılandı - Ortadaki panelden çözünüz]";
        else if (cleanText.startsWith("TXT||")) cleanText = cleanText.replace("TXT||", "");
        
        resultDiv.textContent = cleanText;
        resultDiv.style.color = "var(--accent-primary)";
    }
};

window.triggerPanic = async function() {
    if (confirm("DİKKAT: Veri tabanı kalıcı olarak temizlenecek. Onaylıyor musunuz?")) {
        try {
            if(db) await db.ref("rooms/" + SECURE_ROOM_PATH).remove();
            document.body.innerHTML = `<div style="display:flex; justify-content:center; align-items:center; height:100vh; background:var(--bg-base); color:var(--text-secondary); flex-direction:column; font-family:'Plus Jakarta Sans'; font-size:24px;">Çalışma Alanı İmha Edildi.</div>`;
            setTimeout(() => location.reload(), 3000);
        } catch (e) {
            alert("Bağlantı kesintisi yaşandı.");
        }
    }
};
