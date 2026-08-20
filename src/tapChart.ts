export type ImportedTapNote={id:number,time:number,lane:number};

export type ImportedTapChart={
 title:string;
 artist:string;
 sourceId:string;
 notes:ImportedTapNote[];
 duration:number;
};

export function parseTapChart(text:string):ImportedTapChart{
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/),meta:Record<string,string>={},raw:{x:number,time:number}[]=[];
 for(const source of lines){
  const line=source.trim();
  if(!line)continue;
  if(line.startsWith('#')){const match=line.match(/^#(title|artist|id)\s+(.+)$/i);if(match)meta[match[1].toLowerCase()]=match[2].trim();continue}
  const fields=line.split(',').map(value=>Number(value.trim()));
  if(fields.length<3||!fields.slice(0,3).every(Number.isFinite)||fields[2]<0)continue;
  raw.push({x:fields[0],time:fields[2]*1000});
 }
 if(!raw.length)throw new Error('This .tap file does not contain any playable notes.');
 const xPositions=[...new Set(raw.map(note=>note.x))].sort((a,b)=>a-b),laneForX=(x:number)=>{if(xPositions.length===1)return 1;const rank=xPositions.indexOf(x);return Math.max(0,Math.min(2,Math.round(rank/(xPositions.length-1)*2)))};
 const notes=raw.sort((a,b)=>a.time-b.time).map((note,id)=>({id,time:note.time,lane:laneForX(note.x)}));
 return{title:meta.title||'Imported Chart',artist:meta.artist||'TAP CHART',sourceId:meta.id||String(Date.now()),notes,duration:notes.at(-1)!.time/1000+3};
}
