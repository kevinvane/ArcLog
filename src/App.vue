<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import VChart from 'vue-echarts'
import { serverCoord, type AnalyzeResult } from './utils/analyze'
import { SERVER_REGIONS } from './utils/geo'
import type { CityStat } from './utils/analyze'

const DB_URL = '/data/ip2region.xdb'

const dbLoading = ref(true)
const dbError = ref('') // 数据库加载失败
const runError = ref('') // 运行期错误(解析/聚合阶段)
const canLoad = computed(() => !dbLoading.value && !dbError.value)
const selectedRegion = ref('华东1（杭州）')
const serverLoc = computed(
  () => SERVER_REGIONS.find((r) => r.label === selectedRegion.value)?.city ?? '杭州'
)
const result = ref<AnalyzeResult | null>(null)
const fileName = ref('')
const analyzing = ref(false)
const dragOver = ref(false)
const fileInput = ref<HTMLInputElement>()
const parseProgress = ref<number | null>(null)

// ---------- Worker 通信 ----------
let worker: Worker | null = null

function onWorkerMessage(e: MessageEvent) {
  const msg = e.data
  switch (msg.type) {
    case 'dbReady':
      dbLoading.value = false
      break
    case 'dbError':
      dbError.value = msg.message
      dbLoading.value = false
      analyzing.value = false
      break
    case 'error':
      runError.value = msg.message
      analyzing.value = false
      parseProgress.value = null
      break
    case 'progress':
      parseProgress.value = msg.total ? Math.round((msg.done / msg.total) * 100) : null
      break
    case 'result':
      result.value = msg.result
      runError.value = ''
      analyzing.value = false
      parseProgress.value = null
      break
  }
}

onMounted(() => {
  try {
    worker = new Worker(new URL('./worker/analyzer.worker.ts', import.meta.url), {
      type: 'module'
    })
    worker.onmessage = onWorkerMessage
    worker.onerror = (e) => {
      const message = `Worker 异常: ${e.message}`
      if (dbLoading.value) dbError.value = message
      else runError.value = message
      dbLoading.value = false
      analyzing.value = false
    }
    worker.postMessage({ type: 'load', url: DB_URL })
  } catch (e) {
    dbError.value = e instanceof Error ? e.message : String(e)
    dbLoading.value = false
  }
})

onBeforeUnmount(() => {
  stopPlay()
  worker?.terminate()
  worker = null
})

const SAMPLE_IPS = [
  '114.114.114.114', '223.5.5.5', '223.6.6.6', '119.29.29.29', '101.226.4.6',
  '202.96.128.86', '125.39.174.17', '183.232.231.174', '36.110.213.54', '60.10.14.1',
  '1.202.96.1', '218.30.64.1', '202.38.64.1', '211.136.17.7', '120.55.1.1',
  '47.92.1.1', '106.11.1.1', '112.74.1.1', '115.239.1.1', '124.232.1.1',
  '171.8.1.1', '175.6.1.1', '180.97.1.1', '182.61.1.1', '210.21.1.1',
  '218.18.1.1', '221.4.1.1', '222.85.1.1', '59.51.1.1'
]

const PATHS = ['/', '/index.html', '/api/login', '/api/user', '/static/app.js', '/favicon.ico', '/admin', '/api/data']
const STATUSES = ['200', '200', '200', '304', '404', '301', '500']
const METHODS = ['GET', 'POST', 'GET', 'HEAD']
const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)',
  'curl/8.4.0'
]

function genSample(): string {
  const lines: string[] = []
  const n = 3000
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const p = (x: number) => String(x).padStart(2, '0')
  for (let i = 0; i < n; i++) {
    const ip = SAMPLE_IPS[Math.floor(Math.random() * SAMPLE_IPS.length)]
    const method = METHODS[Math.floor(Math.random() * METHODS.length)]
    const path = PATHS[Math.floor(Math.random() * PATHS.length)]
    const status = STATUSES[Math.floor(Math.random() * STATUSES.length)]
    const ua = UAS[Math.floor(Math.random() * UAS.length)]
    const d = new Date(Date.now() - Math.random() * 86400000)
    // nginx time_local 格式, 保证时间轴可解析
    const t = `${p(d.getDate())}/${MON[d.getMonth()]}/${d.getFullYear()}:${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} +0800`
    lines.push(
      `${ip} - - [${t}] "${method} ${path} HTTP/1.1" ${status} ${Math.floor(Math.random() * 5000)} "-" "${ua}"`
    )
  }
  return lines.join('\n')
}

function runAnalyze(text: string) {
  if (!worker || dbLoading.value || dbError.value) return
  analyzing.value = true
  worker.postMessage({
    type: 'analyze',
    text,
    filters: {
      status: statusFilter.value,
      province: provinceFilter.value,
      isp: ispFilter.value
    }
  })
}

// ---------- 过滤联动 ----------
const statusFilter = ref<string | null>(null)
const provinceFilter = ref<string | null>(null)
const ispFilter = ref<string | null>(null)

