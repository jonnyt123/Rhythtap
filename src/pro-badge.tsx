import React from 'react';
import {Crown} from 'lucide-react';
import './pro-badge.css';

type SupabaseClient=any;

export function ProBadge(){
 return <span className="rt-pro-badge" title="RhythmTap Pro" aria-label="RhythmTap Pro"><Crown fill="currentColor"/><span>PRO</span></span>;
}

export async function attachProBadges<T extends Record<string,any>>(client:SupabaseClient,rows:T[]):Promise<Array<T&{pro_badge:boolean}>>{
 const ids=[...new Set(rows.map(row=>String(row?.user_id||'')).filter(Boolean))];
 if(!ids.length)return rows.map(row=>({...row,pro_badge:false}));
 try{
  const{data,error}=await client.rpc('get_visible_player_pro_badges',{p_user_ids:ids});
  if(error)throw error;
  const badges=new Map((data||[]).map((row:any)=>[String(row.user_id),Boolean(row.pro_badge)]));
  return rows.map(row=>({...row,pro_badge:badges.get(String(row.user_id))===true}));
 }catch(error){
  console.warn('[pro-badge] lookup failed',error);
  return rows.map(row=>({...row,pro_badge:false}));
 }
}
