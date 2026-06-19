import { defineStore } from 'pinia'
import { SPHEngine, DEFAULT_PARAMS, PRESETS } from '../utils/sph-engine'
import type { SimParams, Preset, Particle, FrameState } from '../types'

const MAX_HISTORY_FRAMES = 300

export const useFluidStore = defineStore('fluid', {
  state: () => ({
    engine: null as SPHEngine | null,
    isRunning: false,
    isReversing: false,
    reverseSpeed: 1,
    particleCount: 800,
    currentPreset: PRESETS[0],
    params: { ...DEFAULT_PARAMS } as SimParams,
    fps: 0,
    frameCount: 0,
    historyBuffer: [] as FrameState[],
    historyHead: 0,
    historyCount: 0,
    replayIndex: -1,
    _animId: null as number | null,
    _lastTime: 0,
    _fpsAccum: 0,
    _fpsFrames: 0,
  }),
  getters: {
    particleArray: (state) => state.engine?.particles ?? [],
    avgDensity: (state) => {
      if (!state.engine || state.engine.particles.length === 0) return 0
      const sum = state.engine.particles.reduce((s, p) => s + p.density, 0)
      return sum / state.engine.particles.length
    },
    maxVelocity: (state) => {
      if (!state.engine || state.engine.particles.length === 0) return 0
      return Math.max(...state.engine.particles.map(p => Math.sqrt(p.vx * p.vx + p.vy * p.vy)))
    },
    historyStartFrame: (state): number => {
      if (state.historyCount === 0) return 0
      if (state.historyCount < MAX_HISTORY_FRAMES) return 0
      return state.frameCount - MAX_HISTORY_FRAMES + 1
    },
    historyEndFrame: (state): number => state.frameCount,
    canReverse: (state): boolean => state.historyCount > 1 && !state.isRunning,
  },
  actions: {
    initSimulation(preset?: Preset) {
      if (preset) {
        this.currentPreset = preset
        this.params = { ...DEFAULT_PARAMS, ...preset.params }
        this.particleCount = preset.particleCount
      }
      const canvas = { width: 800, height: 500 }
      this.engine = new SPHEngine(this.particleCount, canvas.width, canvas.height, this.params)
      this.engine.initParticles(this.currentPreset.initialConfig, this.particleCount)
      this.frameCount = 0
      this.fps = 0
      this.historyBuffer = []
      this.historyHead = 0
      this.historyCount = 0
      this.replayIndex = -1
      this.isReversing = false
      this.saveFrameToHistory()
    },
    saveFrameToHistory() {
      if (!this.engine) return
      const frameState: FrameState = {
        particles: this.engine.saveState(),
        frameIndex: this.frameCount,
      }
      if (this.historyCount < MAX_HISTORY_FRAMES) {
        this.historyBuffer.push(frameState)
        this.historyCount++
      } else {
        this.historyBuffer[this.historyHead] = frameState
        this.historyHead = (this.historyHead + 1) % MAX_HISTORY_FRAMES
      }
    },
    getHistoryFrame(index: number): FrameState | null {
      if (this.historyCount === 0) return null
      const startFrame = this.historyStartFrame
      const endFrame = this.historyEndFrame
      if (index < startFrame || index > endFrame) return null
      const bufferIndex = index % MAX_HISTORY_FRAMES
      return this.historyBuffer[bufferIndex]
    },
    start() {
      if (this.isRunning || !this.engine) return
      if (this.isReversing) {
        this.stopReverse()
      }
      if (this.replayIndex !== -1) {
        this.frameCount = this.replayIndex
        if (this.frameCount < this.historyEndFrame) {
          const newBufferSize = this.frameCount - this.historyStartFrame + 1
          if (newBufferSize > 0) {
            const newBuffer: FrameState[] = []
            for (let i = this.historyStartFrame; i <= this.frameCount; i++) {
              const frame = this.getHistoryFrame(i)
              if (frame) newBuffer.push(frame)
            }
            this.historyBuffer = newBuffer
            this.historyHead = newBuffer.length % MAX_HISTORY_FRAMES
            this.historyCount = newBuffer.length
          }
        }
        this.replayIndex = -1
      }
      this.isRunning = true
      this._lastTime = performance.now()
      this._fpsAccum = 0
      this._fpsFrames = 0
      const loop = (now: number) => {
        if (!this.isRunning || !this.engine) return
        const elapsed = now - this._lastTime
        this._lastTime = now
        this._fpsAccum += elapsed
        this._fpsFrames++
        if (this._fpsAccum >= 500) {
          this.fps = Math.round(this._fpsFrames / (this._fpsAccum / 1000))
          this._fpsAccum = 0
          this._fpsFrames = 0
        }
        const subSteps = 3
        for (let s = 0; s < subSteps; s++) {
          this.engine.step()
        }
        this.frameCount++
        this.saveFrameToHistory()
        this._animId = requestAnimationFrame(loop)
      }
      this._animId = requestAnimationFrame(loop)
    },
    stop() {
      this.isRunning = false
      if (this._animId !== null) {
        cancelAnimationFrame(this._animId)
        this._animId = null
      }
    },
    startReverse() {
      if (!this.canReverse || this.isReversing) return
      this.stop()
      this.isReversing = true
      if (this.replayIndex === -1) {
        this.replayIndex = this.frameCount
      }
      this._lastTime = performance.now()
      const loop = (now: number) => {
        if (!this.isReversing || !this.engine) return
        const elapsed = now - this._lastTime
        this._lastTime = now
        const framesToStep = Math.max(1, Math.round(this.reverseSpeed * elapsed / 16))
        for (let i = 0; i < framesToStep; i++) {
          this.stepReverse()
          if (this.replayIndex <= this.historyStartFrame) {
            this.stopReverse()
            return
          }
        }
        this._animId = requestAnimationFrame(loop)
      }
      this._animId = requestAnimationFrame(loop)
    },
    stopReverse() {
      this.isReversing = false
      if (this._animId !== null) {
        cancelAnimationFrame(this._animId)
        this._animId = null
      }
    },
    stepReverse() {
      if (!this.engine || this.historyCount === 0) return
      const targetIndex = this.replayIndex - 1
      const frame = this.getHistoryFrame(targetIndex)
      if (frame) {
        this.engine.restoreState(frame.particles)
        this.replayIndex = targetIndex
      }
    },
    stepForward() {
      if (!this.engine || this.historyCount === 0) return
      const targetIndex = this.replayIndex + 1
      if (targetIndex > this.historyEndFrame) {
        const subSteps = 3
        for (let s = 0; s < subSteps; s++) {
          this.engine.step()
        }
        this.frameCount++
        this.saveFrameToHistory()
        this.replayIndex = this.frameCount
      } else {
        const frame = this.getHistoryFrame(targetIndex)
        if (frame) {
          this.engine.restoreState(frame.particles)
          this.replayIndex = targetIndex
        }
      }
    },
    seekToFrame(targetIndex: number) {
      if (!this.engine) return
      const clampedIndex = Math.max(this.historyStartFrame, Math.min(targetIndex, this.historyEndFrame))
      const frame = this.getHistoryFrame(clampedIndex)
      if (frame) {
        this.engine.restoreState(frame.particles)
        this.replayIndex = clampedIndex
      }
    },
    reset() {
      this.stop()
      this.stopReverse()
      this.initSimulation(this.currentPreset)
    },
    stepOnce() {
      if (!this.engine || this.isRunning) return
      if (this.isReversing) {
        this.stopReverse()
      }
      const subSteps = 3
      for (let s = 0; s < subSteps; s++) {
        this.engine.step()
      }
      this.frameCount++
      this.saveFrameToHistory()
      this.replayIndex = this.frameCount
    },
    setReverseSpeed(speed: number) {
      this.reverseSpeed = Math.max(0.25, Math.min(4, speed))
    },
    updateParam(key: keyof SimParams, value: number) {
      this.params[key] = value
      if (this.engine) {
        this.engine.params[key] = value
        if (key === 'smoothingRadius') {
          this.engine['cellSize'] = value
        }
      }
    },
  },
})
