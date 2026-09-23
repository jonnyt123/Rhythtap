import {assert,assertEquals} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {SONG_STORE_CATALOG,STARTER_SONG_IDS,coinsForXpAward,purchaseLocalSong} from '../src/song-economy.ts';

const transform=await Deno.readTextFile('scripts/song-store-transform-v2.ts');
const migration=await Deno.readTextFile('supabase/migrations/20260922050000_song_store_coins.sql');
const store=await Deno.readTextFile('src/song-store.tsx');
const storeCss=await Deno.readTextFile('src/song-store.css');
const recordSolo=await Deno.readTextFile('supabase/functions/record-solo/index.ts');

Deno.test('song catalog has stable starter tracks and nonnegative prices',()=>{
 const starters=SONG_STORE_CATALOG.filter(entry=>entry.starter);
 assertEquals(starters.map(entry=>entry.songId).sort(),['fly-eagle','never-left','sickness','voltage']);
 assert(starters.every(entry=>entry.price===0));
 assert(SONG_STORE_CATALOG.every(entry=>Number.isInteger(entry.price)&&entry.price>=0));
 assertEquals(new Set(SONG_STORE_CATALOG.map(entry=>entry.songId)).size,SONG_STORE_CATALOG.length);
 assertEquals(SONG_STORE_CATALOG.find(entry=>entry.songId==='through-fire-flames')?.price,900);
});

Deno.test('paid-song pricing curve has deliberate progression and sane completion pacing',()=>{
 const paid=SONG_STORE_CATALOG.filter(entry=>!entry.starter);
 assertEquals(paid.map(entry=>entry.price),[200,300,350,450,550,650,900]);
 const total=paid.reduce((sum,entry)=>sum+entry.price,0);
 assertEquals(total,3400);
 const plays=(price:number,reward:number)=>Math.ceil(price/reward);
 const floorReward=coinsForXpAward(1);
 const solidReward=coinsForXpAward(750);
 const capReward=coinsForXpAward(1500);
 assert(plays(paid[0].price,floorReward)<=8,'first paid song must be reachable within 8 successful low-reward clears');
 assert(plays(paid.at(-1)!.price,floorReward)<=36,'highest-priced song must remain reachable within 36 floor-reward clears');
 assert(plays(total,solidReward)<=68,'solid play should unlock the full paid catalog well before 100 clears');
 assert(plays(total,capReward)<=34,'high performance should materially accelerate the catalog');
});

Deno.test('local purchases never overspend, double-charge, or mutate on invalid attempts',()=>{
 const base={version:1 as const,coins:199,unlockedSongIds:[...STARTER_SONG_IDS]};
 const short=purchaseLocalSong(base,'afterglow');
 assertEquals(short.purchased,false);
 assertEquals(short.economy.coins,199);
 assertEquals(short.economy.unlockedSongIds,base.unlockedSongIds);

 const exact=purchaseLocalSong({...base,coins:200},'afterglow');
 assertEquals(exact.purchased,true);
 assertEquals(exact.economy.coins,0);
 assert(exact.economy.unlockedSongIds.includes('afterglow'));

 const duplicate=purchaseLocalSong(exact.economy,'afterglow');
 assertEquals(duplicate.purchased,false);
 assertEquals(duplicate.economy.coins,0);

 const invalid=purchaseLocalSong({...base,coins:999},'not-a-real-song');
 assertEquals(invalid.purchased,false);
 assertEquals(invalid.economy.coins,999);
 assertEquals(invalid.economy.unlockedSongIds,base.unlockedSongIds);
});

Deno.test('exact catalog wallet can buy every paid track once and ends at zero',()=>{
 const paid=SONG_STORE_CATALOG.filter(entry=>!entry.starter);
 const total=paid.reduce((sum,entry)=>sum+entry.price,0);
 let economy={version:1 as const,coins:total,unlockedSongIds:[...STARTER_SONG_IDS]};
 for(const entry of paid){
  const result=purchaseLocalSong(economy,entry.songId);
  assert(result.purchased,entry.songId+' should purchase');
  economy=result.economy;
 }
 assertEquals(economy.coins,0);
 for(const entry of SONG_STORE_CATALOG)assert(economy.unlockedSongIds.includes(entry.songId));
});

Deno.test('coin earnings are bounded, monotonic and server-parity exact',()=>{
 assertEquals(coinsForXpAward(-500),0);
 assertEquals(coinsForXpAward(0),0);
 assertEquals(coinsForXpAward(1),25);
 assertEquals(coinsForXpAward(150),25);
 assertEquals(coinsForXpAward(375),25);
 assertEquals(coinsForXpAward(750),50);
 assertEquals(coinsForXpAward(1125),75);
 assertEquals(coinsForXpAward(1500),100);
 assertEquals(coinsForXpAward(5000),100);
 let previous=0;
 for(let xp=0;xp<=5000;xp++){
  const reward=coinsForXpAward(xp);
  assert(reward>=previous);
  assert(reward===0||reward>=25);
  assert(reward<=100);
  previous=reward;
 }
 assert(migration.includes("if new.xp_awarded <= 0 then"));
 assert(migration.includes("award := least(100, greatest(25, round(new.xp_awarded::numeric / 15)::integer));"));
});

