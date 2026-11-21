# KIRKO

A cross-platform browser arena FPS prototype with low-poly 3D visuals and real-time multiplayer rooms.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000` in two browser tabs to test multiplayer.

## Deploy

Deploy this repository as a Node web service on Render. The included `render.yaml` configures the service. The game server serves the frontend and Socket.IO from the same origin.

## Controls

- Desktop: WASD to move, mouse to look, click to launch an energy orb, Space to jump, Esc to release pointer lock.
- Mobile: on-screen movement pad, drag the look area, and tap FIRE / JUMP.

## Prototype notes

This is an original, non-graphic arena game prototype. It uses simple geometric arena art and colorful energy-orb tagging. It is not affiliated with or a copy of Kirka.io. For a public production release, add moderation, anti-cheat validation, persistent accounts, rate limits, and monitoring.
