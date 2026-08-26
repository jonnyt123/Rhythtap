import type {Plugin} from 'vite';

const replaceRequired=(source:string,label:string,before:string,after:string)=>{
 if(!source.includes(before))throw new Error(`[stability] Unable to patch ${label}; source layout changed.`);
 return source.replace(before,after);
};

const replaceBetween=(source:string,label:string,startMarker:string,endMarker:string,replacement:string)=>{
 const start=source.indexOf(startMarker),end=start<0?-1:source.indexOf(endMarker,start);
 if(start<0||end<0)throw new Error(`[stability] Unable to patch ${label}; source layout changed.`);
 return source.slice(0,start)+replacement+source.slice(end);
};

const patchMain=(source:string)=>{
 let code=source;
 code=replaceRequired(code,'game result protocol',
  "type GameResult={score:number,accuracy:number,maxCombo:number,counts:Record<Judge,number>,xpEarned:number,dailyBonus:number,levelUp:boolean,previousLevel:number};",
  "type GameplayJudgementEvent={kind:'PERFECT'|'GREAT'|'GOOD'|'MISS'|'HOLD'|'HOLD_BREAK',atMs:number,noteId:number,lane:number};\ntype GameResult={score:number,accuracy:number,maxCombo:number,counts:Record<Judge,number>,xpEarned:number,dailyBonus:number,levelUp:boolean,previousLevel:number,events?:GameplayJudgementEvent[],progressPending?:boolean,progressError?:string};");
 code=replaceRequired(code,'versioned audio cache',
  "const AUDIO_CACHE='rhythtap-audio-v1';",
  "const AUDIO_CACHE='rhythtap-audio-v2';\nconst AUDIO_BUILD=String(import.meta.env.VITE_RHYTHTAP_BUILD||'dev');\nconst versionedAudioPath=(path:string)=>import.meta.env.BASE_URL+path+'?v='+encodeURIComponent(AUDIO_BUILD);");
 code=replaceRequired(code,'game audio URL',"cachedAudioUrl(import.meta.env.BASE_URL+song.audioFile,this.onDownloadProgress)","cachedAudioUrl(versionedAudioPath(song.audioFile),this.onDownloadProgress)");
 code=replaceRequired(code,'preview audio URL',"cachedAudioUrl(import.meta.env.BASE_URL+song.previewFile)","cachedAudioUrl(versionedAudioPath(song.previewFile))");
 code=replaceRequired(code,'media end detection',
  " now(){return this.media?this.media.currentTime*1000:this.ctx?(this.ctx.currentTime-this.startAt)*1000:this.pausedAt}",
  " ended(){return Boolean(this.media?.ended)}\n now(){return this.media?this.media.currentTime*1000:this.ctx?(this.ctx.currentTime-this.startAt)*1000:this.pausedAt}");
 code=replaceRequired(code,'progress request guard'," const playerAccount=usePlayerAccount();"," const playerAccount=usePlayerAccount();\n const progressRequestRef=useRef(0);");
 const finishGame=` const finishGame=(r:Omit<GameResult,'xpEarned'|'dailyBonus'|'levelUp'|'previousLevel'>)=>{
  const previousLevel=profile.level,requestId=++progressRequestRef.current;
  if(multiplayerLaunch){setResult({...r,xpEarned:0,dailyBonus:0,levelUp:false,previousLevel,progressPending:false});setScreen('results');return}
  const official=!song.id.startsWith('tap-');
  if(playerAccount.profile){
   if(!official){setResult({...r,xpEarned:0,dailyBonus:0,levelUp:false,previousLevel,progressPending:false,progressError:'Imported charts do not award cloud XP.'});setScreen('results');return}
   setResult({...r,xpEarned:0,dailyBonus:0,levelUp:false,previousLevel,progressPending:true});setScreen('results');
   void playerAccount.recordGame({songId:song.id,difficulty,events:r.events||[]}).then(award=>{
    if(requestId!==progressRequestRef.current)return;
    if(!award){setResult(current=>({...current,progressPending:false,progressError:'Cloud progression could not be saved.'}));return}
    const today=todayKey();
    setProfile({xp:award.xp,level:award.level});
    setStats(current=>{const next={...current,songsCompleted:award.songsCompleted,perfectHits:award.perfectHits,bestCombo:award.bestCombo,dailyDate:today,dailyPlays:(current.dailyDate===today?current.dailyPlays:0)+1,dailyClaimedDate:award.dailyBonus?today:current.dailyClaimedDate};localStorage.setItem('rhythtap-stats',JSON.stringify(next));return next});
    setResult(current=>({...current,score:award.validatedScore,accuracy:award.validatedAccuracy,maxCombo:award.validatedMaxCombo,counts:award.validatedCounts,xpEarned:award.xpAwarded,dailyBonus:award.dailyBonus,levelUp:award.level>previousLevel,previousLevel,progressPending:false,progressError:''}));
   });return
  }
  const today=todayKey(),dailyPlays=(stats.dailyDate===today?stats.dailyPlays:0)+1,dailyBonus=dailyPlays>=2&&stats.dailyClaimedDate!==today?100:0,nextStats={songsCompleted:stats.songsCompleted+1,perfectHits:stats.perfectHits+r.counts.PERFECT,bestCombo:Math.max(stats.bestCombo,r.maxCombo),dailyDate:today,dailyPlays,dailyClaimedDate:dailyBonus?today:stats.dailyClaimedDate},multiplier={EASY:1,NORMAL:1.4,HARD:1.9}[difficulty],baseAward=Math.min(1500,Math.max(25,Math.round((r.accuracy*1.8+r.score/850)*multiplier))),xpEarned=baseAward+dailyBonus,xp=profile.xp+xpEarned,level=levelFor(xp);
  setStats(nextStats);localStorage.setItem('rhythtap-stats',JSON.stringify(nextStats));setProfile({xp,level});localStorage.setItem('rhythtap-profile',JSON.stringify({xp}));setResult({...r,xpEarned,dailyBonus,levelUp:level>previousLevel,previousLevel,progressPending:false});setScreen('results')};`;
 code=replaceBetween(code,'result/progression flow',' const finishGame=','\n return <main>',finishGame);
 code=replaceRequired(code,'solo judgement buffer',"backgroundPaused=useRef(false);","backgroundPaused=useRef(false),soloEvents=useRef<GameplayJudgementEvent[]>([]);");
 code=replaceRequired(code,'clear solo judgement buffer',"const begin=async()=>{judged.current.clear();","const begin=async()=>{judged.current.clear();soloEvents.current=[];");
 code=replaceRequired(code,'hold completion logging',
  "if(multiplayerSession.enabled)multiplayerSession.recordJudgement('HOLD',held.id,lane,nowRef.current);",
  "if(multiplayerSession.enabled)multiplayerSession.recordJudgement('HOLD',held.id,lane,nowRef.current);else soloEvents.current.push({kind:'HOLD',noteId:held.id,lane,atMs:Math.max(0,Math.round(nowRef.current))});");
 code=replaceRequired(code,'hold break scoring',
  " const release=(lane:number)=>{pressed.current.delete(lane);const hold=activeHolds.current.get(lane);if(!hold)return;const remaining=hold.time+(hold.duration??0)-nowRef.current;if(remaining<=120){completeHold(lane);return}activeHolds.current.delete(lane);showFeedback('MISS',lane);setCombo(0);setEnergy(e=>Math.max(0,e-10))};",
  " const release=(lane:number)=>{pressed.current.delete(lane);const hold=activeHolds.current.get(lane);if(!hold)return;const remaining=hold.time+(hold.duration??0)-nowRef.current;if(remaining<=120){completeHold(lane);return}activeHolds.current.delete(lane);const breakAt=Math.max(hold.time,nowRef.current);if(multiplayerSession.enabled)multiplayerSession.recordJudgement('HOLD_BREAK',hold.id,lane,breakAt);else soloEvents.current.push({kind:'HOLD_BREAK',noteId:hold.id,lane,atMs:Math.max(0,Math.round(breakAt))});applyJudge('MISS',lane)};");
 code=replaceRequired(code,'solo hit logging',
  "if(multiplayerSession.enabled)multiplayerSession.recordJudgement(hitJudge,best.id,lane,hitTime);applyJudge(hitJudge,lane)",
  "if(multiplayerSession.enabled)multiplayerSession.recordJudgement(hitJudge,best.id,lane,hitTime);else soloEvents.current.push({kind:hitJudge,noteId:best.id,lane,atMs:Math.max(0,Math.round(hitTime))});applyJudge(hitJudge,lane)");
 code=replaceRequired(code,'solo miss logging',
  "if(multiplayerSession.enabled)multiplayerSession.recordJudgement('MISS',n.id,n.lane,t);applyJudge('MISS',n.lane)",
  "if(multiplayerSession.enabled)multiplayerSession.recordJudgement('MISS',n.id,n.lane,t);else soloEvents.current.push({kind:'MISS',noteId:n.id,lane:n.lane,atMs:Math.max(0,Math.round(t))});applyJudge('MISS',n.lane)");
 code=replaceRequired(code,'natural media completion',
  "if(t>end){transport.current.stop();const c=countsRef.current,total=Object.values(c).reduce((a,b)=>a+b,0),weighted=c.PERFECT+c.GREAT*.8+c.GOOD*.5,finalResult={score:scoreRef.current,accuracy:total?weighted/total*100:0,maxCombo:maxRef.current,counts:c};if(multiplayerSession.enabled)multiplayerSession.publishFinal({score:finalResult.score,combo:finalResult.maxCombo,accuracy:finalResult.accuracy});finish(finalResult);return}",
  "const mediaFinished=transport.current.ended()&&t>=notes.at(-1)!.time+TIMING.good;if(t>end||mediaFinished){transport.current.stop();const c=countsRef.current,total=Object.values(c).reduce((a,b)=>a+b,0),weighted=c.PERFECT+c.GREAT*.8+c.GOOD*.5,finalResult={score:scoreRef.current,accuracy:total?weighted/total*100:0,maxCombo:maxRef.current,counts:c,events:soloEvents.current.slice()};if(multiplayerSession.enabled)multiplayerSession.publishFinal({score:finalResult.score,combo:finalResult.maxCombo,accuracy:finalResult.accuracy});finish(finalResult);return}");
 code=replaceRequired(code,'validated high score persistence',
  " useEffect(()=>{const key=`ntr-high-${song.id}-${difficulty}`;localStorage.setItem(key,String(Math.max(result.score,Number(localStorage.getItem(key)||0))))},[]);",
  " useEffect(()=>{if(result.progressPending)return;const key=`ntr-high-${song.id}-${difficulty}`;localStorage.setItem(key,String(Math.max(result.score,Number(localStorage.getItem(key)||0))))},[result.score,result.progressPending,song.id,difficulty]);");
 code=replaceRequired(code,'cloud progression status',
  "<small>{result.levelUp?'NEW LEVEL':'PERFORMANCE REWARD'}</small><strong>{result.levelUp?`LEVEL ${profile.level}`:`+${result.xpEarned} XP`}</strong>",
  "<small>{result.progressPending?'VERIFYING RUN':result.progressError?'PROGRESSION STATUS':result.levelUp?'NEW LEVEL':'PERFORMANCE REWARD'}</small><strong>{result.progressPending?'SYNCING…':result.progressError?'NOT SAVED':result.levelUp?`LEVEL ${profile.level}`:`+${result.xpEarned} XP`}</strong>");
 code=replaceRequired(code,'cloud progression error',
  "{result.dailyBonus>0&&<em>DAILY CHALLENGE COMPLETE · +{result.dailyBonus} XP</em>}",
  "{result.progressError&&<em>{result.progressError}</em>}{result.dailyBonus>0&&<em>DAILY CHALLENGE COMPLETE · +{result.dailyBonus} XP</em>}");
 return code;
};

