# KIRKO

A cross-platform multiplayer 3D arena-tag game with low-poly visuals, quick matchmaking, and private rooms.

## Run locally
1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000` in two browser tabs to test multiplayer.

## Deploy
The included `render.yaml` configures a free Render web service. The Node server serves the frontend and Socket.IO from the same origin.

## Controls
- Desktop: WASD to move, mouse to look, E to tag nearby players, Space to jump.
- Mobile: on-screen movement pad, drag the look area, and tap TAG / JUMP.

## Game
KIRKO is an original, non-graphic multiplayer arena game. Players move around a colorful obstacle arena and score points by tagging nearby players. It is not affiliated with or a copy of Kirka.io. This is an early playable prototype; stronger movement validation, moderation, persistent accounts, and monitoring are needed before a public production release.
