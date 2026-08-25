<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import VChart from 'vue-echarts'
import { Ip2Region, type IpSearcher } from './utils/ip2region'
import { analyze, serverCoord, type AnalyzeResult } from './utils/analyze'

const DB_URL = '/data/ip2region.xdb'

const db = ref<IpSearcher | null>(null)
const dbLoading = ref(true)
const dbError = ref('')

const serverLoc = ref('北京')
const result = ref<AnalyzeResult | null>(null)
const fileName = ref('')
const analyzing = ref(false)
const dragOver = ref(false)
const fileInput = ref<HTMLInputElement>()

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

onMounted(async () => {
  try {
    db.value = await Ip2Region.create(DB_URL)
  } catch (e) {
    dbError.value = e instanceof Error ? e.message : String(e)
  } finally {
    dbLoading.value = false
  }
})

function genSample(): string {
  const lines: string[] = []
  const n = 3000
  for (let i = 0; i < n; i++) {
    const ip = SAMPLE_IPS[Math.floor(Math.random() * SAMPLE_IPS.length)]
    const method = METHODS[Math.floor(Math.random() * METHODS.length)]
    const path = PATHS[Math.floor(Math.random() * PATHS.length)]
    const status = STATUSES[Math.floor(Math.random() * STATUSES.length)]
    const t = new Date(Date.now() - Math.random() * 86400000).toUTCString()
    lines.push(
      `${ip} - - [${t}] "${method} ${path} HTTP/1.1" ${status} ${Math.floor(Math.random() * 5000)} "-" "Mozilla/5.0"`
    )
  }
  return lines.join('\n')
}

async function runAnalyze(text: string) {
  if (!db.value) return
  analyzing.value = true
  // 让 UI 先渲染 loading
  await new Promise((r) => setTimeout(r, 30))
  try {
    result.value = analyze(text, db.value, serverLoc.value)
  } finally {
    analyzing.value = false
  }
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  fileName.value = file.name
  const text = await file.text()
  await runAnalyze(text)
}

