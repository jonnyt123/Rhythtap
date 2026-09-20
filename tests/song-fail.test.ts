import {assert} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const main=await Deno.readTextFile('src/main.tsx');
const stability=await Deno.readTextFile('scripts/stability-transform.ts');
const preroll=await Deno.readTextFile('src/game-preroll.ts');
const css=await Deno.readTextFile('src/styles.css');

Deno.test('performance meter has forgiving Tap Tap style drain and recovery',()=>{
 assert(main.includes('const SONG_FAIL_GRACE_MS=2000'));
 assert(main.includes("adjustEnergy(healthDelta??-8)"));
 assert(main.includes("j==='PERFECT'?1.2:j==='GREAT'?.7:.2"));
 assert(main.includes("applyJudge('MISS',lane,-6)"));
 assert(main.includes('const SONG_FAIL_WARNING=25'));
});

Deno.test('zero health immediately stops gameplay before normal completion',()=>{
 assert(main.includes('if(next<=0)failedRef.current=true'));
 assert(main.includes('transport.current.stop();setPaused(false);setReady(false);setFailed(true)'));
 assert(stability.includes("!failedRef.current&&energyRef.current>0"));
});

Deno.test('failed runs never enter reward or high-score results flow',()=>{
 assert(main.includes('failed&&<div className=\"modal song-failed\"'));
 assert(main.includes('RETRY SONG'));
 assert(main.includes('BACK TO SONGS'));
 assert(!main.includes('failed&&finishGame'));
 assert(!main.includes('failed&&finish('));
});

Deno.test('retry uses the same five-second preroll as a fresh start',()=>{
 assert(preroll.includes("label.includes('RETRY SONG')"));
 assert(preroll.includes("for(let count=5;count>=1;count--)"));
 assert(preroll.includes("event.key!=='Enter'&&event.key!==' '"));
});

Deno.test('retry fully resets gameplay state before restarting transport',()=>{
 assert(main.includes('const startingRef=useRef(false)'));
 assert(main.includes('if(startingRef.current)return;startingRef.current=true'));
 assert(main.includes('setReady(false);setPaused(false);setFailed(false);setNow(0);setScore(0);setCombo(0);setMaxCombo(0)'));
 assert(main.includes('setCounts({PERFECT:0,GREAT:0,GOOD:0,MISS:0});setPulse(0);setJudge(null);setHitEffect(null);setEnergy(100)'));
 assert(main.includes('scoreRef.current=0;comboRef.current=0;countsRef.current={PERFECT:0,GREAT:0,GOOD:0,MISS:0};maxRef.current=0'));
 assert(main.includes('finally{startingRef.current=false;setLoading(false)}'));
});

Deno.test('health is synchronous and miss processing stops on the failure frame',()=>{
 assert(main.includes('Math.min(100,energyRef.current+applied)'));
 assert(main.includes('energyRef.current=next;if(next<=0)failedRef.current=true;setEnergy(next)'));
 assert(main.includes("applyJudge('MISS',n.lane)}if(failedRef.current)break"));
});

Deno.test('failure UI warns without obscuring gameplay accessibility',()=>{
 assert(css.includes('.meters.fail-warning .energy'));
 assert(css.includes('.song-failed'));
 assert(css.includes('@media(prefers-reduced-motion:reduce)'));
});
