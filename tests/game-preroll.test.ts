import {assert} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const preroll=await Deno.readTextFile('src/game-preroll.ts');
const css=await Deno.readTextFile('src/game-preroll.css');
const index=await Deno.readTextFile('index.html');

Deno.test('gameplay start has a five-second synchronized preroll',()=>{
  assert(preroll.includes('const PREROLL_MS=5000'));
  assert(preroll.includes("for(let count=5;count>=1;count--)"));
  assert(preroll.includes("value.textContent='GO'"));
  assert(preroll.includes("label.includes('TAP TO START')"));
  assert(preroll.includes("label.includes('START PLAYING')"));
});

Deno.test('preroll keeps audio and chart zero aligned',()=>{
  assert(preroll.includes('HTMLMediaElement.prototype.play'));
  assert(preroll.includes('this.pause()'));
  assert(preroll.includes('this.currentTime=0'));
  assert(preroll.includes('AudioContextCtor.prototype.resume'));
  assert(preroll.includes("if(this.state==='running')await this.suspend()"));
  assert(!preroll.includes('+PREROLL_MS'));
  assert(!preroll.includes('chartOffset'));
});

Deno.test('preroll assets are loaded globally and remain input transparent',()=>{
  assert(index.includes('/src/game-preroll.css'));
  assert(index.includes('/src/game-preroll.ts'));
  assert(css.includes('pointer-events:none'));
  assert(css.includes('.rt-preroll'));
});
