# Contributing to Voice Traffic Cop

Thanks for helping improve Juniper Junction. Small, focused changes are easiest to review and keep the game pleasant to play.

## Before you start

- Search existing issues before opening a new one.
- Use the bug report form for reproducible problems and the feature request form for ideas.
- For large gameplay, art-direction, or architecture changes, open an issue before writing code.
- Never include microphone recordings, private data, credentials, or generated build output in an issue or pull request.

## Local setup

You need a recent Node.js release and npm.

```bash
npm install
npm run dev
```

Open the URL printed by Vite. Microphone controls require either `localhost` or an HTTPS deployment; keyboard controls work without microphone permission.

## Project guidelines

- Keep gameplay logic in `src/game`, browser input in `src/hooks`, and presentation in `src/App.tsx` and `src/styles.css`.
- Preserve keyboard and touch controls when changing voice controls.
- Keep microphone analysis local to the browser. Do not upload or retain audio.
- Reuse the existing visual language and assets. Discuss new generated or third-party artwork before adding it.
- Avoid committing `dist`, `node_modules`, temporary screenshots, or generated TypeScript build files.
- Keep changes scoped. Refactors unrelated to the issue should be submitted separately.

## Validate your change

Run the production build before opening a pull request:

```bash
npm run build
```

For gameplay changes, also test the following where relevant:

- Voice and keyboard control modes
- North–South and East–West light changes
- Pause, restart, and game-over flows
- Music on/off behavior
- Landscape desktop and a narrow mobile viewport
- Reduced-motion mode
- Vehicle spacing, road boundaries, and foreground occlusion

Include a screenshot or short recording for visual changes, but do not include microphone recordings or personal information.

## Pull requests

Explain what changed, why it changed, and how you tested it. Link the related issue when one exists. A pull request should keep the production build green and avoid unrelated formatting churn.
