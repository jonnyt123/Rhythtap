import type {Plugin} from 'vite';

const required=(code:string,label:string,before:string,after:string)=>{
 if(!code.includes(before))throw new Error(\`[coin-bonuses] \${label} marker missing\`);
 return code.replace(before,after);
};

const main=(source:string)=>{
 let code=source;
 code=required(code,'economy import',
  "import {STARTER_SONG_IDS,awardLocalCoins,coinsForXpAward,isStarterSong,loadLocalSongEconomy,purchaseLocalSong,songPrice} from './song-economy';",
  "import {STARTER_SONG_IDS,awardLocalSongCoins,coinsForXpAward,isStarterSong,loadLocalSongEconomy,purchaseLocalSong,songPrice} from './song-economy';");
 code=required(code,'result bonus protocol',
  "events?:GameplayJudgementEvent[],runId?:string,progressPending?:boolean,progressError?:string};",
  "events?:GameplayJudgementEvent[],runId?:string,coinsAwarded?:number,coinBaseAwarded?:number,coinBonusAwarded?:number,coinBonuses?:{firstClear:number;sRank:number;fullCombo:number},progressPending?:boolean,progressError?:string};");
 code=required(code,'guest anti-farm award',
  "if(official)setLocalSongEconomy(current=>awardLocalCoins(current,xpEarned));setResult(",
  "const coinReward=official?awardLocalSongCoins(localSongEconomy,{songId:song.id,difficulty,xpAward:xpEarned,accuracy:r.accuracy,misses:r.counts.MISS}):null;if(coinReward)setLocalSongEconomy(coinReward.economy);setResult(");
 code=required(code,'guest result breakdown',
  "setResult({...r,xpEarned,dailyBonus,levelUp:level>previousLevel,previousLevel,progressPending:false});",
  "setResult({...r,xpEarned,dailyBonus,coinsAwarded:coinReward?.totalCoins??0,coinBaseAwarded:coinReward?.baseCoins??0,coinBonusAwarded:coinReward?.bonusCoins??0,coinBonuses:coinReward?.bonuses,levelUp:level>previousLevel,previousLevel,progressPending:false});");
 code=required(code,'cloud result breakdown',
  "setResult(current=>({...current,score:award.validatedScore,accuracy:award.validatedAccuracy,maxCombo:award.validatedMaxCombo,counts:award.validatedCounts,xpEarned:award.xpAwarded,dailyBonus:award.dailyBonus,levelUp:award.level>previousLevel,previousLevel,progressPending:false,progressError:''}));",
  "setResult(current=>({...current,score:award.validatedScore,accuracy:award.validatedAccuracy,maxCombo:award.validatedMaxCombo,counts:award.validatedCounts,xpEarned:award.xpAwarded,dailyBonus:award.dailyBonus,coinsAwarded:award.coinsAwarded,coinBaseAwarded:award.coinBaseAwarded,coinBonusAwarded:award.coinBonusAwarded,coinBonuses:award.coinBonuses,levelUp:award.level>previousLevel,previousLevel,progressPending:false,progressError:''}));");
 code=required(code,'results reward display',
  "<strong>{result.progressPending?'VERIFYING…':result.progressError?'NOT SAVED':\`+\${coinsForXpAward(result.xpEarned).toLocaleString()}\`}</strong></span></div>",
  "<strong>{result.progressPending?'VERIFYING…':result.progressError?'NOT SAVED':\`+\${(result.coinsAwarded??coinsForXpAward(result.xpEarned)).toLocaleString()}\`}</strong>{!result.progressPending&&!result.progressError&&(result.coinBonusAwarded??0)>0&&<em>+\${result.coinBonusAwarded} BONUS{result.coinBonuses?.firstClear?' · FIRST CLEAR':''}{result.coinBonuses?.sRank?' · S RANK':''}{result.coinBonuses?.fullCombo?' · FULL COMBO':''}</em>}</span></div>");
 return code;
};

const account=(source:string)=>{
 let code=source;
 code=required(code,'award type',
  "dailyBonus:number;coins:number;coinsAwarded:number;validatedScore:number;",
  "dailyBonus:number;coins:number;coinsAwarded:number;coinBaseAwarded:number;coinBonusAwarded:number;coinBonuses:{firstClear:number;sRank:number;fullCombo:number};validatedScore:number;");
 code=required(code,'award parse',
  "dailyBonus:Number(row.dailyBonus),coins:Number.isFinite(Number(row.coins))?Number(row.coins):NaN,coinsAwarded:Number(row.coinsAwarded)||0,validatedScore:Number(validated.score)||0,",
  "dailyBonus:Number(row.dailyBonus),coins:Number.isFinite(Number(row.coins))?Number(row.coins):NaN,coinsAwarded:Number(row.coinsAwarded)||0,coinBaseAwarded:Number(row.coinBaseAwarded)||0,coinBonusAwarded:Number(row.coinBonusAwarded)||0,coinBonuses:{firstClear:Number(row.coinBonuses?.firstClear)||0,sRank:Number(row.coinBonuses?.sRank)||0,fullCombo:Number(row.coinBonuses?.fullCombo)||0},validatedScore:Number(validated.score)||0,");
 return code;
};

export function coinBonusTransform():Plugin{return{name:'rhythtap-coin-bonus-transform',enforce:'pre',transform(source,id){const file=id.replaceAll('\\','/');if(file.endsWith('/src/main.tsx'))return{code:main(source),map:null};if(file.endsWith('/src/player-account.tsx'))return{code:account(source),map:null};return null}}}
