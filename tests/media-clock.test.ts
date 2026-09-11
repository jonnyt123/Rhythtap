import {assert} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const source=await Deno.readTextFile('src/main.tsx');
const vite=await Deno.readTextFile('vite.config.ts');

Deno.test('recorded-song gameplay uses a smoothed high-resolution media clock',()=>{
 assert(source.includes('mediaClockPerf=0'));
 assert(source.includes('mediaClockMs=0'));
 assert(source.includes('mediaClockSyncPerf=0'));
 assert(source.includes('this.mediaClockMs=this.pausedAt;this.mediaClockPerf=performance.now();this.mediaClockSyncPerf=this.mediaClockPerf'));
 assert(source.includes('ended(){return Boolean(this.media?.ended)}'));
 assert(source.includes('mediaNow(){'));
 assert(source.includes('performance.now()'));
 assert(source.includes('media.playbackRate'));
 assert(source.includes('Math.abs(drift)>60'));
 assert(source.includes('drift*.12'));
 assert(source.includes('media.paused||media.seeking||media.readyState<3'));
 assert(source.includes('now(){return this.media?this.mediaNow():this.ctx?(this.ctx.currentTime-this.startAt)*1000:this.pausedAt}'));
});

Deno.test('media clock keeps existing input timestamp and calibration paths intact',()=>{
 assert(!vite.includes('highResolutionMediaClockTransform'));
 assert(source.includes('transport.current.now()-inputEventAgeMs(eventTimeStamp)+offset+(song.chartOffset||0)'));
 assert(source.includes('const t=transport.current.now()+offset+(song.chartOffset||0)'));
});
