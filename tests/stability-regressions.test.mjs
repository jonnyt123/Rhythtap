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
assert.ok(bundle.includes('TAKE THE STAGE'),'online battle must use the music-themed lobby experience');
assert.ok(!bundle.includes('SUPABASE REALTIME'),'player-facing lobby must not expose backend implementation jargon');
assert.ok(!bundle.includes('PING ')&&!bundle.includes('HOST CLOCK'),'player-facing lobby must not expose clock diagnostics');

const migration=await readFile('supabase/migrations/20260826025300_stability_integrity_fixes.sql','utf8');
assert.match(migration,/revoke all on function public\.record_player_game[\s\S]*authenticated/i,'legacy direct progression RPC must be revoked from authenticated users');
assert.match(migration,/p_score > 100000000/,'validated dense scores must not use the legacy 5M ceiling');
assert.match(migration,/pg_advisory_xact_lock/,'multiplayer participant registration must be serialized per match');
assert.match(migration,/Verified multiplayer result is immutable/,'verified multiplayer results must reject changed re-submissions');

const battleProgression=await readFile('supabase/migrations/20260830233500_multiplayer_progression_awards.sql','utf8');
assert.match(battleProgression,/player_progress_events_user_match_unique/,'battle XP must be idempotent per user and match');
assert.match(battleProgression,/record_validated_multiplayer_progress/,'verified battles must have a server-only progression path');
assert.match(battleProgression,/perfect_count/,'verified battle perfect hits must be persisted authoritatively');
assert.match(battleProgression,/revoke all on function public\.record_validated_multiplayer_progress\(uuid,uuid\) from public, anon, authenticated/,'battle progression RPC must not be browser-callable');

const validateMatch=await readFile('supabase/functions/validate-match/index.ts','utf8');
assert.match(validateMatch,/authenticatedUserId/,'online battles must require an authenticated account');
assert.match(validateMatch,/playerId!==authenticatedId/,'battle identity must be bound to the signed-in account');
assert.match(validateMatch,/record_validated_multiplayer_progress/,'validated match finalization must award account progression');
assert.match(validateMatch,/perfect_count:result\.perfect/,'validated match result must persist perfect-hit count');

const session=await readFile('src/multiplayer-session.ts','utf8');
assert.match(session,/payload\?\.matchId!==active\.matchId/,'multiplayer packets must be scoped to the active match');
assert.match(session,/launchRef\.current\?\.matchId!==submittedMatchId/,'late validation responses must be discarded after a rematch');
assert.match(session,/connectionState\.current==='connecting'/,'reconnects must have an in-flight guard');

const prepareAudio=await readFile('scripts/prepare-audio.mjs','utf8');
for(const file of ['my-immortal.mp3','crazy-train.mp3','kill-you.mp3','kryptonite.mp3','through-fire-flames.mp3'])assert.ok(prepareAudio.includes(file),`build audio verification is missing ${file}`);

const ci=await readFile('.github/workflows/multiplayer-ci.yml','utf8');
assert.match(ci,/branches: \[main,/,'full validator CI must run on pushes to main');
assert.ok(ci.includes('supabase/functions/record-solo/index.ts'),'CI must typecheck the authoritative solo Edge Function');
assert.ok(ci.includes('weighted-v3-parity.test.ts'),'CI must gate releases on weighted V3 client-server parity');
assert.ok(ci.includes('supabase functions deploy record-solo'),'guarded backend deployment must include the solo Edge Function');

console.log(JSON.stringify({assets:assetNames.length,authoritativeSolo:true,accountGatedBattles:true,battleProgression:true,matchScopedRealtime:true,versionedAudio:true,weightedV3Parity:true}));
