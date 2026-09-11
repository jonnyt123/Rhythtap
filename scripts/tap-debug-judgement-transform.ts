import type {Plugin} from 'vite';

const required=(source:string,label:string,before:string,after:string)=>{
  if(!source.includes(before))throw new Error(`[tap-debug-judgement] Unable to patch ${label}; transformed layout changed.`);
  return source.replace(before,after);
};

export function tapDebugJudgementTransform():Plugin{
  return {
    name:'rhythtap-tap-debug-judgement-transform',
    enforce:'pre',
    transform(source,id){
      if(!id.replaceAll('\\','/').endsWith('/src/main.tsx'))return null;
      let code=source;

      code=required(
        code,
        'guarded chronological note matching',
        "let best:Note|undefined,dist=Infinity;for(let index=low;index<laneChart.length;index++){const n=laneChart[index];if(n.time>hitTime+TIMING.good)break;const d=Math.abs(hitTime-n.time);if(!judged.current.has(n.id)&&d<dist){best=n;dist=d}}",
        "const candidates:Note[]=[];let nearest:Note|undefined,nearestDist=Infinity;for(let index=low;index<laneChart.length;index++){const n=laneChart[index];if(n.time>hitTime+TIMING.good)break;if(judged.current.has(n.id))continue;candidates.push(n);const d=Math.abs(hitTime-n.time);if(d<nearestDist){nearest=n;nearestDist=d}}const best=candidates[0],dist=best?Math.abs(hitTime-best.time):Infinity,ambiguous=candidates.length>1,futureStealBlocked=Boolean(best&&nearest&&nearest.id!==best.id&&nearest.time>best.time),matchWarning=futureStealBlocked?'FUTURE STEAL BLOCKED':ambiguous?'AMBIGUOUS':null;"
      );

      code=required(
        code,
        'unmatched tap diagnostics',
        "if(!best)return;",
        "if(!best){if(document.documentElement.dataset.tapDebug==='1')window.dispatchEvent(new CustomEvent('rhythtap:tap-judgement',{detail:{eventTimeStamp,lane,hitTime,matched:false,noteId:null,noteTime:null,deltaMs:null,judge:'NO NOTE',candidateCount:0,warning:null,nearestNoteId:null,nearestNoteTime:null}}));return;}"
      );

      code=required(
        code,
        'matched tap diagnostics',
        "const measuredJudge=judgeDistance(dist),hitJudge:Judge=measuredJudge==='MISS'?'GOOD':measuredJudge;",
        "const measuredJudge=judgeDistance(dist),hitJudge:Judge=measuredJudge==='MISS'?'GOOD':measuredJudge;if(document.documentElement.dataset.tapDebug==='1')window.dispatchEvent(new CustomEvent('rhythtap:tap-judgement',{detail:{eventTimeStamp,lane,hitTime,matched:true,noteId:best.id,noteTime:best.time,deltaMs:Math.round(hitTime-best.time),judge:hitJudge,candidateCount:candidates.length,warning:matchWarning,nearestNoteId:nearest?.id??null,nearestNoteTime:nearest?.time??null,nearestDeltaMs:nearest?Math.round(hitTime-nearest.time):null}}));"
      );

      return {code,map:null};
    }
  };
}
