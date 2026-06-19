<script setup lang="ts">
import { computed } from 'vue'
import { useFluidStore } from '../store/fluid'
import { PRESETS } from '../utils/sph-engine'
import type { Preset } from '../types'

const store = useFluidStore()

function selectPreset(preset: Preset) {
  store.initSimulation(preset)
}

function toggleRun() {
  if (store.isRunning) {
    store.stop()
  } else {
    store.start()
  }
}

function reset() {
  store.reset()
}

function stepOnce() {
  store.stepOnce()
}

function toggleReverse() {
  if (store.isReversing) {
    store.stopReverse()
  } else {
    store.startReverse()
  }
}

function stepBack() {
  if (store.isReversing) {
    store.stopReverse()
  }
  if (store.replayIndex === -1) {
    store.replayIndex = store.frameCount
  }
  store.stepReverse()
}

function stepForward() {
  if (store.isReversing) {
    store.stopReverse()
  }
  if (store.replayIndex === -1) {
    store.replayIndex = store.frameCount
  }
  store.stepForward()
}

function onSeek(e: Event) {
  const value = parseInt((e.target as HTMLInputElement).value)
  if (store.replayIndex === -1) {
    store.replayIndex = store.frameCount
  }
  store.seekToFrame(value)
}

function onReverseSpeed(e: Event) {
  store.setReverseSpeed(parseFloat((e.target as HTMLInputElement).value))
}

function onGravity(e: Event) {
  store.updateParam('gravity', parseFloat((e.target as HTMLInputElement).value))
}
function onViscosity(e: Event) {
  store.updateParam('viscosity', parseFloat((e.target as HTMLInputElement).value))
}
function onSmoothingRadius(e: Event) {
  store.updateParam('smoothingRadius', parseFloat((e.target as HTMLInputElement).value))
}
function onParticleCount(e: Event) {
  store.particleCount = parseInt((e.target as HTMLInputElement).value)
}
function onDt(e: Event) {
  store.updateParam('dt', parseFloat((e.target as HTMLInputElement).value))
}

const displayFrame = computed(() => {
  return store.replayIndex !== -1 ? store.replayIndex : store.frameCount
})
</script>

