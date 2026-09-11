from pathlib import Path

main=Path('src/main.tsx')
source=main.read_text()

def repl(text,label,old,new):
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'missing {label}: {old[:120]}')
    return text.replace(old,new,1)

source=repl(source,'fail constants',
"const MAX_INPUT_EVENT_AGE_MS=120;",
"const MAX_INPUT_EVENT_AGE_MS=120;\nconst SONG_FAIL_GRACE_MS=2000;\nconst SONG_FAIL_WARNING=25;")

source=repl(source,'meter warning styling hook',
"const GameplayMeters=memo(function GameplayMeters({energy,pulse}:{energy:number,pulse:number}){return <div className=\"meters\"><div className=\"energy\"><span style={{width:energy+'%'}}/></div><div className=\"pulse\"><Zap size={14}/><span style={{width:pulse+'%'}}/></div></div>});",
"const GameplayMeters=memo(function GameplayMeters({energy,pulse}:{energy:number,pulse:number}){return <div className={'meters '+(energy<=SONG_FAIL_WARNING?'fail-warning':'')} aria-label={'Performance '+Math.round(energy)+' percent'}><div className=\"energy\"><span style={{width:energy+'%'}}/></div><div className=\"pulse\"><Zap size={14}/><span style={{width:pulse+'%'}}/></div></div>});")

source=repl(source,'gameplay refs',
"const transport=useRef(new SynthTransport()),arenaRef=useRef<HTMLDivElement>(null),raf=useRef(0),pressed=useRef(new Set<number>()),judged=useRef(new Set<number>()),activeHolds=useRef(new Map<number,Note>()),feedbackTimer=useRef(0),nowRef=useRef(0),missCursor=useRef(0),lastPaint=useRef(0),frameHealth=useRef({last:0,samples:0,slow:0}),perfSamples=useRef<number[]>([]),backgroundPaused=useRef(false);",
"const transport=useRef(new SynthTransport()),arenaRef=useRef<HTMLDivElement>(null),raf=useRef(0),pressed=useRef(new Set<number>()),judged=useRef(new Set<number>()),activeHolds=useRef(new Map<number,Note>()),feedbackTimer=useRef(0),nowRef=useRef(0),missCursor=useRef(0),lastPaint=useRef(0),frameHealth=useRef({last:0,samples:0,slow:0}),perfSamples=useRef<number[]>([]),backgroundPaused=useRef(false),failedRef=useRef(false),energyRef=useRef(100);")

source=repl(source,'failed state',
"[counts,setCounts]=useState({PERFECT:0,GREAT:0,GOOD:0,MISS:0}),[pulse,setPulse]=useState(0),[energy,setEnergy]=useState(100);",
"[counts,setCounts]=useState({PERFECT:0,GREAT:0,GOOD:0,MISS:0}),[pulse,setPulse]=useState(0),[energy,setEnergy]=useState(100),[failed,setFailed]=useState(false);")

old_apply="const applyJudge=(j:Judge,lane:number)=>{showFeedback(j,lane);setCounts(c=>({...c,[j]:c[j]+1}));if(j==='MISS'){setCombo(0);setEnergy(e=>Math.max(0,e-8));return}const base={PERFECT:1000,GREAT:700,GOOD:350,MISS:0}[j],multiplier=Math.min(4,1+Math.floor(comboRef.current/10));setScore(s=>s+base*multiplier);setCombo(c=>{const n=c+1;setMaxCombo(m=>Math.max(m,n));return n});setPulse(p=>Math.min(100,p+(j==='PERFECT'?5:2)));setEnergy(e=>Math.min(100,e+1))};"
new_apply="const inFailGrace=()=>nowRef.current<notes[0].time+SONG_FAIL_GRACE_MS;\n const adjustEnergy=(delta:number)=>setEnergy(current=>{const applied=delta<0&&inFailGrace()?0:delta,next=Math.max(0,Math.min(100,current+applied));energyRef.current=next;if(next<=0)failedRef.current=true;return next});\n const applyJudge=(j:Judge,lane:number,healthDelta?:number)=>{showFeedback(j,lane);setCounts(c=>({...c,[j]:c[j]+1}));if(j==='MISS'){setCombo(0);adjustEnergy(healthDelta??-8);return}const base={PERFECT:1000,GREAT:700,GOOD:350,MISS:0}[j],multiplier=Math.min(4,1+Math.floor(comboRef.current/10));setScore(s=>s+base*multiplier);setCombo(c=>{const n=c+1;setMaxCombo(m=>Math.max(m,n));return n});setPulse(p=>Math.min(100,p+(j==='PERFECT'?5:2)));adjustEnergy(j==='PERFECT'?1.2:j==='GREAT'?.7:.2)};"
source=repl(source,'health model',old_apply,new_apply)

