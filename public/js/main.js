import { Game } from "./game.js";

const socket = window.io();
const $ = id => document.getElementById(id);
const menu = $("menu-screen"), hud = $("hud"), loading = $("loading");
let game = null, selfId = null, players = new Map(), joined = false;

function showToast(message) {
  const el = $("toast"); el.textContent = message; el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1800);
}
function setLoading(on) { loading.classList.toggle("hidden", !on); }
function join(options) {
  $("menu-error").textContent = "";
  setLoading(true);
  socket.emit("join", { name: $("player-name").value, ...options });
}
$("quick-btn").onclick = () => join({ quick: true });
$("join-btn").onclick = () => join({ code: $("room-code").value });
$("create-btn").onclick = () => join({ code: Math.random().toString(36).slice(2, 6).toUpperCase() });
$("room-code").addEventListener("keydown", e => { if (e.key === "Enter") join({ code: $("room-code").value }); });
$("leave-btn").onclick = () => { socket.disconnect(); location.reload(); };
$("sound-btn").onclick = () => showToast("Sound effects are coming in a future update.");

socket.on("joinError", msg => { setLoading(false); $("menu-error").textContent = msg; });
socket.on("joined", data => {
  joined = true; selfId = data.selfId; players.clear();
  data.players.forEach(p => players.set(p.id, p));
  menu.classList.add("hidden"); hud.classList.remove("hidden"); setLoading(false);
  $("hud-room").textContent = data.code; $("self-name").textContent = $("player-name").value.toUpperCase();
  if (!game) game = new Game({ socket, getPlayers: () => players, getSelfId: () => selfId });
  game.start(); game.syncPlayers(); renderScores();
  showToast("Welcome to arena " + data.code);
});
socket.on("roomState", data => {
  players.clear(); data.players.forEach(p => players.set(p.id, p));
  $("online-count").textContent = data.count + " IN ARENA";
  const self = players.get(selfId);
  if (self && game) game.setSelfPosition(self);
  renderScores();
  if (game) game.syncPlayers();
});
socket.on("playerMoved", p => {
  const old = players.get(p.id);
  if (old) Object.assign(old, p); else players.set(p.id, p);
  if (game) game.syncPlayers();
});
socket.on("tagged", data => {
  addFeed(data.taggerId === selfId ? "You tagged " + data.target : data.tagger + " tagged " + data.target, data.taggerId === selfId ? "good" : "muted");
  if (data.targetId === selfId) showToast("You've been tagged — go get them!");
});
socket.on("tagMiss", () => showToast("Get closer to tag someone!"));
socket.on("feed", data => addFeed(data.text, data.kind));
socket.on("disconnect", () => { if (joined) showToast("Connection lost"); });

function addFeed(text, kind = "") {
  const line = document.createElement("div"); line.className = "feed-line " + kind; line.textContent = text;
  $("feed").prepend(line); while ($("feed").children.length > 4) $("feed").lastChild.remove();
  setTimeout(() => line.remove(), 5000);
}
function renderScores() {
  const sorted = [...players.values()].sort((a,b) => b.score - a.score);
  $("score-list").innerHTML = sorted.map(p => `<div class="score-row"><span class="score-name"><i class="score-swatch" style="background:${p.color}"></i>${escapeHtml(p.name)}${p.id === selfId ? " (YOU)" : ""}</span><b>${p.score}</b></div>`).join("");
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
