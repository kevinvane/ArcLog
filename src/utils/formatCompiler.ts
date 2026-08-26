// 自定义 log_format 编译器: 将 nginx log_format 字符串编译为日志行解析器
import type { LogLine } from './parseLog'
import { parseNginxTime } from './parseLog'

export interface CompiledFormat {
  regex: RegExp
  // 正则组名 → 内部字段名(ip/ipAlt/time/timeIso/request/method/path/status/bytes/ua/referer)
  mapping: Record<string, string>
}

// 已知 nginx 变量 → 内部字段名; 未列出的变量用占位组兜底
const VAR_FIELDS: Record<string, string> = {
  remote_addr: 'ip',
  http_x_forwarded_for: 'ipAlt',
  http_x_real_ip: 'ipAlt',
  time_local: 'time',
  time_iso8601: 'timeIso',
  request: 'request',
  request_method: 'method',
  uri: 'path',
  request_uri: 'path',
  document_uri: 'path',
  status: 'status',
  body_bytes_sent: 'bytes',
  bytes_sent: 'bytes',
  http_user_agent: 'ua',
  http_referer: 'referer'
}

// 字面量正则转义(避免正则字面量带来的转义复杂度)
function escapeLiteral(s: string): string {
  const specials = ['\\', '.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']']
  let out = s
  for (const ch of specials) out = out.split(ch).join('\\' + ch)
  return out
}

// 从 log_format 配置中提取纯格式串
// - 剥离 "log_format <name>" 前缀与结尾分号
// - 移除所有单引号(nginx 中仅作字符串定界符, 折行书写时每段各有引号)
export function extractFormat(raw: string): string {
  let s = raw.trim()
  s = s.replace(/^log_format\s+\S+\s+/, '')
  if (s.endsWith(';')) s = s.slice(0, -1)
  return s.replace(/\r?\n\s*/g, '').split("'").join('').trim()
}

// 手工扫描切分: [literal, var, literal, var, ...]
interface Token {
  kind: 'literal' | 'var'
  value: string
}

function tokenize(format: string): Token[] {
  const tokens: Token[] = []
  let buf = ''
  let i = 0
  while (i < format.length) {
    if (format[i] === '$') {
      let j = i + 1
      while (j < format.length && /[a-z0-9_]/i.test(format[j])) j++
      if (j > i + 1) {
        if (buf) {
          tokens.push({ kind: 'literal', value: buf })
          buf = ''
        }
        tokens.push({ kind: 'var', value: format.slice(i + 1, j) })
        i = j
        continue
      }
    }
    buf += format[i]
    i++
  }
  if (buf) tokens.push({ kind: 'literal', value: buf })
  return tokens
}

// 编译格式串为正则; 引号内变量用 [^"]* 以免吞掉闭合引号
export function compileFormat(format: string): CompiledFormat {
  if (!format.includes('$')) throw new Error('格式串中没有任何 $ 变量')
  const pattern: string[] = []
  const mapping: Record<string, string> = {}
  let unknownIdx = 0

  // 预标记引号区间: 位于双引号内的变量用 [^"]* 匹配
  let inQuote = false
  for (const tk of tokenize(format)) {
    if (tk.kind === 'literal') {
      pattern.push(escapeLiteral(tk.value))
      const quotes = (tk.value.match(/"/g) || []).length
      if (quotes % 2 === 1) inQuote = !inQuote
      continue
    }
    const name = tk.value
    const field = VAR_FIELDS[name]
    if (!field) {
      pattern.push(inQuote ? '[^"]*' : '\\S*')
      unknownIdx++
      continue
    }
    if (mapping[field]) throw new Error(`字段重复: $${name} (${field})`)
    const group = `f_${field}`
    mapping[field] = field
    const body =
      field === 'time'
        ? '[^\\]]+'
        : field === 'status' || field === 'method'
          ? '\\S+' // 方法/状态码不含空格, 即使在引号内也用单 token 匹配
          : inQuote
            ? '[^"]*'
            : '\\S+'
    pattern.push(`(?<${group}>${body})`)
  }

  try {
    return { regex: new RegExp('^' + pattern.join('')), mapping }
  } catch {
    throw new Error('无法识别的格式: 生成的正则无效')
  }
}

// 用编译产物解析单行日志; 不匹配返回 null
export function parseWithFormat(line: string, cf: CompiledFormat): LogLine | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  const m = cf.regex.exec(trimmed)
  if (!m) return null
  const g = m.groups || {}
  const get = (field: string) => {
    const v = g['f_' + field]
    return v && v !== '-' ? v.trim() : undefined
  }

  // 客户端 IP: 反代头优先于 remote_addr
  const ip = get('ipAlt') || get('ip') || ''
  if (!ip) return { ip: trimmed.split(/\s+/)[0] }

  // request 拆分 METHOD URI PROTO
  let method: string | undefined
  let path: string | undefined
  const req = get('request')
  if (req) {
    const seg = req.split(' ')
    method = seg[0]
    path = seg[1]
  } else {
    method = get('method')
    path = get('path')
  }

  const timeRaw = get('time')
  let ts: number | undefined
  if (timeRaw) ts = parseNginxTime(timeRaw)
  const isoRaw = get('timeIso')
  if (ts === undefined && isoRaw) {
    const parsed = Date.parse(isoRaw)
    ts = isNaN(parsed) ? undefined : parsed
  }

  return {
    ip,
    status: get('status'),
    path,
    method,
    ts,
    ua: get('ua'),
    referer: get('referer')
  }
}