source=repl(source,'hold recovery',
"setPulse(p=>Math.min(100,p+8));setEnergy(e=>Math.min(100,e+3));showFeedback('HOLD',lane)",
"setPulse(p=>Math.min(100,p+8));adjustEnergy(1);showFeedback('HOLD',lane)")

old_release="const release=(lane:number,eventTimeStamp?:number)=>{pressed.current.delete(lane);const hold=activeHolds.current.get(lane);if(!hold)return;const releaseTime=transport.current.now()-inputEventAgeMs(eventTimeStamp)+offset+(song.chartOffset||0),remaining=hold.time+(hold.duration??0)-releaseTime;if(remaining<=120){completeHold(lane);return}activeHolds.current.delete(lane);showFeedback('MISS',lane);setCombo(0);setEnergy(e=>Math.max(0,e-10))};"
new_release="const release=(lane:number,eventTimeStamp?:number)=>{pressed.current.delete(lane);const hold=activeHolds.current.get(lane);if(!hold)return;const releaseTime=transport.current.now()-inputEventAgeMs(eventTimeStamp)+offset+(song.chartOffset||0),remaining=hold.time+(hold.duration??0)-releaseTime;if(remaining<=120){completeHold(lane);return}activeHolds.current.delete(lane);applyJudge('MISS',lane,-6)};"
source=repl(source,'broken hold health',old_release,new_release)

source=repl(source,'begin reset',
"const begin=async()=>{judged.current.clear();activeHolds.current.clear();",
"const begin=async()=>{judged.current.clear();failedRef.current=false;energyRef.current=100;setFailed(false);setEnergy(100);activeHolds.current.clear();")

source=repl(source,'failed input guard',
"const hit=(lane:number,eventTimeStamp?:number)=>{if(!ready||paused)return;",
"const hit=(lane:number,eventTimeStamp?:number)=>{if(!ready||paused||failedRef.current)return;")

source=repl(source,'failed animation guard',
"useEffect(()=>{if(!ready||paused)return;const paintInterval=phoneGameplay?100:66",
"useEffect(()=>{if(!ready||paused||failed)return;const paintInterval=phoneGameplay?100:66")

source=repl(source,'tick dependencies',
"},[ready,paused,effectiveGraphicsMode,phoneGameplay]);",
"},[ready,paused,failed,effectiveGraphicsMode,phoneGameplay]);")

insert_anchor=" useEffect(()=>{const handleVisibility=()=>{if(document.hidden&&ready&&!paused){"
fail_effect=" useEffect(()=>{if(!ready||failed||energy>0)return;failedRef.current=true;cancelAnimationFrame(raf.current);pressed.current.clear();activeHolds.current.clear();transport.current.stop();setPaused(false);setReady(false);setFailed(true)},[energy,ready,failed]);\n"
if fail_effect not in source:
    if insert_anchor not in source: raise SystemExit('missing failure effect anchor')
    source=source.replace(insert_anchor,fail_effect+insert_anchor,1)

source=repl(source,'start modal fail gate',
"{!ready&&<div className=\"modal\"><Volume2/>",
"{!ready&&!failed&&<div className=\"modal\"><Volume2/>")

failed_modal="  {failed&&<div className=\"modal song-failed\" role=\"dialog\" aria-modal=\"true\" aria-label=\"Song failed\"><Zap/><small>PERFORMANCE 0%</small><h2>SONG FAILED</h2><p>You lost the crowd. Retry the track and rebuild your performance meter.</p><button className=\"primary\" onClick={()=>{void begin()}}><RotateCcw/> RETRY SONG</button><button className=\"secondary\" onClick={quit}>BACK TO SONGS</button></div>}\n"
paused_anchor="  {paused&&<div className=\"modal\"><Pause/>"
if failed_modal not in source:
    if paused_anchor not in source: raise SystemExit('missing paused modal anchor')
    source=source.replace(paused_anchor,failed_modal+paused_anchor,1)

