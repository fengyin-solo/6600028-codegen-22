<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useFluidStore } from '../store/fluid'

const store = useFluidStore()
const canvas = ref<HTMLCanvasElement | null>(null)

const W = 800
const H = 500

function velocityToColor(speed: number): string {
  // Blue (slow) -> Green (medium) -> Red (fast)
  const maxSpeed = 200
  const t = Math.min(speed / maxSpeed, 1)
  const hue = (1 - t) * 240 // 240=blue, 120=green, 0=red
  const sat = 80
  const light = 40 + t * 20
  return `hsl(${hue}, ${sat}%, ${light}%)`
}

function draw() {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) return

  // Clear
  ctx.fillStyle = '#0c1222'
  ctx.fillRect(0, 0, W, H)

  // Draw boundary walls
  ctx.strokeStyle = '#475569'
  ctx.lineWidth = 3
  ctx.strokeRect(2, 2, W - 4, H - 4)

  // Draw grid (faint)
  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 0.3
  for (let x = 0; x < W; x += 50) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }
  for (let y = 0; y < H; y += 50) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }

  if (!store.engine) return

  // Draw density heatmap background (low-res)
  const gridSize = 20
  const gw = Math.ceil(W / gridSize)
  const gh = Math.ceil(H / gridSize)
  const densityGrid = new Float32Array(gw * gh)
  for (const p of store.engine.particles) {
    const gx = Math.floor(p.x / gridSize)
    const gy = Math.floor(p.y / gridSize)
    if (gx >= 0 && gx < gw && gy >= 0 && gy < gh) {
      densityGrid[gy * gw + gx] += p.density
    }
  }
  const maxDens = Math.max(...densityGrid, 1)
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const d = densityGrid[gy * gw + gx]
      if (d > 0) {
        const alpha = Math.min(d / maxDens * 0.15, 0.15)
        ctx.fillStyle = `rgba(59, 130, 246, ${alpha})`
        ctx.fillRect(gx * gridSize, gy * gridSize, gridSize, gridSize)
      }
    }
  }

  // Draw particles
  const particles = store.engine.particles
  for (const p of particles) {
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
    const color = velocityToColor(speed)
    const radius = 4

    ctx.beginPath()
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  }

  // FPS overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
  ctx.fillRect(W - 80, 5, 75, 22)
  ctx.fillStyle = '#22c55e'
  ctx.font = 'bold 12px monospace'
  ctx.fillText(`FPS: ${store.fps}`, W - 74, 20)

  // Frame count
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
  ctx.fillRect(W - 120, 30, 115, 22)
  ctx.fillStyle = '#94a3b8'
  ctx.font = '11px monospace'
  const displayFrame = store.replayIndex !== -1 ? store.replayIndex : store.frameCount
  ctx.fillText(`Frame: ${displayFrame}`, W - 114, 44)

  // Replay indicator
  if (store.isReversing) {
    ctx.fillStyle = 'rgba(168, 85, 247, 0.9)'
    ctx.fillRect(5, 5, 120, 28)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 12px sans-serif'
    ctx.fillText('⏮ 倒放中...', 12, 24)
  } else if (store.replayIndex !== -1 && !store.isRunning) {
    ctx.fillStyle = 'rgba(100, 116, 139, 0.8)'
    ctx.fillRect(5, 5, 140, 28)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 12px sans-serif'
    ctx.fillText('⏸ 回放模式', 12, 24)
  }

  // Playback progress bar
  if (store.historyCount > 1 && !store.isRunning) {
    const barWidth = 200
    const barHeight = 6
    const barX = W / 2 - barWidth / 2
    const barY = H - 20
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4)
    
    ctx.fillStyle = '#334155'
    ctx.fillRect(barX, barY, barWidth, barHeight)
    
    const progress = (displayFrame - store.historyStartFrame) / (store.historyEndFrame - store.historyStartFrame)
    ctx.fillStyle = '#a855f7'
    ctx.fillRect(barX, barY, barWidth * Math.max(0, Math.min(1, progress)), barHeight)
    
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(barX + barWidth * Math.max(0, Math.min(1, progress)), barY + barHeight / 2, 5, 0, Math.PI * 2)
    ctx.fill()
  }
}

let raf: number | null = null
function animate() {
  draw()
  raf = requestAnimationFrame(animate)
}

function onClick(e: MouseEvent) {
  if (!store.engine || !canvas.value) return
  const rect = canvas.value.getBoundingClientRect()
  const scaleX = W / rect.width
  const scaleY = H / rect.height
  const x = (e.clientX - rect.left) * scaleX
  const y = (e.clientY - rect.top) * scaleY
  store.engine.applyImpulse(x, y, 300)
}

onMounted(() => {
  animate()
})

onUnmounted(() => {
  if (raf) cancelAnimationFrame(raf)
})
</script>

<template>
  <div class="relative">
    <canvas
      ref="canvas"
      :width="W"
      :height="H"
      class="rounded-lg border border-gray-700 cursor-crosshair w-full max-w-[800px]"
      @click="onClick"
    />
  </div>
</template>