const patchAccount=(source:string)=>{
 let code=source;
 code=replaceRequired(code,'account result type',
  "export type ProgressAward={xp:number;level:number;songsCompleted:number;perfectHits:number;bestCombo:number;xpAwarded:number;dailyBonus:number};",
  "export type GameplayJudgementEvent={kind:'PERFECT'|'GREAT'|'GOOD'|'MISS'|'HOLD'|'HOLD_BREAK';atMs:number;noteId:number;lane:number};\nexport type ProgressAward={xp:number;level:number;songsCompleted:number;perfectHits:number;bestCombo:number;xpAwarded:number;dailyBonus:number;validatedScore:number;validatedAccuracy:number;validatedMaxCombo:number;validatedCounts:{PERFECT:number;GREAT:number;GOOD:number;MISS:number}};");
 code=replaceRequired(code,'account controller result input',
  "recordGame:(input:{songId:string;difficulty:string;score:number;accuracy:number;maxCombo:number;perfectHits:number})=>Promise<ProgressAward|null>;",
  "recordGame:(input:{songId:string;difficulty:string;events:GameplayJudgementEvent[]})=>Promise<ProgressAward|null>;");
 code=replaceRequired(code,'literal username search helper',
  "const publicProfileUrl=(username:string)=>`${location.origin}${import.meta.env.BASE_URL}#player/${encodeURIComponent(username)}`;",
  "const publicProfileUrl=(username:string)=>`${location.origin}${import.meta.env.BASE_URL}#player/${encodeURIComponent(username)}`;\nconst escapeIlike=(value:string)=>value.replace(/[\\%_]/g,match=>'\\\\'+match).replace(/[(),]/g,'');");
 const recordGame=` const recordGame=useCallback(async(input:{songId:string;difficulty:string;events:GameplayJudgementEvent[]})=>{if(!userId)return null;try{const client=await getAccountClient(),{data:sessionData}=await client.auth.getSession(),token=sessionData?.session?.access_token;if(!token)throw new Error('Authentication required');const response=await fetch(\`${'${SUPABASE_URL}'}/functions/v1/record-solo\`,{method:'POST',headers:{'content-type':'application/json','apikey':SUPABASE_ANON_KEY,'authorization':\`Bearer ${'${token}'}\`},body:JSON.stringify({songId:input.songId,difficulty:input.difficulty,events:input.events})}),payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(String(payload?.error||\`Progress service unavailable (${'${response.status}'})\`));const row=payload?.progress,validated=payload?.result;if(!row||!validated)return null;const award:ProgressAward={xp:Number(row.xp),level:Number(row.level),songsCompleted:Number(row.songsCompleted),perfectHits:Number(row.perfectHits),bestCombo:Number(row.bestCombo),xpAwarded:Number(row.xpAwarded),dailyBonus:Number(row.dailyBonus),validatedScore:Number(validated.score)||0,validatedAccuracy:Number(validated.accuracy)||0,validatedMaxCombo:Number(validated.maxCombo)||0,validatedCounts:{PERFECT:Number(validated.counts?.PERFECT)||0,GREAT:Number(validated.counts?.GREAT)||0,GOOD:Number(validated.counts?.GOOD)||0,MISS:Number(validated.counts?.MISS)||0}};setProfile(current=>current?{...current,xp:award.xp,level:award.level,songsCompleted:award.songsCompleted,perfectHits:award.perfectHits,bestCombo:award.bestCombo}:current);return award}catch(e:any){console.warn('[account] validated progress sync failed',e?.message||e);return null}},[userId]);`;
 code=replaceBetween(code,'validated account result submission',' const recordGame=','\n const searchProfiles=',recordGame);
 code=replaceRequired(code,'literal player search',
  "const clean=query.trim();if(clean)request=request.or(`username.ilike.%${clean.replace(/[%_,()]/g,'')}%,display_name.ilike.%${clean.replace(/[%_,()]/g,'')}%`);",
  "const clean=escapeIlike(query.trim());if(clean)request=request.or(`username.ilike.%${clean}%,display_name.ilike.%${clean}%`);");
 code=replaceRequired(code,'literal public profile lookup',".ilike('username',username).maybeSingle()",".ilike('username',escapeIlike(username)).maybeSingle()");
 return code;
};

