// Server state stays authoritative; hide only the wheel's delta until it stops.
let pending=false,hiddenDelta=0,casinoSnapshot=null;
export function beginWheelBalance(casinoTotals){pending=true;hiddenDelta=0;casinoSnapshot={totalWon:Number(casinoTotals?.totalWon)||0,totalLost:Number(casinoTotals?.totalLost)||0};}
export function maskWheelDelta(delta){if(pending)hiddenDelta=Number.isFinite(delta)?delta:0;}
export function revealWheelBalance(){pending=false;hiddenDelta=0;casinoSnapshot=null;}
export function getVisibleShards(value){return Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,(Number(value)||0)-(pending?hiddenDelta:0)));}

// The server settles a spin immediately; keep casino profile counters unchanged until the wheel stops.
export function getVisibleCasinoTotals(totals){return casinoSnapshot||{totalWon:Number(totals?.totalWon)||0,totalLost:Number(totals?.totalLost)||0};}
