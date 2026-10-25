<script setup>
import { computed, ref } from 'vue'
import { useElementSize } from '@vueuse/core'
import { formatExactNumber, formatStatsAxisNumber } from '@/lib/usage-stats-ui'

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
  leftAxisLabel: {
    type: String,
    default: '',
  },
  rightAxisLabel: {
    type: String,
    default: '',
  },
})

const root = ref(null)
const { width: containerWidth } = useElementSize(root)
const hoverIndex = ref(null)
const emptyYMax = 10

function seriesAxis(item) {
  return item?.yAxis === 'right' ? 'right' : 'left'
}

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

function lastCompletePointIndex(points) {
  let index = points.length - 1
  while (index >= 0 && !points[index].complete) {
    index -= 1
  }
  return index
}

function formatSeriesValue(item, value) {
  if (typeof item.formatValue === 'function') {
    return item.formatValue(value)
  }
  return formatExactNumber(value)
}

const hasDualAxis = computed(() =>
  (props.series || []).some((item) => seriesAxis(item) === 'right') &&
  (props.series || []).some((item) => seriesAxis(item) === 'left'),
)

const legendItems = computed(() => {
  const labeled = (props.series || []).filter((item) => item.label)
  if (hasDualAxis.value) {
    return labeled
  }
  return labeled.length > 1 ? labeled : []
})

const chart = computed(() => {
  const points = props.points || []
  const denseXLabels = points.length > 8
  const dualAxis = hasDualAxis.value
  const leftAxisLabel = String(props.leftAxisLabel || '').trim()
  const rightAxisLabel = String(props.rightAxisLabel || '').trim()
  const padding = {
    top: 12,
    right: dualAxis
      ? rightAxisLabel
        ? 64
        : 48
      : denseXLabels
        ? 16
        : 12,
    bottom: denseXLabels ? 36 : 16,
    left: leftAxisLabel ? 64 : 48,
  }
  const svgHeight = props.height + (denseXLabels ? 12 : 0)
  const width = Math.max(1, Math.floor(containerWidth.value || 0))

  const leftSeries = props.series.filter((item) => seriesAxis(item) === 'left')
  const rightSeries = props.series.filter((item) => seriesAxis(item) === 'right')
  const leftKeys = leftSeries.map((item) => item.key)
  const rightKeys = rightSeries.map((item) => item.key)

  const leftRawMax = dataMax(points, leftKeys)
  const rightRawMax = dataMax(points, rightKeys)
  const leftMax = niceIntegerMax(leftRawMax)
  const rightMax = niceIntegerMax(rightRawMax)
  const hasSeries = leftRawMax > 0 || rightRawMax > 0

  const innerW = Math.max(1, width - padding.left - padding.right)
  const innerH = svgHeight - padding.top - padding.bottom
  const xCount = points.length > 0 ? points.length : Math.max(1, Number(props.xCount) || 10)
  const step = xCount > 1 ? innerW / (xCount - 1) : innerW
  const lastCompleteIndex = lastCompletePointIndex(points)

  const pointXs = points.map((_, i) => padding.left + i * step)

  const axisIndexByKey = new Map()
  leftSeries.forEach((item, index) => {
    axisIndexByKey.set(item.key, { axis: 'left', index, max: leftMax })
  })
  rightSeries.forEach((item, index) => {
    axisIndexByKey.set(item.key, { axis: 'right', index, max: rightMax })
  })

  const seriesPaths = !hasSeries
    ? []
    : props.series.map((item) => {
        const meta = axisIndexByKey.get(item.key)
        const axisMax = meta?.max || leftMax
        const sameAxisSeries =
          meta?.axis === 'right' ? rightSeries : leftSeries
        const seriesIndex = meta?.index ?? 0
        const lower = []
        const upper = []
        let seriesMax = 0
        for (let i = 0; i < points.length; i += 1) {
          const point = points[i]
          let below = 0
          for (let s = 0; s < seriesIndex; s += 1) {
            below += Number(point[sameAxisSeries[s].key] || 0)
          }
          const value = Number(point[item.key] || 0)
          if (value > seriesMax) seriesMax = value
          const x = pointXs[i]
          const yLow = padding.top + innerH - (below / axisMax) * innerH
          const yHigh = padding.top + innerH - ((below + value) / axisMax) * innerH
          lower.push([x, yLow])
          upper.push([x, yHigh])
        }

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

        const drawStroke = seriesMax > 0
        return {
          ...item,
          upper,
          drawStroke,
          completeArea: lastCompleteIndex >= 1 ? buildArea(0, lastCompleteIndex) : '',
          completeLine:
            drawStroke && lastCompleteIndex >= 1 ? buildLine(0, lastCompleteIndex) : '',
          incompleteLine: !drawStroke
            ? ''
            : lastCompleteIndex >= 0 && lastCompleteIndex < points.length - 1
              ? buildLine(lastCompleteIndex, points.length - 1)
              : points.length > 1 && lastCompleteIndex < 0
                ? buildLine(0, points.length - 1)
                : '',
        }
      })

  const xLabels = points.map((point, idx) => ({
    x: pointXs[idx],
    y: padding.top + innerH + (denseXLabels ? 10 : 12),
    text: point.label || '',
  }))

  const leftTicks = integerTicks(leftMax)
  const yLabels = leftTicks.map((value) => ({
    y: padding.top + innerH - (value / leftMax) * innerH,
    text: formatStatsAxisNumber(value),
  }))

  const rightTicks = dualAxis ? integerTicks(rightMax) : []
  const rightYLabels = rightTicks.map((value) => ({
    y: padding.top + innerH - (value / rightMax) * innerH,
    text: formatStatsAxisNumber(value),
  }))

  const xGrid = pointXs.slice()
  if (points.length === 0) {
    for (let i = 0; i < xCount; i += 1) {
      xGrid.push(padding.left + i * step)
    }
  }

  const axisMidY = padding.top + innerH / 2

  return {
    width,
    seriesPaths,
    xLabels,
    yLabels,
    rightYLabels,
    dualAxis,
    leftAxisColor: dualAxis ? leftSeries[0]?.color || null : null,
    rightAxisColor: dualAxis ? rightSeries[0]?.color || null : null,
    leftAxisLabel,
    rightAxisLabel,
    leftAxisTitle: leftAxisLabel
      ? {
          x: 12,
          y: axisMidY,
          transform: `rotate(-90 12 ${axisMidY})`,
        }
      : null,
    rightAxisTitle: rightAxisLabel && dualAxis
      ? {
          x: padding.left + innerW + padding.right - 12,
          y: axisMidY,
          transform: `rotate(90 ${padding.left + innerW + padding.right - 12} ${axisMidY})`,
        }
      : null,
    xGrid,
    yGrid: yLabels.map((label) => label.y),
    padding,
    svgHeight,
    denseXLabels,
    pointXs,
    points,
    step,
    axis: {
      x1: padding.left,
      y1: padding.top,
      x2: padding.left + innerW,
      y2: padding.top + innerH,
    },
  }
})

