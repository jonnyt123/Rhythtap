import {assert,assertEquals} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const main=await Deno.readTextFile('src/main.tsx');
const stability=await Deno.readTextFile('scripts/stability-transform.ts');
const idempotency=await Deno.readTextFile('scripts/server-idempotency-transform.ts');
const engagement=await Deno.readTextFile('scripts/engagement-ui-transform.ts');
const edge=await Deno.readTextFile('supabase/functions/record-solo/index.ts');
const migration=await Deno.readTextFile('supabase/migrations/20260914110500_solo_progression_idempotency.sql');

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
  assert(idempotency.includes("playerAccount.recordGame({songId:song.id,difficulty,events:r.events||[],runId:r.runId||''})"),'authenticated progression must carry the gameplay run id');
});

Deno.test('every solo attempt receives a fresh UUID run id',()=>{
  assert(idempotency.includes('runIdRef=useRef(createRunId())'),'gameplay run id ref missing');
  assert(idempotency.includes('runIdRef.current=createRunId()'),'begin must rotate the run id for each attempt');
  assert(idempotency.includes('runId:runIdRef.current'),'completed result must carry the same attempt run id');
  assert(idempotency.includes('runId:input.runId'),'account request must send the run id to record-solo');
});

Deno.test('record-solo requires and forwards a valid run id',()=>{
  assert(edge.includes('RUN_ID_RE'),'record-solo must validate run id format');
  assert(edge.includes("return json({error:'Invalid run id'},400)"),'invalid or missing run ids must fail closed');
  assert(edge.includes('p_run_id:runId'),'run id must be forwarded to the server RPC');
});

Deno.test('database makes solo run awards idempotent under retries and races',()=>{
  assert(migration.includes('source_run_id uuid'),'progress event must store source run id');
  assert(migration.includes('player_progress_events_user_run_uidx'),'server must enforce a unique user/run key');
  assert(migration.includes("pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_run_id::text, 0))"),'concurrent duplicate submissions must serialize');
  assert(migration.includes('where user_id = p_user_id and source_run_id = p_run_id'),'RPC must detect an already-awarded run');
  assert(migration.includes('prior.xp_awarded, prior.daily_bonus'),'duplicate run must return the original award instead of adding XP');
  assert(migration.includes("raise exception 'Run id required'"),'legacy RPC path must fail closed rather than bypass idempotency');
});
