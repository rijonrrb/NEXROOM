import { useEffect, useRef, useState } from 'react'
import { ArrowLeftRight, Camera, CameraOff, Copy, Expand, Mic, MicOff, Minimize2, PhoneOff, RefreshCw, Video } from 'lucide-react'
import './CallRoom.css'

type Signal = {
  type: string
  peerId?: string
  remotePeerId?: string | null
  data?: RTCSessionDescriptionInit | RTCIceCandidateInit
  code?: string
}
const SIGNAL_URL = import.meta.env.VITE_SIGNAL_URL || (import.meta.env.DEV ? 'ws://localhost:3001' : 'wss://signal.devrijonn.com')
const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]
const AUDIO_CAPTURE: MediaTrackConstraints = {
  autoGainControl: { ideal: true },
  channelCount: { ideal: 1 },
  echoCancellation: { ideal: true },
  noiseSuppression: { ideal: true },
  sampleRate: { ideal: 48000 },
}
const VIDEO_CAPTURE: MediaTrackConstraints = {
  facingMode: { ideal: 'user' },
  frameRate: { ideal: 30, max: 30 },
  height: { ideal: 1080, max: 1080 },
  width: { ideal: 1920, max: 1920 },
}

function configureVideoSender(sender: RTCRtpSender) {
  const parameters = sender.getParameters()
  if (!parameters.encodings.length) return
  for (const encoding of parameters.encodings) {
    encoding.maxBitrate = 4_000_000
    encoding.maxFramerate = 30
  }
  void sender.setParameters(parameters).catch(error => {
    console.warn('Could not apply video quality settings', error)
  })
}

function mediaErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : ''
  if (!window.isSecureContext) return 'Camera and microphone access requires HTTPS or localhost.'
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Allow microphone access in your browser, then try again.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No usable microphone was found. Connect one and try again.'
  if (name === 'NotReadableError') return 'A camera or microphone is busy in another app. Close it and try again.'
  return 'Could not access your microphone. Check browser permissions and try again.'
}

