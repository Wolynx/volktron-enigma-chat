/* ================= GLOBAL ================= */
let USER = "";
let ROOM = "";
let roomRef = null;
const db = firebase.database();

const encSel = new Set();
const decSel = new Set();

/* ================= SIMPLE CRYPTO ================= */
function xorCrypt(text, key) {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    out += String.fromCharCode(
      text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }
  return out;
}

/* ================= LAYERS ================= */
function makeLayers(el, set) {
  for (let i = 1; i <= 10; i++) {
    const d = document.createElement("div");
    d.className = "layer";
    d.textContent = "Katman " + i;
    d.onclick = () => {
      if (set.has(i)) set.delete(i);
      else set.add(i);
      d.classList.toggle("active");
    };
    el.appendChild(d);
  }
}

makeLayers(document.getElementById("encLayers"), encSel);
makeLayers(document.getElementById("decLayers"), decSel);

/* ================= LOGIN ================= */
function enterRoom() {
  USER = document.getElementById("username").value.trim();
  ROOM = document.getElementById("room").value.trim();
  const SECRET = document.getElementById("secret").value;

  if (!USER || !ROOM || !SECRET) {
    alert("Eksik bilgi");
    return;
  }

  document.getElementById("login").classList.add("hidden");
  document.getElementById("chat").classList.remove("hidden");
  document.getElementById("userName").textContent = USER;
  document.getElementById("roomName").textContent = ROOM;

  roomRef = db.ref("rooms/" + ROOM);
  roomRef.on("child_added", snap => {
    const d = snap.val();
    const div = document.createElement("div");
    div.className = "msg " + (d.user === USER ? "me" : "other");
    div.innerHTML =
      "<b>" + d.user + "</b><br>" +
      xorCrypt(d.text, SECRET);
    document.getElementById("log").appendChild(div);
  });
}

/* ================= SEND ================= */
function sendMsg() {
  const msg = document.getElementById("message").value;
  const SECRET = document.getElementById("secret").value;
  if (!msg) return;

  roomRef.push({
    user: USER,
    text: xorCrypt(msg, SECRET),
    time: Date.now()
  });

  document.getElementById("message").value = "";
}

/* ================= MANUAL DECRYPT ================= */
function manualDecrypt() {
  const cipher = document.getElementById("cipher").value;
  const SECRET = document.getElementById("secret").value;
  document.getElementById("result").textContent =
    "Çözüm: " + xorCrypt(cipher, SECRET);
}
