import {assert,assertEquals} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {isSupportedBeatmapAudio,normalizeRecordedNotes,MAX_BEATMAP_AUDIO_BYTES} from '../src/recorded-beatmap.ts';
import {MAX_TAP_NOTES,MAX_TAP_DURATION_MS} from '../src/tapChart.ts';

const transform=await Deno.readTextFile('scripts/beatmap-recorder-transform.ts');
const component=await Deno.readTextFile('src/beatmap-recorder.tsx');
const menu=await Deno.readTextFile('scripts/metal-menu-transform.ts');
const store=await Deno.readTextFile('src/song-store.tsx');
const config=await Deno.readTextFile('vite.config.ts');

Deno.test('recorded notes are sorted, remapped and validated for gameplay',()=>{
 const raw=[
  {id:42,time:1011.4,lane:2},
  {id:11,time:200.2,lane:0,duration:300},
  {id:19,time:600,lane:1},
  {id:20,time:-100,lane:1},
  {id:30,time:5000,lane:1},
  {id:31,time:500,lane:9},
 ];
 const result=normalizeRecordedNotes(raw,4000);
 assertEquals(result.length,3);
 assertEquals(result.map(note=>note.id),[0,1,2]);
 assertEquals(result.map(note=>note.time),[200,600,1011]);
 assertEquals(result.map(note=>note.lane),[0,1,2]);
 assertEquals(result[0].duration,300);
 assert(!('duration' in result[1]));
});

Deno.test('held notes are bounded to audio and short taps do not become holds',()=>{
 const notes=normalizeRecordedNotes([
  {id:1,time:800,lane:1,duration:2000},
  {id:2,time:50,lane:0,duration:90}
 ],1000);
 assertEquals(notes[1].duration,200);
 assert(!('duration'in notes[0]));
});

Deno.test('recording limits protect local audio and chart storage',()=>{
 assertEquals(MAX_TAP_DURATION_MS,30*60*1000);
 const many=Array.from({length:MAX_TAP_NOTES+5},(_,id)=>({id,time:id*10,lane:id%3}));
 assertEquals(normalizeRecordedNotes(many,MAX_TAP_DURATION_MS).length,MAX_TAP_NOTES);
 assert(isSupportedBeatmapAudio({name:'song.mp3',type:'audio/mpeg',size:1000}));
 assert(isSupportedBeatmapAudio({name:'iphone-recording.m4a',type:'',size:5000}));
 assert(!isSupportedBeatmapAudio({name:'notes.txt',type:'text/plain',size:500}));
 assert(!isSupportedBeatmapAudio({name:'huge.mp3',type:'audio/mpeg',size:MAX_BEATMAP_AUDIO_BYTES+1}));
 assert(!isSupportedBeatmapAudio({name:'empty.mp3',type:'audio/mpeg',size:0}));
});

Deno.test('recorder saves into existing playable local song architecture',()=>{
 assert(transform.includes('storeAudio(id,draft.file)'));
 assert(transform.includes('saveImportedSongs(next)'));
 assert(transform.includes('localAudio:true'));
 assert(transform.includes('charts:{EASY:notes,NORMAL:notes,HARD:notes}'));
 assert(transform.includes("setScreen('library')"));
 assert(transform.includes("setScreen('beatmapRecorder')"));
 assert(transform.includes('createBeatmap:()=>void'));
 assert(config.includes('beatmapRecorderTransform()'));
 assert(component.includes("audio.currentTime*1000"));
 assert(component.includes('onPointerDown'));
 assert(component.includes('onPointerUp'));
 assert(component.includes('SAVE BEATMAP & RETURN TO LIBRARY'));
 assert(component.includes('normalizeRecordedNotes(notes,durationMs)'));
});

Deno.test('wordmarks replace both broken image elements',()=>{
 assert(!menu.includes('src={import.meta.env.BASE_URL+\'assets/menu/rhythmtap-logo.webp\'}'));
 assert(!store.includes('src={import.meta.env.BASE_URL+\'assets/menu/rhythmtap-logo.webp\'}'));
 assert(menu.includes('rhythmtap-metal-wordmark'));
 assert(store.includes('song-store-wordmark'));
});
