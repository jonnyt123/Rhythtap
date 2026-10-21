import type {Plugin} from 'vite';

const replaceRequired=(code:string,label:string,before:string,after:string)=>{
 if(!code.includes(before))throw new Error('[beatmap-recorder] '+label+' marker missing');
 return code.replace(before,after);
};

export function beatmapRecorderTransform():Plugin{
 return{name:'rhythtap-beatmap-recorder-transform',enforce:'pre',transform(source,id){
  if(!id.replaceAll('\\','/').endsWith('/src/main.tsx'))return null;
  let code=source;
  code=replaceRequired(code,'import',"import {createRoot} from 'react-dom/client';",
   "import {createRoot} from 'react-dom/client';\nimport {BeatmapRecorder,type RecordedBeatmapDraft} from './beatmap-recorder';");
  code=replaceRequired(code,'screen type',"'achievements';","'achievements'|'beatmapRecorder';");
  code=replaceRequired(code,'save callback'," const attachAudio=async(id:string,file:File)=>{",
   " const saveRecordedBeatmap=async(draft:RecordedBeatmapDraft)=>{if(!draft.notes.length)throw new Error('Record at least one note.');const id='tap-recorded-'+crypto.randomUUID();const notes=draft.notes as Note[];const newSong:Song={id,title:draft.title,artist:draft.artist,bpm:draft.bpm,color:'#ff8c48',root:43,progression:[0,5,3,7],melody:melodyVoltage,unlockLevel:1,duration:draft.duration,localAudio:true,audioName:draft.file.name,charts:{EASY:notes,NORMAL:notes,HARD:notes}};await storeAudio(id,draft.file);try{const next=[...library,newSong];saveImportedSongs(next);setLibrary(next);setSong(newSong);setScreen('library')}catch(error){await deleteStoredAudio(id);throw error}};\n const attachAudio=async(id:string,file:File)=>{");
  code=replaceRequired(code,'recorder render',
   "  {screen==='library'&&<ImportedLibrary",
   "  {screen==='beatmapRecorder'&&<BeatmapRecorder onBack={()=>setScreen('library')} onSave={saveRecordedBeatmap}/>}\n  {screen==='library'&&<ImportedLibrary");
  code=replaceRequired(code,'library callback',
   "scores={()=>setScreen('leaderboard')} back={()=>setScreen('home')}",
   "scores={()=>setScreen('leaderboard')} createBeatmap={()=>setScreen('beatmapRecorder')} back={()=>setScreen('home')}");
  code=replaceRequired(code,'library component props',
   "function ImportedLibrary({songs,difficulty,setDifficulty,importTap,attachAudio,setChartOffset,removeSong,scores,back,play}:",
   "function ImportedLibrary({songs,difficulty,setDifficulty,importTap,attachAudio,setChartOffset,removeSong,scores,createBeatmap,back,play}:");
  code=replaceRequired(code,'library component type',
   "removeSong:(id:string)=>void,scores:()=>void,back:()=>void,play:",
   "removeSong:(id:string)=>void,scores:()=>void,createBeatmap:()=>void,back:()=>void,play:");
  code=replaceRequired(code,'library create button',
   "<label className=\"library-import\"><FileUp/> IMPORT .TAP",
   "<button type=\"button\" className=\"library-create\" onClick={createBeatmap}><Music2/> CREATE BEATMAP</button><label className=\"library-import\"><FileUp/> IMPORT .TAP");
  code=replaceRequired(code,'empty library create',
   "<p>Import a Phoenix-style .tap file to add it to your permanent local song library.</p>",
   "<p>Upload a song and tap your own note pattern, or import an existing .tap chart.</p><button type=\"button\" className=\"primary library-empty-create\" onClick={createBeatmap}><Music2/> CREATE A BEATMAP</button>");
  return{code,map:null};
 }};
}
