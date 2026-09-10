import {assert} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const source=await Deno.readTextFile('src/main.tsx');

Deno.test('gameplay judges against the physical input event timestamp',()=>{
  assert(source.includes('const MAX_INPUT_EVENT_AGE_MS=120'));
  assert(source.includes('const inputEventAgeMs=(eventTimeStamp?:number)'));
  assert(source.includes('performance.timeOrigin'));
  assert(source.includes('Math.max(0,Math.min(MAX_INPUT_EVENT_AGE_MS,age))'));
  assert(source.includes('transport.current.now()-inputEventAgeMs(eventTimeStamp)+offset+(song.chartOffset||0)'));
  assert(source.includes('hit(l,e.timeStamp)'));
  assert(source.includes('release(l,e.timeStamp)'));
  assert(source.includes('hit(i,e.timeStamp)'));
  assert(source.includes('release(i,e.timeStamp)'));
});

Deno.test('event timestamp compensation does not change judgment windows or chart offsets',()=>{
  assert(source.includes('const TIMING={perfect:55,great:110,good:220}'));
  assert(source.includes("dist<=TIMING.perfect?'PERFECT':dist<=TIMING.great?'GREAT':'GOOD'"));
  assert(!source.includes('TIMING={perfect:'));
  assert(!source.includes('chartOffset||0)-inputEventAgeMs'));
});
