import chinaGeo from '../assets/china.json'
import chinaCities from '../assets/china-cities.json'

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

// 城市坐标表（363 个地级市，名字带「市」后缀）
const cityCoordMap = new Map<string, LngLat>()
for (const c of chinaCities as { name: string; lng: number; lat: number }[]) {
  cityCoordMap.set(c.name, [c.lng, c.lat])
}

// 查城市坐标: 支持 "南京市"/"南京" 两种写法
export function cityCenter(city: string): LngLat | null {
  if (!city) return null
  return cityCoordMap.get(city) || cityCoordMap.get(city + '市') || null
}

export function shortProvince(full: string): string {
  return PROVINCE_ALIAS[full] || full
}

export function provinceCenter(short: string): LngLat | null {
  return centerMap.get(short) || null
}

// 常用城市坐标（含直辖市/省会/主要城市）
const CITY_COORDS: Record<string, LngLat> = {
  北京: [116.41, 39.9],
  上海: [121.47, 31.23],
  天津: [117.2, 39.13],
  重庆: [106.55, 29.56],
  杭州: [120.15, 30.29],
  宁波: [121.55, 29.87],
  广州: [113.26, 23.13],
  深圳: [114.06, 22.55],
  南京: [118.8, 32.06],
  苏州: [120.58, 31.3],
  济南: [117.12, 36.65],
  青岛: [120.38, 36.07],
  郑州: [113.63, 34.75],
  武汉: [114.31, 30.59],
  长沙: [112.94, 28.23],
  合肥: [117.28, 31.86],
  南昌: [115.89, 28.68],
  福州: [119.3, 26.08],
  厦门: [118.09, 24.48],
  成都: [104.07, 30.57],
  贵阳: [106.63, 26.65],
  昆明: [102.83, 24.88],
  南宁: [108.37, 22.82],
  海口: [110.2, 20.04],
  石家庄: [114.51, 38.04],
  太原: [112.55, 37.87],
  张家口: [114.88, 40.82],
  乌兰察布: [113.13, 41.0],
  河源: [114.7, 23.74],
  沈阳: [123.43, 41.8],
  大连: [121.61, 38.91],
  长春: [125.32, 43.9],
  哈尔滨: [126.53, 45.8],
  西安: [108.94, 34.34],
  兰州: [103.83, 36.06],
  西宁: [101.78, 36.62],
  银川: [106.23, 38.49],
  乌鲁木齐: [87.62, 43.79],
  拉萨: [91.11, 29.97],
  呼和浩特: [111.75, 40.84],
  香港: [114.17, 22.32],
  澳门: [113.54, 22.19],
  台北: [121.56, 25.03]
}

// 可选的服务器地域（阿里云地域名 -> 城市）
export const SERVER_REGIONS: { label: string; city: string }[] = [
  { label: '华北1（青岛）', city: '青岛' },
  { label: '华北2（北京）', city: '北京' },
  { label: '华北3（张家口）', city: '张家口' },
  { label: '华北5（呼和浩特）', city: '呼和浩特' },
  { label: '华北6（乌兰察布）', city: '乌兰察布' },
  { label: '华东1（杭州）', city: '杭州' },
  { label: '华东2（上海）', city: '上海' },
  { label: '华南1（深圳）', city: '深圳' },
  { label: '华南2（河源）', city: '河源' },
  { label: '华南3（广州）', city: '广州' },
  { label: '西南1（成都）', city: '成都' },
  { label: '中国香港', city: '香港' }
]

// 解析服务器位置: 支持 "lng,lat"、城市名或省份名; 默认北京
export function resolveServerLocation(input: string): LngLat {
  const t = (input || '').trim()
  const m = t.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (m) return [parseFloat(m[1]), parseFloat(m[2])]
  const c =
    CITY_COORDS[t] ||
    centerMap.get(t) ||
    CITY_COORDS[t.replace(/市$/, '')] ||
    centerMap.get(shortProvince(t))
  if (c) return c
  return [116.4, 39.9]
}