main.write_text(source)

# The stability transform rewrites hold-release handling and song completion after
# the base source. Keep those rewrites compatible with the new health model and
# synchronously prevent a zero-health frame from reaching finish().
stability=Path('scripts/stability-transform.ts')
st=stability.read_text()
old_before=" const release=(lane:number,eventTimeStamp?:number)=>{pressed.current.delete(lane);const hold=activeHolds.current.get(lane);if(!hold)return;const releaseTime=transport.current.now()-inputEventAgeMs(eventTimeStamp)+offset+(song.chartOffset||0),remaining=hold.time+(hold.duration??0)-releaseTime;if(remaining<=120){completeHold(lane);return}activeHolds.current.delete(lane);showFeedback('MISS',lane);setCombo(0);setEnergy(e=>Math.max(0,e-10))};"
new_before=" const release=(lane:number,eventTimeStamp?:number)=>{pressed.current.delete(lane);const hold=activeHolds.current.get(lane);if(!hold)return;const releaseTime=transport.current.now()-inputEventAgeMs(eventTimeStamp)+offset+(song.chartOffset||0),remaining=hold.time+(hold.duration??0)-releaseTime;if(remaining<=120){completeHold(lane);return}activeHolds.current.delete(lane);applyJudge('MISS',lane,-6)};"
if old_before in st: st=st.replace(old_before,new_before,1)
old_after=" const release=(lane:number,eventTimeStamp?:number)=>{pressed.current.delete(lane);const hold=activeHolds.current.get(lane);if(!hold)return;const releaseTime=transport.current.now()-inputEventAgeMs(eventTimeStamp)+offset+(song.chartOffset||0),remaining=hold.time+(hold.duration??0)-releaseTime;if(remaining<=120){completeHold(lane);return}activeHolds.current.delete(lane);const breakAt=Math.max(hold.time,releaseTime);if(multiplayerSession.enabled)multiplayerSession.recordJudgement('HOLD_BREAK',hold.id,lane,breakAt);else soloEvents.current.push({kind:'HOLD_BREAK',noteId:hold.id,lane,atMs:Math.max(0,Math.round(breakAt))});applyJudge('MISS',lane)};"
new_after=" const release=(lane:number,eventTimeStamp?:number)=>{pressed.current.delete(lane);const hold=activeHolds.current.get(lane);if(!hold)return;const releaseTime=transport.current.now()-inputEventAgeMs(eventTimeStamp)+offset+(song.chartOffset||0),remaining=hold.time+(hold.duration??0)-releaseTime;if(remaining<=120){completeHold(lane);return}activeHolds.current.delete(lane);const breakAt=Math.max(hold.time,releaseTime);if(multiplayerSession.enabled)multiplayerSession.recordJudgement('HOLD_BREAK',hold.id,lane,breakAt);else soloEvents.current.push({kind:'HOLD_BREAK',noteId:hold.id,lane,atMs:Math.max(0,Math.round(breakAt))});applyJudge('MISS',lane,-6)};"
if old_after in st: st=st.replace(old_after,new_after,1)
old_completion="if(t>end||mediaFinished){transport.current.stop();"
new_completion="if((t>end||mediaFinished)&&!failedRef.current&&energyRef.current>0){transport.current.stop();"
if new_completion not in st:
    if old_completion not in st: raise SystemExit('missing stability completion anchor')
    st=st.replace(old_completion,new_completion,1)
stability.write_text(st)

# Arm the same five-second countdown for failed-run retries and keyboard button activation.
preroll=Path('src/game-preroll.ts')
pr=preroll.read_text()
pr=pr.replace("if(label.includes('TAP TO START')||label.includes('START PLAYING'))armPreroll();","if(label.includes('TAP TO START')||label.includes('START PLAYING')||label.includes('RETRY SONG'))armPreroll();")
keyboard="""\ndocument.addEventListener('keydown',event=>{\n  if(event.key!=='Enter'&&event.key!==' ')return;\n  const button=(event.target as Element|null)?.closest('button');\n  if(!button||!button.closest('.game.screen'))return;\n  const label=(button.textContent||'').replace(/\\s+/g,' ').trim().toUpperCase();\n  if(label.includes('TAP TO START')||label.includes('START PLAYING')||label.includes('RETRY SONG'))armPreroll();\n},{capture:true});\n"""
marker="\nconst nativeMediaPlay=HTMLMediaElement.prototype.play;"
if keyboard not in pr:
    if marker not in pr: raise SystemExit('missing preroll media marker')
    pr=pr.replace(marker,keyboard+marker,1)
