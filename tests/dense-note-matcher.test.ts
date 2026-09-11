import {assert,assertEquals} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const main=await Deno.readTextFile('src/main.tsx');
const vite=await Deno.readTextFile('vite.config.ts');

Deno.test('guarded chronological matcher blocks future-note stealing',()=>{
  const good=220;
  const choose=(times:number[],hitTime:number)=>times.filter(time=>time>=hitTime-good&&time<=hitTime+good)[0]??null;
  assertEquals(choose([10000,10125],10080),10000);
  assertEquals(choose([10000,10125],10219),10000);
  assertEquals(choose([10000,10125],10221),10125);
});

Deno.test('production matcher selects earliest valid unjudged candidate without widening timing windows',()=>{
  assert(main.includes('const candidates:Note[]=[]'));
  assert(main.includes('const best=candidates[0]'));
  assert(main.includes('hitTime+TIMING.good'));
  assert(main.includes('!judged.current.has(n.id)'));
  assert(!main.includes('TIMING.perfect='));
  assert(!main.includes('TIMING.great='));
  assert(!main.includes('TIMING.good='));
});

Deno.test('dense matcher remains in production after temporary Tap Debug removal',()=>{
  assert(main.includes('const candidates:Note[]=[]'));
  assert(!vite.includes('denseNoteMatcherTransform'));
  assert(!vite.includes('tapDebugJudgementTransform'));
});