const patchCommon=(source:string)=>{
 let code=source;
 code=replaceRequired(code,'hold-break judgement type',"export type JudgementKind='PERFECT'|'GREAT'|'GOOD'|'MISS'|'HOLD';","export type JudgementKind='PERFECT'|'GREAT'|'GOOD'|'MISS'|'HOLD'|'HOLD_BREAK';");
 code=replaceRequired(code,'multiplayer cache version',"export const AUDIO_CACHE='rhythtap-audio-v1';","export const AUDIO_CACHE='rhythtap-audio-v2';export const AUDIO_BUILD=String((import.meta as any).env?.VITE_RHYTHTAP_BUILD||'dev');export const versionedAudioPath=(path:string)=>import.meta.env.BASE_URL+path+'?v='+encodeURIComponent(AUDIO_BUILD);");
 return code;
};

const patchLobby=(source:string)=>{
 let code=source;
 code=replaceRequired(code,'versioned multiplayer audio import',"AUDIO_CACHE,DISPLAY_NAME_KEY,cleanCode","AUDIO_CACHE,DISPLAY_NAME_KEY,cleanCode");
 code=replaceRequired(code,'versioned multiplayer audio helper import',"registerMatchParticipant,stablePlayerId,useClockSync,","registerMatchParticipant,stablePlayerId,useClockSync,versionedAudioPath,");
 code=replaceRequired(code,'versioned multiplayer audio URL',"const path=import.meta.env.BASE_URL+song.audioFile;","const path=versionedAudioPath(song.audioFile);");
 code=replaceRequired(code,'disconnect excess room participant',
  "if(list.length>2&&!list.slice(0,2).some(player=>player.playerId===idRef.current)){setStatus('full');setMessage('ROOM IS FULL')}void channel.send({type:'broadcast',event:'ready-request',payload:{from:idRef.current}})",
  "if(list.length>2&&!list.slice(0,2).some(player=>player.playerId===idRef.current)){setStatus('full');setMessage('ROOM IS FULL');if(channelRef.current===channel)channelRef.current=null;void channel.untrack().catch(()=>{}).finally(()=>void client.removeChannel(channel));return}void channel.send({type:'broadcast',event:'ready-request',payload:{from:idRef.current}})");
 return code;
};

export function stabilityTransform():Plugin{
 return {name:'rhythtap-stability-transform',enforce:'pre',transform(source,id){const normalized=id.replaceAll('\\','/');if(normalized.endsWith('/src/main.tsx'))return{code:patchMain(source),map:null};if(normalized.endsWith('/src/player-account.tsx'))return{code:patchAccount(source),map:null};if(normalized.endsWith('/src/multiplayer-common.ts'))return{code:patchCommon(source),map:null};if(normalized.endsWith('/src/multiplayer-lobby.tsx'))return{code:patchLobby(source),map:null};return null}};
}
