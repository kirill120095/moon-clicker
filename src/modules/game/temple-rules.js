// Pure Moon Temple contract. No UI, wallet, RNG, network or main-game imports.
export const TEMPLE_COLUMNS = 5;
export const TEMPLE_ROWS = 3;
export const TEMPLE_STAKES = Object.freeze([10, 20, 50, 100]);
export const TEMPLE_SYMBOLS = Object.freeze(['ten', 'jack', 'queen', 'king', 'ace', 'crystal', 'moon', 'guardian', 'wild', 'scatter']);
export const TEMPLE_ORDINARY = Object.freeze(TEMPLE_SYMBOLS.slice(0, 8));
export const TEMPLE_PAYLINES = Object.freeze([
  [1,1,1,1,1], [0,0,0,0,0], [2,2,2,2,2], [0,1,2,1,0], [2,1,0,1,2],
  [0,0,1,0,0], [2,2,1,2,2], [1,0,0,0,1], [1,2,2,2,1], [0,1,1,1,0]
].map(Object.freeze));
export const TEMPLE_FREE_SPINS = 10;
const checkedConfigs = new WeakSet();
const checkedGeometries = new WeakSet();

/** Geometry only: no cash paytable or item rewards. */
export function createTempleGeometry(input) {
  if (checkedGeometries.has(input)) return input;
  if (!input || typeof input.id !== 'string' || !/^[a-zA-Z0-9._/-]{1,100}$/.test(input.id)) throw Error('Temple config needs a versioned id');
  if (input.columns !== 5 || input.rows !== 3) throw Error('Temple contract is exactly 5 columns × 3 rows');
  if (input.paylines && JSON.stringify(input.paylines) !== JSON.stringify(TEMPLE_PAYLINES)) throw Error('The ten agreed paylines cannot change silently');
  if (!Array.isArray(input.reelStrips) || input.reelStrips.length !== 5) throw Error('Five circular reel strips are required');
  const reelStrips = input.reelStrips.map(strip => {
    if (!Array.isArray(strip) || strip.length < 3 || strip.length > 4096 ||
        !Array.from(strip).every(id => TEMPLE_SYMBOLS.includes(id))) throw Error('Invalid circular reel strip');
    return Object.freeze([...strip]);
  });
  const geometry = Object.freeze({id:input.id,columns:5,rows:3,reelStrips:Object.freeze(reelStrips),paylines:TEMPLE_PAYLINES,provisional:input.provisional===true});
  checkedGeometries.add(geometry);return geometry;
}

/**
 * Inject immutable, versioned strips and a line-bet paytable from game design.
 * Config: {id, columns:5, rows:3, reelStrips:string[5][], paytable:{id:{3,4,5}},
 *          paylines?: number[10][5], provisional?:boolean}.
 * Ordinary rows are required; a literal-WILD payout row is optional (otherwise 0).
 * Integer multipliers and monotone counts are required: no silent rounding.
 */
export function createTempleConfig(input) {
  if (checkedConfigs.has(input)) return input;
  const geometry = createTempleGeometry(input);
  const paytable = {};
  if (!input.paytable || typeof input.paytable !== 'object') throw Error('A line-bet paytable is required');
  for (const id of Object.keys(input.paytable)) if (![...TEMPLE_ORDINARY, 'wild'].includes(id)) throw Error('SCATTER has no cash payout in this version');
  for (const id of [...TEMPLE_ORDINARY, 'wild']) {
    const source = input.paytable[id];
    if (!source && id !== 'wild') throw Error('Missing ordinary symbol paytable row: ' + id);
    if (source && Object.keys(source).some(count => !['3','4','5'].includes(count))) throw Error('Only counts 3–5 pay');
    const values = [3,4,5].map(count => source ? source[count] : 0);
    if (!values.every(n => Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000) || values[0] > values[1] || values[1] > values[2]) throw Error('Use nonnegative monotone integer line multipliers');
    paytable[id] = Object.freeze(Object.fromEntries([3,4,5].map((count, i) => [count, values[i]])));
  }
  const result = Object.freeze({ id: input.id, columns: 5, rows: 3,
    reelStrips: geometry.reelStrips, paytable: Object.freeze(paytable),
    paylines: TEMPLE_PAYLINES, provisional: input.provisional === true });
  checkedConfigs.add(result);
  return result;
}

export function validateTempleStake(stake) {
  if (!TEMPLE_STAKES.includes(stake)) throw Error('Stake must be 10, 20, 50 or 100');
  return stake;
}

