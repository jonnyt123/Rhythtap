import {assert} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const transform=await Deno.readTextFile('scripts/multiplayer-hardening-transform.ts');
const vite=await Deno.readTextFile('vite.config.ts');
const session=await Deno.readTextFile('src/multiplayer-session.ts');
const engagement=await Deno.readTextFile('scripts/engagement-ui-transform.ts');

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
