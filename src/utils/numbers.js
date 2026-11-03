// Shared compact notation for currency, HP and damage.
export function formatNumber(value){
 if(value===undefined||value===null||!Number.isFinite(Number(value)))return '0';
 const num=Math.floor(Number(value)),abs=Math.abs(num);
 for(const [size,suffix] of [[1e15,'Qa'],[1e12,'T'],[1e9,'B'],[1e6,'M'],[1e4,'K']]){
  if(abs>=size)return (num/(suffix==='K'?1e3:size)).toFixed(1)+suffix;
 }
 return num.toLocaleString('ru-RU');
}
