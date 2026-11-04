// Server state stays authoritative; hide only the wheel's delta until it stops.
let pending=false,hiddenDelta=0;
export function beginWheelBalance(){pending=true;hiddenDelta=0;}
export function maskWheelDelta(delta){if(pending)hiddenDelta=Number.isFinite(delta)?delta:0;}
export function revealWheelBalance(){pending=false;hiddenDelta=0;}
export function getVisibleShards(value){return Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,(Number(value)||0)-(pending?hiddenDelta:0)));}