export default function CallRoom({ roomId, onLeave }: { roomId: string; onLeave: () => void }) {
  const localVideo = useRef<HTMLVideoElement>(null)
  const remoteVideo = useRef<HTMLVideoElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const retryMediaRef = useRef<() => void>(() => {})
  const [participantId] = useState(() => crypto.randomUUID())
  const [hasAudio, setHasAudio] = useState(false)
  const [hasCamera, setHasCamera] = useState(false)
  const [status, setStatus] = useState('Preparing microphone and camera…')
  const [error, setError] = useState('')
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [copied, setCopied] = useState(false)
  const [connected, setConnected] = useState(false)
  const [audioOnly, setAudioOnly] = useState(false)
  const [mediaRetryAvailable, setMediaRetryAvailable] = useState(false)
  const [needsPlayback, setNeedsPlayback] = useState(false)
  const [selfPrimary, setSelfPrimary] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user')
  const [switchingCamera, setSwitchingCamera] = useState(false)
  const callRoom = useRef<HTMLElement>(null)

  useEffect(() => {
    const handleFullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    let cancelled = false
    let socket: WebSocket | null = null
    let peer: RTCPeerConnection | null = null
    let reconnectTimer = 0
    let disconnectedTimer = 0
    let reconnectAttempts = 0
    let restartAttempts = 0
    let restartPending = false
    let localPeerId = ''
    let remotePeerId: string | null = null
    let polite = false
    let makingOffer = false
    let ignoreOffer = false
    let isSettingRemoteAnswerPending = false
    let pendingIce: RTCIceCandidateInit[] = []
    let localStream: MediaStream | null = null
    let fatalSignalingError = false

    const send = (message: Record<string, unknown>) => {
      if (socket?.readyState !== WebSocket.OPEN) return false
      socket.send(JSON.stringify(message))
      return true
    }

    const clearRemoteVideo = () => {
      if (remoteVideo.current) remoteVideo.current.srcObject = null
      setNeedsPlayback(false)
    }

    const closePeer = () => {
      if (disconnectedTimer) window.clearTimeout(disconnectedTimer)
      disconnectedTimer = 0
      if (peer) {
        peer.onicecandidate = null
        peer.ontrack = null
        peer.onnegotiationneeded = null
        peer.oniceconnectionstatechange = null
        peer.onconnectionstatechange = null
        peer.close()
      }
      peer = null
      pcRef.current = null
      pendingIce = []
      makingOffer = false
      ignoreOffer = false
      isSettingRemoteAnswerPending = false
      restartAttempts = 0
      restartPending = false
      clearRemoteVideo()
    }

    const restartIce = (connection: RTCPeerConnection) => {
      if (peer !== connection || connection.signalingState === 'closed') return
      if (restartPending) return
      if (restartAttempts >= 2) {
        setError('Connection could not recover. This network may require a TURN relay.')
        return
      }
      restartAttempts += 1
      restartPending = true
      setStatus('Reconnecting media…')
      try {
        connection.restartIce()
      } catch (restartError) {
        console.error('ICE restart failed', restartError)
      }
    }

    const createPeer = () => {
      if (!localStream || !remotePeerId || cancelled) return
      if (peer && peer.connectionState !== 'closed') return

      closePeer()
      const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      peer = connection
      pcRef.current = connection
      polite = localPeerId.localeCompare(remotePeerId) > 0
      for (const track of localStream.getTracks()) {
        const sender = connection.addTrack(track, localStream)
        if (track.kind === 'video') {
          track.contentHint = 'motion'
          configureVideoSender(sender)
        }
      }

      connection.onicecandidate = event => {
        if (event.candidate) send({ type: 'ice-candidate', data: event.candidate.toJSON() })
      }
      connection.ontrack = event => {
        if (!remoteVideo.current) return
        remoteVideo.current.srcObject = event.streams[0] || new MediaStream([event.track])
        void remoteVideo.current.play().then(() => setNeedsPlayback(false)).catch(() => setNeedsPlayback(true))
      }
      connection.onnegotiationneeded = async () => {
        if (connection !== peer || connection.signalingState !== 'stable') return
        try {
          makingOffer = true
          const offer = await connection.createOffer()
          await connection.setLocalDescription(offer)
          if (connection.localDescription) send({ type: 'offer', data: connection.localDescription })
        } catch (negotiationError) {
          console.error('Offer negotiation failed', negotiationError)
          setError('Could not negotiate the call. Reconnecting…')
        } finally {
          makingOffer = false
        }
      }
      connection.oniceconnectionstatechange = () => {
        if (connection.iceConnectionState === 'connected' || connection.iceConnectionState === 'completed') {
          if (disconnectedTimer) window.clearTimeout(disconnectedTimer)
          disconnectedTimer = 0
          restartAttempts = 0
          restartPending = false
          setConnected(true)
          setError('')
          setStatus('Connected')
        } else if (connection.iceConnectionState === 'disconnected') {
          setConnected(false)
          setStatus('Connection interrupted; reconnecting…')
          if (!disconnectedTimer) {
            disconnectedTimer = window.setTimeout(() => {
              if (connection.iceConnectionState === 'disconnected') restartIce(connection)
            }, 4500)
          }
        } else if (connection.iceConnectionState === 'failed') {
          setConnected(false)
          restartPending = false
          restartIce(connection)
        }
      }
      connection.onconnectionstatechange = () => {
        if (connection.connectionState === 'connected') {
          setConnected(true)
          setStatus('Connected')
        } else if (connection.connectionState === 'failed') {
          setConnected(false)
          restartIce(connection)
        }
      }
    }

    const flushIce = async (connection: RTCPeerConnection) => {
      for (const candidate of pendingIce.splice(0)) await connection.addIceCandidate(candidate)
    }

    const scheduleReconnect = () => {
      if (cancelled || fatalSignalingError || reconnectTimer) return
      closePeer()
      remotePeerId = null
      setConnected(false)
      reconnectAttempts += 1
      const delay = Math.min(1000 * (2 ** Math.min(reconnectAttempts, 4)), 15000) + Math.floor(Math.random() * 400)
      setStatus('Signaling disconnected; reconnecting…')
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = 0
        connectSignal()
      }, delay)
    }

    const connectSignal = () => {
      if (cancelled || fatalSignalingError) return
      if (import.meta.env.PROD && !SIGNAL_URL.startsWith('wss://')) {
        fatalSignalingError = true
        setError('The production signaling URL must use secure WebSocket (wss://).')
        setStatus('Secure signaling is not configured')
        return
      }

      setStatus(reconnectAttempts ? 'Reconnecting to signaling…' : 'Connecting to signaling…')
      let candidate: WebSocket
      try {
        candidate = new WebSocket(SIGNAL_URL)
      } catch (socketError) {
        console.error('Signaling setup failed', socketError)
        scheduleReconnect()
        return
      }
      socket = candidate
      wsRef.current = candidate

      candidate.onopen = () => {
        if (cancelled || socket !== candidate) return candidate.close()
        const joined = send({ type: 'join', roomId, clientId: participantId })
        if (!joined) candidate.close()
      }
      candidate.onmessage = async event => {
        if (cancelled || socket !== candidate) return
        try {
          const message = JSON.parse(event.data) as Signal
          if (message.type === 'joined') {
            if (typeof message.peerId !== 'string') throw new Error('Missing peer id')
            localPeerId = message.peerId
            remotePeerId = typeof message.remotePeerId === 'string' ? message.remotePeerId : null
            if (remotePeerId) {
              createPeer()
              setStatus('Connecting…')
            } else {
              setStatus('Waiting for the other person…')
            }
            reconnectAttempts = 0
          } else if (message.type === 'peer-joined' && typeof message.peerId === 'string') {
            remotePeerId = message.peerId
            createPeer()
            setStatus('Connecting…')
          } else if (message.type === 'peer-left') {
            remotePeerId = null
            closePeer()
            setConnected(false)
            setStatus('Other participant left. Waiting…')
            setError('')
          } else if ((message.type === 'offer' || message.type === 'answer') && message.data && peer) {
            const connection = peer
            const readyForOffer = !makingOffer && (connection.signalingState === 'stable' || isSettingRemoteAnswerPending)
            const offerCollision = message.type === 'offer' && !readyForOffer
            ignoreOffer = !polite && offerCollision
            if (ignoreOffer) return

            isSettingRemoteAnswerPending = message.type === 'answer'
            await connection.setRemoteDescription(message.data as RTCSessionDescriptionInit)
            isSettingRemoteAnswerPending = false
            await flushIce(connection)
            if (message.type === 'offer') {
              const answer = await connection.createAnswer()
              await connection.setLocalDescription(answer)
              if (connection.localDescription) send({ type: 'answer', data: connection.localDescription })
            }
          } else if (message.type === 'ice-candidate' && message.data && peer) {
            const candidateData = message.data as RTCIceCandidateInit
            if (ignoreOffer) return
            if (peer.remoteDescription) await peer.addIceCandidate(candidateData)
            else pendingIce.push(candidateData)
          } else if (message.type === 'error') {
            if (message.code === 'ROOM_FULL') {
              fatalSignalingError = true
              setError('This room already has two people.')
              setStatus('Room is full')
              candidate.close(1000, 'Room is full')
            } else {
              setError('Signaling error: ' + (message.code || 'UNKNOWN'))
            }
          }
        } catch (signalingError) {
          console.error('Signaling negotiation failed', signalingError)
          setError('Could not negotiate the call. Please try again.')
        }
      }
      candidate.onerror = () => {
        if (!cancelled && socket === candidate) setStatus('Signaling connection interrupted…')
      }
      candidate.onclose = () => {
        if (socket !== candidate) return
        socket = null
        wsRef.current = null
        if (!cancelled && !fatalSignalingError) scheduleReconnect()
        else closePeer()
      }
    }

    const requestMedia = async () => {
      setError('')
      setMediaRetryAvailable(false)
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('MEDIA_UNAVAILABLE')
        let media: MediaStream
        try {
          media = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CAPTURE, video: VIDEO_CAPTURE })
          setAudioOnly(false)
          setCameraOff(false)
        } catch (cameraError) {
          console.warn('Camera unavailable, trying audio-only', cameraError)
          media = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CAPTURE, video: false })
          setAudioOnly(true)
          setCameraOff(true)
        }

        if (cancelled) {
          media.getTracks().forEach(track => track.stop())
          return
        }
        localStream = media
        streamRef.current = media
        setHasAudio(media.getAudioTracks().length > 0)
        setHasCamera(media.getVideoTracks().length > 0)
        const capturedFacingMode = media.getVideoTracks()[0]?.getSettings().facingMode
        setCameraFacing(capturedFacingMode === 'environment' ? 'environment' : 'user')
        for (const track of media.getVideoTracks()) track.contentHint = 'motion'
        if (localVideo.current) localVideo.current.srcObject = media
        setStatus('Connecting to signaling…')
        connectSignal()
      } catch (mediaError) {
        if (cancelled) return
        setMediaRetryAvailable(true)
        setStatus('Microphone access needed')
        setError(mediaError instanceof Error && mediaError.message === 'MEDIA_UNAVAILABLE'
          ? 'Camera and microphone are unavailable in this browser.'
          : mediaErrorMessage(mediaError))
        console.error('Media permission failed', mediaError)
      }
    }

    retryMediaRef.current = () => { void requestMedia() }
    void requestMedia()

    return () => {
      cancelled = true
      retryMediaRef.current = () => {}
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      if (disconnectedTimer) window.clearTimeout(disconnectedTimer)
      if (socket?.readyState === WebSocket.OPEN) send({ type: 'leave' })
      socket?.close()
      wsRef.current = null
      closePeer()
      localStream?.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }, [roomId, participantId])

  const toggleMic = () => {
    const tracks = streamRef.current?.getAudioTracks() || []
    tracks.forEach(track => { track.enabled = muted })
    setMuted(!muted)
  }

  const toggleCamera = () => {
    const tracks = streamRef.current?.getVideoTracks() || []
    if (!tracks.length) {
      setError('No camera is available in this call. Voice is still supported.')
      return
    }
    tracks.forEach(track => { track.enabled = cameraOff })
    setCameraOff(!cameraOff)
  }

  const switchCamera = async () => {
    const currentStream = streamRef.current
    const currentTrack = currentStream?.getVideoTracks()[0]
    if (!currentStream || !currentTrack || switchingCamera) return

    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user'
    const currentDeviceId = currentTrack.getSettings().deviceId
    const sender = pcRef.current?.getSenders().find(item => item.track?.kind === 'video')
    let nextStream: MediaStream | null = null
    let releasedCurrentCamera = false
    setSwitchingCamera(true)
    setError('')

    try {
      try {
        await currentTrack.applyConstraints({ facingMode: { exact: nextFacing } })
        if (currentTrack.getSettings().facingMode === nextFacing) {
          currentTrack.contentHint = 'motion'
          if (sender) configureVideoSender(sender)
          setCameraFacing(nextFacing)
          setCameraOff(false)
          return
        }
      } catch {
        // Some browsers cannot change the active camera track in place.
      }

      const alternate = (await navigator.mediaDevices.enumerateDevices())
        .find(device => device.kind === 'videoinput' && device.deviceId && device.deviceId !== currentDeviceId)
      currentStream.removeTrack(currentTrack)
      currentTrack.stop()
      releasedCurrentCamera = true

      try {
        nextStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { ...VIDEO_CAPTURE, facingMode: { exact: nextFacing } },
        })
      } catch (facingError) {
        if (!alternate) throw facingError
        nextStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { ...VIDEO_CAPTURE, deviceId: { exact: alternate.deviceId } },
        })
      }

      const nextTrack = nextStream.getVideoTracks()[0]
      if (!nextTrack) throw new Error('No alternate video track')
      if (sender) await sender.replaceTrack(nextTrack)
      currentStream.addTrack(nextTrack)
      nextTrack.contentHint = 'motion'
      if (sender) configureVideoSender(sender)
      if (localVideo.current) {
        localVideo.current.srcObject = currentStream
        void localVideo.current.play().catch(() => {})
      }
      setHasCamera(true)
      setCameraFacing(nextFacing)
      setCameraOff(false)
    } catch {
      nextStream?.getTracks().forEach(track => track.stop())
      if (releasedCurrentCamera) {
        try {
          const recoveryVideo: MediaTrackConstraints = currentDeviceId
            ? { ...VIDEO_CAPTURE, deviceId: { exact: currentDeviceId } }
            : { ...VIDEO_CAPTURE, facingMode: { ideal: cameraFacing } }
          const recoveryStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: recoveryVideo })
          const recoveryTrack = recoveryStream.getVideoTracks()[0]
          if (!recoveryTrack) throw new Error('No camera track to restore')
          if (sender) await sender.replaceTrack(recoveryTrack)
          currentStream.addTrack(recoveryTrack)
          recoveryTrack.contentHint = 'motion'
          if (localVideo.current) {
            localVideo.current.srcObject = currentStream
            void localVideo.current.play().catch(() => {})
          }
          setHasCamera(true)
          setCameraOff(false)
        } catch (recoveryError) {
          console.error('Could not restore the previous camera', recoveryError)
          setHasCamera(false)
          setCameraOff(true)
        }
      }
      setError('Could not switch camera. Make sure your device has another camera.')
    } finally {
      setSwitchingCamera(false)
    }
  }

  const toggleFullscreen = async () => {
    if (fullscreen) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
      setFullscreen(false)
      return
    }

    setFullscreen(true)
    try {
      await callRoom.current?.requestFullscreen?.()
    } catch (fullscreenError) {
      console.warn('Native fullscreen unavailable; using the expanded call layout', fullscreenError)
    }
  }

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + '/?room=' + encodeURIComponent(roomId))
      setCopied(true)
    } catch {
      setError('Could not copy the invite link. Copy it from your browser address bar.')
    }
  }

  const enablePlayback = () => {
    if (!remoteVideo.current) return
    void remoteVideo.current.play().then(() => setNeedsPlayback(false)).catch(() => setNeedsPlayback(true))
  }

  return <main ref={callRoom} className={`callroom${fullscreen ? ' callroom--fullscreen' : ''}`}>
    <header className="callroom__header"><b>NEX<span>ROOM</span>.</b><div><span className="callroom__status">{connected ? '● LIVE' : '○ ' + status}</span><button onClick={copyInvite} className="callroom__invite"><Copy size={16}/>{copied ? 'COPIED' : 'COPY INVITE'}</button></div></header>
    <div className="callroom__stage">
      <video ref={remoteVideo} autoPlay playsInline aria-label="Remote participant video" className={`callroom__remote${selfPrimary ? ' callroom__remote--pip' : ''}`}/>
      {needsPlayback && <button className="callroom__play" onClick={enablePlayback}>TAP TO ENABLE AUDIO / VIDEO</button>}
      {!connected && <div className="callroom__waiting"><Video size={42}/><h1>YOUR PRIVATE ROOM</h1><p>{status}</p><small>Share your invite link to start a one-to-one call.</small></div>}
      <video ref={localVideo} autoPlay playsInline muted aria-label="Your video" className={`callroom__self${selfPrimary ? ' callroom__self--main' : ''}`}/>
    </div>
    {error && <p role="alert" className="callroom__error">{error}</p>}
    {mediaRetryAvailable && <button className="callroom__media-retry" onClick={() => retryMediaRef.current()}>ALLOW MICROPHONE AND TRY AGAIN</button>}
    <div className="callroom__controls">
      <button onClick={toggleMic} disabled={!hasAudio} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? <MicOff/> : <Mic/>}</button>
      <button onClick={toggleCamera} disabled={audioOnly || !hasCamera} aria-label={cameraOff ? 'Turn camera on' : 'Turn camera off'} title={cameraOff ? 'Turn camera on' : 'Turn camera off'}>{cameraOff ? <CameraOff/> : <Camera/>}</button>
      <button onClick={switchCamera} disabled={!hasCamera || switchingCamera} aria-label={cameraFacing === 'user' ? 'Switch to back camera' : 'Switch to front camera'} title={cameraFacing === 'user' ? 'Switch to back camera' : 'Switch to front camera'}><RefreshCw/></button>
      <button onClick={() => setSelfPrimary(!selfPrimary)} disabled={!connected} aria-pressed={selfPrimary} aria-label={selfPrimary ? 'Show participant large' : 'Show your video large'} title={selfPrimary ? 'Show participant large' : 'Show your video large'}><ArrowLeftRight/></button>
      <button onClick={toggleFullscreen} aria-pressed={fullscreen} aria-label={fullscreen ? 'Exit full-screen view' : 'Enter full-screen view'} title={fullscreen ? 'Exit full-screen view' : 'Enter full-screen view'}>{fullscreen ? <Minimize2/> : <Expand/>}</button>
      <button onClick={onLeave} className="callroom__hangup" aria-label="Leave call"><PhoneOff/></button>
    </div>
  </main>
}
