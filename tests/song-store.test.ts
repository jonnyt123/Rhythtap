import {assert,assertEquals} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {SONG_STORE_CATALOG,coinsForXpAward} from '../src/song-economy.ts';

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
 assertEquals(SONG_STORE_CATALOG.find(entry=>entry.songId==='through-fire-flames')?.price,1200);
});

Deno.test('coin earnings are bounded and performance-scaled',()=>{
 assertEquals(coinsForXpAward(0),10);
 assertEquals(coinsForXpAward(150),10);
 assertEquals(coinsForXpAward(750),50);
 assertEquals(coinsForXpAward(1500),100);
 assertEquals(coinsForXpAward(5000),100);
 assert(migration.includes("least(100, greatest(10, round(new.xp_awarded::numeric / 15)::integer))"));
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

Deno.test('setlist ownership replaces level-only song locking',()=>{
 assert(transform.includes("const locked=!s.id.startsWith('tap-')&&!isSongUnlocked(s.id);"));
 assert(transform.includes("COINS · STORE"));
 assert(transform.includes("selectedLocked?'STORE':'PLAY'"));
 assert(transform.includes('unlockedSongIds={unlockedSongIds}'));
 assert(transform.includes("const locked=!['voltage','sickness','never-left','fly-eagle'].includes(song.id)&&!unlockedSongIds.includes(song.id);"));
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
