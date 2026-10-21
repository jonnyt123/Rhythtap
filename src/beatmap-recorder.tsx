import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,Check,Headphones,Music2,Pause,Play,RotateCcw,Save,Trash2,Upload,Undo2,Volume2} from 'lucide-react';
import {MAX_TAP_DURATION_MS,MAX_TAP_NOTES} from './tapChart';
import './beatmap-recorder.css';

export type RecordedBeatmapNote={id:number;time:number;lane:number;duration?:number};
export type RecordedBeatmapDraft={
 file:File;title:string;artist:string;bpm:number;duration:number;notes:RecordedBeatmapNote[];
};
const LANES=['LEFT','MIDDLE','RIGHT'] as const;
const KEYS=['D','F','J'] as const;
const MAX_AUDIO_BYTES=120*1024*1024;
const allowedAudio=(file:File)=>file.type.startsWith('audio/')||/\.(mp3|m4a|aac|wav|ogg|opus|flac|webm)$/i.test(file.name);
const stamp=(ms:number)=>{
 const seconds=Math.max(0,Math.floor(ms/1000));
 return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
};
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

export function BeatmapRecorder({onBack,onSave}:{
 onBack:()=>void;
 onSave:(draft:RecordedBeatmapDraft)=>Promise<void>;
}){
 const[file,setFile]=useState<File|null>(null);
 const[audioUrl,setAudioUrl]=useState('');
 const[title,setTitle]=useState('');
 const[artist,setArtist]=useState('');
 const[bpm,setBpm]=useState(120);
 const[durationMs,setDurationMs]=useState(0);
 const[positionMs,setPositionMs]=useState(0);
 const[playing,setPlaying]=useState(false);
 const[recording,setRecording]=useState(false);
 const[notes,setNotes]=useState<RecordedBeatmapNote[]>([]);
 const[busy,setBusy]=useState(false);
 const[message,setMessage]=useState('');
 const[activeLane,setActiveLane]=useState<number|null>(null);
 const audioRef=useRef<HTMLAudioElement|null>(null);
 const lastId=useRef(0);
 const pressRef=useRef<Map<number,{id:number;time:number}>>(new Map());
 const notesRef=useRef<RecordedBeatmapNote[]>([]);
 const recordingRef=useRef(false);

 useEffect(()=>{notesRef.current=notes},[notes]);
 useEffect(()=>{recordingRef.current=recording},[recording]);
 useEffect(()=>()=>{if(audioUrl)URL.revokeObjectURL(audioUrl)},[audioUrl]);
 useEffect(()=>{
  const audio=audioRef.current;
  if(!audio)return;
  const time=()=>setPositionMs(Math.round(audio.currentTime*1000));
  const ended=()=>{setPlaying(false);setRecording(false);pressRef.current.clear()};
  const paused=()=>setPlaying(false);
  audio.addEventListener('timeupdate',time);
  audio.addEventListener('ended',ended);
  audio.addEventListener('pause',paused);
  return()=>{audio.removeEventListener('timeupdate',time);audio.removeEventListener('ended',ended);audio.removeEventListener('pause',paused)};
 },[audioUrl]);

 const selectAudio=(incoming?:File)=>{
  if(!incoming)return;
  setMessage('');
  if(!allowedAudio(incoming)){setMessage('Select an audio track such as MP3, M4A, WAV, AAC, OGG, or FLAC.');return}
  if(incoming.size===0||incoming.size>MAX_AUDIO_BYTES){setMessage('Choose an audio file smaller than 120 MB.');return}
  const audio=audioRef.current;
  audio?.pause();
  setPlaying(false);setRecording(false);pressRef.current.clear();
  setNotes([]);lastId.current=0;setDurationMs(0);setPositionMs(0);
  setFile(incoming);
  setTitle(incoming.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').slice(0,80));
  setArtist('CUSTOM BEATMAP');
  setAudioUrl(URL.createObjectURL(incoming));
 };
 const loaded=()=>{
  const duration=audioRef.current?.duration;
  if(!duration||!Number.isFinite(duration)){setMessage('Unable to read the audio duration. Try a different audio file.');return}
  if(duration*1000>MAX_TAP_DURATION_MS){setMessage('Tracks must be 30 minutes or shorter.');return}
  setDurationMs(Math.round(duration*1000));setMessage('');
 };
 const play=async(record:boolean)=>{
  const audio=audioRef.current;
  if(!audio||!file||!durationMs){setMessage('Choose a supported audio file first.');return}
  setMessage('');
  try{
   if(audio.currentTime>=audio.duration-.1)audio.currentTime=0;
   await audio.play();
   setPlaying(true);setRecording(record);
  }catch{setMessage('Audio could not start. Tap PLAY again or try another audio file.')}
 };
 const pause=()=>{
  audioRef.current?.pause();
  setPlaying(false);setRecording(false);pressRef.current.clear();setActiveLane(null);
 };
 const pushNote=useCallback((lane:number)=>{
  const audio=audioRef.current;
  if(!recordingRef.current||!audio||audio.paused||!durationMs||notesRef.current.length>=MAX_TAP_NOTES)return;
  const time=Math.round(audio.currentTime*1000);
  if(time<0||time>=durationMs)return;
  const id=lastId.current++;
  pressRef.current.set(lane,{id,time});
  setNotes(previous=>previous.length>=MAX_TAP_NOTES?previous:[...previous,{id,time,lane}]);
  setActiveLane(lane);
 },[durationMs]);
 const releaseNote=useCallback((lane:number)=>{
  const held=pressRef.current.get(lane);
  pressRef.current.delete(lane);setActiveLane(current=>current===lane?null:current);
  if(!held||!durationMs)return;
  const current=Math.round((audioRef.current?.currentTime??0)*1000);
  const holdMs=Math.min(durationMs-held.time,Math.max(0,current-held.time));
  if(holdMs>=160)setNotes(previous=>previous.map(note=>note.id===held.id?{...note,duration:holdMs}:note));
 },[durationMs]);
 useEffect(()=>{
  const keydown=(event:KeyboardEvent)=>{
   if(event.repeat||event.ctrlKey||event.altKey||event.metaKey)return;
   if(event.target instanceof HTMLElement&&event.target.closest('input,textarea,select'))return;
   const lane=KEYS.indexOf(event.key.toUpperCase() as typeof KEYS[number]);
   if(lane<0)return;
   event.preventDefault();
   if(!pressRef.current.has(lane))pushNote(lane);
  };
  const keyup=(event:KeyboardEvent)=>{
   const lane=KEYS.indexOf(event.key.toUpperCase() as typeof KEYS[number]);
   if(lane>=0)releaseNote(lane);
  };
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);
  return()=>{window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup)};
 },[pushNote,releaseNote]);
 const scrub=(value:number)=>{
  const audio=audioRef.current;
  if(!audio||recording)return;
  pause();
  audio.currentTime=Math.min((durationMs||0)/1000,Math.max(0,value/1000));
  setPositionMs(Math.round(audio.currentTime*1000));
 };
 const reset=()=>{
  if(!notes.length)return;
  if(!window.confirm('Clear every recorded note? This cannot be undone.'))return;
  pause();setNotes([]);lastId.current=0;setMessage('All recorded notes cleared.');
 };
 const leave=()=>{
  if(notes.length&&!window.confirm('Exit without saving this beatmap?'))return;
  pause();onBack();
 };
 const save=async()=>{
  if(busy||!file||!durationMs)return;
  const finalNotes=normalizeRecordedNotes(notes,durationMs);
  if(!finalNotes.length){setMessage('Record at least one note before saving.');return}
  if(!title.trim()){setMessage('Give this beatmap a title before saving.');return}
  pause();setBusy(true);setMessage('');
  try{
   await onSave({file,title:title.trim().slice(0,80),artist:artist.trim().slice(0,80)||'CUSTOM BEATMAP',
    bpm:Math.min(300,Math.max(40,Math.round(bpm)||120)),duration:durationMs/1000,notes:finalNotes});
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to save this beatmap.');setBusy(false)}
 };
 const maxTime=Math.max(0,durationMs);
 const ordered=normalizeRecordedNotes(notes,maxTime);
 return <section className="beatmap-recorder screen">
  <header className="beatmap-recorder-top">
   <button type="button" onClick={leave} aria-label="Back to User Beatmaps"><ArrowLeft/></button>
   <div><small>USER BEATMAPS · CREATOR</small><h1>TAP CHART STUDIO</h1></div>
   <strong className={recording?'recording':''}>{recording?'● RECORDING':playing?'PLAYING':'EDIT MODE'}</strong>
  </header>
  <div className="beatmap-recorder-scroll">
   <div className="beatmap-recorder-intro"><Music2/><div><strong>YOUR SONG. YOUR NOTES.</strong><p>Upload an audio file, play it, then tap the three lanes to record any pattern in time with the music. Save your chart and play it from User Beatmaps.</p></div></div>
   <div className="beatmap-recorder-upload">
    <label><Upload/><span><strong>{file?file.name:'CHOOSE AUDIO FILE'}</strong><small>{file?'Tap to change the track':'MP3 · M4A · WAV · AAC · OGG · FLAC'}</small></span>
     <input aria-label="Upload audio file" type="file" accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.flac,.webm" onChange={event=>{selectAudio(event.target.files?.[0]);event.currentTarget.value=''}}/>
    </label>
    <div className="beatmap-recorder-fields">
     <label>SONG TITLE<input aria-label="Song title" value={title} maxLength={80} onChange={event=>setTitle(event.target.value)}/></label>
     <label>ARTIST<input aria-label="Artist" value={artist} maxLength={80} onChange={event=>setArtist(event.target.value)}/></label>
     <label>BPM<input aria-label="BPM" type="number" min="40" max="300" value={bpm} onChange={event=>setBpm(Number(event.target.value))}/></label>
    </div>
   </div>
   <audio ref={audioRef} src={audioUrl||undefined} preload="metadata" onLoadedMetadata={loaded}
    onError={()=>{if(audioUrl)setMessage('This audio format could not be played on this device.')}}/>
   <div className="beatmap-recorder-transport">
    <div className="beatmap-recorder-track"><span>{stamp(positionMs)}</span><input aria-label="Scrub audio" type="range" min={0} max={maxTime||1} step="100" value={Math.min(positionMs,maxTime||1)} disabled={!durationMs||recording} onChange={event=>scrub(Number(event.target.value))}/><span>{stamp(durationMs)}</span></div>
    <div className="beatmap-recorder-actions">
     {playing?<button onClick={pause}><Pause/> PAUSE</button>:<><button disabled={!durationMs} onClick={()=>void play(false)}><Headphones/> PREVIEW</button><button className="record-button" disabled={!durationMs} onClick={()=>void play(true)}><Play/> RECORD</button></>}
     {playing&&!recording&&<button className="record-button" onClick={()=>setRecording(true)}>● START RECORDING</button>}
     {recording&&<button className="record-button active" onClick={()=>{setRecording(false);pressRef.current.clear();setActiveLane(null)}}>■ STOP RECORDING</button>}
    </div>
   </div>
   <div className="beatmap-recorder-stage">
    <div className="beatmap-recorder-stage-heading"><span>{recording?'TAP NOTES TO THE BEAT':'READY TO CREATE'}</span><strong>{notes.length} / {MAX_TAP_NOTES.toLocaleString()} NOTES</strong></div>
    <div className="beatmap-recorder-lanes">
     {LANES.map((name,index)=><button key={name} type="button" aria-label={'Record '+name+' lane'} disabled={!recording}
      className={'beatmap-recorder-lane lane-'+index+(activeLane===index?' active':'')}
      onPointerDown={event=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);if(!pressRef.current.has(index))pushNote(index)}}
      onPointerUp={event=>{event.preventDefault();releaseNote(index)}}
      onPointerCancel={()=>releaseNote(index)}
      onContextMenu={event=>event.preventDefault()}>
      <i className="beatmap-recorder-lane-pulse"/><strong>{name}</strong><small>{KEYS[index]} KEY</small><span>{recording?'TAP':'◉'}</span>
     </button>)}
    </div>
    <p>Tap for a note. Press and hold for a long note. On desktop use D, F, and J. The chart uses the exact audio playback position.</p>
   </div>
   <div className="beatmap-recorder-edit">
    <div><strong>RECORDED NOTES</strong><small>{ordered.length?ordered.slice(-8).map(note=>stamp(note.time)+' '+LANES[note.lane]).join(' · '):'Start recording and tap the lanes above.'}</small></div>
    <div><button type="button" disabled={!notes.length||busy} onClick={()=>setNotes(previous=>previous.slice(0,-1))}><Undo2/> UNDO</button>
     <button type="button" disabled={!notes.length||busy} onClick={reset}><Trash2/> CLEAR</button></div>
   </div>
   {message&&<p className="beatmap-recorder-message" role="status">{message}</p>}
   <button className="beatmap-recorder-save" type="button" disabled={busy||!file||!durationMs||!notes.length} onClick={()=>void save()}>
    {busy?<RotateCcw/>:<Save/>}{busy?'SAVING…':'SAVE BEATMAP & RETURN TO LIBRARY'}<Check/>
   </button>
   <p className="beatmap-recorder-disclaimer"><Volume2/> Audio and your chart are saved locally on this device. Custom beatmaps do not award store coins. Keep a copy of your source audio.</p>
  </div>
 </section>;
}
