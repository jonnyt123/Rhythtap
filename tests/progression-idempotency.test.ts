import {assert,assertEquals} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const main=await Deno.readTextFile('src/main.tsx');
const stability=await Deno.readTextFile('scripts/stability-transform.ts');
const engagement=await Deno.readTextFile('scripts/engagement-ui-transform.ts');

Deno.test('refresh restores persisted progression without granting XP again',()=>{
  assert(main.includes("const loadProfile=():Profile=>"),'profile reload helper missing');
  assert(main.includes("localStorage.getItem('rhythtap-profile')"),'profile reload must read persisted XP');
  assert(main.includes("useState<Profile>(loadProfile)"),'app must initialize from persisted profile');
  assertEquals(main.includes("loadProfile=():Profile=>{setProfile"),false,'loading profile must never mutate progression');
  assertEquals(main.includes("loadProfile=():Profile=>{localStorage.setItem('rhythtap-profile'"),false,'loading profile must never rewrite/award XP');
});

Deno.test('retry starts a new gameplay attempt without replaying the prior reward function',()=>{
  assert(engagement.includes("name:'song_retry'"),'retry event wiring missing');
  assert(engagement.includes('retry()'),'retry must restart gameplay');
  assertEquals(engagement.includes("name:'song_retry',userId,songId:song.id,difficulty,metadata:{score:result.score,accuracy:result.accuracy}});finishGame"),false,'retry must not call finishGame for the previous result');
  assertEquals(engagement.includes("name:'song_retry',userId,songId:song.id,difficulty,metadata:{battle:true}});finishGame"),false,'battle rematch must not replay progression');
});

Deno.test('cloud progression ignores stale async awards after a retry/new completion',()=>{
  assert(stability.includes('const progressRequestRef=useRef(0);'),'progression request generation guard missing');
  assert(stability.includes('requestId=++progressRequestRef.current'),'each completion must advance the request generation');
  assert(stability.includes('if(requestId!==progressRequestRef.current)return;'),'stale completion response must be ignored');
});

Deno.test('results navigation stays locked while authoritative progression is pending',()=>{
  assert(engagement.includes('completionPending=Boolean(result.progressPending)||(battle&&!verifiedBattle)'));
  assert(engagement.includes('disabled={completionPending} onClick={done}'));
  assert(engagement.includes('disabled={completionPending||tourActionDisabled}'));
  assert(engagement.includes('disabled={completionPending||Boolean(tourAction&&tourActionDisabled)}'));
});

Deno.test('solo XP mutation remains centralized in finishGame rather than Results',()=>{
  const resultsStart=main.indexOf('function Results(');
  assert(resultsStart>=0,'Results component missing');
  const resultsSource=main.slice(resultsStart);
  assertEquals(resultsSource.includes("localStorage.setItem('rhythtap-profile'"),false,'Results must not award/persist XP');
  assert(stability.includes("localStorage.setItem('rhythtap-profile',JSON.stringify({xp}))"),'guest progression persistence missing from completion path');
  assert(stability.includes('playerAccount.recordGame({songId:song.id,difficulty,events:r.events||[]})'),'authenticated progression must use the validated completion path');
});
