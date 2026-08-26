import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';

const assetNames=(await readdir('dist/assets')).filter(name=>name.endsWith('.js'));
assert.ok(assetNames.length>0,'production build should contain a JavaScript bundle');
const bundle=(await Promise.all(assetNames.map(name=>readFile(`dist/assets/${name}`,'utf8')))).join('\n');

assert.ok(bundle.includes('/functions/v1/record-solo'),'signed-in solo progression must use the authoritative Edge Function');
assert.ok(!bundle.includes('record_player_game'),'production browser bundle must not call the legacy aggregate-score RPC');
assert.ok(bundle.includes('HOLD_BREAK'),'production gameplay bundle must report broken holds');
assert.ok(bundle.includes('Cloud progression could not be saved.'),'results UI must expose failed cloud progression');
assert.ok(bundle.includes('?v='),'official audio URLs must carry a deployment version for cache invalidation');

const migration=await readFile('supabase/migrations/20260826025300_stability_integrity_fixes.sql','utf8');
assert.match(migration,/revoke all on function public\.record_player_game[\s\S]*authenticated/i,'legacy direct progression RPC must be revoked from authenticated users');
assert.match(migration,/p_score > 100000000/,'validated dense scores must not use the legacy 5M ceiling');
assert.match(migration,/pg_advisory_xact_lock/,'multiplayer participant registration must be serialized per match');
assert.match(migration,/Verified multiplayer result is immutable/,'verified multiplayer results must reject changed re-submissions');

const session=await readFile('src/multiplayer-session.ts','utf8');
assert.match(session,/payload\?\.matchId!==active\.matchId/,'multiplayer packets must be scoped to the active match');
assert.match(session,/launchRef\.current\?\.matchId!==submittedMatchId/,'late validation responses must be discarded after a rematch');
assert.match(session,/connectionState\.current==='connecting'/,'reconnects must have an in-flight guard');

const prepareAudio=await readFile('scripts/prepare-audio.mjs','utf8');
for(const file of ['my-immortal.mp3','crazy-train.mp3','kill-you.mp3','kryptonite.mp3','through-fire-flames.mp3'])assert.ok(prepareAudio.includes(file),`build audio verification is missing ${file}`);

const ci=await readFile('.github/workflows/multiplayer-ci.yml','utf8');
assert.match(ci,/branches: \[main,/,'full validator CI must run on pushes to main');
assert.ok(ci.includes('supabase/functions/record-solo/index.ts'),'CI must typecheck the authoritative solo Edge Function');
assert.ok(ci.includes('supabase functions deploy record-solo'),'guarded backend deployment must include the solo Edge Function');

console.log(JSON.stringify({assets:assetNames.length,authoritativeSolo:true,matchScopedRealtime:true,versionedAudio:true}));
