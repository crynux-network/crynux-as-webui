<script setup>
import { computed, ref } from 'vue'
import { useElementSize } from '@vueuse/core'

const props = defineProps({
  points: {
    type: Array,
    default: () => [],
  },
  series: {
    type: Array,
    required: true,
  },
  height: {
    type: Number,
    default: 220,
  },
  xCount: {
    type: Number,
    default: 10,
  },
})

const root = ref(null)
const { width: containerWidth } = useElementSize(root)
const emptyYMax = 10

function dataMax(points, keys) {
  let max = 0
  for (const point of points) {
    let stack = 0
    for (const key of keys) {
      stack += Number(point[key] || 0)
    }
    if (stack > max) max = stack
  }
  return max
}

function niceIntegerMax(rawMax) {
  if (!Number.isFinite(rawMax) || rawMax <= 0) return emptyYMax
  const target = Math.ceil(rawMax)
  if (target <= 1) return 1
  const magnitude = 10 ** Math.floor(Math.log10(target))
  const normalized = target / magnitude
  let nice
  if (normalized <= 1) nice = 1
  else if (normalized <= 2) nice = 2
  else if (normalized <= 5) nice = 5
  else nice = 10
  return nice * magnitude
}

function integerTicks(max) {
  const tickCount = Math.min(max, 5)
  const step = Math.max(1, Math.ceil(max / tickCount))
  const ticks = []
  for (let value = 0; value < max; value += step) {
    ticks.push(value)
  }
  if (ticks[ticks.length - 1] !== max) {
    ticks.push(max)
  }
  return ticks
}

const chart = computed(() => {
  const points = props.points || []
  const denseXLabels = points.length > 8
  const padding = {
    top: 12,
    right: denseXLabels ? 16 : 12,
    bottom: denseXLabels ? 36 : 16,
    left: 44,
  }
  const svgHeight = props.height + (denseXLabels ? 12 : 0)
  const width = Math.max(1, Math.floor(containerWidth.value || 0))
  const keys = props.series.map((item) => item.key)
  const rawMax = dataMax(points, keys)
  const max = niceIntegerMax(rawMax)
  const hasSeries = rawMax > 0
  const innerW = Math.max(1, width - padding.left - padding.right)
  const innerH = svgHeight - padding.top - padding.bottom
  const xCount = points.length > 0 ? points.length : Math.max(1, Number(props.xCount) || 10)
  const step = xCount > 1 ? innerW / (xCount - 1) : innerW

  const seriesPaths = !hasSeries ? [] : props.series.map((item, seriesIndex) => {
    const lower = []
    const upper = []
    for (let i = 0; i < points.length; i += 1) {
      const point = points[i]
      let below = 0
      for (let s = 0; s < seriesIndex; s += 1) {
        below += Number(point[props.series[s].key] || 0)
      }
      const value = Number(point[item.key] || 0)
      const x = padding.left + i * step
      const yLow = padding.top + innerH - (below / max) * innerH
      const yHigh = padding.top + innerH - ((below + value) / max) * innerH
      lower.push([x, yLow])
      upper.push([x, yHigh])
    }

    const completeCount = points.filter((p) => p.complete).length
    const buildArea = (from, to) => {
      if (to <= from) return ''
      const top = upper.slice(from, to + 1)
      const bottom = lower.slice(from, to + 1).reverse()
      const d = [
        `M ${top[0][0]} ${top[0][1]}`,
        ...top.slice(1).map((p) => `L ${p[0]} ${p[1]}`),
        ...bottom.map((p) => `L ${p[0]} ${p[1]}`),
        'Z',
      ].join(' ')
      return d
    }
    const buildLine = (from, to) => {
      if (to <= from) return ''
      const top = upper.slice(from, to + 1)
      return top.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')
    }

    const lastCompleteIndex = completeCount > 0 ? completeCount - 1 : -1
    return {
      ...item,
      completeArea: lastCompleteIndex >= 1 ? buildArea(0, lastCompleteIndex) : '',
      completeLine: lastCompleteIndex >= 1 ? buildLine(0, lastCompleteIndex) : '',
      incompleteLine:
        lastCompleteIndex >= 0 && lastCompleteIndex < points.length - 1
          ? buildLine(lastCompleteIndex, points.length - 1)
          : points.length > 1 && lastCompleteIndex < 0
            ? buildLine(0, points.length - 1)
            : '',
    }
  })

  const xLabels = points.map((point, idx) => ({
    x: padding.left + idx * step,
    y: padding.top + innerH + (denseXLabels ? 10 : 12),
    text: point.label || '',
  }))

  const yTicks = integerTicks(max)
  const yLabels = yTicks.map((value) => ({
    y: padding.top + innerH - (value / max) * innerH,
    text: String(value),
  }))

  const xGrid = []
  for (let i = 0; i < xCount; i += 1) {
    xGrid.push(padding.left + i * step)
  }

  return {
    width,
    seriesPaths,
    xLabels,
    yLabels,
    xGrid,
    yGrid: yLabels.map((label) => label.y),
    padding,
    svgHeight,
    denseXLabels,
    axis: {
      x1: padding.left,
      y1: padding.top,
      x2: padding.left + innerW,
      y2: padding.top + innerH,
    },
  }
})
</script>

