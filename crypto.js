import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Firebase Yapılandırman
const firebaseConfig = {
  databaseURL: "https://volktron-chat-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- GLOBAL DEĞİŞKENLER ---
let USER = "", ROOM = "", SECRET = "", roomRef;
const encSel = new Set();
const decSel = new Set();

// --- KATMANLARI (BUTONLARI) OLUŞTURMA ---
function makeLayers(el, set) {
  for (let i = 1; i <= 10; i++) {
    const d = document.createElement("div");
    d.className = "layer";
    d.textContent = "L" + i;
    d.onclick = () => {
      set.has(i) ? set.delete(i) : set.add(i);
      d.classList.toggle("active");
    };
    if(el) el.appendChild(d);
  }
}

// Sayfa yüklendiğinde katman butonlarını DOM'a bas
makeLayers(document.getElementById("encLayers"), encSel);
makeLayers(document.getElementById("decLayers"), decSel);

// --- ODAYA GİRİŞ ---
function enterRoom() {
  USER = document.getElementById("username").value.trim();
  ROOM = document.getElementById("room").value.trim();
  SECRET = document.getElementById("secretKey").value.trim();
  
  if (!USER || !ROOM || !SECRET) {
    return alert("Lütfen Kullanıcı Adı, Oda Adı ve Gizli Anahtar alanlarını doldurun.");
  }

  document.getElementById("userNameDisplay").textContent = USER;
  document.getElementById("roomNameDisplay").textContent = ROOM;
  document.getElementById("login").classList.add("hidden");
  document.getElementById("chat").classList.remove("hidden");

  // Firebase Dinleyicisi
  roomRef = ref(db, "rooms/" + ROOM);
  onChildAdded(roomRef, snap => {
    const d = snap.val();
    const div = document.createElement("div");
    div.className = "msg " + (d.user === USER ? "me" : "other");
    const t = new Date(d.time).toLocaleTimeString();
    
    div.innerHTML = `<b>${d.user}</b> <span style="opacity:.6;font-size:11px;margin-left:5px;">${t}</span><br>${d.text}<span class="copy" title="Şifreyi Çözme Kutusuna Aktar">📋</span>`;
    
    // Kopyala butonuna tıklayınca cipher textarea'sına aktar
    div.querySelector(".copy").onclick = () => {
      document.getElementById("cipher").value = d.text;
    };
    
    const logDiv = document.getElementById("log");
    logDiv.appendChild(div);
    logDiv.scrollTop = logDiv.scrollHeight;
  });
}

// --- GÜÇLÜ AES-256 ŞİFRELEME (ÇOKLU KATMAN) ---
function applyStrongLayers(text, secret, selectedLayers) {
  let encrypted = text;
  let layers = [...selectedLayers].sort((a, b) => a - b);
  
  if (layers.length === 0) {
    return CryptoJS.AES.encrypt(encrypted, secret).toString();
  }

  layers.forEach(layer => {
    let layerSpecificKey = secret + "_LayerSalt_" + layer;
    encrypted = CryptoJS.AES.encrypt(encrypted, layerSpecificKey).toString();
  });
  
  return encrypted;
}

// --- GÜÇLÜ AES-256 ŞİFRE ÇÖZME ---
function removeStrongLayers(ciphertext, secret, selectedLayers) {
  let decrypted = ciphertext;
  let layers = [...selectedLayers].sort((a, b) => b - a);
  
  try {
    if (layers.length === 0) {
       let bytes = CryptoJS.AES.decrypt(decrypted, secret);
       let result = bytes.toString(CryptoJS.enc.Utf8);
       if(!result) throw new Error();
       return result;
    }

    layers.forEach(layer => {
      let layerSpecificKey = secret + "_LayerSalt_" + layer;
      let bytes = CryptoJS.AES.decrypt(decrypted, layerSpecificKey);
      decrypted = bytes.toString(CryptoJS.enc.Utf8);
      if(!decrypted) throw new Error(); 
    });
    
    return decrypted;
  } catch (error) {
    return "⚠ [Çözülemedi: Yanlış Gizli Anahtar veya Eksik/Hatalı Katman Sırası]";
  }
}

// --- MESAJ GÖNDER ---
function encryptAndSend() {
  const msgInput = document.getElementById("message");
  if (!msgInput.value.trim()) return;
  
  const encryptedText = applyStrongLayers(msgInput.value, SECRET, encSel);
  
  push(roomRef, { 
    user: USER, 
    text: encryptedText, 
    time: Date.now() 
  });
  
  msgInput.value = "";
}

// --- MESAJ ÇÖZ ---
function decryptMessage() {
  const cipherInput = document.getElementById("cipher").value.trim();
  const resultDiv = document.getElementById("result");
  
  if (!cipherInput) {
    resultDiv.textContent = "Lütfen çözülecek metni girin.";
    resultDiv.style.color = "#ff77b7";
    return;
  }

  const decryptedText = removeStrongLayers(cipherInput, SECRET, decSel);
  
  if (decryptedText.includes("⚠")) {
    resultDiv.style.color = "#ff4444"; 
  } else {
    resultDiv.style.color = "#7CFF9E"; 
  }
  
  resultDiv.textContent = "Çözüm: " + decryptedText;
}

// HTML'deki onclick eventlerinin bu fonksiyonlara erişebilmesi için window objesine bağlıyoruz
window.enterRoom = enterRoom;
window.encryptAndSend = encryptAndSend;
window.decryptMessage = decryptMessage;