/** Stop denotes the TOP visible symbol. The next two cells wrap around that strip. */
export function templeGridFromStops(config, stops) {
  config = createTempleGeometry(config);
  if (!Array.isArray(stops) || stops.length !== 5 || !Array.from(stops).every((stop, i) => Number.isInteger(stop) && stop >= 0 && stop < config.reelStrips[i].length)) throw Error('Five valid stop indices are required');
  return stops.map((stop, reel) => Array.from({ length: 3 }, (_, row) => config.reelStrips[reel][(stop + row) % config.reelStrips[reel].length]));
}

export function validateTempleGrid(grid) {
  if (!Array.isArray(grid) || grid.length !== 5 || !Array.from(grid).every(column => Array.isArray(column) && column.length === 3 && Array.from(column).every(id => TEMPLE_SYMBOLS.includes(id)))) throw Error('Grid must be column-major grid[5][3] with known IDs');
  return grid;
}

/** One best actual prefix candidate from reel 0. WILD never stands for SCATTER.
 * Ties: greater gross, then longer count, then symbol order above (stable UI identity).
 */
export function evaluateTempleLine(config, symbols, lineBet) {
  config = createTempleConfig(config);
  if (!Array.isArray(symbols) || symbols.length !== 5 || !Array.from(symbols).every(id => TEMPLE_SYMBOLS.includes(id))) throw Error('A line needs five known symbols');
  if (!Number.isSafeInteger(lineBet) || lineBet < 1 || !TEMPLE_STAKES.map(s => s / 10).includes(lineBet)) throw Error('Invalid line bet');
  const bestScore = scoreTempleLine(symbols, config.paytable);
  const best = bestScore ? {symbol:bestScore.symbol,count:bestScore.count,multiplier:bestScore.score,gross:bestScore.score*lineBet} : null;
  return best;
}

export function evaluateTempleGrid(config, grid, totalStake) {
  config = createTempleConfig(config); validateTempleGrid(grid); validateTempleStake(totalStake);
  const lineBet = totalStake / 10, lineWins = [];
  TEMPLE_PAYLINES.forEach((rows, index) => {
    const symbols = rows.map((row, reel) => grid[reel][row]);
    const win = evaluateTempleLine(config, symbols, lineBet);
    if (win) lineWins.push({ lineId: index + 1, rows: [...rows], ...win,
      positions: rows.slice(0, win.count).map((row, reel) => ({ reel, row })) });
  });
  const scatterPositions = [];
  grid.forEach((column, reel) => column.forEach((id, row) => { if (id === 'scatter') scatterPositions.push({ reel, row }); }));
  return { grid: grid.map(c => [...c]), totalStake, lineBet, lineWins,
    gross: lineWins.reduce((sum, win) => sum + win.gross, 0),
    scatterCount: scatterPositions.length, scatterPositions, triggersFreeSpins: scatterPositions.length >= 3 };
}


/** Physical matches only. Ranking/reward mapping must be supplied explicitly. */
export function templeLineCandidates(symbols) {
  if (!Array.isArray(symbols) || symbols.length!==5 || !Array.from(symbols).every(id=>TEMPLE_SYMBOLS.includes(id))) throw Error('A line needs five known IDs');
  const candidates=[];
  for(const symbol of [...TEMPLE_ORDINARY,'wild']) {
    let count=0;
    while(count<5&&(symbols[count]===symbol||(symbol!=='wild'&&symbols[count]==='wild')))count++;
    if(count>=3)candidates.push({symbol,count});
  }
  return candidates;
}

/** Unitless line score, NOT shards/cash/items. No fallback score table. */
export function scoreTempleLine(symbols, scoreTable) {
  if(!scoreTable || typeof scoreTable!=='object')throw Error('Explicit score table required; reward mapping is not inferred from cash RTP');
  let best=null;
  for(const candidate of templeLineCandidates(symbols)) {
    const score=scoreTable[candidate.symbol]?.[candidate.count]??0;
    if(!Number.isSafeInteger(score)||score<0)throw Error('Invalid unitless score');
    if(score>0&&(!best||score>best.score||(score===best.score&&candidate.count>best.count)))best={...candidate,score};
  }
  return best;
}
export function scoreTempleGrid(grid, scoreTable) {
  validateTempleGrid(grid);
  const lineWins=[];
  TEMPLE_PAYLINES.forEach((rows,index)=>{
    const win=scoreTempleLine(rows.map((row,reel)=>grid[reel][row]),scoreTable);
    if(win)lineWins.push({lineId:index+1,rows:[...rows],...win,positions:rows.slice(0,win.count).map((row,reel)=>({reel,row}))});
  });
  return {grid:grid.map(c=>[...c]),lineWins,totalLineScore:lineWins.reduce((sum,win)=>sum+win.score,0)};
}
