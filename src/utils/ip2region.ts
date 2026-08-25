// 纯前端 ip2region xdb 解析器（兼容 v4 / STRUCTURE_30 格式）
// 数据库结构: 256 字节 Header + 向量索引 + 14 字节段索引 + 数据区
// 段索引块布局: startIp(4) + endIp(4) + dataLen(2) + dataPtr(4)

export interface RegionResult {
  country: string
  province: string // 原始省份全名，如 "广东省"
  city: string
  isp: string
}

export interface IpSearcher {
  search(ip: string): RegionResult
}

const EMPTY: RegionResult = { country: '', province: '', city: '', isp: '' }

// 缓存上限: 超过后清空(扫描器场景下唯一 IP 可达数十万, 防止内存无限增长)
const CACHE_LIMIT = 50000

export class Ip2Region implements IpSearcher {
  private view: DataView
  private startIndexPtr: number
  private endIndexPtr: number
  private readonly segSize = 14
  private cache = new Map<string, RegionResult>()

  constructor(buffer: ArrayBuffer) {
    if (buffer.byteLength < 16) {
      throw new Error(`ip2region 数据库文件过小(${buffer.byteLength} 字节), 可能已损坏`)
    }
    this.view = new DataView(buffer)
    this.startIndexPtr = this.view.getUint32(8, true)
    this.endIndexPtr = this.view.getUint32(12, true)
    const len = buffer.byteLength
    if (
      this.startIndexPtr < 256 ||
      this.endIndexPtr < this.startIndexPtr + this.segSize ||
      this.endIndexPtr > len - 1
    ) {
      throw new Error('ip2region 数据库索引指针非法, 文件可能已损坏或不受支持')
    }
  }

  static async create(url: string): Promise<Ip2Region> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`无法加载 ip2region 数据库: ${res.status}`)
    const buf = await res.arrayBuffer()
    return new Ip2Region(buf)
  }

  private parseIP(ip: string): number[] | null {
    // 先做严格格式校验, 拒绝 "1..2.3" / "1.2.3.4.5" 等畸形串
    if (!/^(\d{1,3})(\.\d{1,3}){3}$/.test(ip)) return null
    const p = ip.split('.').map(Number)
    for (const x of p) if (x < 0 || x > 255) return null
    return p
  }

  // 比较查询 IP(q) 与段索引中存储的 4 字节(小端) IP，位于绝对偏移 off
  private cmpAt(q: number[], off: number, b: Uint8Array): number {
    for (let i = 0; i < 4; i++) {
      const x = q[i]
      const y = b[off + 3 - i]
      if (x < y) return -1
      if (x > y) return 1
    }
    return 0
  }

  search(ip: string): RegionResult {
    const cached = this.cache.get(ip)
    if (cached) return cached

    const q = this.parseIP(ip)
    if (!q) {
      this.cache.set(ip, EMPTY)
      return EMPTY
    }

    const SEG = this.segSize
    const b = new Uint8Array(this.view.buffer, this.view.byteOffset, this.view.byteLength)
    let l = 0
    let h = Math.floor((this.endIndexPtr - this.startIndexPtr) / SEG)
    let dataLen = 0
    let dataPtr = 0

    while (l <= h) {
      const m = (l + h) >> 1
      const p = this.startIndexPtr + m * SEG
      // 边界防护: 索引越界视为无匹配(文件截断时兜底)
      if (p + SEG > b.length) break
      const c1 = this.cmpAt(q, p, b)
      if (c1 < 0) {
        h = m - 1
        continue
      }
      const c2 = this.cmpAt(q, p + 4, b)
      if (c2 > 0) {
        l = m + 1
        continue
      }
      dataLen = this.view.getUint16(p + 8, true)
      dataPtr = this.view.getUint32(p + 10, true)
      // 数据区边界校验
      if (dataLen < 4 || dataPtr < 0 || dataPtr + dataLen > b.length) {
        return EMPTY
      }
      break
    }

    if (dataLen === 0) {
      this.cache.set(ip, EMPTY)
      return EMPTY
    }

    const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + dataPtr, dataLen)
    const parts = new TextDecoder('utf-8').decode(bytes).split('|')
    const result: RegionResult = {
      country: parts[0] || '',
      province: parts[1] || '',
      city: parts[2] || '',
      isp: parts[3] || ''
    }
    if (this.cache.size >= CACHE_LIMIT) this.cache.clear()
    this.cache.set(ip, result)
    return result
  }
}