function recompute() {
  if (!worker || !result.value) return
  analyzing.value = true
  worker.postMessage({
    type: 'refilter',
    filters: {
      status: statusFilter.value,
      province: provinceFilter.value,
      isp: ispFilter.value
    }
  })
}

watch([statusFilter, provinceFilter, ispFilter], recompute)

function toggleStatus(code: string) {
  statusFilter.value = statusFilter.value === code ? null : code
}
function toggleProvince(name: string) {
  provinceFilter.value = provinceFilter.value === name ? null : name
}
function toggleIsp(name: string) {
  ispFilter.value = ispFilter.value === name ? null : name
}
function clearFilters() {
  statusFilter.value = null
  provinceFilter.value = null
  ispFilter.value = null
}
const hasFilter = computed(
  () => !!(statusFilter.value || provinceFilter.value || ispFilter.value)
)

// ---------- 时间轴回放 ----------
const playIndex = ref<number | null>(null) // null = 总览
const playing = ref(false)
let playTimer: number | null = null

function stopPlay() {
  playing.value = false
  if (playTimer != null) {
    clearInterval(playTimer)
    playTimer = null
  }
}

function togglePlay() {
  const tl = result.value?.timeline
  if (!tl) return
  if (playing.value) {
    stopPlay()
    return
  }
  if (playIndex.value == null) playIndex.value = 0
  playing.value = true
  playTimer = window.setInterval(() => {
    const t = result.value?.timeline
    if (!t || playIndex.value == null) return stopPlay()
    playIndex.value = (playIndex.value + 1) % t.buckets.length
  }, 1000)
}

function onSlide(e: Event) {
  stopPlay()
  playIndex.value = +(e.target as HTMLInputElement).value
}

// 新结果(新文件/过滤切换)时重置回总览
watch(result, () => {
  stopPlay()
  playIndex.value = null
})