async function onDrop(e: DragEvent) {
  e.preventDefault()
  dragOver.value = false
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

function statusClass(code: string): string {
  if (code.startsWith('2')) return 's2'
  if (code.startsWith('3')) return 's3'
  if (code.startsWith('4')) return 's4'
  return 's5'
}

const mapOption = computed(() => {
  if (!result.value) return {}
  const server = serverCoord(serverLoc.value)
  const provinces = result.value.provinces

  // 按数量排名分成 5 级(quantile 分级), 保证任何分布下视觉层级都清晰
  const K = 5
  const n = provinces.length
  const LEVEL_WIDTH = [9, 6.5, 4.5, 3, 1.6]
  const LEVEL_BLUR = [16, 12, 9, 6, 3]
  const LEVEL_STRANDS = [5, 3, 2, 1, 1] // 每级飞线股数: 流量越大线条越多
  // 白 -> 红 梯度: t=1 最红(量大), t=0 近白(量小)
  const mixWhiteRed = (t: number) =>
    `rgb(230, ${Math.round(255 - t * 225)}, ${Math.round(255 - t * 205)})`
  const LEVEL_COLOR = Array.from({ length: K }, (_, i) => mixWhiteRed(1 - i / (K - 1)))
  const LEVEL_SHADOW = Array.from({ length: K }, (_, i) =>
    `rgba(230, ${Math.round(60 + (i / (K - 1)) * 195)}, ${Math.round(50 + (i / (K - 1)) * 205)}, 0.6)`
  )

  const linesData = provinces.flatMap((p, i) => {
    const level = Math.min(K - 1, Math.floor((i / n) * K))
    const strands = LEVEL_STRANDS[level]
    return Array.from({ length: strands }, (_, s) => ({
      coords: [
        // 起点轻微抖动, 让多股线在视觉上分开
        [p.coord[0] + (Math.random() - 0.5) * 1.4, p.coord[1] + (Math.random() - 0.5) * 1.4],
        server
      ],
      value: p.count,
      name: p.name,
      level,
      lineStyle: { curveness: 0.22 + (s % 5) * 0.05 } // 不同弧度形成扇形束
    }))
  })
  const pointsData = provinces.map((p) => ({
    name: p.name,
    value: [...p.coord, p.count]
  }))

  return {
    backgroundColor: 'transparent',
    title: {
      text: 'Nginx 访问 IP 来源 · 飞线图',
      left: 'center',
      textStyle: { color: '#e6edf3', fontSize: 16 }
    },
    tooltip: {
      trigger: 'item',
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
          period: 4.5,
          trailLength: 0.5,
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
        symbolSize: (val: number[]) => Math.max(5, Math.sqrt(val[2] / maxCount.value) * 32),
        itemStyle: { color: '#ff7a45' },
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
          <h1>IP 来源分析</h1>
          <p>Nginx 日志 · 飞线可视化</p>
        </div>
      </header>

      <section class="panel">
        <div class="field">
          <label>服务器位置</label>
          <input v-model="serverLoc" placeholder="省份名 或 lng,lat，如 北京" />
        </div>

        <div
          class="drop"
          :class="{ over: dragOver }"
          @dragover.prevent="dragOver = true"
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
            <p>拖入 access.log 到此处</p>
          </template>
          <p v-else class="file">{{ fileName }}</p>
          <button class="btn ghost" @click="fileInput?.click()">
            选择日志文件
          </button>
        </div>

        <div class="actions">
          <button class="btn primary" :disabled="!db || dbLoading" @click="onSample">
            {{ dbLoading ? '数据库加载中…' : '载入示例数据' }}
          </button>
        </div>

        <div v-if="dbError" class="hint err">数据库加载失败: {{ dbError }}</div>
      </section>

      <section v-if="result" class="panel stats">
        <div class="stat-grid">
          <div class="stat"><b>{{ result.provinces.length }}</b><span>覆盖省份</span></div>
          <div class="stat"><b>{{ result.parsedLines.toLocaleString() }}</b><span>解析行数</span></div>
          <div class="stat"><b class="warn">{{ result.foreign }}</b><span>海外/未知</span></div>
          <div class="stat"><b :class="{ warn: result.unknown > 0 }">{{ result.unknown }}</b><span>无法解析</span></div>
        </div>

        <h3>省份 Top 12</h3>
        <ul class="list">
          <li v-for="(p, i) in result.provinces.slice(0, 12)" :key="p.name">
            <span class="rank" :class="'r' + (i < 3 ? i + 1 : 0)">{{ i + 1 }}</span>
            <span class="name">{{ p.name }}</span>
            <i class="bar"><i :style="{ width: (p.count / maxCount) * 100 + '%' }"></i></i>
            <span class="num">{{ p.count.toLocaleString() }}</span>
          </li>
        </ul>

        <h3>状态码</h3>
        <ul class="list codes">
          <li v-for="s in result.status" :key="s.code">
            <span class="chip" :class="statusClass(s.code)">{{ s.code }}</span>
            <span class="num">{{ s.count.toLocaleString() }}</span>
          </li>
        </ul>
      </section>
    </aside>

    <main class="map">
      <VChart v-if="result" :option="mapOption" autoresize class="chart" />
      <div v-else class="placeholder">
        <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3.5 9h17M3.5 15h17M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
        <p>加载日志后在此显示 IP 飞线地图</p>
        <p class="sub">支持拖拽 nginx access.log（combined 格式）· 数据仅在本机处理</p>
      </div>
      <footer v-if="result" class="tips">滚轮缩放 · 拖拽平移 · 悬停查看数值</footer>
      <div v-if="analyzing" class="overlay"><span class="spin"></span>分析中…</div>
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

.panel {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 14px;
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
  padding: 5px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.codes li {
  grid-template-columns: 48px 1fr;
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
