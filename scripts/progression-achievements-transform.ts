import type {Plugin} from 'vite';

const required=(source:string,label:string,before:string,after:string)=>{
 if(!source.includes(before))throw new Error(`[progress-achievements] ${label} marker missing`);
 return source.replace(before,after);
};

export function progressionAchievementsTransform():Plugin{
 return{name:'rhythtap-progression-achievements-transform',enforce:'pre',transform(source,id){
  if(!id.replaceAll('\\','/').endsWith('/src/main.tsx'))return null;
  let code=source;
  code=required(code,'component import',
   "import {createRoot} from 'react-dom/client';",
   "import {createRoot} from 'react-dom/client';\nimport {ProgressionAchievementsScreen} from './progression-achievements';");
  code=required(code,'achievement render',
   "{screen==='achievements'&&<AchievementsScreen stats={stats} back={()=>setScreen('home')}/>} ",
   "{screen==='achievements'&&<ProgressionAchievementsScreen stats={stats} userId={playerAccount.userId} accountLoading={playerAccount.loading} cloudUnlockedSongIds={playerAccount.unlockedSongIds} localEconomy={localSongEconomy} back={()=>setScreen('home')}/>} ");
  return{code,map:null};
 }};
}
