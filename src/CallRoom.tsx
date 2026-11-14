import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Copy, Mic, MicOff, PhoneOff, Video } from 'lucide-react'
import './CallRoom.css'

type Signal = {type: string; roomId?: string; data?: RTCSessionDescriptionInit | RTCIceCandidateInit; code?: string; initiator?: boolean}
const SIGNAL_URL = import.meta.env.VITE_SIGNAL_URL || 'ws://localhost:3001'
const ICE_SERVERS: RTCIceServer[] = [{urls:'stun:stun.l.google.com:19302'}]

export default function CallRoom({roomId, onLeave}:{roomId:string;onLeave:()=>void}) {
  const localVideo = useRef<HTMLVideoElement>(null)
  const remoteVideo = useRef<HTMLVideoElement>(null)
  const wsRef = useRef<WebSocket|null>(null)
  const pcRef = useRef<RTCPeerConnection|null>(null)
  const streamRef = useRef<MediaStream|null>(null)
  const pendingIce = useRef<RTCIceCandidateInit[]>([])
  const [status,setStatus] = useState('Preparing microphone and camera…')
  const [error,setError] = useState('')
  const [muted,setMuted] = useState(false)
  const [cameraOff,setCameraOff] = useState(false)
  const [copied,setCopied] = useState(false)
  const [connected,setConnected] = useState(false)
  const [audioOnly,setAudioOnly] = useState(false)

  useEffect(()=>{
    let cancelled=false
    const socket=new WebSocket(SIGNAL_URL)
    wsRef.current=socket
    const send=(type:string,data?:unknown)=>{if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type,data}))}
    const peer=new RTCPeerConnection({iceServers:ICE_SERVERS})
    pcRef.current=peer
    peer.onicecandidate=e=>{if(e.candidate)send('ice-candidate',e.candidate.toJSON())}
    peer.ontrack=e=>{
      if(remoteVideo.current)remoteVideo.current.srcObject=e.streams[0]
      setStatus('Connected')
      setConnected(true)
    }
    peer.onconnectionstatechange=()=>{
      if(peer.connectionState==='failed')setError('Connection failed. Some networks require a TURN relay; configure one before production.')
      if(peer.connectionState==='disconnected')setStatus('Reconnecting…')
      if(peer.connectionState==='connected'){setConnected(true);setStatus('Connected')}
    }
    const flushIce=async()=>{
      for(const ice of pendingIce.current.splice(0))await peer.addIceCandidate(ice)
    }
    const start=async()=>{
      try{
        let media: MediaStream
        try {
          media=await navigator.mediaDevices.getUserMedia({audio:true,video:true})
        } catch (cameraError) {
          // A missing/blocked camera should not prevent a voice-only conversation.
          console.warn('Camera unavailable, trying audio-only',cameraError)
          media=await navigator.mediaDevices.getUserMedia({audio:true,video:false})
          setAudioOnly(true)
          setCameraOff(true)
        }
        if(cancelled){media.getTracks().forEach(t=>t.stop());return}
        streamRef.current=media
        if(localVideo.current)localVideo.current.srcObject=media
        for(const track of media.getTracks())peer.addTrack(track,media)
        setStatus('Waiting for the other person…')
        if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'join',roomId}))
      }catch(e){setError('Camera/microphone permission failed. Use HTTPS or localhost and allow access in your browser.');console.error(e)}
    }
    socket.onopen=()=>start()
    socket.onmessage=async event=>{
      try{
        const msg=JSON.parse(event.data) as Signal
        if(msg.type==='joined'){setStatus('Waiting for the other person…')}
        if(msg.type==='peer-joined'){
          const offer=await peer.createOffer()
          await peer.setLocalDescription(offer)
          send('offer',peer.localDescription)
        }
        if(msg.type==='offer' && msg.data){
          await peer.setRemoteDescription(msg.data as RTCSessionDescriptionInit)
          await flushIce()
          const answer=await peer.createAnswer()
          await peer.setLocalDescription(answer)
          send('answer',peer.localDescription)
        }
        if(msg.type==='answer' && msg.data){
          await peer.setRemoteDescription(msg.data as RTCSessionDescriptionInit)
          await flushIce()
        }
        if(msg.type==='ice-candidate' && msg.data){
          const ice=msg.data as RTCIceCandidateInit
          if(peer.remoteDescription)await peer.addIceCandidate(ice)
          else pendingIce.current.push(ice)
        }
        if(msg.type==='peer-left'){
          setConnected(false);setStatus('Other participant left. Waiting…')
          if(remoteVideo.current)remoteVideo.current.srcObject=null
          // A new peer connection is needed for reconnecting after an ended call.
        }
        if(msg.type==='error')setError(msg.code==='ROOM_FULL'?'This room already has two people.':'Room error: '+msg.code)
      }catch(e){console.error('Signaling error',e);setError('Could not negotiate the call. Please reload and try again.')}
    }
    socket.onerror=()=>setError('Could not connect to signaling server. Check VITE_SIGNAL_URL and server status.')
    socket.onclose=()=>{if(!cancelled)setStatus('Signaling disconnected')}
    return ()=>{
      cancelled=true
      if(socket.readyState===WebSocket.OPEN)send('leave')
      socket.close()
      peer.close()
      streamRef.current?.getTracks().forEach(track=>track.stop())
    }
  },[roomId])

  const toggleMic=()=>{
    const tracks=streamRef.current?.getAudioTracks()||[]
    tracks.forEach(t=>t.enabled=muted)
    setMuted(!muted)
  }
  const toggleCamera=()=>{
    const tracks=streamRef.current?.getVideoTracks()||[]
    if(!tracks.length){setError('No camera is available in this call. Voice is still supported.');return}
    tracks.forEach(t=>t.enabled=cameraOff)
    setCameraOff(!cameraOff)
  }
  const copyInvite=async()=>{
    await navigator.clipboard.writeText(window.location.origin+'/?room='+encodeURIComponent(roomId))
    setCopied(true)
  }
  return <main className="callroom">
    <header className="callroom__header"><b>NEX<span>ROOM</span>.</b><div><span className="callroom__status">{connected?'● LIVE':'○ '+status}</span><button onClick={copyInvite} className="callroom__invite"><Copy size={16}/>{copied?'COPIED':'COPY INVITE'}</button></div></header>
    <div className="callroom__stage">
      <video ref={remoteVideo} autoPlay playsInline className="callroom__remote"/>
      {!connected&&<div className="callroom__waiting"><Video size={42}/><h1>YOUR PRIVATE ROOM</h1><p>{status}</p><small>Share your invite link to start a one-to-one call.</small></div>}
      <video ref={localVideo} autoPlay playsInline muted className="callroom__self"/>
    </div>
    {error&&<p role="alert" className="callroom__error">{error}</p>}
    <div className="callroom__controls">
      <button onClick={toggleMic} aria-label={muted?'Unmute':'Mute'}>{muted?<MicOff/>:<Mic/>}</button>
      <button onClick={toggleCamera} disabled={audioOnly} aria-label={cameraOff?'Turn camera on':'Turn camera off'}>{cameraOff?<CameraOff/>:<Camera/>}</button>
      <button onClick={onLeave} className="callroom__hangup" aria-label="Leave call"><PhoneOff/></button>
    </div>
  </main>
}
