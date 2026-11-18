[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/semutadv/best-game-entry/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/semutadv/best-game-entry/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# Starfall Defender

Entry for make.fun contest **best-game-01** ("Make the best game").
A complete, original 2D arcade space shooter in vanilla JavaScript +
canvas, with no external libraries and no network requests: defend the
last star-harbour against waves of raiders, collect power-ups, and beat
a boss every five waves.

* `game/` — the playable game as static files (`game/index.html` + ES modules under `game/src/`).
* `main.ts` — the entry program: copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with `buildDossier` from `vendor/makefun-game.ts`.
* `screenshots/` — real renders of the game's own code.
* `LICENSE` — MIT.

## How to play

Move with the arrow keys / WASD or the mouse, shoot with Space (or hold
the mouse button). Survive the waves, grab power-ups, beat the boss.
P pauses, R restarts after game over. Best score is kept in
localStorage. All art is drawn on canvas and all sound is synthesized
with WebAudio — nothing is loaded from the network.
