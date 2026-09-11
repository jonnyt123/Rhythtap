import type {Plugin} from 'vite';

const required=(source:string,label:string,before:string,after:string)=>{
  if(!source.includes(before))throw new Error(`[dense-note-matcher] Unable to patch ${label}; transformed layout changed.`);
  return source.replace(before,after);
};

export function denseNoteMatcherTransform():Plugin{
  return {
    name:'rhythtap-dense-note-matcher-transform',
    enforce:'pre',
    transform(source,id){
      if(!id.replaceAll('\\','/').endsWith('/src/main.tsx'))return null;
      const code=required(
        source,
        'guarded chronological note matching',
        "let best:Note|undefined,dist=Infinity;for(let index=low;index<laneChart.length;index++){const n=laneChart[index];if(n.time>hitTime+TIMING.good)break;const d=Math.abs(hitTime-n.time);if(!judged.current.has(n.id)&&d<dist){best=n;dist=d}}",
        "const candidates:Note[]=[];for(let index=low;index<laneChart.length;index++){const n=laneChart[index];if(n.time>hitTime+TIMING.good)break;if(!judged.current.has(n.id))candidates.push(n)}const best=candidates[0],dist=best?Math.abs(hitTime-best.time):Infinity;"
      );
      return {code,map:null};
    }
  };
}
