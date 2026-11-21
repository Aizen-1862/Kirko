const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true }, pingInterval: 25000, pingTimeout: 20000 });
const PORT = process.env.PORT || 3000;
const rooms = new Map();
const COLORS = ["#42d9ff", "#ffca58", "#b48cff", "#70e1a1", "#ff7d9d", "#f58b4b"];

app.use(express.static(path.join(__dirname, "..", "public")));
app.get("/health", (_req, res) => res.json({ ok: true, game: "Kirko", rooms: rooms.size }));

function makeCode() { return Math.random().toString(36).slice(2, 6).toUpperCase(); }
function cleanName(value) {
  return String(value || "Player").replace(/[^a-zA-Z0-9 _-]/g, "").trim().slice(0, 16) || "Player";
}
function makeRoom(code) {
  const room = { code, players: new Map() };
  rooms.set(code, room);
  return room;
}
function publicPlayers(room) {
  return [...room.players.values()].map(p => ({
    id: p.id, name: p.name, color: p.color, x: p.x, y: p.y, z: p.z,
    yaw: p.yaw, pitch: p.pitch, score: p.score, tags: p.tags
  }));
}
function snapshot(room) {
  io.to(room.code).emit("roomState", { code: room.code, players: publicPlayers(room), count: room.players.size });
}
function leaveRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  if (room) {
    room.players.delete(socket.id);
    socket.to(code).emit("feed", { text: "A player left the arena", kind: "muted" });
    if (room.players.size === 0) rooms.delete(code);
    else snapshot(room);
  }
  socket.leave(code);
  socket.data.roomCode = null;
}
function joinRoom(socket, code, name) {
  leaveRoom(socket);
  let room = rooms.get(code);
  if (!room) room = makeRoom(code);
  if (room.players.size >= 10) return socket.emit("joinError", "That arena is full. Try another room.");
  const player = {
    id: socket.id, name: cleanName(name), color: COLORS[Math.floor(Math.random() * COLORS.length)],
    x: (Math.random() - 0.5) * 12, y: 1, z: (Math.random() - 0.5) * 12,
    yaw: 0, pitch: 0, score: 0, tags: 0, lastTag: 0
  };
  room.players.set(socket.id, player);
  socket.join(code);
  socket.data.roomCode = code;
  socket.emit("joined", { code, selfId: socket.id, players: publicPlayers(room) });
  socket.to(code).emit("feed", { text: player.name + " joined the arena", kind: "good" });
  snapshot(room);
}
function quickRoom() {
  for (const room of rooms.values()) if (room.players.size < 10) return room.code;
  return makeCode();
}

io.on("connection", socket => {
  socket.on("join", data => {
    const name = cleanName(data && data.name);
    const code = data && data.quick ? quickRoom() : String(data && data.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (!code) return socket.emit("joinError", "Enter a room code or choose Quick Match.");
    joinRoom(socket, code, name);
  });

  socket.on("move", data => {
    const room = rooms.get(socket.data.roomCode);
    const p = room && room.players.get(socket.id);
    if (!p || !data) return;
    p.x = Math.max(-17, Math.min(17, Number(data.x) || 0));
    p.y = Math.max(0.8, Math.min(4, Number(data.y) || 1));
    p.z = Math.max(-17, Math.min(17, Number(data.z) || 0));
    p.yaw = Number(data.yaw) || 0;
    p.pitch = Math.max(-1.35, Math.min(1.35, Number(data.pitch) || 0));
    socket.to(room.code).emit("playerMoved", { id: p.id, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch });
  });

  socket.on("tag", () => {
    const room = rooms.get(socket.data.roomCode);
    const tagger = room && room.players.get(socket.id);
    if (!tagger || Date.now() - tagger.lastTag < 900) return;
    tagger.lastTag = Date.now();
    let target = null;
    let nearest = 2.35;
    for (const player of room.players.values()) {
      if (player.id === tagger.id) continue;
      const distance = Math.hypot(player.x - tagger.x, player.z - tagger.z);
      if (distance < nearest) { nearest = distance; target = player; }
    }
    if (!target) return socket.emit("tagMiss");
    tagger.score += 1;
    tagger.tags += 1;
    target.x = (Math.random() - 0.5) * 22;
    target.z = (Math.random() - 0.5) * 22;
    target.y = 1;
    io.to(room.code).emit("tagged", {
      taggerId: tagger.id, tagger: tagger.name,
      targetId: target.id, target: target.name, score: tagger.score
    });
    snapshot(room);
  });

  socket.on("disconnect", () => leaveRoom(socket));
});

server.listen(PORT, () => console.log("KIRKO listening on " + PORT));
