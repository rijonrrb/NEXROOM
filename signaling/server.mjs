import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'

const port = Number(process.env.PORT || 3001)
const maxConnections = Number(process.env.MAX_CONNECTIONS || 100)
const maxRooms = Number(process.env.MAX_ROOMS || 50)
const maxPayload = 16 * 1024
const maxDescriptionLength = 14 * 1024
const maxCandidateLength = 4096
const production = process.env.NODE_ENV === 'production'
const localOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173']

function parseAllowedOrigins(value) {
  const origins = (value === undefined ? (production ? [] : localOrigins) : value.split(','))
    .map(origin => origin.trim())
    .filter(Boolean)

  for (const origin of origins) {
    let parsed
    try {
      parsed = new URL(origin)
    } catch {
      throw new Error('ALLOWED_ORIGINS must contain exact HTTP(S) origins')
    }
    if (parsed.origin !== origin || !['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('ALLOWED_ORIGINS must contain exact HTTP(S) origins without paths')
    }
    if (production && parsed.protocol !== 'https:') {
      throw new Error('Production ALLOWED_ORIGINS must use HTTPS')
    }
  }

  return new Set(origins)
}

const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT')
if (!Number.isInteger(maxConnections) || maxConnections < 2) throw new Error('MAX_CONNECTIONS must be at least 2')
if (!Number.isInteger(maxRooms) || maxRooms < 1) throw new Error('MAX_ROOMS must be positive')
if (production && allowedOrigins.size === 0) throw new Error('Set ALLOWED_ORIGINS before starting the production signaling server')

const rooms = new Map()
const server = createServer((request, response) => {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname
  if (!['/', '/healthz'].includes(pathname) || !['GET', 'HEAD'].includes(request.method || '')) {
    response.writeHead(404, { 'cache-control': 'no-store', 'content-length': '0' })
    response.end()
    return
  }

  response.writeHead(200, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  })
  response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ service: 'nexroom-signaling', ok: true }))
})
const wss = new WebSocketServer({
  noServer: true,
  maxPayload,
  perMessageDeflate: false,
})

function send(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
}

function sendError(socket, code) {
  send(socket, { type: 'error', code })
}

function leave(socket) {
  const roomId = socket.roomId
  if (!roomId) return

  const room = rooms.get(roomId)
  socket.roomId = null
  socket.clientId = null
  if (!room) return

  room.delete(socket)
  for (const peer of room) send(peer, { type: 'peer-left' })
  if (room.size === 0) rooms.delete(roomId)
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isValidDescription(type, data) {
  return isRecord(data)
    && data.type === type
    && typeof data.sdp === 'string'
    && data.sdp.length > 0
    && data.sdp.length <= maxDescriptionLength
}

function isValidCandidate(data) {
  return isRecord(data)
    && typeof data.candidate === 'string'
    && data.candidate.length <= maxCandidateLength
    && (data.sdpMid === undefined || data.sdpMid === null || (typeof data.sdpMid === 'string' && data.sdpMid.length <= 128))
    && (data.sdpMLineIndex === undefined || data.sdpMLineIndex === null || (Number.isInteger(data.sdpMLineIndex) && data.sdpMLineIndex >= 0 && data.sdpMLineIndex <= 255))
    && (data.usernameFragment === undefined || data.usernameFragment === null || (typeof data.usernameFragment === 'string' && data.usernameFragment.length <= 256))
}

function consumeMessageToken(socket) {
  const now = Date.now()
  const elapsedSeconds = Math.max(0, (now - socket.rateUpdatedAt) / 1000)
  socket.rateTokens = Math.min(40, socket.rateTokens + elapsedSeconds * 2)
  socket.rateUpdatedAt = now
  if (socket.rateTokens < 1) return false
  socket.rateTokens -= 1
  return true
}

function join(socket, message) {
  const roomId = message.roomId
  const clientId = message.clientId
  if (typeof roomId !== 'string' || !/^[a-zA-Z0-9_-]{24,80}$/.test(roomId)) {
    sendError(socket, 'INVALID_ROOM')
    return
  }
  if (typeof clientId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)) {
    sendError(socket, 'INVALID_CLIENT')
    return
  }

  if (socket.roomId === roomId && socket.clientId === clientId) {
    const room = rooms.get(roomId)
    const remotePeer = room && [...room].find(peer => peer !== socket)
    send(socket, {
      type: 'joined',
      peerId: socket.id,
      remotePeerId: remotePeer?.id || null,
      initiator: !remotePeer,
    })
    return
  }

  const currentRoom = rooms.get(roomId)
  const duplicate = currentRoom && [...currentRoom].find(peer => peer !== socket && peer.clientId === clientId)
  if (duplicate) {
    leave(duplicate)
    duplicate.close(4001, 'Participant reconnected')
  }

  if (socket.roomId) leave(socket)

  let room = rooms.get(roomId)
  if (!room) {
    if (rooms.size >= maxRooms) {
      sendError(socket, 'SERVER_BUSY')
      return
    }
    room = new Set()
    rooms.set(roomId, room)
  }
  if (room.size >= 2) {
    sendError(socket, 'ROOM_FULL')
    return
  }

  const existing = [...room]
  room.add(socket)
  socket.roomId = roomId
  socket.clientId = clientId
  send(socket, {
    type: 'joined',
    peerId: socket.id,
    remotePeerId: existing[0]?.id || null,
    initiator: existing.length === 0,
  })
  for (const peer of existing) send(peer, { type: 'peer-joined', peerId: socket.id })
}

