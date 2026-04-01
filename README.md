# Voice Traffic Cop

`Voice Traffic Cop` is a polished browser game built with `React + TypeScript + Vite`.

You play as the voice-guided traffic controller of a lively animal-city intersection. Use your microphone to switch traffic flow, keep lanes moving, and stop Juniper Junction from turning into a jam.

## Features

- Voice-controlled traffic switching with live microphone input
- Stylized animated-film-inspired city presentation
- Charming traffic officer character and lively intersection scene
- Easy early difficulty with level-based progression
- Score, streak, mood, and game-over flow
- Responsive browser-based experience

## Controls

- Low hum: switch to `North-South`
- High hum: switch to `East-West`
- Loud burst: `Emergency stop`
- Stable tone: small `flow boost`

The game is designed to be forgiving:

- A short hum is enough to switch directions
- The game starts on an easier rookie difficulty
- Difficulty ramps up after you hit score goals

## Tech Stack

- `React`
- `TypeScript`
- `Vite`
- `Web Audio API`

## Getting Started

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

### Build

```bash
npm run build
```

## Notes

- Microphone permission is required
- Voice input works best with a short hum or sung note
- The mic panel in-game shows what the system is hearing

## Project Structure

```text
src/
  game/
    constants.ts
    logic.ts
    types.ts
  hooks/
    useMicrophoneControls.ts
  App.tsx
  main.tsx
  styles.css
```

## Idea

The goal of this project was to make a voice-controlled browser game that feels more like a miniature animated world than a plain simulation UI.
