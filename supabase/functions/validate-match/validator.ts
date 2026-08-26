export type Difficulty='EASY'|'NORMAL'|'HARD';
export type JudgementKind='PERFECT'|'GREAT'|'GOOD'|'MISS'|'HOLD'|'HOLD_BREAK';
export type Note={id:number,time:number,lane:number,duration?:number};
export type JudgementEvent={kind:JudgementKind,atMs:number,noteId:number,lane:number};
export type OnsetEvent=readonly [time:number,lane:number,strength:number];
export type CanonicalChart={songId:string,difficulty:Difficulty,notes:Note[],endMs:number};
export type ValidatedResult={score:number,accuracy:number,maxCombo:number,eventCount:number,noteCount:number,holdCount:number,perfect:number,great:number,good:number,miss:number,normalizedEvents:JudgementEvent[]};

export const TIMING={perfect:55,great:110,good:220} as const;
const HIT_KINDS=new Set<JudgementKind>(['PERFECT','GREAT','GOOD']);
const ALL_KINDS=new Set<JudgementKind>(['PERFECT','GREAT','GOOD','MISS','HOLD','HOLD_BREAK']);
const SYNTH_SONGS:Record<string,{bpm:number,melody:number[]}>= {
 voltage:{bpm:118,melody:[12,15,19,17,12,10,7,10]},
 afterglow:{bpm:132,melody:[12,14,15,19,17,15,14,10]},
 gravity:{bpm:102,melody:[12,19,17,15,14,10,12,7]},
};
const BEAT_SONGS:Record<string,{bpm:number,offset:number,duration:number,seed:number}>={
 'my-immortal':{bpm:76,offset:232,duration:270.497,seed:4},
 'crazy-train':{bpm:136,offset:325,duration:226.325,seed:1},
 'kill-you':{bpm:107.666,offset:232,duration:264.411,seed:2},
 kryptonite:{bpm:99.384,offset:627,duration:234.292,seed:0},
 'through-fire-flames':{bpm:198.8,offset:1324,duration:300.121,seed:3},
};
const AUDIO_EXPORTS:Record<string,string>={sickness:'sicknessEvents','never-left':'neverLeftEvents','fly-eagle':'flyEagleEvents'};

const laneFor=(pitch:number,melody:number[])=>{const low=Math.min(...melody),high=Math.max(...melody);return Math.max(0,Math.min(2,Math.round((pitch-low)/Math.max(1,high-low)*2)))};
export const makeMelodyChart=(bpm:number,melody:number[],difficulty:Difficulty,bars=20):Note[]=>{
 const step=30000/bpm,out:Note[]=[];let id=0;
 for(let n=0;n<bars*8;n++){
  if(difficulty==='EASY'&&n%2)continue;
  const pitch=melody[n%melody.length],lane=laneFor(pitch,melody),next=melody[(n+1)%melody.length];
  out.push({id:id++,time:1800+n*step,lane,duration:next===pitch?step*.9:undefined});
  if(difficulty!=='EASY'&&n%8===0)out.push({id:id++,time:1800+n*step,lane:(lane+1)%3});
  if(difficulty==='HARD'&&n%8===4)out.push({id:id++,time:1800+n*step,lane:(lane+2)%3});
 }
 return out;
};

export const makeBeatChart=(bpm:number,offset:number,duration:number,difficulty:Difficulty,seed:number):Note[]=>{
 const beat=60000/bpm,step=difficulty==='EASY'?beat:beat/2,out:Note[]=[];let id=0,n=0;
 for(let time=offset;time<duration*1000-700;time+=step,n++){
  const lane=(n*2+Math.floor(n/4)+seed)%3;
  out.push({id:id++,time,lane,duration:n%32===20?beat*(difficulty==='EASY'?1:1.5):undefined});
  if(difficulty!=='EASY'&&n%8===0)out.push({id:id++,time,lane:(lane+1)%3});
  if(difficulty==='HARD'&&n%4===3)out.push({id:id++,time:time+step/2,lane:(lane+2+seed)%3});
 }
 return out;
};