function fmtBucket(ts: number, gran: 'hour' | 'day'): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  if (gran === 'hour') return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:00`
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const timeLabel = computed(() => {
  const tl = result.value?.timeline
  if (!tl) return ''
  if (playIndex.value == null)
    return `总览 · ${tl.granularity === 'hour' ? '按小时' : '按天'}`
  return fmtBucket(tl.buckets[playIndex.value], tl.granularity)
})

async function onFile(e: Event) {
  if (!canLoad.value) return
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = '' // 允许重复选择同一文件
  fileName.value = file.name
  const text = await file.text()
  await runAnalyze(text)
}

async function onDrop(e: DragEvent) {
  e.preventDefault()
  dragOver.value = false
  if (!canLoad.value) return
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  fileName.value = file.name
  const text = await file.text()
  await runAnalyze(text)
}

async function onSample() {
  fileName.value = 'sample.log (示例数据)'
  await runAnalyze(genSample())
}

const maxCount = computed(() =>
  result.value ? Math.max(1, ...result.value.provinces.map((p) => p.count)) : 1
)

// ---------- 导出 ----------
function triggerDownload(href: string, name: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = name
  a.click()
}

function exportPng() {
  const inst = chartComp.value?.chart
  if (!inst) return
  const url = inst.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#0a0e17' })
  triggerDownload(url, `arclog-${new Date().toISOString().slice(0, 10)}.png`)
}

function exportCsv() {
  if (!result.value) return
  const r = result.value
  // 防公式注入: 路径等字段来自日志(不可信), 以 =+-@ 开头的值前置单引号
  const q = (v: unknown) => {
    let s = String(v ?? '').replace(/"/g, '""')
    if (/^[=+\-@\t\r]/.test(s)) s = `'` + s
    return `"${s}"`
  }
  const lines: string[] = []
  lines.push('省份,请求数')
  r.provinces.forEach((p) => lines.push(`${q(p.name)},${p.count}`))
  lines.push('')
  lines.push('城市,所属省份,请求数')
  r.cities.forEach((c) => lines.push(`${q(c.name)},${q(c.province)},${c.count}`))
  lines.push('')
  lines.push('状态码,次数')
  r.status.forEach((s) => lines.push(`${q(s.code)},${s.count}`))
  lines.push('')
  lines.push('运营商,请求数')
  r.isps.forEach((i) => lines.push(`${q(i.name)},${i.count}`))
  lines.push('')
  lines.push('客户端,请求数')
  r.uas.forEach((u) => lines.push(`${q(u.name)},${u.count}`))
  lines.push('')
  lines.push('请求路径,次数')
  r.topPaths.forEach((t) => lines.push(`${q(t.path)},${t.count}`))
  lines.push('')
  lines.push('可疑IP,请求数,错误数,错误占比,主要路径')
  r.suspects.forEach((s) =>
    lines.push(`${q(s.ip)},${s.count},${s.errCount},${(s.errRatio * 100).toFixed(1)}%,${q(s.topPath)}`)
  )
  const bom = '\uFEFF'
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  triggerDownload(url, `nginx-stats-${new Date().toISOString().slice(0, 10)}.csv`)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// 单文件 HTML 报告: 地图快照 + 全部统计, 可直接发送给他人离线查看
function exportHtml() {
  const r = result.value
  if (!r) return
  const inst = chartComp.value?.chart
  const png = inst
    ? inst.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#0a0e17' })
    : ''
  const esc = (s: unknown) =>
    String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
  const table = (title: string, head: string[], rows: (string | number)[][]) =>
    rows.length
      ? `<h2>${esc(title)}</h2><table><thead><tr>${head
          .map((h) => `<th>${esc(h)}</th>`)
          .join('')}</tr></thead><tbody>${rows
          .map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`
      : ''

  const filters = [
    statusFilter.value && `状态码 ${statusFilter.value}`,
    provinceFilter.value && `省份 ${provinceFilter.value}`,
    ispFilter.value && `运营商 ${ispFilter.value}`
  ].filter(Boolean)

  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>ArcLog 分析报告 - ${esc(fileName.value || '未命名')}</title>
<style>
body{background:#0a0e17;color:#e8edf5;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;margin:0;padding:32px}
.wrap{max-width:960px;margin:0 auto}
h1{font-size:22px;margin:0 0 4px}
h2{font-size:15px;border-bottom:1px solid #24304a;padding-bottom:6px;margin:28px 0 10px}
.meta{color:#77839b;font-size:12px;margin-bottom:20px}
img{width:100%;border-radius:12px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #1c2740}
th{color:#93a1ba;font-weight:600}
td:last-child,th:last-child{text-align:right;font-variant-numeric:tabular-nums}
.tag{display:inline-block;background:rgba(255,77,94,.15);color:#ffb3bb;border-radius:6px;padding:2px 8px;font-size:12px;margin-right:6px}
footer{margin-top:36px;color:#5d6b85;font-size:11px;text-align:center}
</style></head><body><div class="wrap">
<h1>ArcLog · 访问来源分析报告</h1>
<div class="meta">生成于 ${new Date().toLocaleString()} · 文件: ${esc(fileName.value)} · 共 ${r.totalLines.toLocaleString()} 行${
    filters.length ? ` · 筛选: ${filters.map(esc).join(' / ')}` : ''
  }</div>
${png ? `<img src="${png}" alt="飞线地图">` : ''}
${table('省份分布', ['省份', '请求数'], r.provinces.map((p) => [p.name, p.count]))}
${table('城市 Top 20', ['城市', '所属省', '请求数'], r.cities.slice(0, 20).map((c) => [c.name, c.province, c.count]))}
${table('状态码', ['状态码', '次数'], r.status.map((s) => [s.code, s.count]))}
${table('运营商', ['运营商', '请求数'], r.isps.map((i) => [i.name, i.count]))}
${table('客户端', ['类型', '请求数'], r.uas.map((u) => [u.name, u.count]))}
${table('路径 Top 10', ['路径', '次数'], r.topPaths.map((t) => [t.path, t.count]))}
${table(
    '可疑 IP',
    ['IP', '请求数', '错误数', '错误占比', '主要路径'],
    r.suspects.map((s) => [s.ip, s.count, s.errCount, (s.errRatio * 100).toFixed(1) + '%', s.topPath])
  )}
<footer>由 ArcLog 生成 · 数据仅来源于所分析的日志文件</footer>
</div></body></html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  triggerDownload(url, `arclog-report-${new Date().toISOString().slice(0, 10)}.html`)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const maxIspCount = computed(() =>
  result.value ? Math.max(1, ...result.value.isps.map((x) => x.count)) : 1
)

const maxUaCount = computed(() =>
  result.value ? Math.max(1, ...result.value.uas.map((x) => x.count)) : 1
)

const alertProvinceSet = computed(
  () => new Set(result.value ? result.value.alertedProvinces : [])
)

// ---------- 飞线密度控制 ----------
type DensityKey = 'sparse' | 'normal' | 'dense'
const DENSITY_STRANDS: Record<DensityKey, number[]> = {
  sparse: [2, 1, 1, 1, 1], // 每级股数
  normal: [4, 2, 1, 1, 1],
  dense: [6, 4, 3, 2, 1]
}
const DENSITY_OPTIONS: { label: string; value: DensityKey }[] = [
  { label: '稀疏', value: 'sparse' },
  { label: '适中', value: 'normal' },
  { label: '密集', value: 'dense' }
]
const lineDensity = ref<DensityKey>('sparse')

function statusClass(code: string): string {
  if (code.startsWith('2')) return 's2'
  if (code.startsWith('3')) return 's3'
  if (code.startsWith('4')) return 's4'
  return 's5'
}

// ---------- 地图 <-> 榜单 联动高亮 ----------
const chartComp = ref<any>()
const hoveredProvince = ref<string | null>(null)
let currentHighlighted: string | null = null

function onMapOver(params: any) {
  const name =
    params.componentType === 'geo'
      ? params.name
      : params.seriesName === '来源'
        ? (params.data && params.data.name)
        : null
  if (!name || !name.trim()) return
  hoveredProvince.value = name
  nextTick(() => {
    document.getElementById('prov-' + name)?.scrollIntoView({ block: 'nearest' })
  })
}

function onMapOut() {
  hoveredProvince.value = null
}

function highlightOnMap(name: string | null) {
  hoveredProvince.value = name
  // vue-echarts v8 通过 expose({ chart }) 暴露实例, 模板 ref 上没有 $el
  const inst = chartComp.value?.chart ?? null
  if (!inst) return
  try {
    if (currentHighlighted && currentHighlighted !== name) {
      inst.dispatchAction({ type: 'downplay', geoIndex: 0, name: currentHighlighted })
    }
    if (name && name !== currentHighlighted) {
      inst.dispatchAction({ type: 'highlight', geoIndex: 0, name })
    }
  } catch {
    /* 忽略不支持的高亮动作 */
  }
  currentHighlighted = name
}

const mapOption = computed(() => {
  if (!result.value) return {}
  const server = serverCoord(serverLoc.value)
  // 城市级飞线: 回放模式下取当前时间片的分时计数, 否则用总览
  const tl = result.value.timeline
  const bi = playIndex.value
  let origins: CityStat[]
  if (tl && bi != null) {
    origins = tl.cities
      .map((c) => ({ name: c.name, province: c.province, coord: c.coord, count: c.counts[bi] || 0 }))
      .filter((o) => o.count > 0)
    origins.sort((a, b) => b.count - a.count)
  } else {
    origins = result.value.cities
  }
  const localMax = Math.max(1, ...origins.map((o) => o.count))

  // 按数量排名分成 5 级(quantile 分级), 保证任何分布下视觉层级都清晰
  const K = 5
  const n = origins.length
  const LEVEL_WIDTH = [9, 6.5, 4.5, 3, 1.6]
  const LEVEL_BLUR = [16, 12, 9, 6, 3]
  // 白 -> 红 梯度: t=1 最红(量大), t=0 近白(量小)
  const mixWhiteRed = (t: number) =>
    `rgb(230, ${Math.round(255 - t * 225)}, ${Math.round(255 - t * 205)})`
  const LEVEL_COLOR = Array.from({ length: K }, (_, i) => mixWhiteRed(1 - i / (K - 1)))
  const LEVEL_SHADOW = Array.from({ length: K }, (_, i) =>
    `rgba(230, ${Math.round(60 + (i / (K - 1)) * 195)}, ${Math.round(50 + (i / (K - 1)) * 205)}, 0.6)`
  )

  const linesData = origins.flatMap((p, i) => {
    const level = Math.min(K - 1, Math.floor((i / n) * K))
    const strands = DENSITY_STRANDS[lineDensity.value][level]
    // 确定性 hash: 同一城市抖动恒定, 重算时线束不跳变
    let h = 0
    for (let c = 0; c < p.name.length; c++) h = (h * 31 + p.name.charCodeAt(c)) | 0
    return Array.from({ length: strands }, (_, s) => ({
      coords: [
        // 起点轻微抖动, 让多股线在视觉上分开
        [
          p.coord[0] + (((h + s * 97) % 100) / 100 - 0.5) * 1.4,
          p.coord[1] + (((h + s * 53) % 100) / 100 - 0.5) * 1.4
        ],
        server
      ],
      value: p.count,
      name: `${p.name} (${p.province})`,
      level,
      lineStyle: { curveness: 0.22 + (s % 5) * 0.05 } // 不同弧度形成扇形束
    }))
  })
  const pointsData = origins.map((p) => ({
    name: `${p.name} (${p.province})`,
    value: [...p.coord, p.count],
    alert: alertProvinceSet.value.has(p.province)
  }))

  return {
    backgroundColor: 'transparent',
    title: {
      text: 'ArcLog · 访问来源飞线图',
      left: 'center',
      top: 14,
      textStyle: { color: '#c7d2e4', fontSize: 15, fontWeight: 600, letterSpacing: 1 }
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(13, 18, 30, 0.92)',
      borderColor: 'rgba(255, 255, 255, 0.12)',
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: '#e8edf5', fontSize: 12 },
      extraCssText:
        'border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.45); backdrop-filter:blur(4px);',
      formatter: (p: any) => {
        const d = p.data
        if (d && Array.isArray(d.coords)) return `${d.name}<br/>访问次数: ${d.value}`
        if (p.seriesName === '服务器') return '服务器位置'
        if (p.seriesName === '来源' && d?.value)
          return `${d.name}<br/>访问: ${d.value[2]}`
        return p.name || ''
      }
    },
    geo: {
      map: 'china',
      roam: true,
      zoom: 1.15,
      scaleLimit: { min: 1, max: 8 },
      label: { show: false },
      itemStyle: {
        areaColor: '#1b2436',
        borderColor: '#3a4a66'
      },
      emphasis: {
        itemStyle: { areaColor: '#2a3a55' },
        label: { show: false }
      }
    },
    series: [
      {
        name: '飞线',
        type: 'lines',
        coordinateSystem: 'geo',
        zlevel: 2,
        effect: {
          show: true,
          // 回放模式: 周期略短于时间片(1s), 保证箭头在切换前飞完全程
          period: tl && bi != null ? 0.85 : 4.5,
          trailLength: tl && bi != null ? 0.35 : 0.5,
          symbol: 'arrow',
          symbolSize: 6,
          loop: true
        },
        lineStyle: {
          color: (params: any) => LEVEL_COLOR[params.data?.level ?? 0],
          width: (params: any) => LEVEL_WIDTH[params.data?.level ?? 0],
          opacity: 0.85,
          curveness: 0.3,
          shadowBlur: (params: any) => LEVEL_BLUR[params.data?.level ?? 0],
          shadowColor: (params: any) => LEVEL_SHADOW[params.data?.level ?? 0]
        },
        data: linesData
      },
      {
        name: '来源',
        type: 'effectScatter',
        coordinateSystem: 'geo',
        zlevel: 3,
        rippleEffect: { brushType: 'stroke' },
        symbolSize: (val: number[]) => Math.max(5, Math.sqrt(val[2] / localMax) * 32),
        itemStyle: {
          color: (params: any) => (params.data && params.data.alert ? '#c084fc' : '#ff7a45')
        },
        data: pointsData
      },
      {
        name: '服务器',
        type: 'scatter',
        coordinateSystem: 'geo',
        zlevel: 4,
        symbol: 'pin',
        symbolSize: 34,
        itemStyle: { color: '#00e676' },
        label: { show: true, formatter: '服务器', position: 'top', color: '#fff', fontSize: 11 },
        data: [{ name: '服务器', value: [...server, 0] }]
      }
    ]
  }
})
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <header class="brand">
        <div class="logo">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M3 17c4-8 14 2 18-10" />
            <circle cx="3" cy="17" r="1.6" fill="currentColor" stroke="none" />
            <circle cx="21" cy="7" r="1.6" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <div>
          <h1>ArcLog · 访迹</h1>
          <p>Nginx 访问来源 · 飞线可视化</p>
        </div>
        <a
          class="gh-link"
          href="https://github.com/kevinvane/ArcLog"
          target="_blank"
          rel="noopener"
          title="GitHub 仓库"
        >
          <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
      </header>

      <section class="panel">
        <div class="field">
          <label>服务器位置</label>
          <select v-model="selectedRegion">
            <option v-for="r in SERVER_REGIONS" :key="r.label" :value="r.label">
              {{ r.label }}
            </option>
          </select>
        </div>

        <div class="field">
          <label>飞线密度</label>
          <div class="seg">
            <button
              v-for="d in DENSITY_OPTIONS"
              :key="d.value"
              :class="{ on: lineDensity === d.value }"
              @click="lineDensity = d.value"
            >
              {{ d.label }}
            </button>
          </div>
        </div>

        <div
          class="drop"
          :class="{ over: dragOver, disabled: !canLoad }"
          @dragover.prevent="canLoad && (dragOver = true)"
          @dragleave.prevent="dragOver = false"
          @drop="onDrop"
        >
          <input ref="fileInput" type="file" accept=".log,.txt" @change="onFile" hidden />
          <template v-if="!fileName">
            <div class="drop-icon">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 16V4m0 0-4 4m4-4 4 4" />
                <path d="M4 16v3a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-3" />
              </svg>
            </div>
            <p>{{ dbLoading ? 'IP 数据库加载中…' : '拖入 access.log 到此处' }}</p>
          </template>
          <p v-else class="file">{{ fileName }}</p>
          <button class="btn ghost" @click="fileInput?.click()">
            选择日志文件
          </button>
        </div>

        <div class="actions">
          <button class="btn primary" :disabled="dbLoading || !!dbError" @click="onSample">
            {{ dbLoading ? '数据库加载中…' : '载入示例数据' }}
          </button>
        </div>

        <div v-if="dbError" class="hint err">数据库加载失败: {{ dbError }}</div>
        <div v-else-if="runError" class="hint err">分析出错: {{ runError }}</div>
      </section>

      <section v-if="result" class="panel stats">
        <div v-if="hasFilter" class="filter-bar">
          <span v-if="statusFilter" class="f-chip" @click="statusFilter = null">
            状态码 {{ statusFilter }} ×
          </span>
          <span v-if="provinceFilter" class="f-chip" @click="provinceFilter = null">
            省份 {{ provinceFilter }} ×
          </span>
          <span v-if="ispFilter" class="f-chip" @click="ispFilter = null">
            运营商 {{ ispFilter }} ×
          </span>
          <button class="f-clear" @click="clearFilters">清除</button>
        </div>

        <div class="stat-grid">
          <div class="stat"><b>{{ result.cities.length }}</b><span>覆盖城市</span></div>
          <div class="stat"><b>{{ (hasFilter ? result.matchedLines : result.totalLines).toLocaleString() }}</b><span>{{ hasFilter ? '匹配行数' : '解析行数' }}</span></div>
          <div class="stat"><b class="warn">{{ result.foreign }}</b><span>海外/未知</span></div>
          <div class="stat"><b :class="{ warn: result.unknown > 0 }">{{ result.unknown }}</b><span>无法解析</span></div>
        </div>

        <template v-if="result.suspects.length">
          <h3 class="danger-title">⚠ 可疑来源 Top 10</h3>
          <ul class="list suspects">
            <li v-for="s in result.suspects" :key="s.ip" :title="`主要请求: ${s.topPath}`">
              <span class="ip">{{ s.ip }}</span>
              <span class="meta">
                {{ s.count }} 次 · 错误 {{ (s.errRatio * 100).toFixed(0) }}%
              </span>
            </li>
          </ul>
        </template>

        <h3>省份 Top 12</h3>
        <ul class="list">
          <li
            v-for="(p, i) in result.provinces.slice(0, 12)"
            :key="p.name"
            :id="'prov-' + p.name"
            :class="{ active: hoveredProvince === p.name, sel: provinceFilter === p.name }"
            @mouseenter="highlightOnMap(p.name)"
            @mouseleave="highlightOnMap(null)"
            @click="toggleProvince(p.name)"
          >
            <span class="rank" :class="'r' + (i < 3 ? i + 1 : 0)">{{ i + 1 }}</span>
            <span class="name">
              {{ p.name }}<span v-if="alertProvinceSet.has(p.name)" class="warn-badge">⚠</span>
            </span>
            <i class="bar"><i :style="{ width: (p.count / maxCount) * 100 + '%' }"></i></i>
            <span class="num">{{ p.count.toLocaleString() }}</span>
          </li>
        </ul>

        <h3>状态码</h3>
        <ul class="list codes">
          <li v-for="s in result.status" :key="s.code" @click="toggleStatus(s.code)">
            <span
              class="chip"
              :class="[statusClass(s.code), { dim: statusFilter && statusFilter !== s.code }]"
            >{{ s.code }}</span>
            <span class="num">{{ s.count.toLocaleString() }}</span>
          </li>
        </ul>

        <template v-if="result.isps.length">
          <h3>运营商</h3>
          <ul class="list isps">
            <li
              v-for="isp in result.isps.slice(0, 8)"
              :key="isp.name"
              :title="isp.name"
              :class="{ sel: ispFilter === isp.name }"
              @click="toggleIsp(isp.name)"
            >
              <span class="name">{{ isp.name }}</span>
              <i class="bar"><i :style="{ width: (isp.count / maxIspCount) * 100 + '%' }"></i></i>
              <span class="num">{{ isp.count.toLocaleString() }}</span>
            </li>
          </ul>
        </template>

        <template v-if="result.uas.length">
          <h3>客户端</h3>
          <ul class="list uas">
            <li v-for="u in result.uas.slice(0, 8)" :key="u.name" :title="u.name">
              <span class="name">{{ u.name }}</span>
              <i class="bar"><i :style="{ width: (u.count / maxUaCount) * 100 + '%' }"></i></i>
              <span class="num">{{ u.count.toLocaleString() }}</span>
            </li>
          </ul>
        </template>

        <template v-if="result.topPaths.length">
          <h3>路径 Top 10</h3>
          <ul class="list paths">
            <li v-for="(p, i) in result.topPaths" :key="p.path" :title="p.path">
              <span class="rank" :class="'r' + (i < 3 ? i + 1 : 0)">{{ i + 1 }}</span>
              <span class="path">{{ p.path }}</span>
              <span class="num">{{ p.count.toLocaleString() }}</span>
            </li>
          </ul>
        </template>
      </section>
    </aside>

    <main class="map">
      <div v-if="result" class="chart">
        <VChart
          ref="chartComp"
          :option="mapOption"
          autoresize
          class="chart-inner"
          @mouseover="onMapOver"
          @mouseout="onMapOut"
        />
      </div>
      <div v-else class="placeholder">
        <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3.5 9h17M3.5 15h17M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
        <p>加载日志后在此显示 IP 飞线地图</p>
        <p class="sub">支持拖拽 nginx access.log（combined 格式）· 数据仅在本机处理</p>
      </div>
      <footer v-if="result" class="tips">滚轮缩放 · 拖拽平移 · 悬停查看数值</footer>
      <div v-if="result" class="map-tools">
        <button class="tool-btn" @click="exportPng">导出 PNG</button>
        <button class="tool-btn" @click="exportCsv">导出 CSV</button>
        <button class="tool-btn" @click="exportHtml">导出报告</button>
      </div>
      <div v-if="result" class="legend">
        <span class="lg-title">访问量</span>
        <span class="lg-end">少</span>
        <i class="lg-bar"></i>
        <span class="lg-end">多</span>
      </div>
      <div v-if="result?.timeline" class="timeline">
        <button class="t-btn" @click="togglePlay">{{ playing ? '❚❚' : '▶' }}</button>
        <input
          class="t-slider"
          type="range"
          min="0"
          :max="result.timeline.buckets.length - 1"
          :value="playIndex ?? result.timeline.buckets.length - 1"
          @input="onSlide"
        />
        <span class="t-label">{{ timeLabel }}</span>
      </div>
      <div v-if="analyzing" class="overlay">
        <span class="spin"></span>
        分析中{{ parseProgress != null ? ` ${parseProgress}%` : '…' }}
      </div>
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  background:
    radial-gradient(1200px 600px at 70% 40%, rgba(230, 45, 60, 0.05), transparent 60%),
    #0a0e17;
}

/* ---------- 侧栏 ---------- */
.sidebar {
  width: 340px;
  padding: 20px 18px;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  overflow-y: auto;
  background: rgba(12, 17, 28, 0.9);
  backdrop-filter: blur(6px);
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.logo {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: #fff;
  background: linear-gradient(135deg, #ff4d5e, #b3123f);
  box-shadow: 0 4px 14px rgba(255, 77, 94, 0.35);
}
.brand h1 {
  font-size: 16px;
  margin: 0;
  letter-spacing: 0.5px;
}
.brand p {
  margin: 2px 0 0;
  font-size: 11px;
  color: #77839b;
}
.gh-link {
  margin-left: auto;
  color: #77839b;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  transition: color 0.15s, background 0.15s;
}
.gh-link:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.panel {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 14px;
  animation: rise 0.35s ease both;
}
.panel:nth-of-type(2) {
  animation-delay: 0.08s;
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

.field {
  margin-bottom: 12px;
}
.field label {
  display: block;
  font-size: 11px;
  color: #8b97ad;
  margin-bottom: 6px;
  letter-spacing: 0.3px;
}
.seg {
  display: flex;
  gap: 4px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 3px;
  border-radius: 8px;
}
.seg button {
  flex: 1;
  border-radius: 6px;
  padding: 5px 0;
  font-size: 12px;
  color: #93a1ba;
  transition: background 0.15s, color 0.15s;
}
.seg button:hover:not(.on) {
  background: rgba(255, 255, 255, 0.06);
  color: #e8edf5;
}
.seg button.on {
  color: #fff;
  background: linear-gradient(135deg, #ff4d5e, #c9184a);
}

input {
  width: 100%;
}

.drop {
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  padding: 20px 14px 16px;
  text-align: center;
  transition: border-color 0.15s, background 0.15s;
}
.drop.over {
  border-color: #ff4d5e;
  background: rgba(255, 77, 94, 0.08);
  transform: scale(1.02);
  box-shadow: 0 0 0 4px rgba(255, 77, 94, 0.12);
}
.drop {
  transition: border-color 0.15s, background 0.15s, transform 0.15s, box-shadow 0.15s;
}
.drop.disabled {
  opacity: 0.55;
}
.drop.disabled .btn.ghost {
  opacity: 0.5;
}
.drop-icon {
  color: #5d6b85;
  margin-bottom: 8px;
}
.drop p {
  margin: 0 0 12px;
  font-size: 13px;
  color: #8b97ad;
}
.drop .file {
  color: #e8edf5;
  word-break: break-all;
  font-size: 12px;
}

.actions {
  margin-top: 12px;
}

.btn {
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 13px;
  transition: transform 0.12s, box-shadow 0.12s, background 0.15s;
}
.btn.primary {
  width: 100%;
  color: #fff;
  background: linear-gradient(135deg, #ff4d5e, #c9184a);
  box-shadow: 0 4px 14px rgba(255, 77, 94, 0.3);
}
.btn.primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(255, 77, 94, 0.4);
}
.btn.ghost {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #cdd6e4;
}
.btn.ghost:hover {
  background: rgba(255, 255, 255, 0.06);
}
.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.hint.err {
  margin-top: 10px;
  font-size: 12px;
  color: #ff6b6b;
}

/* ---------- 统计 ---------- */
.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 16px;
}
.stat {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 10px 8px;
  text-align: center;
}
.stat b {
  display: block;
  font-size: 19px;
  font-variant-numeric: tabular-nums;
  color: #ff6675;
}
.stat b.warn {
  color: #ffb020;
}
.stat span {
  font-size: 11px;
  color: #77839b;
}

h3 {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  margin: 4px 0 10px;
  color: #93a1ba;
}

.list {
  list-style: none;
  margin: 0 0 6px;
  padding: 0;
  font-size: 12px;
}
.list li {
  display: grid;
  grid-template-columns: 22px 44px 1fr 58px;
  align-items: center;
  gap: 8px;
  padding: 5px 4px;
  margin: 0 -4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  transition: background 0.15s;
}
.list li:hover,
.list li.active {
  background: rgba(255, 77, 94, 0.12);
}
.list li.active .name {
  color: #fff;
}
.list li.active .bar > i {
  filter: brightness(1.2);
}
.codes li {
  grid-template-columns: 48px 1fr;
  cursor: pointer;
}
.paths li {
  grid-template-columns: 22px 1fr 58px;
}
.isps li {
  grid-template-columns: 64px 1fr 58px;
  cursor: pointer;
}
.uas li {
  grid-template-columns: 64px 1fr 58px;
}
.list li.sel {
  background: rgba(255, 77, 94, 0.16);
  box-shadow: inset 2px 0 0 #ff4d5e;
}
.chip {
  transition: opacity 0.15s, transform 0.12s;
}
.chip:hover {
  transform: translateY(-1px);
}
.chip.dim {
  opacity: 0.3;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.f-chip {
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  color: #ffb3bb;
  background: rgba(255, 77, 94, 0.15);
  border: 1px solid rgba(255, 77, 94, 0.35);
  cursor: pointer;
}
.f-chip:hover {
  background: rgba(255, 77, 94, 0.28);
}
.f-clear {
  margin-left: auto;
  font-size: 11px;
  color: #93a1ba;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 6px;
  padding: 3px 8px;
}
.f-clear:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}
.path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  direction: rtl;
  text-align: left;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 11px;
  color: #c3cee0;
}
.rank {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  font-size: 11px;
  color: #77839b;
  background: rgba(255, 255, 255, 0.05);
}
.rank.r1 { color: #fff; background: linear-gradient(135deg, #ff4d5e, #c9184a); }
.rank.r2 { color: #ffd9dc; background: rgba(255, 77, 94, 0.55); }
.rank.r3 { color: #ffd9dc; background: rgba(255, 77, 94, 0.3); }
.name {
  color: #dfe6f1;
}
.warn-badge {
  margin-left: 4px;
  color: #fbbf24;
  font-size: 11px;
}
.danger-title {
  color: #fb7185;
}
.suspects li {
  grid-template-columns: 1fr auto;
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.suspects .ip {
  font-family: ui-monospace, Consolas, monospace;
  color: #fda4af;
  font-size: 11px;
}
.suspects .meta {
  flex-shrink: 0;
  color: #77839b;
  font-size: 11px;
}
.bar {
  position: relative;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.07);
  overflow: hidden;
}
.bar i {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 2px;
  background: linear-gradient(90deg, #ffb199, #ff4d5e);
  transition: width 0.4s ease;
}
.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: #aab6cb;
}

.chip {
  justify-self: start;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  font-family: ui-monospace, Consolas, monospace;
}
.chip.s2 { color: #4ade80; background: rgba(74, 222, 128, 0.12); }
.chip.s3 { color: #60a5fa; background: rgba(96, 165, 250, 0.12); }
.chip.s4 { color: #fbbf24; background: rgba(251, 191, 36, 0.12); }
.chip.s5 { color: #fb7185; background: rgba(251, 113, 133, 0.15); }

/* ---------- 地图区 ---------- */
.map {
  position: relative;
  flex: 1;
  min-width: 0;
}
.chart {
  position: absolute;
  inset: 0;
}
.chart-inner {
  width: 100%;
  height: 100%;
}
.placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #4d5a72;
}
.placeholder .sub {
  font-size: 12px;
}
.tips {
  position: absolute;
  left: 14px;
  bottom: 12px;
  font-size: 11px;
  color: #5d6b85;
  background: rgba(12, 17, 28, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.07);
  padding: 5px 10px;
  border-radius: 8px;
  pointer-events: none;
}
.map-tools {
  position: absolute;
  top: 14px;
  right: 16px;
  display: flex;
  gap: 8px;
}
.timeline {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(12, 17, 28, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.07);
  padding: 6px 14px;
  border-radius: 8px;
}
.t-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: #fff;
  font-size: 11px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #ff4d5e, #c9184a);
}
.t-slider {
  width: 220px;
  padding: 0;
  border: none;
  background: transparent;
  accent-color: #ff4d5e;
  cursor: pointer;
}
.t-label {
  font-size: 11px;
  color: #aab6cb;
  font-variant-numeric: tabular-nums;
  min-width: 96px;
  text-align: center;
}
.tool-btn {
  font-size: 12px;
  color: #cdd6e4;
  background: rgba(12, 17, 28, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 6px 12px;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.tool-btn:hover {
  color: #fff;
  background: rgba(255, 77, 94, 0.18);
  border-color: rgba(255, 77, 94, 0.45);
}
.legend {
  position: absolute;
  right: 16px;
  bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #8b97ad;
  background: rgba(12, 17, 28, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.07);
  padding: 6px 12px;
  border-radius: 8px;
  pointer-events: none;
}
.lg-title {
  color: #aab6cb;
  margin-right: 2px;
}
.lg-bar {
  width: 90px;
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(90deg, rgb(230, 255, 250), rgb(230, 30, 50));
  box-shadow: 0 0 8px rgba(230, 45, 60, 0.35);
}
.overlay {
  position: absolute;
  inset: 0;
  background: rgba(10, 14, 23, 0.65);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 15px;
  color: #e8edf5;
}
.spin {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: #ff4d5e;
  animation: rotate 0.8s linear infinite;
}
@keyframes rotate {
  to { transform: rotate(360deg); }
}

/* ---------- 滚动条 ---------- */
.sidebar::-webkit-scrollbar {
  width: 8px;
}
.sidebar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}
.sidebar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.18);
}
</style>
