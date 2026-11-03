// Shared compact notation for currency, HP and damage.
export function formatNumber(value){
 if(value===undefined||value===null||!Number.isFinite(Number(value)))return '0';
 const num=Math.floor(Number(value)),abs=Math.abs(num);
 for(const [size,suffix] of [[1e15,'Qa'],[1e12,'T'],[1e9,'B'],[1e6,'M'],[1e4,'K']]){
  if(abs>=size)return (num/(suffix==='K'?1e3:size)).toFixed(1)+suffix;
 }
 return num.toLocaleString('ru-RU');
}

/** Balances never round up; prices never round down across an affordability boundary. */
function formatCurrency(value,round){
 const num=Math.max(0,Math.floor(Number(value)||0));
 if(!Number.isFinite(num))return '0';
 for(const [threshold,divisor,suffix] of [[1e15,1e15,'Qa'],[1e12,1e12,'T'],[1e9,1e9,'B'],[1e6,1e6,'M'],[1e4,1e3,'K']]){
  if(num>=threshold)return (round(num/(divisor/100))/100).toFixed(2).replace(/\.?0+$/,'')+suffix;
 }
 return num.toLocaleString('ru-RU');
}
export function formatMoney(value){return formatCurrency(value,Math.floor);}
export function formatPrice(value){return formatCurrency(value,Math.ceil);}
export function formatExact(value){return Math.max(0,Math.floor(Number(value)||0)).toLocaleString('ru-RU');}

/** Cosmic base damage can contain tenths before final damage is rounded. */
export function formatBaseDamage(value){
 const num=Number(value);if(!Number.isFinite(num))return '0';
 return Math.abs(num)<1e4?num.toLocaleString('ru-RU',{maximumFractionDigits:1}):formatNumber(num);
}
