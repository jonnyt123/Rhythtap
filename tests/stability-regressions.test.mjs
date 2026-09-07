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

const v4Progression=await readFile('supabase/migrations/20260903020626_allow_v4_multiplayer_progression.sql','utf8');
assert.match(v4Progression,/validation_version in \(3,4\)/,'multiplayer account progression must retain legacy v3/v4 support');
assert.match(v4Progression,/revoke all on function public\.record_validated_multiplayer_progress\(uuid,uuid\) from public, anon, authenticated/,'v4 progression migration must preserve server-only RPC access');

const validateMatch=await readFile('supabase/functions/validate-match/index.ts','utf8');
assert.match(validateMatch,/authenticatedUserId/,'online battles must require an authenticated account');
assert.match(validateMatch,/playerId!==authenticatedId/,'battle identity must be bound to the signed-in account');
assert.match(validateMatch,/record_validated_multiplayer_progress/,'validated match finalization must award account progression');
assert.match(validateMatch,/perfect_count:result\.perfect/,'validated match result must persist perfect-hit count');
assert.match(validateMatch,/chart_version:meta\.chartVersion/,'new multiplayer matches must persist the negotiated chart version');
assert.match(validateMatch,/normalizeChartVersion\(match\.chart_version\)/,'finalization must validate against the chart version stored on the match');

const chartSelector=await readFile('supabase/functions/validate-match/chart-validator.ts','utf8');
assert.match(chartSelector,/Number\(value\)===5\?5:Number\(value\)===4\?4:3/,'missing or unknown chart versions must remain backward-compatible with v3 while supporting v4/v5');
assert.match(chartSelector,/chartVersion===5\?buildV5/,'the authoritative selector must opt into v5 explicitly');
assert.match(chartSelector,/chartVersion===4\?buildV4/,'the authoritative selector must retain v4 explicitly');

const weightedTransform=await readFile('scripts/weighted-chart-transform.ts','utf8');
assert.match(weightedTransform,/weighted-chart-v5/,'release client chart generation must use the shared v5 generator');

const rolloutTransform=await readFile('scripts/chart-v4-rollout-transform.ts','utf8');
assert.match(rolloutTransform,/player-account\.tsx/,'signed-in solo submissions must be patched in the actual TSX account module');
assert.match(rolloutTransform,/chartVersion:5/,'release client requests must explicitly opt into authoritative chart v5');

const session=await readFile('src/multiplayer-session.ts','utf8');
assert.match(session,/payload\?\.matchId!==active\.matchId/,'multiplayer packets must be scoped to the active match');
assert.match(session,/launchRef\.current\?\.matchId!==submittedMatchId/,'late validation responses must be discarded after a rematch');
assert.match(session,/connectionState\.current==='connecting'/,'reconnects must have an in-flight guard');

const accountSession=await readFile('scripts/account-session-transform.ts','utf8');
assert.match(accountSession,/persistSession:true/,'RhythmTap ID sessions must persist across browser launches');
assert.match(accountSession,/autoRefreshToken:true/,'persisted account sessions must automatically refresh access tokens');
assert.match(accountSession,/window\.localStorage/,'account sessions must use durable same-origin browser storage');
assert.match(accountSession,/storageKey:'rhythtap-account-auth'/,'account auth storage must use a stable dedicated key');
assert.doesNotMatch(accountSession,/localStorage\.setItem\([^\n]*password/i,'raw account passwords must never be written to browser storage');

const prepareAudio=await readFile('scripts/prepare-audio.mjs','utf8');
for(const file of ['my-immortal.mp3','crazy-train.mp3','kill-you.mp3','kryptonite.mp3','through-fire-flames.mp3'])assert.ok(prepareAudio.includes(file),`build audio verification is missing ${file}`);

const ci=await readFile('.github/workflows/multiplayer-ci.yml','utf8');
assert.match(ci,/branches: \[main,/,'full validator CI must run on pushes to main');
assert.ok(ci.includes('supabase/functions/record-solo/index.ts'),'CI must typecheck the authoritative solo Edge Function');
assert.ok(ci.includes('tests/chart-version-compat.test.ts'),'CI must prove legacy chart compatibility during version rollouts');
assert.ok(ci.includes('tests/chart-quality-v4.test.ts'),'CI must preserve v4 client-server parity and playability');
assert.ok(ci.includes('tests/chart-quality-v5.test.ts'),'CI must gate releases on v5 Hard density and parity');
assert.ok(ci.includes('supabase/functions/validate-match/chart-validator.ts'),'CI must typecheck the versioned authoritative chart selector');
assert.ok(ci.includes('supabase functions deploy record-solo'),'guarded backend deployment must include the solo Edge Function');

console.log(JSON.stringify({assets:assetNames.length,authoritativeSolo:true,accountGatedBattles:true,battleProgression:true,v4BattleProgression:true,matchScopedRealtime:true,persistentAccountSessions:true,versionedAudio:true,chartV3Compatibility:true,chartV4Compatibility:true,chartV5Density:true}));
