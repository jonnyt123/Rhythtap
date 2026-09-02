import {makeWeightedBeatChart,makeWeightedOnsetChart,type WeightedDifficulty,type WeightedNote} from '../supabase/functions/_shared/weighted-chart-v4.ts';
import {flyEagleEvents,neverLeftEvents,sicknessEvents} from '../src/audioChartData.ts';

const beatSongs=[
 ['my-immortal',76,232,270.497,4],
 ['crazy-train',136,325,226.325,1],
 ['kill-you',107.666,232,264.411,2],
 ['kryptonite',99.384,627,234.292,0],
 ['through-fire-flames',198.8,1324,300.121,3],
] as const;
const onsetSongs=[['sickness',sicknessEvents],['never-left',neverLeftEvents],['fly-eagle',flyEagleEvents]] as const;
const minGap:Record<WeightedDifficulty,number>={EASY:180,NORMAL:115,HARD:70};
const difficulties:WeightedDifficulty[]=['EASY','NORMAL','HARD'];

const assertPlayable=(name:string,difficulty:WeightedDifficulty,notes:WeightedNote[])=>{
 if(!notes.length)throw new Error(`${name} ${difficulty}: empty chart`);
 const perLane=[0,1,2].map(lane=>notes.filter(note=>note.lane===lane));
 for(const laneNotes of perLane){
  for(let i=1;i<laneNotes.length;i++){
   const previous=laneNotes[i-1],current=laneNotes[i],gap=current.time-previous.time;
   if(gap<minGap[difficulty])throw new Error(`${name} ${difficulty}: lane ${current.lane} repeat ${gap.toFixed(1)}ms is below ${minGap[difficulty]}ms`);
   if(previous.duration&&current.time<previous.time+previous.duration-100)throw new Error(`${name} ${difficulty}: note overlaps active hold on lane ${current.lane}`);
  }
 }
 const simultaneous=new Map<number,number>();
 for(const note of notes)simultaneous.set(note.time,(simultaneous.get(note.time)||0)+1);
 const maxChord=Math.max(...simultaneous.values());
 if(maxChord>2)throw new Error(`${name} ${difficulty}: generated ${maxChord}-note chord on a 3-lane touch chart`);
 if(difficulty==='EASY'&&maxChord>1)throw new Error(`${name} EASY: chords are not allowed`);
};

Deno.test('chart v4 shipped beat-grid songs meet touch ergonomics',()=>{
 for(const [name,bpm,offset,duration,seed] of beatSongs)for(const difficulty of difficulties)assertPlayable(name,difficulty,makeWeightedBeatChart(bpm,offset,duration,difficulty,seed));
});

Deno.test('chart v4 onset-driven songs meet touch ergonomics',()=>{
 for(const [name,events] of onsetSongs)for(const difficulty of difficulties)assertPlayable(name,difficulty,makeWeightedOnsetChart(events,difficulty));
});
