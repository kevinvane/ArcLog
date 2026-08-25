import chinaGeo from '../assets/china.json'

export type LngLat = [number, number]

interface ChinaFeature {
  properties: {
    name: string
    cp?: LngLat
    longitude?: number
    latitude?: number
  }
}

// ip2region 省份全名 -> GeoJSON 短名
export const PROVINCE_ALIAS: Record<string, string> = {
  北京市: '北京',
  天津市: '天津',
  上海市: '上海',
  重庆市: '重庆',
  河北省: '河北',
  山西省: '山西',
  辽宁省: '辽宁',
  吉林省: '吉林',
  黑龙江省: '黑龙江',
  江苏省: '江苏',
  浙江省: '浙江',
  安徽省: '安徽',
  福建省: '福建',
  江西省: '江西',
  山东省: '山东',
  河南省: '河南',
  湖北省: '湖北',
  湖南省: '湖南',
  广东省: '广东',
  海南省: '海南',
  四川省: '四川',
  贵州省: '贵州',
  云南省: '云南',
  陕西省: '陕西',
  甘肃省: '甘肃',
  青海省: '青海',
  内蒙古自治区: '内蒙古',
  广西壮族自治区: '广西',
  西藏自治区: '西藏',
  宁夏回族自治区: '宁夏',
  新疆维吾尔自治区: '新疆',
  香港特别行政区: '香港',
  澳门特别行政区: '澳门',
  台湾省: '台湾'
}

const centerMap = new Map<string, LngLat>()
for (const f of (chinaGeo as { features: ChinaFeature[] }).features) {
  const name = f.properties.name
  let coord: LngLat | null = null
  if (Array.isArray(f.properties.cp)) coord = f.properties.cp
  else if (typeof f.properties.longitude === 'number')
    coord = [f.properties.longitude, f.properties.latitude as number]
  if (coord) centerMap.set(name, coord)
}

export const chinaGeoJson = chinaGeo

export function shortProvince(full: string): string {
  return PROVINCE_ALIAS[full] || full
}

export function provinceCenter(short: string): LngLat | null {
  return centerMap.get(short) || null
}

// 解析服务器位置: 支持 "lng,lat" 或省份名; 默认北京
export function resolveServerLocation(input: string): LngLat {
  const t = (input || '').trim()
  const m = t.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (m) return [parseFloat(m[1]), parseFloat(m[2])]
  const c = centerMap.get(t) || centerMap.get(shortProvince(t))
  if (c) return c
  return [116.4, 39.9]
}
