import {assert} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const badge=await Deno.readTextFile('src/pro-badge.tsx');
const css=await Deno.readTextFile('src/pro-badge.css');
const playerAccount=await Deno.readTextFile('src/player-account.tsx');
const socialRanked=await Deno.readTextFile('src/tour-social-ranked.tsx');
const migration=await Deno.readTextFile('supabase/migrations/20260909103500_public_pro_badge_lookup.sql');
const asset=await Deno.readFile('public/assets/pro-badge.png');

Deno.test('Pro badge uses the optimized hard-rock crest artwork',()=>{
 assert(badge.includes("const badgeSrc=`${import.meta.env.BASE_URL}assets/pro-badge.png`"));
 assert(badge.includes('alt="RhythmTap Pro"'));
 assert(badge.includes('draggable={false}'));
 assert(badge.includes("size='small'"));
 assert(badge.includes("size==='profile'?' profile':''"));
 assert(!badge.includes("from 'lucide-react'"));
 assert(!badge.includes('<Crown'));
 assert(!badge.includes('<span>PRO</span>'));
 assert(asset.length>0&&asset.length<350_000);
 assert(asset[0]===0x89&&asset[1]===0x50&&asset[2]===0x4e&&asset[3]===0x47);
});

Deno.test('Pro crest stays compact and mobile-safe',()=>{
 assert(css.includes('width:20px;height:20px'));
 assert(css.includes('.rt-pro-badge.profile{width:28px;height:28px}'));
 assert(css.includes('@media(max-width:620px)'));
 assert(css.includes('width:18px;height:18px'));
 assert(css.includes('.rt-pro-badge.profile{width:26px;height:26px}'));
 assert(css.includes('object-fit:contain'));
 assert(css.includes('flex:0 0 auto'));
 assert(css.includes('drop-shadow(0 0 2px rgba(255,40,40,.58))'));
 assert(css.includes('text-overflow:ellipsis'));
 assert(!css.includes('.profile-hero .rt-pro-badge'));
 assert(!css.includes('border-radius:999px'));
});

Deno.test('public badge authority remains live-only and fail-closed',()=>{
 assert(migration.includes("e.environment = 'live'"));
 assert(migration.includes('coalesce(e.pro_enabled, false)'));
 assert(badge.includes("client.rpc('get_visible_player_pro_badges'"));
 assert(badge.includes('pro_badge:false'));
 assert(!badge.includes('pro_badge:true'));
});

Deno.test('public player identity is username-only with no at-prefix',()=>{
 assert(playerAccount.includes('<span className="rt-username-text">{account.profile.username}</span>'));
 assert(playerAccount.includes('<span className="rt-username-text">{p.username}</span>'));
 assert(playerAccount.includes('<span className="rt-username-text">{player.username}</span>'));
 assert(!playerAccount.includes('<h1>{account.profile.displayName}</h1>'));
 assert(!playerAccount.includes('<h1>{p.displayName}</h1>'));
 assert(!playerAccount.includes('@{account.profile.username}'));
 assert(!playerAccount.includes('@{p.username}'));
 assert(!playerAccount.includes('@{player.username}'));
 assert(socialRanked.includes('profile?.username||fallback'));
 assert(!socialRanked.includes('profile?.displayName||fallback'));
 assert(!socialRanked.includes('`@${p.username}`'));
 assert(!socialRanked.includes('<small>@{p.username}'));
});

Deno.test('username plate is a compact hard-rock metal rectangle',()=>{
 assert(css.includes('.rt-username-plate{'));
 assert(css.includes('border:1px solid rgba(190,198,210,.42)'));
 assert(css.includes('border-radius:3px'));
 assert(css.includes('linear-gradient(180deg,rgba(49,51,58,.98)'));
 assert(css.includes('rgba(255,70,70,.58)'));
 assert(css.includes('clip-path:polygon('));
 assert(css.includes('.rt-username-plate.compact'));
 assert(css.includes('max-width:180px'));
 assert(css.includes('max-width:138px'));
 assert(css.includes('overflow:hidden;text-overflow:ellipsis;white-space:nowrap'));
});