const hover = computed(() => {
  const index = hoverIndex.value
  if (index == null || index < 0 || index >= chart.value.points.length) {
    return null
  }
  const point = chart.value.points[index]
  const x = chart.value.pointXs[index]
  const rows = props.series.map((item, seriesIndex) => {
    const value = Number(point[item.key] || 0)
    const path = chart.value.seriesPaths[seriesIndex]
    const markerY = path?.upper?.[index]?.[1]
    return {
      key: item.key,
      label: item.label || (props.series.length === 1 ? null : item.key),
      color: item.color,
      value,
      text: formatSeriesValue(item, value),
      markerY,
      showMarker: Boolean(path?.drawStroke),
    }
  })
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  return {
    index,
    x,
    title: point.tooltipLabel || point.label || '',
    incomplete: point.complete === false,
    rows,
    all:
      !hasDualAxis.value && rows.length > 1
        ? {
            text: formatExactNumber(total),
          }
        : null,
  }
})

function clientToSvgX(event) {
  const el = root.value
  if (!el || chart.value.width <= 0) return null
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0) return null
  return ((event.clientX - rect.left) / rect.width) * chart.value.width
}

function nearestPointIndex(svgX) {
  const { pointXs, padding, axis } = chart.value
  if (!pointXs.length) return null
  if (svgX < padding.left || svgX > axis.x2) return null
  let best = 0
  let bestDist = Math.abs(pointXs[0] - svgX)
  for (let i = 1; i < pointXs.length; i += 1) {
    const dist = Math.abs(pointXs[i] - svgX)
    if (dist < bestDist) {
      best = i
      bestDist = dist
    }
  }
  return best
}

function onPointerMove(event) {
  const svgX = clientToSvgX(event)
  if (svgX == null) {
    hoverIndex.value = null
    return
  }
  hoverIndex.value = nearestPointIndex(svgX)
}

function onPointerLeave() {
  hoverIndex.value = null
}

const tooltipStyle = computed(() => {
  if (!hover.value || !root.value || chart.value.width <= 0) return null
  const rectWidth = root.value.getBoundingClientRect().width || chart.value.width
  const scale = rectWidth / chart.value.width
  const leftPx = hover.value.x * scale
  const placeLeft = leftPx > rectWidth * 0.55
  return {
    left: `${leftPx}px`,
    top: `${chart.value.padding.top * scale}px`,
    transform: placeLeft ? 'translate(-100%, 0) translateX(-10px)' : 'translateX(10px)',
  }
})
</script>

