import {MAX_TAP_DURATION_MS,MAX_TAP_NOTES} from './tapChart';

export type RecordedBeatmapNote={id:number;time:number;lane:number;duration?:number};
export type RecordedBeatmapDraft={
 file:File;title:string;artist:string;bpm:number;duration:number;notes:RecordedBeatmapNote[];
};
export const MAX_BEATMAP_AUDIO_BYTES=120*1024*1024;
export const isSupportedBeatmapAudio=(file:Pick<File,'name'|'type'|'size'>)=>
 file.size>0&&file.size<=MAX_BEATMAP_AUDIO_BYTES
 &&(file.type.startsWith('audio/')||/\.(mp3|m4a|aac|wav|ogg|opus|flac|webm)$/i.test(file.name));

export const normalizeRecordedNotes=(notes:RecordedBeatmapNote[],durationMs:number)=>{
 const safeDuration=Math.min(MAX_TAP_DURATION_MS,Math.max(0,durationMs));
 return notes
  .filter(note=>Number.isFinite(note.time)&&Number.isInteger(note.lane)&&note.lane>=0&&note.lane<3&&note.time>=0&&note.time<safeDuration)
  .sort((a,b)=>a.time-b.time||a.id-b.id)
  .slice(0,MAX_TAP_NOTES)
  .map((note,id)=>({
   id,time:Math.round(note.time),lane:note.lane,
   ...(Number.isFinite(note.duration)&&Number(note.duration)>=160
    ?{duration:Math.round(Math.min(Number(note.duration),safeDuration-note.time))}:{})
  }));
};
