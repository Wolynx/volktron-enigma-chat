// --- FIREBASE MODÜL İMPORTLARI ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getDatabase, 
    ref, 
    push, 
    set, 
    remove, 
    onChildAdded, 
    onChildRemoved, 
    onValue 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- FIREBASE KONFİGÜRASYONU ---
// Burayı kendi proje ayarlarınla değiştirmeyi unutma!
const firebaseConfig = {
  databaseURL: "https://volktron-chat-default-rtdb.firebaseio.com/"
};

// Uygulamayı Başlat
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- GLOBAL DEĞİŞKENLER ---
let USER = "";
let ROOM = "";
let SECRET = "";
let roomMessagesRef;
let selectedImageBase64 = null; // Seçilen resmin verisi burada tutulur

// Katman Seçimleri (Set yapısı tekrarı engeller)
const encSel = new Set();
const decSel = new Set();

// --- YARDIMCI FONKSİYON: KATMAN BUTONLARINI OLUŞTUR ---
function makeLayers(element, setObj) {
    if (!element) return;
    
    for (let i = 1; i <= 10; i++) {
        const btn = document.createElement("div");
        btn.className = "layer";
        // Şık görünüm için sayıları 01, 02 formatında yaz
        const label = i < 10 ? '0' + i : i;
        btn.innerHTML = `L-${label}`;
        
        btn.onclick = () => {
            // Tıklayınca sete ekle veya çıkar
            if (setObj.has(i)) {
                setObj.delete(i);
            } else {
                setObj.add(i);
            }
            btn.classList.toggle("active");
        };
        
        element.appendChild(btn);
    }
}

// Sayfa yüklenince katmanları oluştur
makeLayers(document.getElementById("encLayers"), encSel);
makeLayers(document.getElementById("decLayers"), decSel);


// --- GÖRSEL YÜKLEME İŞLEMİ ---
document.getElementById("imageInput").addEventListener("change", function(e) {
    const file = e.target.files[0];
    const btn = document.querySelector(".file-upload-label");
    
    if (!file) return;

    // Boyut Kontrolü (1.5 MB Sınırı)
    if (file.size > 1.5 * 1024 * 1024) {
        alert("GÜVENLİK UYARISI: Dosya boyutu çok büyük! Maksimum 1.5MB.");
        this.value = ""; // Inputu temizle
        return;
    }

    const reader = new FileReader();
    
    reader.onload = function(event) {
        selectedImageBase64 = event.target.result;
        // Buton rengini değiştirerek kullanıcya haber ver
        btn.textContent = "✅ GÖRSEL HAZIR";
        btn.style.background = "var(--neon-blue)";
        btn.style.color = "#000";
    };
    
    reader.onerror = function() {
        alert("Dosya okuma hatası!");
    };

    reader.readAsDataURL(file);
});


// --- YAZIYOR GÖSTERGESİ (Typing Indicator) ---
let typingTimer;
document.getElementById("message").addEventListener("input", () => {
    if(!ROOM || !USER) return;
    
    const typingRef = ref(db, "rooms/" + ROOM + "/typing/" + USER);
    set(typingRef, Date.now()); // Yazdığı anı kaydet
    
    // 2 saniye yazmazsa veritabanından sil
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        remove(typingRef);
    }, 2000);
});


// --- ODAYA GİRİŞ FONKSİYONU ---
function enterRoom() {
    // Değerleri al
    USER = document.getElementById("username").value.trim();
    ROOM = document.getElementById("room").value.trim();
    SECRET = document.getElementById("secretKey").value.trim();

    // Boş alan kontrolü
    if (!USER || !ROOM || !SECRET) {
        alert("ERİŞİM REDDEDİLDİ: Lütfen tüm kimlik bilgilerini girin.");
        return;
    }

    // Arayüzü güncelle
    document.getElementById("userNameDisplay").textContent = USER;
    document.getElementById("roomNameDisplay").textContent = ROOM;

    // Login ekranını gizle, sohbeti aç (Animasyonlu geçiş için CSS class kullanılır)
    const loginDiv = document.getElementById("login");
    const chatDiv = document.getElementById("chat");

    loginDiv.style.opacity = "0";
    loginDiv.style.transform = "scale(0.9)";
    
    setTimeout(() => {
        loginDiv.classList.add("hidden");
        chatDiv.classList.remove("hidden");
    }, 500);

    // --- FIREBASE DİNLEYİCİLERİNİ BAŞLAT ---
    startFirebaseListeners();
}


