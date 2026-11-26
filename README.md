# BrickBreaker

A pure turn-based 8×8 strategic line-clearing block puzzle built with **TypeScript** and **Vite**, optimized for **10-inch tablets** with responsive support across desktop and mobile.

## Gameplay

- **8×8 Grid, No Gravity, No Timers, No Rotation**: Place geometric polyomino pieces onto open cells in their exact dealt orientation. Remaining blocks stay locked in place when lines clear.
- **3-Piece Batch Dealing**: Drag and drop pieces from the bottom tray in any order (or tap to select and tap to place). A fresh batch of 3 deals once all 3 pieces are placed.
- **Two-Axis & Multi-Line Clearing**: Completing any 8-cell horizontal row or vertical column clears it simultaneously, awarding multi-line bonus points.
- **Scaled Explosions, Sound & Screen-Wide Lightning**: Cleared blocks trigger particle explosions, shockwaves, micro-shake, and synthesized Web Audio explosion sounds whose intensity scales with the number of blocks cleared, plus a brief electric lightning flash across the screen along each cleared line.
- **Combo Streaks**: Clearing at least one line during a 3-piece round increases your combo streak multiplier (`×1`, `×2`, `×3`, ...). Completing a 3-piece cycle with no line clears resets the streak to `0`.
- **Levels**: Start at Level 1 and advance a level every 100 cleared lines, tracked in the right-side vertical scoring panel.
- **Classic Mode & Adventure Mode Architecture**: Classic endless high-score mode is playable now. The engine (`src/game/types.ts`, `src/game/modes.ts`, `src/game/board.ts`, `src/game/engine.ts`) is structured for future **Adventure Mode** stages with pre-filled obstacles, multi-hit durability, gem-embedded blocks, and stage objectives.

## Development

```bash
npm install
npm run dev      # Start Vite dev server
npm test         # Run Vitest unit tests
npm run build    # Type-check & build production bundle into dist/
```

## GitHub Pages Deployment

The workflow in `.github/workflows/deploy.yml` automatically tests, builds, and deploys `dist/` to GitHub Pages on pushes to `main` (and via manual `workflow_dispatch`). In your repository settings under **Settings → Pages**, set **Source** to **GitHub Actions**.
