from pathlib import Path

path = Path('src/main.tsx')
text = path.read_text()

old = "const TIMING={perfect:55,great:110,good:220};\n"
new = "const TIMING={perfect:55,great:110,good:220};\nconst MAX_INPUT_EVENT_AGE_MS=120;\nconst inputEventAgeMs=(eventTimeStamp?:number)=>{if(!Number.isFinite(eventTimeStamp))return 0;const now=performance.now();let stamp=Number(eventTimeStamp);if(stamp>1e12&&Number.isFinite(performance.timeOrigin))stamp-=performance.timeOrigin;const age=now-stamp;return Number.isFinite(age)?Math.max(0,Math.min(MAX_INPUT_EVENT_AGE_MS,age)):0};\n"
assert old in text, 'TIMING anchor not found'
text = text.replace(old, new, 1)

old = " const release=(lane:number)=>{pressed.current.delete(lane);const hold=activeHolds.current.get(lane);if(!hold)return;const remaining=hold.time+(hold.duration??0)-nowRef.current;if(remaining<=120){completeHold(lane);return}activeHolds.current.delete(lane);showFeedback('MISS',lane);setCombo(0);setEnergy(e=>Math.max(0,e-10))};\n const hit=(lane:number)=>{if(!ready||paused)return;pressed.current.add(lane);if(activeHolds.current.has(lane))return;const hitTime=transport.current.now()+offset+(song.chartOffset||0),laneChart=laneNotes[lane],windowStart=hitTime-TIMING.good;nowRef.current=hitTime;"
new = " const release=(lane:number,eventTimeStamp?:number)=>{pressed.current.delete(lane);const hold=activeHolds.current.get(lane);if(!hold)return;const releaseTime=transport.current.now()-inputEventAgeMs(eventTimeStamp)+offset+(song.chartOffset||0),remaining=hold.time+(hold.duration??0)-releaseTime;if(remaining<=120){completeHold(lane);return}activeHolds.current.delete(lane);showFeedback('MISS',lane);setCombo(0);setEnergy(e=>Math.max(0,e-10))};\n const hit=(lane:number,eventTimeStamp?:number)=>{if(!ready||paused)return;pressed.current.add(lane);if(activeHolds.current.has(lane))return;const hitTime=transport.current.now()-inputEventAgeMs(eventTimeStamp)+offset+(song.chartOffset||0),laneChart=laneNotes[lane],windowStart=hitTime-TIMING.good;nowRef.current=hitTime;"
assert old in text, 'hit/release anchor not found'
text = text.replace(old, new, 1)

old = "if(!e.repeat)hit(i)}if(e.code==='Escape')togglePause()};const up=(e:KeyboardEvent)=>{const i=keys.indexOf(e.code);if(i>=0)release(i)};"
new = "if(!e.repeat)hit(i,e.timeStamp)}if(e.code==='Escape')togglePause()};const up=(e:KeyboardEvent)=>{const i=keys.indexOf(e.code);if(i>=0)release(i,e.timeStamp)};"
assert old in text, 'keyboard anchor not found'
text = text.replace(old, new, 1)

old = "onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);hit(l)}} onPointerUp={()=>release(l)} onPointerCancel={()=>release(l)}"
new = "onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);hit(l,e.timeStamp)}} onPointerUp={e=>release(l,e.timeStamp)} onPointerCancel={e=>release(l,e.timeStamp)}"
assert old in text, 'pointer anchor not found'
text = text.replace(old, new, 1)

path.write_text(text)
print('Applied event-timestamped gameplay input timing patch')
