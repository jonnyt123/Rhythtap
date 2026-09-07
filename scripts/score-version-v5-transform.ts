import type {Plugin} from 'vite';

const required=(source:string,label:string,before:string,after:string)=>{
 if(!source.includes(before))throw new Error(`[score-version-v5] Unable to patch ${label}; transformed layout changed.`);
 return source.replace(before,after);
};

export function scoreVersionV5Transform():Plugin{
 return {name:'rhythtap-score-version-v5-transform',enforce:'pre',transform(source,id){
  const path=id.replaceAll('\\','/');
  let code=source;
  if(path.endsWith('/src/main.tsx')){
   code=required(code,'local Hard personal best reader',
    "const highScoreFor=(songId:string,difficulty:Difficulty)=>Number(localStorage.getItem(`ntr-high-${songId}-${difficulty}`)||0);",
    "const highScoreFor=(songId:string,difficulty:Difficulty)=>Number(localStorage.getItem(`ntr-high-${songId}-${difficulty}${difficulty==='HARD'&&!songId.startsWith('tap-')?'-v5':''}`)||0);");
   code=required(code,'local Hard personal best bucket',
    "const key=`ntr-high-${song.id}-${difficulty}`;",
    "const key=`ntr-high-${song.id}-${difficulty}${difficulty==='HARD'&&!song.id.startsWith('tap-')?'-v5':''}`;");
   return{code,map:null};
  }
  if(path.endsWith('/src/player-account.tsx')){
   code=required(code,'public profile score version filter',
    ".from('player_song_scores').select('*').eq('user_id',data.user_id).order('high_score',{ascending:false}).limit(12)",
    ".from('player_song_scores').select('*').eq('user_id',data.user_id).or('difficulty.neq.HARD,chart_version.eq.5').order('high_score',{ascending:false}).limit(12)");
   return{code,map:null};
  }
  if(path.endsWith('/src/tour-social-ranked.tsx')){
   code=required(code,'ranked leaderboard score version filter',
    ".from('player_song_scores').select('*').eq('song_id',songId).eq('difficulty',difficulty).order('high_score',{ascending:false}).limit(50)",
    ".from('player_song_scores').select('*').eq('song_id',songId).eq('difficulty',difficulty).eq('chart_version',difficulty==='HARD'?5:4).order('high_score',{ascending:false}).limit(50)");
   return{code,map:null};
  }
  return null;
 }};
}
