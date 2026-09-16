import {assert,assertEquals} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {parseTapChart} from '../src/tapChart.ts';

const main=await Deno.readTextFile('src/main.tsx');
const deepAudit=await Deno.readTextFile('scripts/deep-audit-fixes-transform.ts');
const tapChart=await Deno.readTextFile('src/tapChart.ts');
const serviceWorker=await Deno.readTextFile('public/sw.js');
const packager=await Deno.readTextFile('scripts/package-itch.mjs');
const vite=await Deno.readTextFile('vite.config.ts');

Deno.test('TAP lane mapping is linear instead of repeated indexOf scans',()=>{
 assert(tapChart.includes('const lanesByX=new Map<number,number>()'));
 assert(!tapChart.includes('xPositions.indexOf'));
 const lines=['#title Extreme X Test','#artist QA'];
 for(let i=0;i<4000;i++)lines.push(`${i},0,${(i/1000).toFixed(3)}`);
 const parsed=parseTapChart(lines.join('\n'));
 assertEquals(parsed.notes.length,4000);
 assertEquals(parsed.notes[0].lane,0);
 assertEquals(parsed.notes.at(-1)?.lane,2);
});

Deno.test('local audio persistence handles restricted and aborted IndexedDB operations',()=>{
 assert(deepAudit.includes("typeof indexedDB==='undefined'"));
 assert(deepAudit.includes('transaction.onabort'));
 assert(deepAudit.includes('finally{db.close()}'));
 assert(deepAudit.includes("request.onblocked"));
 assert(deepAudit.includes("deleteStoredAudio(id).catch"));
});

Deno.test('mobile file providers may attach known audio extensions with generic MIME',()=>{
 assert(main.includes('accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac,.flac"'));
 assert(deepAudit.includes("mime==='application/octet-stream'"));
 assert(deepAudit.includes('mp3|m4a|wav|ogg|aac|flac'));
});

Deno.test('pending media metadata waits are explicitly cancelled',()=>{
 assert(deepAudit.includes("media.addEventListener('rhythmtap-cancel',cancelled"));
 assert(deepAudit.includes("media.dispatchEvent(new Event('rhythmtap-cancel'))"));
});

Deno.test('itch runtime does not attempt service worker registration',()=>{
 assert(deepAudit.includes("import.meta.env.MODE!=='itch'"));
 assert(deepAudit.includes("serviceWorker.register"));
 assert(vite.includes('deepAuditFixesTransform()'));
});

Deno.test('service worker retires stale shell and runtime caches and has explicit offline fallback',()=>{
 assert(serviceWorker.includes("SHELL_CACHE='rhythtap-shell-v2'"));
 assert(serviceWorker.includes("RUNTIME_CACHE='rhythtap-runtime-v2'"));
 assert(serviceWorker.includes("key.startsWith('rhythtap-runtime-')"));
 assert(serviceWorker.includes("url.pathname.endsWith('/sw.js')"));
 assert(serviceWorker.includes("status:503"));
 assert(serviceWorker.includes('if(response.ok)'));
});

Deno.test('itch packager strips website-only files and rejects dev audio versions',()=>{
 assert(packager.includes("relative === 'sw.js'"));
 assert(packager.includes("relative === 'robots.txt'"));
 assert(packager.includes("relative === 'sitemap.xml'"));
 assert(packager.includes("relative.startsWith('launch/')"));
 assert(packager.includes("text.includes('?v=dev')"));
 assert(packager.includes('VITE_RHYTHTAP_BUILD'));
});
