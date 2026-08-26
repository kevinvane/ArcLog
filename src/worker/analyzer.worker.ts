// 分析 Worker: 解析 + IP 定位 + 聚合全部在后台线程执行
import { Ip2Region } from '../utils/ip2region'
import { parseLines, parseNginxTime, type LogLine } from '../utils/parseLog'
import { aggregateStats, type LogFilter } from '../utils/analyze'
import { compileFormat, extractFormat, parseWithFormat, type CompiledFormat } from '../utils/formatCompiler'

const ctx: any = self
const CHUNK = 20000

let db: Ip2Region | null = null
let lines: LogLine[] = []
let lastText = '' // 保留原始日志, 切换自定义格式时可重新解析
let customParser: CompiledFormat | null = null

function parseChunk(raw: string[]): LogLine[] {
  if (!customParser) return parseLines(raw)
  const out: LogLine[] = []
  for (const l of raw) {
    const r = parseWithFormat(l, customParser)
    if (r) out.push(r)
  }
  return out
}

async function load(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`无法加载 ip2region 数据库: ${res.status}`)
  db = new Ip2Region(await res.arrayBuffer())
  ctx.postMessage({ type: 'dbReady' })
}

function analyze(text: string, filters: LogFilter = {}) {
  if (!db) return
  lastText = text
  const raw = text.split(/\r?\n/)
  lines = []
  for (let i = 0; i < raw.length; i += CHUNK) {
    lines.push(...parseChunk(raw.slice(i, i + CHUNK)))
    ctx.postMessage({ type: 'progress', done: Math.min(i + CHUNK, raw.length), total: raw.length })
  }
  // 首次聚合: 每个 IP 的首次查询较慢, 但结果会缓存在 db 内
  const result = aggregateStats(lines, db, filters)
  ctx.postMessage({ type: 'result', result })
}

ctx.onmessage = async (e: MessageEvent) => {
  const msg = e.data
  try {
    if (msg.type === 'load') {
      await load(msg.url)
    } else if (msg.type === 'analyze') {
      customParser = msg.format ? compileFormat(extractFormat(msg.format)) : null
      analyze(msg.text, msg.filters)
    } else if (msg.type === 'refilter') {
      if (!db || !lines.length) return
      const result = aggregateStats(lines, db, (msg.filters || {}) as LogFilter)
      ctx.postMessage({ type: 'result', result })
    } else if (msg.type === 'validateFormat') {
      validateFormat(msg.format || '')
    }
  } catch (err) {
    ctx.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err)
    })
  }
}

// 校验自定义格式: 对已加载日志的前 1000 行统计匹配率并给出字段预览
function validateFormat(raw: string) {
  const total = Math.min(lastText ? lastText.split(/\r?\n/).length : 0, 1000)
  if (!total) {
    // 尚无日志: 仅做编译检查
    try {
      compileFormat(extractFormat(raw))
      ctx.postMessage({ type: 'validateResult', matched: 0, total: 0 })
    } catch (err) {
      ctx.postMessage({
        type: 'validateResult',
        error: err instanceof Error ? err.message : String(err)
      })
    }
    return
  }

  const cf = compileFormat(extractFormat(raw))
  const sample = lastText.split(/\r?\n/).slice(0, total)
  let matched = 0
  let preview: Record<string, string> | undefined
  for (const l of sample) {
    const r = parseWithFormat(l, cf)
    if (!r) continue
    matched++
    if (!preview && r.ip) {
      preview = {
        ip: r.ip,
        status: r.status || '-',
        path: r.path || '-',
        time: r.ts ? new Date(r.ts).toLocaleString() : '-',
        ua: r.ua || '-'
      }
    }
  }
  ctx.postMessage({ type: 'validateResult', matched, total, preview })
}
