from pathlib import Path

patches={
 Path('src/main.tsx'):[
  ("const highScoreFor=(songId:string,difficulty:Difficulty)=>Number(localStorage.getItem(`ntr-high-${songId}-${difficulty}`)||0);","const highScoreFor=(songId:string,difficulty:Difficulty)=>Number(localStorage.getItem(`ntr-high-${songId}-${difficulty}${difficulty==='HARD'&&!songId.startsWith('tap-')?'-v5':''}`)||0);"),
  ("const key=`ntr-high-${song.id}-${difficulty}`;","const key=`ntr-high-${song.id}-${difficulty}${difficulty==='HARD'&&!song.id.startsWith('tap-')?'-v5':''}`;"),
 ],
 Path('src/player-account.tsx'):[
  (".from('player_song_scores').select('*').eq('user_id',data.user_id).order('high_score',{ascending:false}).limit(12)",".from('player_song_scores').select('*').eq('user_id',data.user_id).or('difficulty.neq.HARD,chart_version.eq.5').order('high_score',{ascending:false}).limit(12)"),
 ],
 Path('src/tour-social-ranked.tsx'):[
  (".from('player_song_scores').select('*').eq('song_id',songId).eq('difficulty',difficulty).order('high_score',{ascending:false}).limit(50)",".from('player_song_scores').select('*').eq('song_id',songId).eq('difficulty',difficulty).eq('chart_version',difficulty==='HARD'?5:4).order('high_score',{ascending:false}).limit(50)"),
 ],
}
for path,pairs in patches.items():
 source=path.read_text()
 for old,new in pairs:
  if new in source: continue
  if old not in source: raise SystemExit(f'anchor missing in {path}: {old[:90]}')
  source=source.replace(old,new,1)
 path.write_text(source)

vite=Path('vite.config.ts')
source=vite.read_text()
source=source.replace("import { scoreVersionV5Transform } from './scripts/score-version-v5-transform.ts';\n",'')
source=source.replace('highResolutionMediaClockTransform(), scoreVersionV5Transform(), engagementUiTransform()','highResolutionMediaClockTransform(), engagementUiTransform()')
if 'scoreVersionV5Transform' in source or 'score-version-v5-transform' in source: raise SystemExit('score version transform remains in Vite config')
vite.write_text(source)

Path('scripts/score-version-v5-transform.ts').unlink()
Path('scripts/consolidate-score-version-v5.py').unlink()
Path('.github/workflows/consolidate-score-version-v5.yml').unlink()
