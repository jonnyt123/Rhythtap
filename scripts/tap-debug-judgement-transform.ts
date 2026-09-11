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
        'unmatched tap diagnostics',
        "if(!best)return;",
        "if(!best){if(document.documentElement.dataset.tapDebug==='1')window.dispatchEvent(new CustomEvent('rhythtap:tap-judgement',{detail:{eventTimeStamp,lane,hitTime,matched:false,noteId:null,noteTime:null,deltaMs:null,judge:'NO NOTE'}}));return;}"
      );

      code=required(
        code,
        'matched tap diagnostics',
        "const measuredJudge=judgeDistance(dist),hitJudge:Judge=measuredJudge==='MISS'?'GOOD':measuredJudge;",
        "const measuredJudge=judgeDistance(dist),hitJudge:Judge=measuredJudge==='MISS'?'GOOD':measuredJudge;if(document.documentElement.dataset.tapDebug==='1')window.dispatchEvent(new CustomEvent('rhythtap:tap-judgement',{detail:{eventTimeStamp,lane,hitTime,matched:true,noteId:best.id,noteTime:best.time,deltaMs:Math.round(hitTime-best.time),judge:hitJudge}}));"
      );

      return {code,map:null};
    }
  };
}
