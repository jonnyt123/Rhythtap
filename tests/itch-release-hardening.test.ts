import {assert,assertEquals,assertThrows} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {MAX_TAP_DURATION_MS,MAX_TAP_FILE_BYTES,MAX_TAP_NOTES,parseTapChart} from '../src/tapChart.ts';

const hardening=await Deno.readTextFile('scripts/game-wide-hardening-transform.ts');
const itchWorkflow=await Deno.readTextFile('.github/workflows/build-itch.yml');

Deno.test('itch account links use a URL-aware relative base',()=>{
 assert(hardening.includes("const appBaseUrl=()=>new URL(import.meta.env.BASE_URL,location.href)"));
 assert(hardening.includes("emailRedirectTo:appBaseUrl().toString()"));
 assert(hardening.includes("const accountRecoveryUrl=()=>{const url=appBaseUrl()"));
});

Deno.test('audio loads are invalidated and abortable',()=>{
 assert(hardening.includes('loadGeneration=0;loadAbort:AbortController|null=null'));
 assert(hardening.includes("this.loadAbort?.abort();this.loadAbort=null"));
 assert(hardening.includes("fetch(path,{signal})"));
 assert(hardening.includes("if(!started)return;setPreviewing(s.id)"));
});

Deno.test('short local audio can finish an imported chart without hanging',()=>{
 assert(hardening.includes("endedEarly=Boolean(song.localAudio&&mediaFinished&&t<lastNoteEnd)"));
 assert(hardening.includes("MISS:countsRef.current.MISS+remaining.length"));
});

Deno.test('itch releases receive unique audio cache versions and live billing mode',()=>{
 assert(itchWorkflow.includes('VITE_RHYTHTAP_BUILD: ${{ github.sha }}'));
 assert(itchWorkflow.includes('VITE_STRIPE_BILLING_ENV: live'));
});

Deno.test('tap parser preserves normal charts',()=>{
 const chart=parseTapChart('#title Test Song\n#artist Test Artist\n0,0,0.5\n1,0,1\n2,0,1.5');
 assertEquals(chart.title,'Test Song');
 assertEquals(chart.artist,'Test Artist');
 assertEquals(chart.notes.length,3);
 assertEquals(chart.notes.map(note=>note.lane),[0,1,2]);
});

Deno.test('tap parser rejects pathological note counts and duration',()=>{
 const tooMany=Array.from({length:MAX_TAP_NOTES+1},(_,index)=>`${index%3},0,${index/100}`).join('\n');
 assertThrows(()=>parseTapChart(tooMany),Error,'note import limit');
 assertThrows(()=>parseTapChart(`0,0,${MAX_TAP_DURATION_MS/1000+1}`),Error,'30 minute');
});

Deno.test('tap import caps remain storage-friendly',()=>{
 assertEquals(MAX_TAP_FILE_BYTES,1_500_000);
 assertEquals(MAX_TAP_NOTES,12_000);
 assertEquals(MAX_TAP_DURATION_MS,1_800_000);
 assert(hardening.includes('RhythmTap local chart storage is full'));
});
