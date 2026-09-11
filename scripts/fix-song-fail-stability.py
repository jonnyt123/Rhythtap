from pathlib import Path

path=Path('scripts/stability-transform.ts')
source=path.read_text()
old="code=replaceRequired(code,'solo judgement buffer',\"backgroundPaused=useRef(false);\",\"backgroundPaused=useRef(false),soloEvents=useRef<GameplayJudgementEvent[]>([]);\");"
new="code=replaceRequired(code,'solo judgement buffer',\"backgroundPaused=useRef(false),failedRef=useRef(false),energyRef=useRef(100);\",\"backgroundPaused=useRef(false),failedRef=useRef(false),energyRef=useRef(100),soloEvents=useRef<GameplayJudgementEvent[]>([]);\");"
if new not in source:
    if old not in source:
        raise SystemExit('solo judgement buffer transform anchor not found')
    source=source.replace(old,new,1)
path.write_text(source)