<template>
  <div class="w-full min-w-0">
    <div
      v-if="legendItems.length > 0"
      class="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1"
    >
      <div
        v-for="item in legendItems"
        :key="item.key"
        class="flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <span
          class="inline-block h-2 w-2 rounded-sm"
          :style="{ backgroundColor: item.color }"
        />
        <span>{{ item.label }}</span>
      </div>
    </div>
    <div
      ref="root"
      class="relative w-full min-w-0"
      :style="{ minHeight: `${chart.svgHeight}px` }"
      @pointermove="onPointerMove"
      @pointerleave="onPointerLeave"
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
          :class="chart.leftAxisColor ? undefined : 'stroke-border'"
          :stroke="chart.leftAxisColor || undefined"
          stroke-width="1"
        />
        <line
          v-if="chart.dualAxis"
          :x1="chart.axis.x2"
          :y1="chart.axis.y1"
          :x2="chart.axis.x2"
          :y2="chart.axis.y2"
          :class="chart.rightAxisColor ? undefined : 'stroke-border'"
          :stroke="chart.rightAxisColor || undefined"
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
        <path
          v-for="item in chart.seriesPaths.filter((s) => s.completeArea)"
          :key="`area-${item.key}`"
          :d="item.completeArea"
          :fill="item.fill || item.color"
          opacity="0.18"
        />
        <path
          v-for="item in chart.seriesPaths.filter((s) => s.completeLine)"
          :key="`line-${item.key}`"
          :d="item.completeLine"
          fill="none"
          :stroke="item.color"
          stroke-width="2"
        />
        <path
          v-for="item in chart.seriesPaths.filter((s) => s.incompleteLine)"
          :key="`incomplete-${item.key}`"
          :d="item.incompleteLine"
          fill="none"
          :stroke="item.color"
          stroke-width="2"
          stroke-dasharray="5 4"
        />
        <g v-if="hover">
          <line
            :x1="hover.x"
            :y1="chart.axis.y1"
            :x2="hover.x"
            :y2="chart.axis.y2"
            class="stroke-foreground"
            stroke-width="1"
            opacity="0.35"
          />
          <circle
            v-for="row in hover.rows.filter((r) => r.showMarker)"
            :key="`dot-${row.key}`"
            :cx="hover.x"
            :cy="row.markerY"
            r="3.5"
            :fill="row.color"
            class="stroke-background"
            stroke-width="1.5"
          />
        </g>
        <text
          v-if="chart.leftAxisTitle"
          :x="chart.leftAxisTitle.x"
          :y="chart.leftAxisTitle.y"
          :transform="chart.leftAxisTitle.transform"
          text-anchor="middle"
          class="text-[10px] font-medium"
          :class="chart.leftAxisColor ? undefined : 'fill-muted-foreground'"
          :fill="chart.leftAxisColor || undefined"
        >
          {{ chart.leftAxisLabel }}
        </text>
        <g
          v-for="label in chart.yLabels"
          :key="`y-${label.y}-${label.text}`"
        >
          <text
            :x="chart.padding.left - 8"
            :y="label.y + 3"
            text-anchor="end"
            class="text-[10px]"
            :class="chart.leftAxisColor ? undefined : 'fill-muted-foreground'"
            :fill="chart.leftAxisColor || undefined"
          >
            {{ label.text }}
          </text>
        </g>
        <text
          v-if="chart.rightAxisTitle"
          :x="chart.rightAxisTitle.x"
          :y="chart.rightAxisTitle.y"
          :transform="chart.rightAxisTitle.transform"
          text-anchor="middle"
          class="text-[10px] font-medium"
          :class="chart.rightAxisColor ? undefined : 'fill-muted-foreground'"
          :fill="chart.rightAxisColor || undefined"
        >
          {{ chart.rightAxisLabel }}
        </text>
        <g
          v-for="label in chart.rightYLabels"
          :key="`yr-${label.y}-${label.text}`"
        >
          <text
            :x="chart.axis.x2 + 8"
            :y="label.y + 3"
            text-anchor="start"
            class="text-[10px]"
            :class="chart.rightAxisColor ? undefined : 'fill-muted-foreground'"
            :fill="chart.rightAxisColor || undefined"
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

      <div
        v-if="hover && tooltipStyle"
        class="pointer-events-none absolute z-10 min-w-[120px] rounded-md border border-border bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-md"
        :style="tooltipStyle"
      >
        <div
          v-if="hover.title"
          class="mb-1.5 font-medium text-foreground"
        >
          {{ hover.title }}
          <span
            v-if="hover.incomplete"
            class="ml-1 font-normal text-muted-foreground"
          >(current)</span>
        </div>
        <div class="space-y-1">
          <div
            v-for="row in hover.rows"
            :key="`tip-${row.key}`"
            class="flex items-center justify-between gap-4"
          >
            <div class="flex items-center gap-1.5 text-muted-foreground">
              <span
                class="inline-block h-2 w-2 shrink-0 rounded-sm"
                :style="{ backgroundColor: row.color }"
              />
              <span v-if="row.label">{{ row.label }}</span>
            </div>
            <span class="tabular-nums text-foreground">{{ row.text }}</span>
          </div>
          <div
            v-if="hover.all"
            class="flex items-center justify-between gap-4 border-t border-border pt-1"
          >
            <span class="text-muted-foreground">All</span>
            <span class="tabular-nums font-medium text-foreground">{{ hover.all.text }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