Deno.test('cloud purchases are server-authoritative and atomic',()=>{
 assert(migration.includes('create or replace function public.purchase_song_unlock'));
 assert(migration.includes("uid uuid := auth.uid()"));
 assert(migration.includes('for update'));
 assert(migration.includes("if balance < offer.price then"));
 assert(migration.includes('set coins = p.coins - offer.price'));
 assert(migration.includes("values (uid, offer.song_id, offer.price, 'store')"));
 assert(migration.includes('revoke all on public.player_song_unlocks from anon, authenticated'));
 assert(migration.includes('grant select on public.player_song_unlocks to authenticated'));
 assert(!migration.includes('grant insert on public.player_song_unlocks'));
 assert(!migration.includes('grant update on public.player_profiles'));
});

Deno.test('existing players keep legacy value and song access',()=>{
 assert(migration.includes('set coins = floor(xp::numeric / 10)::bigint'));
 assert(migration.includes('(c.starter or p.level >= c.legacy_unlock_level)'));
 assert(migration.includes("case when c.starter then 'starter' else 'legacy-level' end"));
});

Deno.test('validated progression mints coins exactly when a progress event is inserted',()=>{
 assert(migration.includes('before insert on public.player_progress_events'));
 assert(migration.includes('new.coin_awarded := award'));
 assert(migration.includes('set coins = coins + award'));
 assert(recordSolo.includes("select('coins')"));
 assert(recordSolo.includes("select('coin_awarded')"));
 assert(recordSolo.includes('coinsAwarded:Number(eventRow?.coin_awarded)||0'));
});

Deno.test('main menu Store opens the shop instead of player profile',()=>{
 assert(transform.includes('onClick={onStore} aria-label=\\"Open RhythmTap Song Store\\"'));
 assert(transform.includes("onStore={()=>setScreen('store')}"));
 assert(transform.includes("screen==='store'&&<SongShopScreen"));
 assert(transform.includes('<small>COINS</small><strong>{coins.toLocaleString()}</strong>'));
});

Deno.test('completed official songs show the exact coin reward on results',()=>{
 assert(transform.includes("coinsForXpAward(result.xpEarned).toLocaleString()"));
 assert(transform.includes('COINS EARNED'));
 assert(transform.includes("result.progressPending?'VERIFYING…'"));
 assert(transform.includes("result.progressError?'NOT SAVED'"));
 assert(transform.includes("!battle&&!song.id.startsWith('tap-')"));
 assert(storeCss.includes('.result-coin-reward{'));
});

Deno.test('guest coin awards cannot be farmed with imported charts',()=>{
 assert(transform.includes("if(official)setLocalSongEconomy(current=>awardLocalCoins(current,xpEarned))"));
});

Deno.test('setlist ownership replaces level-only song locking',()=>{
 assert(transform.includes("const locked=!s.id.startsWith('tap-')&&!isSongUnlocked(s.id);"));
 assert(transform.includes("COINS · STORE"));
 assert(transform.includes("selectedLocked?'STORE':'PLAY'"));
 assert(transform.includes('unlockedSongIds={unlockedSongIds}'));
 assert(transform.includes("const locked=!['voltage','sickness','never-left','fly-eagle'].includes(song.id)&&!unlockedSongIds.includes(song.id);"));
});

Deno.test('successful purchases show an accessible SONG UNLOCKED reveal',()=>{
 assert(store.includes("setReveal({song:bought,price:songPrice(songId),coins:result.coins})"));
 assert(store.includes('role="dialog"'));
 assert(store.includes('aria-modal="true"'));
 assert(store.includes('SONG UNLOCKED'));
 assert(store.includes('COINS SPENT'));
 assert(store.includes('NEW BALANCE'));
 assert(store.includes('autoFocus'));
 assert(storeCss.includes('.song-unlock-overlay{'));
 assert(storeCss.includes('@media(prefers-reduced-motion:reduce)'));
});

Deno.test('shop keeps the metal mobile presentation and safe areas',()=>{
 assert(store.includes('BUILD YOUR SETLIST'));
 assert(store.includes('Clear songs to earn coins'));
 assert(store.includes('assets/menu/menu-texture.webp'));
 assert(storeCss.includes('height:100dvh'));
 assert(storeCss.includes('env(safe-area-inset-top)'));
 assert(storeCss.includes('env(safe-area-inset-bottom)'));
 assert(storeCss.includes('.song-store-buy:active'));
 assert(storeCss.includes('@media(max-width:360px)'));
 assert(storeCss.includes('@media(orientation:landscape) and (max-height:500px)'));
});

Deno.test('song shop does not couple game coins to Stripe billing',()=>{
 assert(!store.includes('Stripe'));
 assert(!migration.toLowerCase().includes('stripe'));
 assert(!transform.toLowerCase().includes('stripe'));
});
