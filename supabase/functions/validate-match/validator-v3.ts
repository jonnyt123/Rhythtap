import {makeWeightedBeatChart,makeWeightedOnsetChart} from '../_shared/weighted-chart-v3.ts';
import {buildCanonicalChart as buildLegacyChart,parseOnsetEvents,validateAgainstChart,type CanonicalChart,type Difficulty,type Note} from './validator.ts';

const BEAT_SONGS:Record<string,{bpm:number,offset:number,duration:number,seed:number}>={
 'my-immortal':{bpm:76,offset:232,duration:270.497,seed:4},
 'crazy-train':{bpm:136,offset:325,duration:226.325,seed:1},
 'kill-you':{bpm:107.666,offset:232,duration:264.411,seed:2},
 kryptonite:{bpm:99.384,offset:627,duration:234.292,seed:0},
 'through-fire-flames':{bpm:198.8,offset:1324,duration:300.121,seed:3},
};
const AUDIO_EXPORTS:Record<string,string>={sickness:'sicknessEvents','never-left':'neverLeftEvents','fly-eagle':'flyEagleEvents'};

export const makeBeatChart=(bpm:number,offset:number,duration:number,difficulty:Difficulty,seed:number):Note[]=>makeWeightedBeatChart(bpm,offset,duration,difficulty,seed) as Note[];
export const makeOnsetChart=(events:readonly (readonly [number,number,number])[],difficulty:Difficulty):Note[]=>makeWeightedOnsetChart(events,difficulty) as Note[];

export const buildCanonicalChart=(songId:string,difficulty:Difficulty,onsetSource?:string):CanonicalChart=>{const beatSong=BEAT_SONGS[songId];let notes:Note[];if(beatSong)notes=makeBeatChart(beatSong.bpm,beatSong.offset,beatSong.duration,difficulty,beatSong.seed);else if(AUDIO_EXPORTS[songId]){if(!onsetSource)throw new Error('Unsupported multiplayer chart');notes=makeOnsetChart(parseOnsetEvents(onsetSource,AUDIO_EXPORTS[songId]),difficulty)}else return buildLegacyChart(songId,difficulty,onsetSource);if(!notes.length)throw new Error('Authoritative chart is empty');return{songId,difficulty,notes,endMs:notes.at(-1)!.time+2200}};
export {validateAgainstChart};
export type {CanonicalChart,Difficulty};
