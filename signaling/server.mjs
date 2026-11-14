import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const port = Number(process.env.PORT || 3001);
const rooms = new Map();
const server = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ service: 'nexroom-signaling', ok: true }));
});
const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });

function send(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}
function leave(socket) {
  const roomId = socket.roomId;
  if (!roomId) return;
  const room = rooms.get(roomId);
  socket.roomId = null;
  if (!room) return;
  room.delete(socket);
  for (const peer of room) send(peer, { type: 'peer-left' });
  if (room.size === 0) rooms.delete(roomId);
}
wss.on('connection', socket => {
  socket.id = randomUUID();
  socket.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return send(socket, { type: 'error', code: 'INVALID_JSON' }); }
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'join') {
      const roomId = msg.roomId;
      if (typeof roomId !== 'string' || !/^[a-zA-Z0-9_-]{12,80}$/.test(roomId)) return send(socket, { type: 'error', code: 'INVALID_ROOM' });
      if (socket.roomId) leave(socket);
      let room = rooms.get(roomId);
      if (!room) { room = new Set(); rooms.set(roomId, room); }
      if (room.size >= 2) return send(socket, { type: 'error', code: 'ROOM_FULL' });
      const existing = [...room];
      room.add(socket);
      socket.roomId = roomId;
      send(socket, { type: 'joined', peerId: socket.id, initiator: existing.length === 0 });
      for (const peer of existing) send(peer, { type: 'peer-joined' });
      return;
    }
    if (msg.type === 'leave') return leave(socket);
    if (['offer', 'answer', 'ice-candidate'].includes(msg.type)) {
      const room = rooms.get(socket.roomId);
      if (!room || !room.has(socket)) return send(socket, { type: 'error', code: 'NOT_IN_ROOM' });
      const data = msg.data;
      if (!data || typeof data !== 'object' || Array.isArray(data)) return;
      for (const peer of room) if (peer !== socket) send(peer, { type: msg.type, data });
    }
  });
  socket.on('close', () => leave(socket));
  socket.on('error', () => leave(socket));
});
server.listen(port, () => console.log(`NEXROOM signaling listening on ${port}`));