export const makeOnsetChart=(events:readonly OnsetEvent[],difficulty:Difficulty):Note[]=>{
 const threshold={EASY:72,NORMAL:46,HARD:20}[difficulty],gap={EASY:330,NORMAL:170,HARD:85}[difficulty],out:Note[]=[];let id=0,last=-Infinity;
 for(let i=0;i<events.length;i++){
  const [time,sourceLane,strength]=events[i],lane=sourceLane%3;
  if(strength<threshold||time-last<gap)continue;
  const next=events[i+1]?.[0]??time;
  out.push({id:id++,time,lane,duration:strength>88&&next-time>650?Math.min(1200,(next-time)*.62):undefined});
  if(difficulty==='NORMAL'&&strength>88)out.push({id:id++,time,lane:(lane+1)%3});
  if(difficulty==='HARD'&&strength>70)out.push({id:id++,time,lane:(lane+2)%3});
  last=time;
 }
 return out;
};

export const parseOnsetEvents=(source:string,exportName:string):OnsetEvent[]=>{
 const marker=`export const ${exportName}:readonly OnsetEvent[]=`;
 const markerIndex=source.indexOf(marker);
 if(markerIndex<0)throw new Error(`Authoritative chart source is missing ${exportName}`);
 const start=source.indexOf('[',markerIndex+marker.length),end=source.indexOf(';',start);
 if(start<0||end<0)throw new Error(`Unable to parse ${exportName}`);
 const parsed=JSON.parse(source.slice(start,end));
 if(!Array.isArray(parsed))throw new Error(`Invalid ${exportName}`);
 return parsed.map((raw:unknown)=>{
  if(!Array.isArray(raw)||raw.length!==3)throw new Error(`Invalid ${exportName} event`);
  const time=Number(raw[0]),lane=Number(raw[1]),strength=Number(raw[2]);
  if(!Number.isFinite(time)||!Number.isInteger(lane)||!Number.isFinite(strength))throw new Error(`Invalid ${exportName} event`);
  return [time,lane,strength] as const;
 });
};

export const buildCanonicalChart=(songId:string,difficulty:Difficulty,onsetSource?:string):CanonicalChart=>{
 let notes:Note[];
 const synth=SYNTH_SONGS[songId],beatSong=BEAT_SONGS[songId];
 if(synth)notes=makeMelodyChart(synth.bpm,synth.melody,difficulty);
 else if(beatSong)notes=makeBeatChart(beatSong.bpm,beatSong.offset,beatSong.duration,difficulty,beatSong.seed);
 else{
  const exportName=AUDIO_EXPORTS[songId];
  if(!exportName||!onsetSource)throw new Error('Unsupported multiplayer chart');
  notes=makeOnsetChart(parseOnsetEvents(onsetSource,exportName),difficulty);
 }
 if(!notes.length)throw new Error('Authoritative chart is empty');
 const endMs=notes.at(-1)!.time+2200;
 return{songId,difficulty,notes,endMs};
};

const claimedJudge=(distance:number):Exclude<JudgementKind,'MISS'|'HOLD'|'HOLD_BREAK'>|null=>distance<=TIMING.perfect?'PERFECT':distance<=TIMING.great?'GREAT':distance<=TIMING.good?'GOOD':null;

const normalizeEvents=(input:unknown,chart:CanonicalChart):JudgementEvent[]=>{
 if(!Array.isArray(input)||input.length>chart.notes.length*2+16)throw new Error('Invalid event log length');
 let previous=-1;
 return input.map((raw:any,index:number)=>{
  const kind=String(raw?.kind) as JudgementKind,atMs=Number(raw?.atMs),noteId=Number(raw?.noteId),lane=Number(raw?.lane);
  if(!ALL_KINDS.has(kind)||!Number.isFinite(atMs)||atMs<0||atMs>chart.endMs+30000||!Number.isInteger(noteId)||noteId<0||!Number.isInteger(lane)||lane<0||lane>2)throw new Error(`Invalid judgement event at ${index}`);
  const rounded=Math.round(atMs);
  if(rounded<previous-5)throw new Error('Judgement event log is out of order');
  previous=Math.max(previous,rounded);
  return{kind,atMs:rounded,noteId,lane};
 });
};

