import {assert,assertEquals} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const debug=await Deno.readTextFile('src/tap-debug.ts');
const transform=await Deno.readTextFile('scripts/tap-debug-judgement-transform.ts');
const vite=await Deno.readTextFile('vite.config.ts');

Deno.test('tap debug exposes exact matched-note timing and dense-note warnings',()=>{
  assert(debug.includes("addEventListener('rhythtap:tap-judgement'"));
  assert(debug.includes("deltaMs"));
  assert(debug.includes("noteId"));
  assert(debug.includes("noteTime"));
  assert(debug.includes("'NO NOTE'"));
  assert(debug.includes("q${tap.age}ms"));
  assert(debug.includes("FUTURE STEAL BLOCKED"));
  assert(debug.includes("AMBIGUOUS"));
  assert(debug.includes("OLD→N${detail.nearestNoteId}"));
  assert(transform.includes("Math.round(hitTime-best.time)"));
  assert(transform.includes("noteId:best.id"));
  assert(transform.includes("noteTime:best.time"));
  assert(transform.includes("candidateCount:candidates.length"));
  assert(transform.includes("futureStealBlocked"));
  assert(transform.includes("const best=candidates[0]"));
  assert(transform.includes("nearestNoteId:nearest?.id??null"));
  assert(transform.includes("matched:false"));
  assert(transform.includes("document.documentElement.dataset.tapDebug==='1'"));
  assert(!transform.includes('TIMING.perfect='));
  assert(!transform.includes('TIMING.great='));
  assert(!transform.includes('TIMING.good='));
});

Deno.test('guarded chronological matcher blocks a future note from stealing a valid earlier tap',()=>{
  const good=220;
  const choose=(times:number[],hitTime:number)=>{
    const candidates=times.filter(time=>time>=hitTime-good&&time<=hitTime+good);
    const earliest=candidates[0]??null;
    const nearest=candidates.reduce<number|null>((best,time)=>best===null||Math.abs(hitTime-time)<Math.abs(hitTime-best)?time:best,null);
    return {earliest,nearest,candidateCount:candidates.length,futureStealBlocked:earliest!==null&&nearest!==null&&nearest!==earliest&&nearest>earliest};
  };
  const result=choose([10000,10125],10080);
  assertEquals(result.earliest,10000);
  assertEquals(result.nearest,10125);
  assertEquals(result.candidateCount,2);
  assert(result.futureStealBlocked);
});

Deno.test('guarded matcher advances only after the earlier note leaves the GOOD window',()=>{
  const good=220;
  const choose=(times:number[],hitTime:number)=>times.filter(time=>time>=hitTime-good&&time<=hitTime+good)[0]??null;
  assertEquals(choose([10000,10125],10219),10000);
  assertEquals(choose([10000,10125],10221),10125);
});

Deno.test('tap debug instrumentation runs after gameplay timing transforms',()=>{
  assert(vite.includes("import { tapDebugJudgementTransform } from './scripts/tap-debug-judgement-transform';"));
  const quality=vite.indexOf('gameplayQualityTransform()');
  const media=vite.indexOf('highResolutionMediaClockTransform()');
  const debugIndex=vite.indexOf('tapDebugJudgementTransform()');
  const reactIndex=vite.indexOf('react()]');
  assert(quality>=0&&media>quality&&debugIndex>media&&reactIndex>debugIndex);
});
