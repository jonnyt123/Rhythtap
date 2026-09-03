import {buildCanonicalChart as buildV3,validateAgainstChart,type CanonicalChart,type Difficulty} from './validator-v3.ts';
import {buildCanonicalChart as buildV4} from './validator-v4.ts';

export type ChartVersion=3|4;
export const normalizeChartVersion=(value:unknown):ChartVersion=>Number(value)===4?4:3;
export const buildCanonicalChart=(songId:string,difficulty:Difficulty,onsetSource?:string,chartVersion:ChartVersion=3):CanonicalChart=>chartVersion===4?buildV4(songId,difficulty,onsetSource):buildV3(songId,difficulty,onsetSource);
export {validateAgainstChart};
export type {CanonicalChart,Difficulty};