<template>
  <div class="w-72 bg-gray-800 rounded-lg border border-gray-700 p-4 flex flex-col gap-4 overflow-auto h-full">
    <!-- Presets -->
    <div>
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">预设场景</h3>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="preset in PRESETS"
          :key="preset.name"
          @click="selectPreset(preset)"
          class="text-xs px-2 py-2 rounded transition text-left"
          :class="store.currentPreset.name === preset.name
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
        >
          {{ preset.label }}
        </button>
      </div>
      <p class="text-xs text-gray-500 mt-1">{{ store.currentPreset.description }}</p>
    </div>

    <!-- Controls -->
    <div class="flex gap-2">
      <button
        @click="toggleRun"
        class="flex-1 py-2 rounded text-sm font-medium transition"
        :class="store.isRunning
          ? 'bg-red-600 hover:bg-red-700 text-white'
          : 'bg-green-600 hover:bg-green-700 text-white'"
      >
        {{ store.isRunning ? '暂停' : '开始' }}
      </button>
      <button
        @click="reset"
        class="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 rounded text-sm transition"
      >
        重置
      </button>
      <button
        @click="stepOnce"
        :disabled="store.isRunning"
        class="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-200 py-2 rounded text-sm transition"
      >
        单步
      </button>
    </div>

    <!-- Playback Controls -->
    <div class="bg-gray-900 rounded-lg p-3 border border-gray-700">
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">时间倒放</h3>
      
      <!-- Frame progress bar -->
      <div class="mb-3">
        <div class="flex justify-between text-xs text-gray-500 mb-1">
          <span>帧 {{ displayFrame }}</span>
          <span>缓存: {{ store.historyCount }} 帧</span>
        </div>
        <input
          type="range"
          :min="store.historyStartFrame"
          :max="store.historyEndFrame"
          :value="displayFrame"
          @input="onSeek"
          :disabled="store.historyCount < 2"
          class="w-full accent-purple-500 h-1.5 disabled:opacity-40"
        />
        <div class="flex justify-between text-[10px] text-gray-600 mt-0.5">
          <span>{{ store.historyStartFrame }}</span>
          <span>{{ store.historyEndFrame }}</span>
        </div>
      </div>

      <!-- Reverse playback buttons -->
      <div class="flex gap-2 mb-3">
        <button
          @click="stepBack"
          :disabled="!store.canReverse && !store.isReversing"
          class="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-200 py-2 rounded text-sm transition"
        >
          ← 后退
        </button>
        <button
          @click="toggleReverse"
          :disabled="!store.canReverse && !store.isReversing"
          class="flex-1 py-2 rounded text-sm font-medium transition"
          :class="store.isReversing
            ? 'bg-orange-600 hover:bg-orange-700 text-white'
            : 'bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40'"
        >
          {{ store.isReversing ? '停止倒放' : '倒放' }}
        </button>
        <button
          @click="stepForward"
          :disabled="store.isRunning"
          class="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-200 py-2 rounded text-sm transition"
        >
          前进 →
        </button>
      </div>

      <!-- Reverse speed control -->
      <div>
        <label class="flex justify-between text-xs text-gray-400 mb-1">
          <span>倒放速度</span>
          <span class="text-gray-300">{{ store.reverseSpeed.toFixed(2) }}x</span>
        </label>
        <input
          type="range"
          min="0.25"
          max="4"
          step="0.25"
          :value="store.reverseSpeed"
          @input="onReverseSpeed"
          class="w-full accent-purple-500 h-1.5"
        />
        <div class="flex justify-between text-[10px] text-gray-600 mt-0.5">
          <span>0.25x</span>
          <span>2x</span>
          <span>4x</span>
        </div>
      </div>
    </div>

    <!-- Parameters -->
    <div class="space-y-3">
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">模拟参数</h3>

      <div>
        <label class="flex justify-between text-xs text-gray-400 mb-1">
          <span>重力</span>
          <span class="text-gray-300">{{ store.params.gravity.toFixed(1) }}</span>
        </label>
        <input
          type="range" min="0" max="20" step="0.1"
          :value="store.params.gravity"
          @input="onGravity"
          class="w-full accent-blue-500 h-1.5"
        />
      </div>

      <div>
        <label class="flex justify-between text-xs text-gray-400 mb-1">
          <span>粘性</span>
          <span class="text-gray-300">{{ store.params.viscosity.toFixed(1) }}</span>
        </label>
        <input
          type="range" min="0" max="5" step="0.1"
          :value="store.params.viscosity"
          @input="onViscosity"
          class="w-full accent-blue-500 h-1.5"
        />
      </div>

      <div>
        <label class="flex justify-between text-xs text-gray-400 mb-1">
          <span>光滑半径</span>
          <span class="text-gray-300">{{ store.params.smoothingRadius.toFixed(0) }}</span>
        </label>
        <input
          type="range" min="10" max="50" step="1"
          :value="store.params.smoothingRadius"
          @input="onSmoothingRadius"
          class="w-full accent-blue-500 h-1.5"
        />
      </div>

      <div>
        <label class="flex justify-between text-xs text-gray-400 mb-1">
          <span>粒子数量</span>
          <span class="text-gray-300">{{ store.particleCount }}</span>
        </label>
        <input
          type="range" min="200" max="2000" step="50"
          :value="store.particleCount"
          @input="onParticleCount"
          class="w-full accent-blue-500 h-1.5"
        />
        <p class="text-xs text-gray-600 mt-0.5">重置后生效</p>
      </div>

      <div>
        <label class="flex justify-between text-xs text-gray-400 mb-1">
          <span>时间步长</span>
          <span class="text-gray-300">{{ store.params.dt.toFixed(4) }}</span>
        </label>
        <input
          type="range" min="0.001" max="0.02" step="0.001"
          :value="store.params.dt"
          @input="onDt"
          class="w-full accent-blue-500 h-1.5"
        />
      </div>
    </div>

    <!-- Stats -->
    <div class="mt-auto pt-3 border-t border-gray-700">
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">运行状态</h3>
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="bg-gray-900 rounded px-2 py-1.5">
          <span class="text-gray-500">FPS</span>
          <p class="text-green-400 font-mono text-sm">{{ store.fps }}</p>
        </div>
        <div class="bg-gray-900 rounded px-2 py-1.5">
          <span class="text-gray-500">粒子数</span>
          <p class="text-blue-400 font-mono text-sm">{{ store.particleArray.length }}</p>
        </div>
        <div class="bg-gray-900 rounded px-2 py-1.5">
          <span class="text-gray-500">平均密度</span>
          <p class="text-yellow-400 font-mono text-sm">{{ store.avgDensity.toFixed(0) }}</p>
        </div>
        <div class="bg-gray-900 rounded px-2 py-1.5">
          <span class="text-gray-500">最大速度</span>
          <p class="text-red-400 font-mono text-sm">{{ store.maxVelocity.toFixed(1) }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
