// SYNTHETIC QA FIXTURES ONLY. Not final math, not an RTP claim or visual design.
// Every deterministic outcome is produced from real circular-strip stops.
const cases = {
  loss: [['ten','jack','queen'],['king','ace','crystal'],['moon','guardian','ten'],['queen','king','ace'],['jack','crystal','moon']],
  leftThree: [['ten','moon','queen'],['jack','moon','king'],['queen','moon','ace'],['king','ace','crystal'],['ace','ten','guardian']],
  trigger: [['scatter','jack','queen'],['king','ace','crystal'],['moon','guardian','scatter'],['queen','king','ace'],['jack','scatter','moon']],
  fiveWild: Array.from({length:5},()=>['wild','wild','wild']),
  fourFromSecond: [['ten','jack','queen'],['moon','moon','moon'],['moon','moon','moon'],['moon','moon','moon'],['moon','moon','moon']],
  lineAndBonus: [['scatter','moon','queen'],['jack','moon','king'],['queen','moon','ace'],['scatter','ace','crystal'],['ace','ten','scatter']]
};
const names = Object.keys(cases);
export const TEMPLE_FIXTURE_CONFIG = {
  id:'qa-wireframe-v1', columns:5, rows:3, provisional:true,
  reelStrips:Array.from({length:5},(_,reel)=>names.flatMap(name=>cases[name][reel])),
  paytable:Object.fromEntries(['ten','jack','queen','king','ace','crystal','moon','guardian'].map(id=>[id,{3:2,4:5,5:12}]).concat([['wild',{3:4,4:8,5:16}]]))
};
export const TEMPLE_FIXTURE_STOPS = Object.freeze(Object.fromEntries(names.map((name,i)=>[name,Object.freeze(Array(5).fill(i*3))])));
