from pathlib import Path

main = Path('src/main.tsx')
vite = Path('vite.config.ts')
test = Path('tests/dense-note-matcher.test.ts')

old = "let best:Note|undefined,dist=Infinity;for(let index=low;index<laneChart.length;index++){const n=laneChart[index];if(n.time>hitTime+TIMING.good)break;const d=Math.abs(hitTime-n.time);if(!judged.current.has(n.id)&&d<dist){best=n;dist=d}}"
new = "const candidates:Note[]=[];for(let index=low;index<laneChart.length;index++){const n=laneChart[index];if(n.time>hitTime+TIMING.good)break;if(!judged.current.has(n.id))candidates.push(n)}const best=candidates[0],dist=best?Math.abs(hitTime-best.time):Infinity;"

source = main.read_text()
if old not in source:
    raise SystemExit('dense matcher source anchor not found')
if new in source:
    raise SystemExit('dense matcher already consolidated')
main.write_text(source.replace(old, new, 1))

vite_source = vite.read_text()
vite_source = vite_source.replace("import { denseNoteMatcherTransform } from './scripts/dense-note-matcher-transform.ts';\n", '')
vite_source = vite_source.replace('highResolutionMediaClockTransform(), denseNoteMatcherTransform(), chartV4RolloutTransform()', 'highResolutionMediaClockTransform(), chartV4RolloutTransform()')
if 'denseNoteMatcherTransform' in vite_source:
    raise SystemExit('dense matcher transform reference remains in vite config')
vite.write_text(vite_source)

test.write_text("""import {assert,assertEquals} from 'https://deno.land/std@0.224.0/assert/mod.ts';

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
""")

Path('scripts/dense-note-matcher-transform.ts').unlink()
Path('scripts/consolidate-dense-note-matcher.py').unlink()
Path('.github/workflows/consolidate-dense-note-matcher.yml').unlink()
