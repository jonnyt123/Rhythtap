import {assert} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const transform=await Deno.readTextFile('scripts/high-resolution-media-clock-transform.ts');
const vite=await Deno.readTextFile('vite.config.ts');

Deno.test('recorded-song gameplay uses a smoothed high-resolution media clock',()=>{
 assert(transform.includes('mediaClockPerf=0'));
 assert(transform.includes('mediaClockMs=0'));
 assert(transform.includes('mediaNow(){'));
 assert(transform.includes('performance.now()'));
 assert(transform.includes('media.playbackRate'));
 assert(transform.includes('Math.abs(drift)>60'));
 assert(transform.includes('drift*.12'));
 assert(transform.includes('media.paused||media.seeking||media.readyState<3'));
});

Deno.test('media clock keeps existing input timestamp and calibration paths intact',()=>{
 assert(vite.includes("highResolutionMediaClockTransform"));
 assert(vite.indexOf('gameplayQualityTransform()')<vite.indexOf('highResolutionMediaClockTransform()'));
 assert(!transform.includes('TIMING={'));
 assert(!transform.includes('chartOffset='));
});
