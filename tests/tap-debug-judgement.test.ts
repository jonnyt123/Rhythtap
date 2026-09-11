import {assert} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const debug=await Deno.readTextFile('src/tap-debug.ts');
const transform=await Deno.readTextFile('scripts/tap-debug-judgement-transform.ts');
const vite=await Deno.readTextFile('vite.config.ts');

Deno.test('tap debug exposes exact matched-note timing without changing judgement rules',()=>{
  assert(debug.includes("addEventListener('rhythtap:tap-judgement'"));
  assert(debug.includes("deltaMs"));
  assert(debug.includes("noteId"));
  assert(debug.includes("noteTime"));
  assert(debug.includes("'NO NOTE'"));
  assert(debug.includes("q${tap.age}ms"));
  assert(transform.includes("Math.round(hitTime-best.time)"));
  assert(transform.includes("noteId:best.id"));
  assert(transform.includes("noteTime:best.time"));
  assert(transform.includes("matched:false"));
  assert(transform.includes("document.documentElement.dataset.tapDebug==='1'"));
  assert(!transform.includes('TIMING.perfect='));
  assert(!transform.includes('TIMING.great='));
  assert(!transform.includes('TIMING.good='));
});

Deno.test('tap debug instrumentation runs after gameplay timing transforms',()=>{
  assert(vite.includes("import { tapDebugJudgementTransform } from './scripts/tap-debug-judgement-transform';"));
  const quality=vite.indexOf('gameplayQualityTransform()');
  const media=vite.indexOf('highResolutionMediaClockTransform()');
  const debugIndex=vite.indexOf('tapDebugJudgementTransform()');
  const reactIndex=vite.indexOf('react()]');
  assert(quality>=0&&media>quality&&debugIndex>media&&reactIndex>debugIndex);
});
