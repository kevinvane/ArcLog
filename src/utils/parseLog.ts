// nginx 访问日志解析（兼容 combined / 常见自定义格式）
// 主要提取: 客户端 IP、状态码、请求路径

export interface LogLine {
  ip: string
  status?: string
  path?: string
  method?: string
}

// 标准 combined 格式:
// $remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"
const COMBINED_RE =
  /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d{3}) (\S+)/

export function parseLine(line: string): LogLine | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  const m = trimmed.match(COMBINED_RE)
  if (m) {
    return {
      ip: m[1],
      status: m[6],
      method: m[3],
      path: m[4]
    }
  }

  // 退化: 仅取首个 token 作为 IP
  const ip = trimmed.split(/\s+/)[0]
  if (!ip) return null
  const sm = trimmed.match(/(\s|")(\d{3})(\s|")/)
  return { ip, status: sm ? sm[2] : undefined }
}

export function parseLog(text: string): LogLine[] {
  const lines = text.split(/\r?\n/)
  const out: LogLine[] = []
  for (const line of lines) {
    const r = parseLine(line)
    if (r) out.push(r)
  }
  return out
}
