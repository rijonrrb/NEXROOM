import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { chromium } from 'playwright'

const signalingDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(signalingDir, '..')
const signalingPort = 31992
const frontendPort = 32173
const origin = 'http://127.0.0.1:' + frontendPort
const signalOrigin = 'http://127.0.0.1:' + frontendPort
const signalUrl = 'ws://127.0.0.1:' + signalingPort
const processOutput = new Map()

function startProcess(command, args, cwd, env) {
  const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
  processOutput.set(child, '')
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', chunk => {
      processOutput.set(child, (processOutput.get(child) + chunk.toString()).slice(-8000))
    })
  }
  child.on('error', error => {
    processOutput.set(child, (processOutput.get(child) + String(error)).slice(-8000))
  })
  return child
}

async function waitForHttp(url, child) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error('Process exited early: ' + processOutput.get(child))
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {}
    await delay(150)
  }
  throw new Error('Timed out waiting for ' + url + ': ' + processOutput.get(child))
}

async function stopProcess(child) {
  if (child.exitCode !== null) return
  const exited = once(child, 'exit')
  child.kill()
  await Promise.race([exited, delay(3000)])
  if (child.exitCode === null) child.kill('SIGKILL')
}

async function waitForRemote(page, videoRequired = true) {
  await page.waitForFunction(({ videoRequired: requireVideo }) => {
    const stream = document.querySelector('.callroom__remote')?.srcObject
    return stream instanceof MediaStream
      && stream.getAudioTracks().length > 0
      && (!requireVideo || stream.getVideoTracks().length > 0)
  }, { videoRequired }, { timeout: 30000 })
  await page.waitForFunction(() => document.querySelector('.callroom__status')?.textContent?.includes('LIVE'), null, { timeout: 30000 })
}

async function assertLocalTracks(page, videoRequired = true) {
  const tracks = await page.evaluate(() => {
    const stream = document.querySelector('.callroom__self')?.srcObject
    return {
      audio: stream instanceof MediaStream && stream.getAudioTracks().length > 0,
      video: stream instanceof MediaStream && stream.getVideoTracks().length > 0,
    }
  })
  assert.equal(tracks.audio, true, 'local microphone track should be live')
  assert.equal(tracks.video, videoRequired, 'local camera availability should match the test')
}

const serverEnv = {
  ...process.env,
  PORT: String(signalingPort),
  NODE_ENV: 'test',
  ALLOWED_ORIGINS: signalOrigin,
}
let signaling = startProcess(process.execPath, ['server.mjs'], signalingDir, serverEnv)
let vite = startProcess(process.execPath, [
  resolve(rootDir, 'node_modules/vite/bin/vite.js'),
  '--host', '127.0.0.1',
  '--port', String(frontendPort),
  '--strictPort',
], rootDir, { ...process.env, VITE_SIGNAL_URL: signalUrl })
let browser

try {
  await waitForHttp('http://127.0.0.1:' + signalingPort + '/healthz', signaling)
  await waitForHttp(origin, vite)

  browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  })

  const contextA = await browser.newContext({ permissions: ['camera', 'microphone'] })
  const contextB = await browser.newContext({ permissions: ['camera', 'microphone'] })
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()
  for (const page of [pageA, pageB]) page.setDefaultTimeout(15000)

  await pageA.goto(origin)
  await pageA.getByRole('button', { name: /CREATE A ROOM/ }).click()
  await pageA.getByLabel('ROOM NAME').fill('Browser test')
  await pageA.getByRole('button', { name: 'START ROOM' }).click()
  const callUrl = new URL(pageA.url())
  const callRoomId = callUrl.searchParams.get('room')
  assert.ok(callRoomId, 'room id should be present in the URL')
  await pageA.waitForSelector('.callroom')
  await pageB.goto(origin + '/?room=' + encodeURIComponent(callRoomId))
  await Promise.all([waitForRemote(pageA), waitForRemote(pageB)])
  await Promise.all([assertLocalTracks(pageA), assertLocalTracks(pageB)])

  await pageA.getByRole('button', { name: 'Mute' }).click()
  await pageA.waitForFunction(() => document.querySelector('.callroom__self')?.srcObject?.getAudioTracks().every(track => !track.enabled))
  await pageA.getByRole('button', { name: 'Unmute' }).click()
  await pageA.getByRole('button', { name: 'Turn camera off' }).click()
  await pageA.waitForFunction(() => document.querySelector('.callroom__self')?.srcObject?.getVideoTracks().every(track => !track.enabled))
  await pageA.getByRole('button', { name: 'Turn camera on' }).click()

  await pageA.getByRole('button', { name: 'Leave call' }).click()
  await pageB.waitForFunction(() => document.querySelector('.callroom__status')?.textContent?.includes('Other participant left'))
  const pageC = await contextA.newPage()
  pageC.setDefaultTimeout(15000)
  await pageC.goto(origin + '/?room=' + encodeURIComponent(callRoomId))
  await Promise.all([waitForRemote(pageB), waitForRemote(pageC)])

  await stopProcess(signaling)
  await delay(350)
  signaling = startProcess(process.execPath, ['server.mjs'], signalingDir, serverEnv)
  await waitForHttp('http://127.0.0.1:' + signalingPort + '/healthz', signaling)
  await Promise.all([waitForRemote(pageB), waitForRemote(pageC)])

  await pageB.getByRole('button', { name: 'Leave call' }).click()
  await pageC.getByRole('button', { name: 'Leave call' }).click()
  await pageB.waitForSelector('.hero')
  await pageC.waitForSelector('.hero')

  const voiceRoomId = 'voiceroom1234567890abcdefgh'
  const voiceContext = await browser.newContext({ permissions: ['microphone'] })
  await voiceContext.addInitScript(() => {
    const mediaDevices = navigator.mediaDevices
    const original = mediaDevices.getUserMedia.bind(mediaDevices)
    mediaDevices.getUserMedia = constraints => {
      if (constraints.video) return Promise.reject(new DOMException('No camera available', 'NotFoundError'))
      return original(constraints)
    }
  })
  const voicePage = await voiceContext.newPage()
  const peerContext = await browser.newContext({ permissions: ['camera', 'microphone'] })
  const peerPage = await peerContext.newPage()
  await Promise.all([voicePage.goto(origin + '/?room=' + voiceRoomId), peerPage.goto(origin + '/?room=' + voiceRoomId)])
  await Promise.all([waitForRemote(voicePage, false), waitForRemote(peerPage, false)])
  await assertLocalTracks(voicePage, false)
  assert.equal(await voicePage.getByRole('button', { name: 'Turn camera on' }).isDisabled(), true)

  console.log('PASS: two-browser media, controls, leave/rejoin, signaling reconnect and audio-only fallback')
  await voiceContext.close()
  await peerContext.close()
  await contextB.close()
  await contextA.close()
} catch (error) {
  console.error('FAIL', error)
  console.error('Signaling output:', processOutput.get(signaling))
  console.error('Vite output:', processOutput.get(vite))
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  await stopProcess(vite)
  await stopProcess(signaling)
}