export const validateAgainstChart=(input:unknown,chart:CanonicalChart):ValidatedResult=>{
 const events=normalizeEvents(input,chart),notesById=new Map(chart.notes.map(note=>[note.id,note])),initial=new Map<number,JudgementEvent>(),holds=new Map<number,JudgementEvent>(),holdBreaks=new Map<number,JudgementEvent>();
 for(const event of events){
  const note=notesById.get(event.noteId);
  if(!note)throw new Error(`Unknown note ${event.noteId}`);
  if(event.lane!==note.lane)throw new Error(`Lane mismatch for note ${event.noteId}`);
  if(event.kind==='HOLD'||event.kind==='HOLD_BREAK'){
   if(!note.duration)throw new Error(`${event.kind==='HOLD'?'Hold bonus':'Hold break'} on non-hold note ${event.noteId}`);
   const first=initial.get(note.id);
   if(!first||first.kind==='MISS')throw new Error(`${event.kind==='HOLD'?'Hold bonus':'Hold break'} without a valid hold start for note ${event.noteId}`);
   if(holds.has(note.id)||holdBreaks.has(note.id))throw new Error(`Duplicate hold outcome for note ${event.noteId}`);
   const tail=note.time+note.duration;
   if(event.kind==='HOLD'){
    if(event.atMs<tail-150)throw new Error(`Hold completed too early for note ${event.noteId}`);
    holds.set(note.id,event);
   }else{
    if(event.atMs<first.atMs)throw new Error(`Hold break precedes hold start for note ${event.noteId}`);
    if(event.atMs>=tail-100)throw new Error(`Hold break reported too late for note ${event.noteId}`);
    holdBreaks.set(note.id,event);
   }
   continue;
  }
  if(initial.has(note.id))throw new Error(`Duplicate judgement for note ${event.noteId}`);
  if(event.kind==='MISS'){
   if(event.atMs<note.time+TIMING.good-40)throw new Error(`Miss reported too early for note ${event.noteId}`);
  }else if(HIT_KINDS.has(event.kind)){
   const expected=claimedJudge(Math.abs(event.atMs-note.time));
   if(expected!==event.kind)throw new Error(`Timing does not match ${event.kind} for note ${event.noteId}`);
  }else throw new Error(`Invalid initial judgement for note ${event.noteId}`);
  initial.set(note.id,event);
 }
 if(initial.size!==chart.notes.length){
  const missing=chart.notes.find(note=>!initial.has(note.id));
  throw new Error(`Incomplete chart result${missing?`: missing note ${missing.id}`:''}`);
 }

 type ScoreEvent={kind:JudgementKind,note:Note,scoreTime:number};
 const scoreEvents:ScoreEvent[]=[];
 for(const note of chart.notes){const event=initial.get(note.id)!;scoreEvents.push({kind:event.kind,note,scoreTime:note.time});const hold=holds.get(note.id),holdBreak=holdBreaks.get(note.id);if(hold)scoreEvents.push({kind:'HOLD',note,scoreTime:note.time+(note.duration??0)});else if(holdBreak)scoreEvents.push({kind:'HOLD_BREAK',note,scoreTime:holdBreak.atMs})}
 scoreEvents.sort((a,b)=>a.scoreTime-b.scoreTime||a.note.id-b.note.id||(a.kind==='HOLD'||a.kind==='HOLD_BREAK'?1:-1));
 let score=0,combo=0,maxCombo=0,perfect=0,great=0,good=0,miss=0;
 for(const event of scoreEvents){
  if(event.kind==='MISS'||event.kind==='HOLD_BREAK'){miss++;combo=0;continue}
  const multiplier=Math.min(4,1+Math.floor(combo/10));
  if(event.kind==='HOLD'){score+=600*multiplier;continue}
  if(event.kind==='PERFECT'){score+=1000*multiplier;perfect++}
  else if(event.kind==='GREAT'){score+=700*multiplier;great++}
  else if(event.kind==='GOOD'){score+=350*multiplier;good++}
  combo++;maxCombo=Math.max(maxCombo,combo);
 }
 const total=perfect+great+good+miss,accuracy=total?((perfect+great*.8+good*.5)/total*100):0;
 return{score,accuracy:Number(accuracy.toFixed(3)),maxCombo,eventCount:events.length,noteCount:chart.notes.length,holdCount:holds.size,perfect,great,good,miss,normalizedEvents:events};
};
