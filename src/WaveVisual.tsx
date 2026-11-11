import { useEffect, useRef } from 'react'

type Point = { x: number; z: number; phase: number; size: number }

export default function WaveVisual() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) return

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const points: Point[] = []
    const cols = 67
    const rows = 33
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        points.push({
          x: (col / (cols - 1) - 0.5) * 2,
          z: (row / (rows - 1) - 0.5) * 2,
          phase: Math.sin(col * 15.31 + row * 6.71) * 0.5,
          size: (col + row) % 11 === 0 ? 1.5 : 0.82,
        })
      }
    }

    let width = 1
    let height = 1
    let raf = 0
    let active = true
    let visible = true
    let mouseX = 0
    let mouseY = 0
    let targetX = 0
    let targetY = 0
    let lastFrame = 0
    const onPointer = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect()
      targetX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
      targetY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2
    }
    const onPointerLeave = () => { targetX = 0; targetY = 0 }
    const onVisibility = () => { visible = !document.hidden; if (visible) requestFrame() }
    const observer = new IntersectionObserver(entries => {
      active = entries[0]?.isIntersecting ?? false
      if (active) requestFrame()
    }, { threshold: 0.02 })
    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      width = Math.max(1, bounds.width)
      height = Math.max(1, bounds.height)
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      requestFrame()
    }
    const surface = (x: number, z: number, time: number) => {
      const ridge = Math.sin(x * 4.1 + time * 0.67) * Math.cos(z * 2.4 - time * 0.39)
      const detail = Math.sin(x * 7.3 - z * 3.6 + time * 0.48) * 0.11
      const envelope = Math.max(0.18, 1 - Math.pow(Math.abs(x), 2.2) * 0.48)
      return (ridge * 0.38 + detail) * envelope
    }
    const project = (x: number, z: number, y: number) => {
      const yaw = -0.23 + mouseX * 0.12
      const rotatedX = x * Math.cos(yaw) - z * Math.sin(yaw)
      const rotatedZ = x * Math.sin(yaw) + z * Math.cos(yaw)
      const tilt = 0.54 + mouseY * 0.06
      const depth = rotatedZ * Math.cos(tilt) - y * Math.sin(tilt)
      const elevation = rotatedZ * Math.sin(tilt) + y * Math.cos(tilt)
      const perspective = 3.8 / (3.8 + depth * 0.29)
      const scale = Math.min(width * 0.49, height * 0.68)
      return { x: width * 0.5 + rotatedX * scale * perspective, y: height * 0.52 + elevation * scale * perspective, depth }
    }
    const render = (timestamp: number) => {
      raf = 0
      if (!active || !visible) return
      if (timestamp - lastFrame < 32 && !motionPreference.matches) { requestFrame(); return }
      lastFrame = timestamp
      const time = motionPreference.matches ? 1.6 : timestamp * 0.001
      mouseX += (targetX - mouseX) * 0.035
      mouseY += (targetY - mouseY) * 0.035
      context.clearRect(0, 0, width, height)

      const projected = points.map(p => {
        const y = surface(p.x, p.z, time) + p.phase * 0.012
        return { ...project(p.x, p.z, y), size: p.size, y }
      })
      context.save()
      context.globalCompositeOperation = 'screen'
      for (let row = 0; row < rows; row++) {
        context.beginPath()
        for (let col = 0; col < cols; col++) {
          const p = projected[row * cols + col]
          if (col === 0) context.moveTo(p.x, p.y)
          else context.lineTo(p.x, p.y)
        }
        context.strokeStyle = row % 4 === 0 ? 'rgba(245,197,24,0.27)' : 'rgba(245,197,24,0.105)'
        context.lineWidth = row % 4 === 0 ? 0.75 : 0.42
        context.stroke()
      }
      for (let col = 0; col < cols; col += 2) {
        context.beginPath()
        for (let row = 0; row < rows; row++) {
          const p = projected[row * cols + col]
          if (row === 0) context.moveTo(p.x, p.y)
          else context.lineTo(p.x, p.y)
        }
        context.strokeStyle = 'rgba(255,212,63,0.105)'
        context.lineWidth = 0.5
        context.stroke()
      }
      for (const p of projected) {
        const brightness = Math.max(0.12, Math.min(1, 0.52 + p.y * 0.001 + p.depth * -0.11))
        context.fillStyle = 'rgba(255,206,48,' + (brightness * 0.77).toFixed(3) + ')'
        context.beginPath()
        context.arc(p.x, p.y, p.size * (0.68 + brightness * 0.44), 0, Math.PI * 2)
        context.fill()
      }
      context.restore()
      if (!motionPreference.matches) requestFrame()
    }
    const requestFrame = () => { if (!raf && active && visible) raf = requestAnimationFrame(render) }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)
    observer.observe(canvas)
    canvas.addEventListener('pointermove', onPointer)
    canvas.addEventListener('pointerleave', onPointerLeave)
    document.addEventListener('visibilitychange', onVisibility)
    resize()
    return () => {
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      observer.disconnect()
      canvas.removeEventListener('pointermove', onPointer)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <div className="visual visual--mesh">
      <canvas ref={canvasRef} className="visual__canvas" aria-hidden="true" />
      <span className="visual__mesh-label" aria-hidden="true">LIVE CONNECTION / NEXROOM</span>
    </div>
  )
}
