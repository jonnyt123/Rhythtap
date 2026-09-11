import {assert,assertEquals} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const transform=await Deno.readTextFile('scripts/dense-note-matcher-transform.ts');
const vite=await Deno.readTextFile('vite.config.ts');

Deno.test('guarded chronological matcher blocks future-note stealing',()=>{
  const good=220;
  const choose=(times:number[],hitTime:number)=>times.filter(time=>time>=hitTime-good&&time<=hitTime+good)[0]??null;
  assertEquals(choose([10000,10125],10080),10000);
  assertEquals(choose([10000,10125],10219),10000);
  assertEquals(choose([10000,10125],10221),10125);
});

Deno.test('production matcher selects earliest valid unjudged candidate without widening timing windows',()=>{
  assert(transform.includes('const candidates:Note[]=[]'));
  assert(transform.includes('const best=candidates[0]'));
  assert(transform.includes('hitTime+TIMING.good'));
  assert(transform.includes('!judged.current.has(n.id)'));
  assert(!transform.includes('TIMING.perfect='));
  assert(!transform.includes('TIMING.great='));
  assert(!transform.includes('TIMING.good='));
});

Deno.test('dense matcher remains in production after temporary Tap Debug removal',()=>{
  assert(vite.includes("import { denseNoteMatcherTransform } from './scripts/dense-note-matcher-transform.ts';"));
  assert(vite.includes('denseNoteMatcherTransform()'));
  assert(!vite.includes('tapDebugJudgementTransform'));
});
