const ROTORS = [1,2,3,5,7,11,13,17,19,23]; // 10 kabuk

function encrypt(msg, activeRotors){
    let result = msg;
    for(let i=0;i<ROTORS.length;i++){
        if(!activeRotors[i]) continue;
        result = caesarShift(result, ROTORS[i]);
    }
    return result;
}

function decrypt(msg, activeRotors){
    let result = msg;
    for(let i=ROTORS.length-1;i>=0;i--){
        if(!activeRotors[i]) continue;
        result = caesarShift(result, -ROTORS[i]);
    }
    return result;
}

function caesarShift(msg, shift){
    let result = "";
    for(let i=0;i<msg.length;i++){
        result += String.fromCharCode(msg.charCodeAt(i)+shift);
    }
    return result;
}
