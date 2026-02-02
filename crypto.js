let USER="", ROOM="", roomRef;
const encSel=new Set(), decSel=new Set();

function enterRoom(){
  USER=username.value.trim();
  ROOM=room.value.trim();
  if(!USER||!ROOM) return alert("Kullanıcı adı ve oda gerekli");

  userName.textContent=USER;
  roomName.textContent=ROOM;
  login.classList.add("hidden");
  chat.classList.remove("hidden");

  roomRef = fbRef(db,"rooms/"+ROOM);

  fbOnAdd(roomRef,snap=>{
    const d=snap.val();

    const row=document.createElement("div");
    row.className="msg";

    const text=document.createElement("span");
    text.innerHTML=`<b>${d.user}:</b> ${d.text}`;

    const copy=document.createElement("span");
    copy.className="copy";
    copy.textContent="📋 kopyala";

    copy.onclick=()=>{
      navigator.clipboard.writeText(d.text);
      cipher.value=d.text;
      cipher.focus();
    };

    row.appendChild(text);
    row.appendChild(copy);
    log.appendChild(row);
  });
}

function changeRoom(){
  location.reload();
}

function makeLayers(el,set){
  for(let i=1;i<=10;i++){
    const d=document.createElement("div");
    d.className="layer";
    d.textContent="Katman "+i;
    d.onclick=()=>{
      set.has(i)?set.delete(i):set.add(i);
      d.classList.toggle("active");
    };
    el.appendChild(d);
  }
}
makeLayers(encLayers,encSel);
makeLayers(decLayers,decSel);

function applyLayers(t,l){
  let o=t;
  [...l].sort((a,b)=>a-b).forEach(k=>{
    o=[...o].map(c=>String.fromCharCode(c.charCodeAt(0)+k)).join("");
  });
  return o;
}
function removeLayers(t,l){
  let o=t;
  [...l].sort((a,b)=>b-a).forEach(k=>{
    o=[...o].map(c=>String.fromCharCode(c.charCodeAt(0)-k)).join("");
  });
  return o;
}

function encrypt(){
  if(!message.value)return;
  const e=applyLayers(message.value,encSel);
  fbPush(roomRef,{user:USER,text:e,time:Date.now()});
  message.value="";
}

function decrypt(){
  if(!cipher.value)return;
  result.textContent="Çözüm: "+removeLayers(cipher.value,decSel);
}
