import {assert} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const transform=await Deno.readTextFile('scripts/multiplayer-hardening-transform.ts');
const gameWide=await Deno.readTextFile('scripts/game-wide-hardening-transform.ts');
const vite=await Deno.readTextFile('vite.config.ts');
const session=await Deno.readTextFile('src/multiplayer-session.ts');
const engagement=await Deno.readTextFile('scripts/engagement-ui-transform.ts');
const serviceWorker=await Deno.readTextFile('public/sw.js');

Deno.test('online battle cannot be terminated by the solo song-fail meter',()=>{
 assert(transform.includes("if(multiplayerSession.enabled){energyRef.current=100"));
 assert(transform.includes("!multiplayerSession.enabled&&<GameplayMeters"));
 assert(transform.includes("background recovery cannot fail battle"));
});

Deno.test('host battle creation is single-flight',()=>{
 assert(transform.includes('startingMatchRef=useRef(false)'));
 assert(transform.includes('||startingMatchRef.current)return;startingMatchRef.current=true'));
 assert(transform.includes('finally{startingMatchRef.current=false}'));
});

Deno.test('realtime presence is deduplicated by player identity',()=>{
 assert(transform.includes("const presence=flattenPresence(channel.presenceState()),unique=new Map<string,any>()"));
 assert(transform.includes('unique.set(key,player)'));
 assert(transform.includes('const list=Array.from(unique.values()).sort'));
});

Deno.test('reconnect sync preserves final and rematch state',()=>{
 assert(transform.includes('localRematchRef=useRef(false)'));
 assert(transform.includes('rematchReady:localRematchRef.current'));
 assert(transform.includes('setOpponentRematch(Boolean(payload.rematchReady))'));
 assert(transform.includes("latestProgress.current={...progress,finished:event==='final'}"));
 assert(transform.includes('localRematchRef.current=true;setLocalRematch(true)'));
});

Deno.test('hardening runs after multiplayer session composition and before downstream UI transforms',()=>{
 const loop=vite.indexOf('multiplayerSessionLoopTransform()');
 const hardening=vite.indexOf('multiplayerHardeningTransform()');
 const engagementIndex=vite.indexOf('engagementUiTransform()');
 assert(loop>=0&&hardening>loop&&engagementIndex>hardening);
});

Deno.test('battle result actions remain gated until local authoritative finalization resolves',()=>{
 assert(engagement.includes("completionPending=Boolean(result.progressPending)||(battle&&!verifiedBattle)"));
 assert(engagement.includes('disabled={completionPending}'));
 assert(session.includes("setVerifiedLocal(verified);send('final'"));
});

Deno.test('timing settings survive reload and corrupted offsets are sanitized',()=>{
 assert(gameWide.includes("localStorage.getItem('ntr-speed')"));
 assert(gameWide.includes("Math.max(.7,Math.min(1.5,value))"));
 assert(gameWide.includes("localStorage.setItem('ntr-speed',String(next))"));
 assert(gameWide.includes("localStorage.getItem('ntr-offset')"));
 assert(gameWide.includes("Number.isFinite(value)?Math.max(-200,Math.min(200,value)):0"));
});

Deno.test('sign out restores device-local guest progression instead of leaking cloud state',()=>{
 assert(gameWide.includes('if(playerAccount.loading)return;if(playerAccount.profile)'));
 assert(gameWide.includes('setProfile(loadProfile());setStats(loadStats())'));
});

Deno.test('multiplayer personal best is written only from verified server score',()=>{
 assert(gameWide.includes("battle&&verifiedBattle?.validation!=='verified'"));
 assert(gameWide.includes('const finalScore=battle?verifiedBattle!.score:result.score'));
});

Deno.test('versioned audio cache removes stale copies and clear-downloads removes all audio generations',()=>{
 const staleMarker="url.pathname===target.pathname&&url.href!==target.href";
 assert(gameWide.includes(staleMarker));
 assert(gameWide.indexOf(staleMarker)!==gameWide.lastIndexOf(staleMarker));
 assert(gameWide.includes("keys.filter(key=>key.startsWith('rhythtap-audio-'))"));
});

Deno.test('service worker derives deployment base instead of assuming GitHub Pages',()=>{
 assert(serviceWorker.includes("const BASE=new URL('./',self.location.href).pathname"));
 assert(!serviceWorker.includes("const BASE='/Rhythtap/'"));
});

Deno.test('game-wide hardening sees the final transformed application',()=>{
 const billing=vite.indexOf('stripeBillingTransform()');
 const hardening=vite.indexOf('gameWideHardeningTransform()');
 const react=vite.indexOf('react()');
 assert(billing>=0&&hardening>billing&&react>hardening);
});
