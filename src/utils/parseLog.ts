// nginx 访问日志解析（兼容 combined / 常见自定义格式）
// 主要提取: 客户端 IP、状态码、请求路径、时间戳

export interface LogLine {
  ip: string
  status?: string
  path?: string
  method?: string
  ts?: number // epoch ms
  ua?: string // User-Agent 原文
}

// 标准 combined 格式:
// $remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"
const COMBINED_RE =
  /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d{3}) (\S+)(?: "([^"]*)" "([^"]*)")?/

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
}

// 解析 nginx time_local: "25/Aug/2026:14:32:10 +0800"
function parseNginxTime(s: string | undefined): number | undefined {
  if (!s || s.length < 20) return undefined
  const day = +s.slice(0, 2)
  const mon = MONTHS[s.slice(3, 6)]
  const year = +s.slice(7, 11)
  if (mon === undefined || isNaN(day) || isNaN(year)) return undefined
  const hh = +s.slice(12, 14)
  const mi = +s.slice(15, 17)
  const ss = +s.slice(18, 20)
  let tzMin = 0
  const tzm = /^([+-])(\d{2})(\d{2})/.exec(s.slice(21).trim())
  if (tzm) tzMin = (+tzm[2] * 60 + +tzm[3]) * (tzm[1] === '-' ? -1 : 1)
  const ts = Date.UTC(year, mon, day, hh, mi, ss) - tzMin * 60000
  return isNaN(ts) ? undefined : ts
}

export function parseLine(line: string): LogLine | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  const m = trimmed.match(COMBINED_RE)
  if (m) {
    return {
      ip: m[1],
      status: m[6],
      method: m[3],
      path: m[4],
      ts: parseNginxTime(m[2]),
      ua: m[9]
    }
  }

  // 退化: 仅取首个 token 作为 IP
  const ip = trimmed.split(/\s+/)[0]
  if (!ip) return null
  const sm = trimmed.match(/(\s|")(\d{3})(\s|")/)
  return { ip, status: sm ? sm[2] : undefined }
}

// 分片解析(供 Worker 分批调用并上报进度)
export function parseLines(rawLines: string[]): LogLine[] {
  const out: LogLine[] = []
  for (const line of rawLines) {
    const r = parseLine(line)
    if (r) out.push(r)
  }
  return out
}

export function parseLog(text: string): LogLine[] {
  return parseLines(text.split(/\r?\n/))
}
