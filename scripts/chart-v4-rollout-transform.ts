import type {Plugin} from 'vite';

const replaceRequired=(source:string,label:string,before:string,after:string)=>{if(!source.includes(before))throw new Error(`[chart-v4-rollout] Unable to patch ${label}; transformed layout changed.`);return source.replace(before,after)};

export function chartV4RolloutTransform():Plugin{return{name:'rhythtap-chart-v4-rollout-transform',enforce:'pre',transform(source,id){const path=id.replaceAll('\\','/');let code=source;
 if(path.endsWith('/src/player-account.ts')){code=replaceRequired(code,'solo chart version',"body:JSON.stringify({songId:input.songId,difficulty:input.difficulty,events:input.events})","body:JSON.stringify({songId:input.songId,difficulty:input.difficulty,chartVersion:4,events:input.events})");return{code,map:null}}
 if(path.endsWith('/src/multiplayer-common.ts')){code=replaceRequired(code,'match registration chart version',"functionRequest({action:'register',...input})","functionRequest({action:'register',chartVersion:4,...input})");return{code,map:null}}
 if(path.endsWith('/src/multiplayer-session.ts')){code=replaceRequired(code,'match finalize chart version',"functionRequest({action:'finalize',matchId:submittedMatchId,submissionToken:current.submissionToken,roomCode:current.roomCode,playerId:current.playerId,displayName:current.displayName,songId:current.songId,difficulty:current.difficulty,events:eventSnapshot})","functionRequest({action:'finalize',chartVersion:4,matchId:submittedMatchId,submissionToken:current.submissionToken,roomCode:current.roomCode,playerId:current.playerId,displayName:current.displayName,songId:current.songId,difficulty:current.difficulty,events:eventSnapshot})");return{code,map:null}}
 return null}}}
