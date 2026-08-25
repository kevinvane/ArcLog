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

const mapOption = computed(() => {
  if (!result.value) return {}
  const server = serverCoord(serverLoc.value)
  const provinces = result.value.provinces

  const linesData = provinces.map((p) => ({
    coords: [p.coord, server],
    value: p.count,
    name: p.name
  }))

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
          period: 5,
          trailLength: 0.25,
          symbol: 'arrow',
          symbolSize: 5
        },
        lineStyle: {
          color: (params: any) => {
            const v = (params.data && params.data.value) || 0
            const max = maxCount.value
            // 对数归一化: 拉开长尾分布下各省的亮度差
            const norm = max > 0 ? Math.log(1 + v) / Math.log(1 + max) : 0
            const hue = 45 // 单一金色色相
            const light = 90 - norm * 60 // 少(浅)90% -> 多(深)30%
            return `hsl(${hue}, 95%, ${light}%)`
          },
          width: (params: any) => {
            const v = (params.data && params.data.value) || 0
            const max = maxCount.value
            const norm = max > 0 ? Math.log(1 + v) / Math.log(1 + max) : 0
            return 0.6 + norm * 3.4 // 少(细)0.6 -> 多(粗)4
          },
          opacity: 0.75,
          curveness: 0.3
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
      <h1>IP 来源分析</h1>

      <div class="field">
        <label>服务器位置（省份名 或 lng,lat）</label>
        <input v-model="serverLoc" placeholder="例如: 北京 或 120.15,30.28" />
      </div>

      <div
        class="drop"
        :class="{ over: dragOver }"
        @dragover.prevent="dragOver = true"
        @dragleave.prevent="dragOver = false"
        @drop="onDrop"
      >
        <p v-if="!fileName">拖入 access.log 到此处</p>
        <p v-else class="file">{{ fileName }}</p>
        <input type="file" accept=".log,.txt" @change="onFile" hidden />
        <button @click="(($event.target as HTMLElement).previousElementSibling as HTMLInputElement)?.click()">
          选择日志文件
        </button>
      </div>

      <div class="actions">
        <button :disabled="!db || dbLoading" @click="onSample">生成示例数据</button>
      </div>

      <div v-if="dbLoading" class="hint">正在加载 IP 数据库…</div>
      <div v-else-if="dbError" class="hint err">数据库加载失败: {{ dbError }}</div>

      <div v-if="result" class="stats">
        <div class="stat-grid">
          <div class="stat"><b>{{ result.provinces.length }}</b><span>覆盖省份</span></div>
          <div class="stat"><b>{{ result.foreign }}</b><span>海外/未知归属</span></div>
          <div class="stat"><b>{{ result.unknown }}</b><span>无法解析</span></div>
          <div class="stat"><b>{{ result.parsedLines }}</b><span>解析行数</span></div>
        </div>

        <h3>省份 Top</h3>
        <ul class="list">
          <li v-for="p in result.provinces.slice(0, 12)" :key="p.name">
            <span>{{ p.name }}</span><span class="num">{{ p.count }}</span>
          </li>
        </ul>

        <h3>状态码</h3>
        <ul class="list">
          <li v-for="s in result.status" :key="s.code">
            <span>{{ s.code }}</span><span class="num">{{ s.count }}</span>
          </li>
        </ul>
      </div>
    </aside>

    <main class="map">
      <VChart v-if="result" :option="mapOption" autoresize class="chart" />
      <div v-else class="placeholder">
        <p>加载日志后在此显示 IP 飞线地图</p>
        <p class="sub">支持拖拽 nginx access.log（combined 格式）</p>
      </div>
      <div v-if="analyzing" class="overlay">分析中…</div>
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
}
.sidebar {
  width: 320px;
  padding: 18px;
  border-right: 1px solid #1f2a3d;
  overflow-y: auto;
  background: #0c111c;
}
.sidebar h1 {
  font-size: 18px;
  margin: 0 0 16px;
}
.field {
  margin-bottom: 14px;
}
.field label {
  display: block;
  font-size: 12px;
  color: #8b9bb4;
  margin-bottom: 6px;
}
.field input {
  width: 100%;
}
.drop {
  border: 1px dashed #3a4a66;
  border-radius: 8px;
  padding: 18px;
  text-align: center;
  transition: border-color 0.15s, background 0.15s;
}
.drop.over {
  border-color: #4d7cff;
  background: #16203a;
}
.drop p {
  margin: 0 0 10px;
  font-size: 13px;
  color: #8b9bb4;
}
.drop .file {
  color: #e6edf3;
  word-break: break-all;
}
.actions {
  margin-top: 12px;
}
.actions button {
  width: 100%;
}
.hint {
  margin-top: 12px;
  font-size: 12px;
  color: #8b9bb4;
}
.hint.err {
  color: #ff6b6b;
}
.stats {
  margin-top: 18px;
}
.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 14px;
}
.stat {
  background: #16203a;
  border-radius: 8px;
  padding: 10px;
  text-align: center;
}
.stat b {
  display: block;
  font-size: 20px;
  color: #4d7cff;
}
.stat span {
  font-size: 11px;
  color: #8b9bb4;
}
h3 {
  font-size: 13px;
  margin: 14px 0 8px;
  color: #c5d2e6;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 12px;
}
.list li {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 1px solid #16203a;
}
.list .num {
  color: #ffd24d;
}
.map {
  position: relative;
  flex: 1;
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
  color: #6b7a93;
}
.placeholder .sub {
  font-size: 12px;
}
.overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 20, 32, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #e6edf3;
}
</style>