preroll.write_text(pr)

# Add theme-compatible low-health and fail-state polish.
styles=Path('src/styles.css')
css=styles.read_text()
block="""\n/* Song failure / performance meter */\n.meters.fail-warning .energy{box-shadow:0 0 18px rgba(240,91,85,.45)}\n.meters.fail-warning .energy>span{animation:rtFailPulse .7s ease-in-out infinite alternate}\n.song-failed{z-index:40;text-align:center}\n.song-failed>svg{width:42px;height:42px;color:#f05b55;filter:drop-shadow(0 0 16px rgba(240,91,85,.45))}\n.song-failed>small{letter-spacing:.14em;color:#f05b55;font-weight:800}\n.song-failed .primary{min-width:min(320px,82vw)}\n@keyframes rtFailPulse{from{opacity:.62}to{opacity:1}}\n@media(prefers-reduced-motion:reduce){.meters.fail-warning .energy>span{animation:none}}\n"""
if '/* Song failure / performance meter */' not in css: styles.write_text(css+block)

# Add regression coverage.
test=Path('tests/song-fail.test.ts')
test.write_text("""import {assert} from 'https://deno.land/std@0.224.0/assert/mod.ts';\n\nconst main=await Deno.readTextFile('src/main.tsx');\nconst stability=await Deno.readTextFile('scripts/stability-transform.ts');\nconst preroll=await Deno.readTextFile('src/game-preroll.ts');\nconst css=await Deno.readTextFile('src/styles.css');\n\nDeno.test('performance meter has forgiving Tap Tap style drain and recovery',()=>{\n assert(main.includes('const SONG_FAIL_GRACE_MS=2000'));\n assert(main.includes("adjustEnergy(healthDelta??-8)"));\n assert(main.includes("j==='PERFECT'?1.2:j==='GREAT'?.7:.2"));\n assert(main.includes("applyJudge('MISS',lane,-6)"));\n assert(main.includes('const SONG_FAIL_WARNING=25'));\n});\n\nDeno.test('zero health immediately stops gameplay before normal completion',()=>{\n assert(main.includes('if(next<=0)failedRef.current=true'));\n assert(main.includes('transport.current.stop();setPaused(false);setReady(false);setFailed(true)'));\n assert(stability.includes("!failedRef.current&&energyRef.current>0"));\n});\n\nDeno.test('failed runs never enter reward or high-score results flow',()=>{\n assert(main.includes('failed&&<div className=\\"modal song-failed\\"'));\n assert(main.includes('RETRY SONG'));\n assert(main.includes('BACK TO SONGS'));\n assert(!main.includes('failed&&finishGame'));\n assert(!main.includes('failed&&finish('));\n});\n\nDeno.test('retry uses the same five-second preroll as a fresh start',()=>{\n assert(preroll.includes("label.includes('RETRY SONG')"));\n assert(preroll.includes("for(let count=5;count>=1;count--)"));\n assert(preroll.includes("event.key!=='Enter'&&event.key!==' '"));\n});\n\nDeno.test('failure UI warns without obscuring gameplay accessibility',()=>{\n assert(css.includes('.meters.fail-warning .energy'));\n assert(css.includes('.song-failed'));\n assert(css.includes('@media(prefers-reduced-motion:reduce)'));\n});\n""")

ci=Path('.github/workflows/multiplayer-ci.yml')
y=ci.read_text()
anchor="      - name: Run gameplay preroll synchronization guard\n        run: deno test --allow-read tests/game-preroll.test.ts\n"
step=anchor+"      - name: Run song failure regression guard\n        run: deno test --allow-read tests/song-fail.test.ts\n"
if 'Run song failure regression guard' not in y:
    if anchor not in y: raise SystemExit('missing CI preroll step')
    y=y.replace(anchor,step,1)
ci.write_text(y)
