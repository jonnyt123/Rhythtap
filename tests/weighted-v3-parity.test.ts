import assert from 'node:assert/strict';
import {buildCanonicalChart,makeBeatChart,makeOnsetChart} from '../supabase/functions/validate-match/validator-v3.ts';
import {buildCanonicalChart as buildLegacyChart,parseOnsetEvents} from '../supabase/functions/validate-match/validator.ts';
import {makeWeightedBeatChart,makeWeightedOnsetChart} from '../supabase/functions/_shared/weighted-chart-v3.ts';

const difficulties=['EASY','NORMAL','HARD'] as const;
const onsetSource=await Deno.readTextFile('src/audioChartData.ts');
const transformSource=await Deno.readTextFile('scripts/weighted-chart-transform.ts');

Deno.test('client transform imports the shared V3 generator instead of duplicating it',()=>{
 assert.match(transformSource,/\.\.\/supabase\/functions\/_shared\/weighted-chart-v3/);
 assert.match(transformSource,/makeWeightedBeatChart/);
 assert.match(transformSource,/makeWeightedOnsetChart/);
 assert.doesNotMatch(transformSource,/const hash01=/);
});

const beatSongs=[
 {id:'my-immortal',bpm:76,offset:232,duration:270.497,seed:4},
 {id:'crazy-train',bpm:136,offset:325,duration:226.325,seed:1},
 {id:'kill-you',bpm:107.666,offset:232,duration:264.411,seed:2},
 {id:'kryptonite',bpm:99.384,offset:627,duration:234.292,seed:0},
 {id:'through-fire-flames',bpm:198.8,offset:1324,duration:300.121,seed:3},
] as const;

const onsetSongs=[
 {id:'sickness',exportName:'sicknessEvents'},
 {id:'never-left',exportName:'neverLeftEvents'},
 {id:'fly-eagle',exportName:'flyEagleEvents'},
] as const;

const legacySongs=['voltage','afterglow','gravity'] as const;

const assertChartShape=(songId:string,difficulty:string,notes:{id:number,time:number,lane:number,duration?:number}[])=>{
 assert.ok(notes.length>0,`${songId} ${difficulty} must not be empty`);
 for(let i=0;i<notes.length;i++){
  const note=notes[i];
  assert.equal(note.id,i,`${songId} ${difficulty} IDs must be canonical and sequential`);
  assert.ok(Number.isFinite(note.time)&&note.time>=0,`${songId} ${difficulty} has invalid note time`);
  assert.ok(Number.isInteger(note.lane)&&note.lane>=0&&note.lane<=2,`${songId} ${difficulty} has invalid lane`);
  if(note.duration!==undefined)assert.ok(Number.isFinite(note.duration)&&note.duration>0,`${songId} ${difficulty} has invalid hold duration`);
  if(i>0){const previous=notes[i-1];assert.ok(note.time>=previous.time,`${songId} ${difficulty} note times must be nondecreasing`)}
 }
};

for(const song of beatSongs){
 for(const difficulty of difficulties){
  Deno.test(`${song.id} ${difficulty} uses exact shared weighted beat chart`,()=>{
   const shared=makeWeightedBeatChart(song.bpm,song.offset,song.duration,difficulty,song.seed);
   const wrapper=makeBeatChart(song.bpm,song.offset,song.duration,difficulty,song.seed);
   const canonical=buildCanonicalChart(song.id,difficulty);
   assert.deepEqual(wrapper,shared);
   assert.deepEqual(canonical.notes,shared);
   assert.deepEqual(buildCanonicalChart(song.id,difficulty).notes,canonical.notes,'chart generation must be deterministic');
   assertChartShape(song.id,difficulty,canonical.notes);
  });
 }
}

for(const song of onsetSongs){
 const events=parseOnsetEvents(onsetSource,song.exportName);
 for(const difficulty of difficulties){
  Deno.test(`${song.id} ${difficulty} uses exact shared weighted onset chart`,()=>{
   const shared=makeWeightedOnsetChart(events,difficulty);
   const wrapper=makeOnsetChart(events,difficulty);
   const canonical=buildCanonicalChart(song.id,difficulty,onsetSource);
   assert.deepEqual(wrapper,shared);
   assert.deepEqual(canonical.notes,shared);
   assert.deepEqual(buildCanonicalChart(song.id,difficulty,onsetSource).notes,canonical.notes,'chart generation must be deterministic');
   assertChartShape(song.id,difficulty,canonical.notes);
  });
 }
}

for(const songId of legacySongs){
 for(const difficulty of difficulties){
  Deno.test(`${songId} ${difficulty} remains identical to legacy client rules`,()=>{
   const expected=buildLegacyChart(songId,difficulty);
   const canonical=buildCanonicalChart(songId,difficulty);
   assert.deepEqual(canonical,expected);
   assertChartShape(songId,difficulty,canonical.notes);
  });
 }
}

Deno.test('weighted HARD charts are materially richer than NORMAL across recorded songs',()=>{
 for(const song of beatSongs){
  const normal=buildCanonicalChart(song.id,'NORMAL').notes.length;
  const hard=buildCanonicalChart(song.id,'HARD').notes.length;
  assert.ok(hard>normal,`${song.id} HARD should contain more playable events than NORMAL`);
 }
 for(const song of onsetSongs){
  const normal=buildCanonicalChart(song.id,'NORMAL',onsetSource).notes.length;
  const hard=buildCanonicalChart(song.id,'HARD',onsetSource).notes.length;
  assert.ok(hard>normal,`${song.id} HARD should contain more playable events than NORMAL`);
 }
});
