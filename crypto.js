function caesarEncrypt(text, shift = 3) {
  return [...text].map(c => {
    if (/[a-z]/i.test(c)) {
      const code = c.charCodeAt(0);
      const base = code <= 90 ? 65 : 97;
      return String.fromCharCode(((code - base + shift) % 26) + base);
    }
    return c;
  }).join("");
}

function caesarDecrypt(text, shift = 3) {
  return caesarEncrypt(text, 26 - shift);
}

function applyLayer(text, type, encrypt = true) {
  try {
    if (type === "caesar")
      return encrypt ? caesarEncrypt(text) : caesarDecrypt(text);

    if (type === "base64")
      return encrypt ? btoa(unescape(encodeURIComponent(text)))
                     : decodeURIComponent(escape(atob(text)));

    if (type === "reverse")
      return [...text].reverse().join("");

    return text;
  } catch {
    return "[⚠ Çözülemedi]";
  }
}
