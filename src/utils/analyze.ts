import type { IpSearcher } from './ip2region'
import { parseLog } from './parseLog'
import { shortProvince, provinceCenter, resolveServerLocation, type LngLat } from './geo'

export interface ProvinceStat {
  name: string
  count: number
  coord: LngLat
}

export interface AnalyzeResult {
  totalLines: number
  parsedLines: number
  foreign: number
  unknown: number
  provinces: ProvinceStat[]
  status: { code: string; count: number }[]
  isps: { name: string; count: number }[]
  topPaths: { path: string; count: number }[]
}

export function analyze(
  text: string,
  db: IpSearcher,
  serverLoc: string
): AnalyzeResult {
  const lines = parseLog(text)
  const provinceCounts = new Map<string, number>()
  const statusCounts = new Map<string, number>()
  const pathCounts = new Map<string, number>()
  const ispCounts = new Map<string, number>()
  let foreign = 0
  let unknown = 0

  for (const line of lines) {
    if (line.status) {
      statusCounts.set(line.status, (statusCounts.get(line.status) || 0) + 1)
    }
    if (line.path && line.path !== '-') {
      pathCounts.set(line.path, (pathCounts.get(line.path) || 0) + 1)
    }

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
    const coord = provinceCenter(short)
    if (!coord) {
      foreign++
      continue
    }
    provinceCounts.set(short, (provinceCounts.get(short) || 0) + 1)
    const isp = region.isp && region.isp !== '0' ? region.isp : '未知'
    ispCounts.set(isp, (ispCounts.get(isp) || 0) + 1)
  }

  const provinces: ProvinceStat[] = []
  for (const [name, count] of provinceCounts) {
    const coord = provinceCenter(name)!
    provinces.push({ name, count, coord })
  }
  provinces.sort((a, b) => b.count - a.count)

  const status = [...statusCounts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)

  const isps = [...ispCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  const topPaths = [...pathCounts.entries()]
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    totalLines: lines.length,
    parsedLines: lines.length,
    foreign,
    unknown,
    provinces,
    status,
    isps,
    topPaths
  }
}

export function serverCoord(serverLoc: string): LngLat {
  return resolveServerLocation(serverLoc)
}
