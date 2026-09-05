import {makeWeightedBeatChart as makeV4Beat,makeWeightedOnsetChart as makeV4Onset} from '../supabase/functions/_shared/weighted-chart-v4.ts';
import {makeWeightedBeatChart as makeV5Beat,makeWeightedOnsetChart as makeV5Onset} from '../supabase/functions/_shared/weighted-chart-v5.ts';
import {buildCanonicalChart as buildV5} from '../supabase/functions/validate-match/validator-v5.ts';
import {flyEagleEvents,neverLeftEvents,sicknessEvents} from '../src/audioChartData.ts';

const onsetSource=await Deno.readTextFile('src/audioChartData.ts');
const beatSongs=[['crazy-train',136,325,226.325,1],['through-fire-flames',198.8,1324,300.121,3]] as const;
const onsetSongs=[['sickness',sicknessEvents],['never-left',neverLeftEvents],['fly-eagle',flyEagleEvents]] as const;

const assertHardDensity=(name:string,notes:{time:number}[])=>{for(let i=0;i<notes.length;i++){const start=notes[i].time;let count=0;for(let j=i;j<notes.length&&notes[j].time<start+1000;j++)count++;if(count>7)throw new Error(`${name}: ${count} notes inside one second exceeds Hard performance cap`)}const events=[...new Set(notes.map(note=>note.time))];for(let i=1;i<events.length;i++)if(events[i]-events[i-1]<105)throw new Error(`${name}: event spacing ${events[i]-events[i-1]}ms is below 105ms`)};

Deno.test('V5 preserves Easy and Normal exactly',()=>{for(const difficulty of ['EASY','NORMAL'] as const){const v4=makeV4Beat(136,325,226.325,difficulty,1),v5=makeV5Beat(136,325,226.325,difficulty,1);if(JSON.stringify(v4)!==JSON.stringify(v5))throw new Error(`${difficulty} changed in V5`)}});
Deno.test('V5 Hard reduces peak density and remains authoritative',()=>{for(const [name,bpm,offset,duration,seed] of beatSongs){const v4=makeV4Beat(bpm,offset,duration,'HARD',seed),v5=makeV5Beat(bpm,offset,duration,'HARD',seed),server=buildV5(name,'HARD').notes;if(v5.length>=v4.length)throw new Error(`${name}: V5 Hard did not reduce note count`);if(JSON.stringify(v5)!==JSON.stringify(server))throw new Error(`${name}: client/server V5 mismatch`);assertHardDensity(name,v5)}});
Deno.test('V5 onset Hard is capped and authoritative',()=>{for(const [name,events] of onsetSongs){const v4=makeV4Onset(events,'HARD'),v5=makeV5Onset(events,'HARD'),server=buildV5(name,'HARD',onsetSource).notes;if(v5.length>=v4.length)throw new Error(`${name}: V5 Hard did not reduce note count`);if(JSON.stringify(v5)!==JSON.stringify(server))throw new Error(`${name}: client/server V5 mismatch`);assertHardDensity(name,v5)}});