function relay(socket, message) {
  const room = rooms.get(socket.roomId)
  if (!room || !room.has(socket)) {
    sendError(socket, 'NOT_IN_ROOM')
    return
  }

  const valid = message.type === 'ice-candidate'
    ? isValidCandidate(message.data)
    : isValidDescription(message.type, message.data)
  if (!valid) {
    sendError(socket, 'INVALID_SIGNAL')
    return
  }

  for (const peer of room) {
    if (peer !== socket) send(peer, { type: message.type, data: message.data })
  }
}

server.on('upgrade', (request, socket, head) => {
  const reject = (status, label) => {
    socket.end('HTTP/1.1 ' + status + ' ' + label + '\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
  }
  const origin = request.headers.origin
  const pathname = new URL(request.url || '/', 'http://localhost').pathname
  if (request.method !== 'GET' || pathname !== '/') {
    reject(404, 'Not Found')
    return
  }
  if (typeof origin !== 'string' || !allowedOrigins.has(origin)) {
    reject(403, 'Forbidden')
    return
  }
  if (wss.clients.size >= maxConnections) {
    reject(503, 'Service Unavailable')
    return
  }

  wss.handleUpgrade(request, socket, head, client => wss.emit('connection', client, request))
})

wss.on('connection', socket => {
  socket.id = randomUUID()
  socket.rateTokens = 40
  socket.rateUpdatedAt = Date.now()
  socket.strikes = 0
  socket.isAlive = true

  socket.on('pong', () => { socket.isAlive = true })
  socket.on('message', (raw, isBinary) => {
    if (isBinary) {
      socket.close(1003, 'Text messages only')
      return
    }
    if (!consumeMessageToken(socket)) {
      sendError(socket, 'RATE_LIMITED')
      socket.close(1008, 'Rate limit exceeded')
      return
    }

    let message
    try {
      message = JSON.parse(raw.toString())
    } catch {
      socket.strikes += 1
      sendError(socket, 'INVALID_JSON')
      if (socket.strikes >= 3) socket.close(1008, 'Invalid messages')
      return
    }
    if (!isRecord(message) || typeof message.type !== 'string') {
      socket.strikes += 1
      sendError(socket, 'INVALID_MESSAGE')
      if (socket.strikes >= 3) socket.close(1008, 'Invalid messages')
      return
    }

    if (message.type === 'join') {
      join(socket, message)
      return
    }
    if (message.type === 'leave') {
      leave(socket)
      return
    }
    if (['offer', 'answer', 'ice-candidate'].includes(message.type)) {
      relay(socket, message)
      return
    }

    socket.strikes += 1
    sendError(socket, 'UNKNOWN_MESSAGE')
    if (socket.strikes >= 3) socket.close(1008, 'Invalid messages')
  })
  socket.on('close', () => leave(socket))
  socket.on('error', () => leave(socket))
})

const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    if (socket.readyState !== WebSocket.OPEN) continue
    if (!socket.isAlive) {
      socket.terminate()
      continue
    }
    socket.isAlive = false
    socket.ping()
  }
}, 30000)
heartbeat.unref()

server.listen(port, () => console.log('NEXROOM signaling listening on ' + port))