function startFirebaseListeners() {
    // 1. YAZIYOR DİNLEYİCİSİ
    const typingListRef = ref(db, "rooms/" + ROOM + "/typing");
    onValue(typingListRef, (snap) => {
        const data = snap.val() || {};
        const activeWriters = Object.keys(data).filter(user => user !== USER);
        const indicator = document.getElementById("typing-indicator");

        if (activeWriters.length > 0) {
            indicator.textContent = `⚡ Ajan ${activeWriters.join(", ")} veri şifreliyor...`;
            indicator.style.opacity = "1";
        } else {
            indicator.style.opacity = "0";
        }
    });

    // 2. MESAJ DİNLEYİCİSİ (Gelen Mesajlar)
    roomMessagesRef = ref(db, "rooms/" + ROOM + "/messages");
    
    onChildAdded(roomMessagesRef, (snap) => {
        const data = snap.val();
        const msgKey = snap.key;
        
        // Mesaj kutusunu oluştur
        const div = document.createElement("div");
        div.id = "msg-" + msgKey; // Silme işlemi için ID veriyoruz
        div.className = "msg " + (data.user === USER ? "me" : "other");
        
        const time = new Date(data.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        // Varsayılan olarak ŞİFRELİ (GİZLİ) görünüm
        div.innerHTML = `
            <div class="msg-header">
                <b>[${data.user}]</b> 
                <span>${time}</span>
            </div>
            
            <div class="msg-content">
                <div class="encrypted-placeholder" style="color:#666; font-size:12px; letter-spacing:1px;">
                    🔒 [AES-256 ŞİFRELİ VERİ PAKETİ] <br>
                    ${data.text.substring(0, 40)}...
                </div>
                <div class="decrypted-content" style="display:none;"></div>
            </div>

            <button class="decrypt-btn-inline">🔐 ÇÖZ VE GÖSTER</button>
        `;

        // ÇÖZME BUTONUNA TIKLANINCA
        const btn = div.querySelector(".decrypt-btn-inline");
        btn.onclick = () => {
            // Şifreyi çözmeyi dene
            const decrypted = removeStrongLayers(data.text, SECRET, encSel);
            const contentDiv = div.querySelector(".decrypted-content");
            const placeholder = div.querySelector(".encrypted-placeholder");

            if (decrypted.includes("HATA:")) {
                // Hata varsa
                placeholder.innerHTML = `<span style="color:red">⚠️ ŞİFRE ÇÖZME BAŞARISIZ! <br> Anahtar veya katmanlar yanlış.</span>`;
            } else {
                // Başarılıysa içeriği göster
                let htmlContent = "";
                
                // Resim mi Metin mi kontrolü
                if (decrypted.startsWith("IMG||")) {
                    const parts = decrypted.split("||"); // IMG || base64 || text
                    htmlContent = `
                        <img src="${parts[1]}" style="max-width:100%; border-radius:8px; border:1px solid var(--neon-blue); margin-bottom:10px;">
                        <div>${parts[2]}</div>
                    `;
                } else if (decrypted.startsWith("TXT||")) {
                    htmlContent = decrypted.replace("TXT||", "");
                } else {
                    htmlContent = decrypted;
                }

                contentDiv.innerHTML = htmlContent;
                contentDiv.style.display = "block";
                placeholder.style.display = "none";
                btn.style.display = "none"; // Butonu gizle

                // --- KENDİNİ İMHA SAYACI (BURN TIMER) ---
                if (data.burn && data.burn > 0) {
                    startBurnTimer(data.burn, msgKey, div);
                }
            }
        };

        const logDiv = document.getElementById("log");
        logDiv.appendChild(div);
        logDiv.scrollTop = logDiv.scrollHeight; // En alta kaydır
    });

    // 3. SİLİNEN MESAJ DİNLEYİCİSİ (Panik veya İmha durumunda)
    onChildRemoved(roomMessagesRef, (snap) => {
        const el = document.getElementById("msg-" + snap.key);
        if (el) {
            // Kırmızı bir uyarı ile silindiğini göster
            el.innerHTML = `
                <div style="color:red; text-align:center; font-weight:bold; padding:10px;">
                    🚫 VERİ İMHA EDİLDİ
                </div>
            `;
            // 1.5 saniye sonra tamamen kaldır
            setTimeout(() => el.remove(), 1500);
        }
    });
}


// --- KENDİNİ İMHA SAYACI FONKSİYONU ---
function startBurnTimer(seconds, msgKey, element) {
    let timeLeft = seconds;
    
    const timerDisplay = document.createElement("div");
    timerDisplay.style.color = "var(--neon-pink)";
    timerDisplay.style.fontWeight = "bold";
    timerDisplay.style.fontSize = "12px";
    timerDisplay.style.marginTop = "10px";
    timerDisplay.style.textAlign = "right";
    timerDisplay.style.borderTop = "1px dashed var(--neon-pink)";
    timerDisplay.style.paddingTop = "5px";
    
    element.appendChild(timerDisplay);

    const interval = setInterval(() => {
        timerDisplay.innerHTML = `🔥 İMHA: ${timeLeft}sn`;
        timeLeft--;

        if (timeLeft < 0) {
            clearInterval(interval);
            // Süre doldu, sadece kendi ekranımdan değil, VERİTABANINDAN sil.
            // Böylece herkesin ekranından silinir.
            remove(ref(db, "rooms/" + ROOM + "/messages/" + msgKey));
        }
    }, 1000);
}


// --- ŞİFRELEME MOTORU (AES-256 + KATMANLAR) ---
function applyStrongLayers(text, secret, selectedLayers) {
    let encrypted = text;
    // Katmanları sırala (Karışıklık olmasın diye)
    let layers = [...selectedLayers].sort((a, b) => a - b);
    
    // Eğer katman seçilmediyse standart AES yap
    if (layers.length === 0) {
        return CryptoJS.AES.encrypt(encrypted, secret).toString();
    }

    // Seçilen her katman için şifrele (Soğan kabuğu gibi)
    layers.forEach(layer => {
        // Her katman için anahtarı değiştiriyoruz (Tuzlama)
        let layerSpecificKey = secret + "_LayerSalt_L" + layer;
        encrypted = CryptoJS.AES.encrypt(encrypted, layerSpecificKey).toString();
    });
    
    return encrypted;
}


// --- ŞİFRE ÇÖZME MOTORU ---
function removeStrongLayers(ciphertext, secret, selectedLayers) {
    let decrypted = ciphertext;
    // Çözerken tersten gitmeliyiz (Büyükten küçüğe)
    let layers = [...selectedLayers].sort((a, b) => b - a);
    
    try {
        if (layers.length === 0) {
            let bytes = CryptoJS.AES.decrypt(decrypted, secret);
            let result = bytes.toString(CryptoJS.enc.Utf8);
            if (!result) throw new Error();
            return result;
        }

        layers.forEach(layer => {
            let layerSpecificKey = secret + "_LayerSalt_L" + layer;
            let bytes = CryptoJS.AES.decrypt(decrypted, layerSpecificKey);
            decrypted = bytes.toString(CryptoJS.enc.Utf8);
            if (!decrypted) throw new Error();
        });
        
        return decrypted;
    } catch (error) {
        return "HATA: Çözülemedi";
    }
}


// --- GÖNDERME FONKSİYONU ---
function encryptAndSend() {
    const msgInput = document.getElementById("message");
    const burnSelect = document.getElementById("burnTimer");
    
    const textVal = msgInput.value.trim();
    const burnTime = parseInt(burnSelect.value);

    // Boş gönderimi engelle
    if (!textVal && !selectedImageBase64) {
        alert("Lütfen bir mesaj yazın veya resim seçin.");
        return;
    }

    // Veri Paketleme (Protokol)
    let payload = "";
    if (selectedImageBase64) {
        // Resim varsa: IMG || VERİ || YAZI
        payload = "IMG||" + selectedImageBase64 + "||" + textVal;
    } else {
        // Sadece yazı: TXT || YAZI
        payload = "TXT||" + textVal;
    }

    // Şifreleme
    const encryptedPayload = applyStrongLayers(payload, SECRET, encSel);

    // Firebase'e Gönder
    push(roomMessagesRef, {
        user: USER,
        text: encryptedPayload,
        time: Date.now(),
        burn: burnTime // İmha süresini de ekliyoruz
    });

    // Temizlik
    msgInput.value = "";
    selectedImageBase64 = null;
    const btn = document.querySelector(".file-upload-label");
    btn.textContent = "📷 FOTOĞRAF";
    btn.style.background = ""; 
    btn.style.color = "";
}


// --- HARİCİ ŞİFRE ÇÖZÜCÜ (SAĞ PANEL) ---
function decryptExternal() {
    const cipherText = document.getElementById("cipher").value.trim();
    const resultDiv = document.getElementById("result");

    if (!cipherText) {
        resultDiv.textContent = "Lütfen şifreli metni yapıştırın.";
        resultDiv.style.color = "var(--neon-pink)";
        return;
    }

    const plainText = removeStrongLayers(cipherText, SECRET, decSel);

    if (plainText.includes("HATA:")) {
        resultDiv.textContent = "ÇÖZÜLEMEDİ: Anahtar veya katmanlar hatalı.";
        resultDiv.style.color = "var(--neon-red)";
        resultDiv.style.borderColor = "var(--neon-red)";
    } else {
        // Temiz bir çıktı ver
        let cleanText = plainText;
        if (cleanText.startsWith("IMG||")) cleanText = "[RESİM DOSYASI İÇERİYOR - ANA EKRANDA AÇINIZ]";
        if (cleanText.startsWith("TXT||")) cleanText = cleanText.replace("TXT||", "");
        
        resultDiv.textContent = cleanText;
        resultDiv.style.color = "var(--neon-green)";
        resultDiv.style.borderColor = "var(--neon-green)";
    }
}


// --- PANİK BUTONU (HER ŞEYİ SİL) ---
function triggerPanic() {
    const confirmPanic = confirm("⚠️ DİKKAT: KIRMIZI KOD!\n\nBu işlem odadaki TÜM MESAJLARI ve KAYITLARI kalıcı olarak silecektir. Geri dönüşü yoktur.\n\nOnaylıyor musun?");
    
    if (confirmPanic) {
        // Odayı komple sil
        remove(ref(db, "rooms/" + ROOM));
        
        // Ekranı karart ve mesaj ver
        document.body.innerHTML = `
            <div style="display:flex; justify-content:center; align-items:center; height:100vh; background:black; color:red; flex-direction:column;">
                <h1 style="font-family:Orbitron; font-size:50px;">SİSTEM İMHA EDİLDİ</h1>
                <p>Tüm veriler temizlendi. Bağlantı kesiliyor...</p>
            </div>
        `;
        
        // 3 saniye sonra sayfayı yenile
        setTimeout(() => {
            location.reload();
        }, 3000);
    }
}

// --- FONKSİYONLARI HTML'E BAĞLA ---
window.enterRoom = enterRoom;
window.encryptAndSend = encryptAndSend;
window.decryptExternal = decryptExternal;
window.triggerPanic = triggerPanic;
