import {assert,assertEquals} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const source=await Deno.readTextFile('src/main.tsx');
const vite=await Deno.readTextFile('vite.config.ts');

Deno.test('guarded chronological matcher blocks future-note stealing',()=>{
  const good=220;
  const choose=(times:number[],hitTime:number)=>times.filter(time=>time>=hitTime-good&&time<=hitTime+good)[0]??null;
  assertEquals(choose([10000,10125],10080),10000);
  assertEquals(choose([10000,10125],10219),10000);
  assertEquals(choose([10000,10125],10221),10125);
});

Deno.test('production source selects earliest valid unjudged candidate without widening timing windows',()=>{
  assert(source.includes('const candidates:Note[]=[]'));
  assert(source.includes('const best=candidates[0]'));
  assert(source.includes('hitTime+TIMING.good'));
  assert(source.includes('!judged.current.has(n.id)'));
  assert(source.includes('const TIMING={perfect:55,great:110,good:220}'));
  assert(!source.includes('TIMING.perfect='));
  assert(!source.includes('TIMING.great='));
  assert(!source.includes('TIMING.good='));
});

Deno.test('dense matcher is normal production source, not a Vite transform',()=>{
  assert(!vite.includes('denseNoteMatcherTransform'));
  assert(!vite.includes('dense-note-matcher-transform'));
  assert(!source.includes('tapDebugJudgementTransform'));
});
