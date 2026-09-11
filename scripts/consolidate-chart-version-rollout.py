from pathlib import Path

replacements = {
    Path('src/player-account.tsx'): [
        (
            "body:JSON.stringify({songId:input.songId,difficulty:input.difficulty,events:input.events})",
            "body:JSON.stringify({songId:input.songId,difficulty:input.difficulty,chartVersion:5,events:input.events})",
        ),
    ],
    Path('src/multiplayer-common.ts'): [
        (
            "functionRequest({action:'register',...input})",
            "functionRequest({action:'register',chartVersion:5,...input})",
        ),
    ],
    Path('src/multiplayer-session.ts'): [
        (
            "functionRequest({action:'finalize',matchId:submittedMatchId,submissionToken:current.submissionToken,roomCode:current.roomCode,playerId:current.playerId,displayName:current.displayName,songId:current.songId,difficulty:current.difficulty,events:eventSnapshot})",
            "functionRequest({action:'finalize',chartVersion:5,matchId:submittedMatchId,submissionToken:current.submissionToken,roomCode:current.roomCode,playerId:current.playerId,displayName:current.displayName,songId:current.songId,difficulty:current.difficulty,events:eventSnapshot})",
        ),
    ],
}

for path, pairs in replacements.items():
    source = path.read_text()
    for old, new in pairs:
        if new in source:
            continue
        if old not in source:
            raise SystemExit(f'anchor not found in {path}: {old[:80]}')
        source = source.replace(old, new, 1)
    path.write_text(source)

vite = Path('vite.config.ts')
source = vite.read_text()
source = source.replace("import { chartV4RolloutTransform } from './scripts/chart-v4-rollout-transform.ts';\n", '')
source = source.replace('highResolutionMediaClockTransform(), chartV4RolloutTransform(), scoreVersionV5Transform()', 'highResolutionMediaClockTransform(), scoreVersionV5Transform()')
if 'chartV4RolloutTransform' in source or 'chart-v4-rollout-transform' in source:
    raise SystemExit('chart rollout transform reference remains in vite config')
vite.write_text(source)

Path('scripts/chart-v4-rollout-transform.ts').unlink()
Path('scripts/consolidate-chart-version-rollout.py').unlink()
Path('.github/workflows/consolidate-chart-version-rollout.yml').unlink()
