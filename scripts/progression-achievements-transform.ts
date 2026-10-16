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
   "{screen==='achievements'&&<AchievementsScreen stats={stats} back={()=>setScreen('home')}/>}\n",
   "{screen==='achievements'&&<ProgressionAchievementsScreen stats={stats} userId={playerAccount.userId} accountLoading={playerAccount.loading} cloudUnlockedSongIds={playerAccount.unlockedSongIds} localEconomy={localSongEconomy} back={()=>setScreen('home')}/>}\n");
  code=required(code,'home achievements copy',
   "<em>{completedAchievements} / {achievements.length} earned</em>",
   "<em>First clears · S ranks · full combos</em>");
  code=required(code,'home career copy',
   "{stats.bestCombo} best combo · {completedAchievements}/{achievements.length} achievements",
   "{stats.bestCombo} best combo · setlist mastery");
  return{code,map:null};
 }};
}
