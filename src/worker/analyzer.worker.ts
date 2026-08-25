// 分析 Worker: 解析 + IP 定位 + 聚合全部在后台线程执行
import { Ip2Region } from '../utils/ip2region'
import { parseLines } from '../utils/parseLog'
import { aggregateStats, type LogFilter } from '../utils/analyze'
import type { LogLine } from '../utils/parseLog'

const ctx: any = self
const CHUNK = 20000

let db: Ip2Region | null = null
let lines: LogLine[] = []

async function load(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`无法加载 ip2region 数据库: ${res.status}`)
  db = new Ip2Region(await res.arrayBuffer())
  ctx.postMessage({ type: 'dbReady' })
}

function analyze(text: string) {
  if (!db) return
  const raw = text.split(/\r?\n/)
  lines = []
  for (let i = 0; i < raw.length; i += CHUNK) {
    lines.push(...parseLines(raw.slice(i, i + CHUNK)))
    ctx.postMessage({ type: 'progress', done: Math.min(i + CHUNK, raw.length), total: raw.length })
  }
  // 首次聚合: 每个 IP 的首次查询较慢, 但结果会缓存在 db 内
  const result = aggregateStats(lines, db)
  ctx.postMessage({ type: 'result', result })
}

ctx.onmessage = async (e: MessageEvent) => {
  const msg = e.data
  try {
    if (msg.type === 'load') {
      await load(msg.url)
    } else if (msg.type === 'analyze') {
      analyze(msg.text)
    } else if (msg.type === 'refilter') {
      if (!db || !lines.length) return
      const result = aggregateStats(lines, db, (msg.filters || {}) as LogFilter)
      ctx.postMessage({ type: 'result', result })
    }
  } catch (err) {
    ctx.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err)
    })
  }
}
