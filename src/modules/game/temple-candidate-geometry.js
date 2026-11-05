import { TEMPLE_SYMBOLS, TEMPLE_PAYLINES, createTempleGeometry } from './temple-rules.js';
// Candidate geometry received from coordinator. NOT an approved item reward model.
// Never transpose: outer arrays are the five reels, not three rows.
export const TEMPLE_CANDIDATE_INDICES = Object.freeze([
 [7,2,1,8,5,0,0,4,5,4,2,3,3,3,0,2,6,1,4,0,6,9,7,1],
 [0,2,4,8,5,3,7,3,4,5,0,1,2,1,2,0,3,6,7,1,6,9,0,4],
 [3,5,8,3,2,1,2,3,7,4,7,4,1,6,4,0,1,0,5,6,0,9,0,2],
 [6,3,8,4,9,4,3,1,2,1,2,0,5,0,0,4,5,7,1,6,0,7,2,3],
 [2,5,0,4,6,6,1,1,2,0,8,9,1,2,5,4,4,3,7,3,0,0,3,7]
].map(Object.freeze));
export function decodeTempleStrips(indices, symbolOrder = TEMPLE_SYMBOLS) {
  if (JSON.stringify(symbolOrder) !== JSON.stringify(TEMPLE_SYMBOLS)) throw Error('Unexpected symbolOrder; no silent ID remap');
  if (!Array.isArray(indices) || indices.length !== 5) throw Error('Five reel strips required, column-major');
  return indices.map(strip => {
    if (!Array.isArray(strip) || strip.length !== 24 || !Array.from(strip).every(id => Number.isInteger(id) && id >= 0 && id < 10)) throw Error('Candidate strips must each have24 valid IDs');
    return strip.map(id => symbolOrder[id]);
  });
}
export const TEMPLE_CANDIDATE_GEOMETRY = createTempleGeometry({
  id:'candidate-24x5-items-pending-v1',columns:5,rows:3,paylines:TEMPLE_PAYLINES,
  reelStrips:decodeTempleStrips(TEMPLE_CANDIDATE_INDICES),provisional:true
});
