import { useEffect, useRef } from 'react'

export default function WaveVisual() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const mobile = window.matchMedia('(max-width: 760px)')
    let width = 600, height = 480, frame = 0, raf = 0, running = true
    let yaw = -0.38, pitch = 0.34, targetYaw = yaw, targetPitch = pitch
    let dragging = false, prevX = 0, prevY = 0
    const columns = 58, rows = 40
    const coords = Array.from({length: columns * rows}, (_, i) => ({
      x: (i % columns / (columns - 1) - .5) * 2.85,
      z: (Math.floor(i / columns) / (rows - 1) - .5) * 2.25,
      jitter: Math.sin(i * 12.9898) * .009
    }))
    const onDown = (e: PointerEvent) => {
      dragging = true; prevX = e.clientX; prevY = e.clientY
      canvas.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (dragging) {
        targetYaw += (e.clientX - prevX) * .008
        targetPitch = Math.max(-.12, Math.min(.95, targetPitch + (e.clientY - prevY) * .006))
        prevX = e.clientX; prevY = e.clientY
      } else {
        const r = canvas.getBoundingClientRect()
        targetYaw = -.38 + ((e.clientX - r.left) / r.width - .5) * .32
        targetPitch = .34 + ((e.clientY - r.top) / r.height - .5) * .16
      }
      if (reduceMotion.matches) draw()
    }
    const onUp = () => { dragging = false }
    const onLeave = () => { if (!dragging) { targetYaw = -.38; targetPitch = .34 } }
    const onResize = () => {
      const r = canvas.getBoundingClientRect()
      width = Math.max(1, r.width); height = Math.max(1, r.height)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw()
    }
    const rotate = (x: number, y: number, z: number) => {
      const cx = x * Math.cos(yaw) + z * Math.sin(yaw)
      const cz = -x * Math.sin(yaw) + z * Math.cos(yaw)
      const cy = y * Math.cos(pitch) - cz * Math.sin(pitch)
      const depth = y * Math.sin(pitch) + cz * Math.cos(pitch)
      const perspective = 4.9 / (4.9 + depth * .27)
      const scale = Math.min(width / 4.25, height / 3.75)
      return { x: width / 2 + cx * scale * perspective, y: height / 2 + cy * scale * perspective, depth }
    }
    const wave = (x: number, z: number, t: number) =>
      .43 * Math.sin(x * 2.45 - t * .72) * Math.cos(z * 2.4 + t * .36)
      + .17 * Math.sin(x * 4.3 + z * 2.2 + t * .57)
    const draw = () => {
      if (mobile.matches) return
      yaw += (targetYaw - yaw) * .11
      pitch += (targetPitch - pitch) * .11
      const t = reduceMotion.matches ? 2 : frame / 42
      ctx.clearRect(0, 0, width, height)
      const corners = [
        [-1.53,-.88,-1.24],[1.53,-.88,-1.24],[1.53,-.88,1.24],[-1.53,-.88,1.24],
        [-1.53,.88,-1.24],[1.53,.88,-1.24],[1.53,.88,1.24],[-1.53,.88,1.24]
      ].map(p => rotate(p[0],p[1],p[2]))
      const edge = (a: number, b: number, opacity: number) => {
        ctx.beginPath(); ctx.moveTo(corners[a].x,corners[a].y);ctx.lineTo(corners[b].x,corners[b].y)
        ctx.strokeStyle = 'rgba(245,197,24,'+opacity+')';ctx.lineWidth = 1;ctx.stroke()
      }
      ;[[0,1],[1,2],[2,3],[3,0],[0,4],[1,5],[2,6],[3,7],[4,5],[5,6],[6,7],[7,4]]
        .forEach(([a,b])=>edge(a,b,.16))
      const pts = coords.map(p => {
        const h = wave(p.x,p.z,t) + p.jitter
        return {...rotate(p.x,h,p.z), h}
      })
      ctx.globalCompositeOperation = 'screen'
      for(let r=0;r<rows;r+=2){
        ctx.beginPath()
        for(let c=0;c<columns;c++){
          const p=pts[r*columns+c]
          if(c===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y)
        }
        ctx.strokeStyle='rgba(245,197,24,.18)';ctx.lineWidth=.65;ctx.stroke()
      }
      for(let c=0;c<columns;c+=3){
        ctx.beginPath()
        for(let r=0;r<rows;r++){
          const p=pts[r*columns+c]
          if(r===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y)
        }
        ctx.strokeStyle='rgba(245,197,24,.12)';ctx.lineWidth=.6;ctx.stroke()
      }
      pts.forEach((p,i)=>{
        const light=Math.max(.25,Math.min(1,.72 + p.h*.38 - p.depth*.11))
        ctx.fillStyle='rgba(255,211,62,'+(.5*light+.16)+')'
        ctx.beginPath();ctx.arc(p.x,p.y,i%13===0?1.65:1.05,0,Math.PI*2);ctx.fill()
      })
      ctx.globalCompositeOperation='source-over'
      if (!reduceMotion.matches && running) {frame++;raf=requestAnimationFrame(draw)}
    }
    const observer = new ResizeObserver(onResize)
    observer.observe(canvas)
    canvas.addEventListener('pointerdown',onDown)
    canvas.addEventListener('pointermove',onMove)
    canvas.addEventListener('pointerup',onUp)
    canvas.addEventListener('pointercancel',onUp)
    canvas.addEventListener('pointerleave',onLeave)
    const visibility = () => {running=!document.hidden;if(running){cancelAnimationFrame(raf);raf=requestAnimationFrame(draw)}}
    document.addEventListener('visibilitychange',visibility)
    onResize()
    return () => {
      running=false;cancelAnimationFrame(raf);observer.disconnect()
      canvas.removeEventListener('pointerdown',onDown)
      canvas.removeEventListener('pointermove',onMove)
      canvas.removeEventListener('pointerup',onUp)
      canvas.removeEventListener('pointercancel',onUp)
      canvas.removeEventListener('pointerleave',onLeave)
      document.removeEventListener('visibilitychange',visibility)
    }
  }, [])

  return <div className="visual visual--mesh">
    <div className="visual__desktop-stage">
      <canvas ref={canvasRef} className="visual__canvas" aria-label="Interactive 3D particle wave. Drag to rotate the wave and its frame." />
      <span className="visual__drag-hint">DRAG TO ROTATE / INTERACTIVE FIELD</span>
    </div>
    <svg className="visual__mobile-wave" viewBox="0 0 420 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id="mobile-wave-gold" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#f5c518" stopOpacity="0"/><stop offset=".27" stopColor="#f5c518" stopOpacity=".42"/><stop offset=".65" stopColor="#ffe477" stopOpacity=".8"/><stop offset="1" stopColor="#f5c518" stopOpacity="0"/></linearGradient></defs>
      <g className="visual__mobile-wave-lines" fill="none">
        {Array.from({length:24},(_,i)=><path key={i} d={`M -60 ${145+i*7} C 60 ${85+i*5}, 130 ${285-i*3}, 240 ${183+i*4} S 365 ${90+i*5}, 480 ${165+i*4}`} stroke="url(#mobile-wave-gold)" strokeWidth={i%5===0?1.5:.85} opacity={.3+i/45}/>)}
      </g>
    </svg>
  </div>
}
