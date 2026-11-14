import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import WebSocket from 'ws'

const port = 31991
const url = 'ws://127.0.0.1:' + port
const origin = 'http://127.0.0.1:5173'
const roomId = 'testroom1234567890abcdefghijkl'
const clientA = '00000000-0000-4000-8000-000000000001'
const clientB = '00000000-0000-4000-8000-000000000002'
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('.', import.meta.url),
  env: {
    ...process.env,
    PORT: String(port),
    NODE_ENV: 'test',
    ALLOWED_ORIGINS: origin,
    MAX_CONNECTIONS: '10',
    MAX_ROOMS: '4',
  },
  stdio: 'ignore',
})

function messageQueue(socket) {
  const queued = []
  const waiting = []
  socket.on('message', raw => {
    const value = JSON.parse(raw.toString())
    const next = waiting.shift()
    if (next) next(value)
    else queued.push(value)
  })
  return () => queued.length ? Promise.resolve(queued.shift()) : new Promise(resolve => waiting.push(resolve))
}

function connect(requestOrigin = origin) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { origin: requestOrigin })
    socket.once('open', () => resolve(socket))
    socket.once('error', reject)
  })
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:' + port + '/healthz')
      if (response.ok) return response
    } catch {}
    await delay(100)
  }
  throw new Error('signaling server did not start')
}

try {
  const health = await waitForHealth()
  assert.deepEqual(await health.json(), { service: 'nexroom-signaling', ok: true })
  const root = await fetch('http://127.0.0.1:' + port + '/')
  assert.equal(root.status, 200)
  assert.deepEqual(await root.json(), { service: 'nexroom-signaling', ok: true })

  await assert.rejects(connect('https://attacker.example'))

  const a = await connect()
  const aMessage = messageQueue(a)
  a.send(JSON.stringify({ type: 'join', roomId, clientId: clientA }))
  const aJoined = await aMessage()
  assert.equal(aJoined.type, 'joined')
  assert.equal(aJoined.initiator, true)

  const b = await connect()
  const bMessage = messageQueue(b)
  const aPeerJoined = aMessage()
  b.send(JSON.stringify({ type: 'join', roomId, clientId: clientB }))
  const bJoined = await bMessage()
  assert.equal(bJoined.type, 'joined')
  assert.equal(bJoined.remotePeerId, aJoined.peerId)
  assert.equal((await aPeerJoined).type, 'peer-joined')

  const c = await connect()
  const cMessage = messageQueue(c)
  c.send(JSON.stringify({ type: 'join', roomId, clientId: '00000000-0000-4000-8000-000000000003' }))
  assert.equal((await cMessage()).code, 'ROOM_FULL')
  c.close()

  b.send(JSON.stringify({ type: 'offer', data: { type: 'offer', sdp: 'v=0\\r\\n' } }))
  assert.equal((await aMessage()).type, 'offer')
  a.send(JSON.stringify({ type: 'answer', data: { type: 'answer', sdp: 'v=0\\r\\n' } }))
  assert.equal((await bMessage()).type, 'answer')

  a.send(JSON.stringify({ type: 'offer', data: { type: 'answer', sdp: 'v=0\\r\\n' } }))
  assert.equal((await aMessage()).code, 'INVALID_SIGNAL')
  a.send('{')
  assert.equal((await aMessage()).code, 'INVALID_JSON')

  const peerLeft = bMessage()
  const peerJoined = bMessage()
  const a2 = await connect()
  const a2Message = messageQueue(a2)
  a2.send(JSON.stringify({ type: 'join', roomId, clientId: clientA }))
  const a2Joined = await a2Message()
  assert.equal(a2Joined.type, 'joined')
  assert.equal((await peerLeft).type, 'peer-left')
  assert.equal((await peerJoined).type, 'peer-joined')

  const tooLarge = await connect()
  const tooLargeClosed = new Promise(resolve => tooLarge.once('close', code => resolve(code)))
  tooLarge.send('x'.repeat(17 * 1024))
  assert.equal(await tooLargeClosed, 1009)

  const flood = await connect()
  const floodMessages = []
  flood.on('message', raw => floodMessages.push(JSON.parse(raw.toString())))
  const floodClosed = new Promise(resolve => flood.once('close', resolve))
  for (let index = 0; index < 60; index += 1) flood.send(JSON.stringify({ type: 'leave' }))
  await floodClosed
  assert.ok(floodMessages.some(message => message.code === 'RATE_LIMITED'))

  a.close()
  a2.close()
  b.close()
  console.log('PASS: health check, exact origin, room capacity, SDP relay, reconnect, schema, payload and rate limits')
} catch (error) {
  console.error('FAIL', error)
  process.exitCode = 1
} finally {
  server.kill()
}
