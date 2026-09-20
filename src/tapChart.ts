export type ImportedTapNote={id:number,time:number,lane:number};

export type ImportedTapChart={
 title:string;
 artist:string;
 sourceId:string;
 notes:ImportedTapNote[];
 duration:number;
};

export const MAX_TAP_FILE_BYTES=1_500_000;
export const MAX_TAP_NOTES=12_000;
export const MAX_TAP_DURATION_MS=30*60*1000;

const cleanMeta=(value:string,max:number)=>value.trim().slice(0,max);

export function parseTapChart(text:string):ImportedTapChart{
 if(text.length>MAX_TAP_FILE_BYTES)throw new Error('This .tap file is too large. Keep chart files under 1.5 MB.');
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/),meta:Record<string,string>={},raw:{x:number,time:number}[]=[];
 for(const source of lines){
  const line=source.trim();
  if(!line)continue;
  if(line.startsWith('#')){const match=line.match(/^#(title|artist|id)\s+(.+)$/i);if(match){const key=match[1].toLowerCase(),limit=key==='id'?64:80;meta[key]=cleanMeta(match[2],limit)}continue}
  const fields=line.split(',').map(value=>Number(value.trim()));
  if(fields.length<3||!fields.slice(0,3).every(Number.isFinite)||fields[2]<0)continue;
  const time=fields[2]*1000;
  if(time>MAX_TAP_DURATION_MS)throw new Error('This .tap chart is longer than the 30 minute import limit.');
  if(raw.length>=MAX_TAP_NOTES)throw new Error(`This .tap chart exceeds the ${MAX_TAP_NOTES.toLocaleString()} note import limit.`);
  raw.push({x:fields[0],time});
 }
 if(!raw.length)throw new Error('This .tap file does not contain any playable notes.');
 const xPositions=[...new Set(raw.map(note=>note.x))].sort((a,b)=>a-b);
 const lanesByX=new Map<number,number>();
 for(let rank=0;rank<xPositions.length;rank++){
  const lane=xPositions.length===1?1:Math.max(0,Math.min(2,Math.round(rank/(xPositions.length-1)*2)));
  lanesByX.set(xPositions[rank],lane);
 }
 const notes=raw.sort((a,b)=>a.time-b.time).map((note,id)=>({id,time:note.time,lane:lanesByX.get(note.x)??1}));
 return{title:meta.title||'Imported Chart',artist:meta.artist||'TAP CHART',sourceId:meta.id||String(Date.now()),notes,duration:notes.at(-1)!.time/1000+3};
}