<template>
  <div
    ref="root"
    class="w-full min-w-0"
    :style="{ minHeight: `${chart.svgHeight}px` }"
  >
    <svg
      v-if="chart.width > 0"
      :viewBox="`0 0 ${chart.width} ${chart.svgHeight}`"
      class="block w-full"
      :style="{ height: `${chart.svgHeight}px` }"
      role="img"
    >
      <g class="stroke-border" opacity="0.45">
        <line
          v-for="(x, idx) in chart.xGrid"
          :key="`vx-${idx}`"
          :x1="x"
          :y1="chart.axis.y1"
          :x2="x"
          :y2="chart.axis.y2"
          stroke-width="1"
        />
        <line
          v-for="(y, idx) in chart.yGrid"
          :key="`hy-${idx}`"
          :x1="chart.axis.x1"
          :y1="y"
          :x2="chart.axis.x2"
          :y2="y"
          stroke-width="1"
        />
      </g>
      <line
        :x1="chart.axis.x1"
        :y1="chart.axis.y1"
        :x2="chart.axis.x1"
        :y2="chart.axis.y2"
        class="stroke-border"
        stroke-width="1"
      />
      <line
        :x1="chart.axis.x1"
        :y1="chart.axis.y2"
        :x2="chart.axis.x2"
        :y2="chart.axis.y2"
        class="stroke-border"
        stroke-width="1"
      />
      <g
        v-for="item in chart.seriesPaths"
        :key="item.key"
      >
        <path
          v-if="item.completeArea"
          :d="item.completeArea"
          :fill="item.fill || item.color"
          opacity="0.18"
        />
        <path
          v-if="item.completeLine"
          :d="item.completeLine"
          fill="none"
          :stroke="item.color"
          stroke-width="2"
        />
        <path
          v-if="item.incompleteLine"
          :d="item.incompleteLine"
          fill="none"
          :stroke="item.color"
          stroke-width="2"
          stroke-dasharray="5 4"
        />
      </g>
      <g
        v-for="label in chart.yLabels"
        :key="`y-${label.y}-${label.text}`"
      >
        <text
          :x="chart.padding.left - 8"
          :y="label.y + 3"
          text-anchor="end"
          class="fill-muted-foreground text-[10px]"
        >
          {{ label.text }}
        </text>
      </g>
      <g
        v-for="(label, idx) in chart.xLabels"
        :key="`x-${idx}`"
      >
        <text
          :x="label.x"
          :y="label.y"
          :text-anchor="chart.denseXLabels ? 'end' : 'middle'"
          :transform="chart.denseXLabels ? `rotate(-60 ${label.x} ${label.y})` : undefined"
          class="fill-muted-foreground text-[9px]"
        >
          {{ label.text }}
        </text>
      </g>
    </svg>
  </div>
</template>
