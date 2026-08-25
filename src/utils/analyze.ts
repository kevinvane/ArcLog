import type { IpSearcher } from './ip2region'
import type { LogLine } from './parseLog'
import {
  shortProvince,
  provinceCenter,
  cityCenter,
  resolveServerLocation,
  type LngLat
} from './geo'

export interface ProvinceStat {
  name: string
  count: number
  coord: LngLat
}

export interface CityStat {
  name: string // 短名, 如 "南京"
  province: string // 所属省份短名
  count: number
  coord: LngLat
}

export interface SuspectIp {
  ip: string
  count: number
  errCount: number // 4xx + 5xx 次数
  errRatio: number
  topPath: string // 该 IP 最常访问的路径
}

// 可疑判定阈值
const SUSPECT_MIN_REQ = 20 // 单 IP 最少请求数
const SUSPECT_ERR_RATIO = 0.6 // 单 IP 错误占比阈值
const ALERT_MIN_PROV_REQ = 30 // 省份最少请求数(避免小样本误报)
const ALERT_PROV_ERR_RATIO = 0.5 // 省份错误占比阈值

// 过滤条件: 全部为 null/undefined 表示不过滤
export interface LogFilter {
  status?: string | null // 精确状态码, 如 "404"
  province?: string | null // 省份短名, 如 "江苏"
  isp?: string | null
}

export interface AnalyzeResult {
  totalLines: number
  matchedLines: number
  foreign: number
  unknown: number
  provinces: ProvinceStat[]
  cities: CityStat[]
  status: { code: string; count: number }[]
  isps: { name: string; count: number }[]
  topPaths: { path: string; count: number }[]
  suspects: SuspectIp[]
  alertedProvinces: string[] // 错误占比异常的省份短名
}

export function aggregateStats(
  lines: LogLine[],
  db: IpSearcher,
  filters: LogFilter = {}
): AnalyzeResult {
  const provinceCounts = new Map<string, number>()
  const cityCounts = new Map<string, CityStat>()
  const statusCounts = new Map<string, number>()
  const pathCounts = new Map<string, number>()
  const ispCounts = new Map<string, number>()
  // 单 IP 明细: 请求数 / 错误数 / 路径计数(用于可疑检测)
  const ipStats = new Map<string, { count: number; err: number; paths: Map<string, number> }>()
  // 省份错误计数
  const provinceErr = new Map<string, number>()
  let foreign = 0
  let unknown = 0
  let matched = 0

  for (const line of lines) {
    // 状态码过滤(无需查库, 先行短路)
    if (filters.status && line.status !== filters.status) continue

    const region = db.search(line.ip)
    if (!region || !region.country) {
      unknown++
      continue
    }
    if (region.country !== '中国') {
      foreign++
      continue
    }
    const short = shortProvince(region.province)
    const provCoord = provinceCenter(short)
    if (!provCoord) {
      foreign++
      continue
    }
    const isp = region.isp && region.isp !== '0' ? region.isp : '未知'

    // 省份 / 运营商过滤
    if (filters.province && short !== filters.province) continue
    if (filters.isp && isp !== filters.isp) continue

    matched++

    if (line.status) {
      statusCounts.set(line.status, (statusCounts.get(line.status) || 0) + 1)
    }
    if (line.path && line.path !== '-') {
      pathCounts.set(line.path, (pathCounts.get(line.path) || 0) + 1)
    }

    provinceCounts.set(short, (provinceCounts.get(short) || 0) + 1)

    // 错误请求(4xx/5xx)计入省份与 IP 明细
    const isErr = !!line.status && (line.status.startsWith('4') || line.status.startsWith('5'))
    if (isErr) {
      provinceErr.set(short, (provinceErr.get(short) || 0) + 1)
    }
    let st = ipStats.get(line.ip)
    if (!st) {
      st = { count: 0, err: 0, paths: new Map() }
      ipStats.set(line.ip, st)
    }
    st.count++
    if (isErr) st.err++
    const p = line.path && line.path !== '-' ? line.path : '(empty)'
    st.paths.set(p, (st.paths.get(p) || 0) + 1)

    // 城市级聚合: 城市坐标缺失时回退省中心
    const rawCity = region.city && region.city !== '0' ? region.city : ''
    const cityShort = rawCity.replace(/市$/, '')
    const coord = (cityShort && cityCenter(cityShort)) || provCoord
    const key = `${short}|${cityShort || short}`
    const prev = cityCounts.get(key)
    if (prev) {
      prev.count++
    } else {
      cityCounts.set(key, { name: cityShort || short, province: short, count: 1, coord })
    }

    ispCounts.set(isp, (ispCounts.get(isp) || 0) + 1)
  }

  const provinces: ProvinceStat[] = []
  for (const [name, count] of provinceCounts) {
    const coord = provinceCenter(name)!
    provinces.push({ name, count, coord })
  }
  provinces.sort((a, b) => b.count - a.count)

  const cities = [...cityCounts.values()].sort((a, b) => b.count - a.count)

  const status = [...statusCounts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)

  const isps = [...ispCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  // 可疑 IP: 高频 + 高错误率(扫描/爆破特征)
  const suspects: SuspectIp[] = []
  for (const [ip, st] of ipStats) {
    if (st.count < SUSPECT_MIN_REQ) continue
    const ratio = st.err / st.count
    if (ratio < SUSPECT_ERR_RATIO) continue
    let topPath = '(empty)'
    let max = 0
    for (const [path, c] of st.paths) {
      if (c > max) {
        max = c
        topPath = path
      }
    }
    suspects.push({ ip, count: st.count, errCount: st.err, errRatio: ratio, topPath })
  }
  suspects.sort((a, b) => b.errCount - a.errCount || b.count - a.count)

  // 错误占比异常的省份
  const alertedProvinces = provinces
    .filter((p) => p.count >= ALERT_MIN_PROV_REQ)
    .filter((p) => (provinceErr.get(p.name) || 0) / p.count >= ALERT_PROV_ERR_RATIO)
    .map((p) => p.name)

  const topPaths = [...pathCounts.entries()]
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    totalLines: lines.length,
    matchedLines: matched,
    foreign,
    unknown,
    provinces,
    cities,
    status,
    isps,
    topPaths,
    suspects: suspects.slice(0, 10),
    alertedProvinces
  }
}

export function serverCoord(serverLoc: string): LngLat {
  return resolveServerLocation(serverLoc)
}
