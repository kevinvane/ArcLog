// 主题系统: 强调色(Accent) × 昼夜模式(Mode) 二维组合
export type ModeId = 'dark' | 'light'

export interface Accent {
  id: string
  label: string
  accent: string // 主强调色
  accent2: string // 渐变端
  bgDark: string // 该强调色下的暗色底(带微色调)
  glowDark: string // 暗色模式的径向光晕
  lineFrom: [number, number, number] // 飞线渐变·量少(暗色模式)
  lineTo: [number, number, number] // 飞线渐变·量大(暗色模式)
  point: string // 来源涟漪点
  alert: string // 可疑预警点(暗色模式)
  alertLight?: string // 可疑预警点(日间模式覆盖, 避免与强调色撞色)
  mapArea: string // 暗色地图底色
  mapHover: string
  mapBorder: string
}

export const ACCENTS: Accent[] = [
  {
    id: 'ember',
    label: '曜石红',
    accent: '#ff4d5e',
    accent2: '#c9184a',
    bgDark: '#0a0e17',
    glowDark: 'rgba(230, 45, 60, 0.05)',
    lineFrom: [230, 255, 250],
    lineTo: [225, 28, 45],
    point: '#ff7a45',
    alert: '#c084fc',
    mapArea: '#1b2436',
    mapHover: '#2a3a55',
    mapBorder: '#3a4a66'
  },
  {
    id: 'ocean',
    label: '深海蓝',
    accent: '#38bdf8',
    accent2: '#2563eb',
    bgDark: '#060b16',
    glowDark: 'rgba(56, 160, 255, 0.06)',
    lineFrom: [215, 238, 255],
    lineTo: [37, 99, 235],
    point: '#22d3ee',
    alert: '#f472b6',
    mapArea: '#0f1b2e',
    mapHover: '#1a2c49',
    mapBorder: '#27405f'
  },
  {
    id: 'aurora',
    label: '极光绿',
    accent: '#34d399',
    accent2: '#047857',
    bgDark: '#071010',
    glowDark: 'rgba(52, 211, 153, 0.05)',
    lineFrom: [218, 255, 240],
    lineTo: [5, 150, 105],
    point: '#bef264',
    alert: '#fb7185',
    alertLight: '#d97706',
    mapArea: '#10201b',
    mapHover: '#1a332b',
    mapBorder: '#2b4a41'
  },
  {
    id: 'violet',
    label: '落日紫',
    accent: '#a78bfa',
    accent2: '#6d28d9',
    bgDark: '#0d0a17',
    glowDark: 'rgba(167, 139, 250, 0.06)',
    lineFrom: [238, 234, 255],
    lineTo: [124, 58, 237],
    point: '#f472b6',
    alert: '#fbbf24',
    mapArea: '#1c1730',
    mapHover: '#2b2350',
    mapBorder: '#3d3466'
  }
]

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgba(hex: string, alpha: number): string {
  return `rgba(${hexToRgb(hex).join(', ')}, ${alpha})`
}

export interface ResolvedTheme {
  dark: boolean
  css: Record<string, string>
  chart: {
    mapArea: string
    mapHover: string
    mapBorder: string
    lineFrom: [number, number, number]
    lineTo: [number, number, number]
    point: string
    alert: string
    server: string
    tipBg: string
    tipText: string
    tipBorder: string
  }
}

const DARK_BASE: Record<string, string> = {
  '--text': '#e8edf5',
  '--strong': '#ffffff',
  '--dim': '#8b97ad',
  '--muted': '#5d6b85',
  '--panel': 'rgba(255, 255, 255, 0.03)',
  '--panel-2': 'rgba(255, 255, 255, 0.05)',
  '--border': 'rgba(255, 255, 255, 0.06)',
  '--border-2': 'rgba(255, 255, 255, 0.13)',
  '--hover': 'rgba(255, 255, 255, 0.06)',
  '--bar-track': 'rgba(255, 255, 255, 0.07)',
  '--input-bg': 'rgba(255, 255, 255, 0.05)',
  '--input-border': 'rgba(255, 255, 255, 0.1)',
  '--overlay': 'rgba(10, 14, 23, 0.65)',
  '--float-bg': 'rgba(12, 17, 28, 0.75)'
}

const LIGHT_BASE: Record<string, string> = {
  '--text': '#17233a',
  '--strong': '#000000',
  '--dim': '#5d6b85',
  '--muted': '#94a3b8',
  '--panel': '#ffffff',
  '--panel-2': 'rgba(15, 23, 42, 0.04)',
  '--border': 'rgba(15, 23, 42, 0.09)',
  '--border-2': 'rgba(15, 23, 42, 0.2)',
  '--hover': 'rgba(15, 23, 42, 0.06)',
  '--bar-track': 'rgba(15, 23, 42, 0.09)',
  '--input-bg': '#ffffff',
  '--input-border': 'rgba(15, 23, 42, 0.16)',
  '--overlay': 'rgba(242, 245, 250, 0.72)',
  '--float-bg': 'rgba(255, 255, 255, 0.88)'
}

export function findAccent(id: string): Accent {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0]
}

// 组合强调色与模式, 解析出完整的 CSS 变量表与图表配色
export function resolveTheme(accentId: string, mode: ModeId): ResolvedTheme {
  const a = findAccent(accentId)
  const dark = mode === 'dark'

  const css: Record<string, string> = {
    ...(dark ? DARK_BASE : LIGHT_BASE),
    '--bg': dark ? a.bgDark : '#f2f5fa',
    '--glow': dark ? a.glowDark : rgba(a.accent, 0.05),
    '--accent': a.accent,
    '--accent-2': a.accent2,
    '--accent-soft': rgba(a.accent, dark ? 0.12 : 0.1)
  }

  const chart = dark
    ? {
        mapArea: a.mapArea,
        mapHover: a.mapHover,
        mapBorder: a.mapBorder,
        lineFrom: a.lineFrom,
        lineTo: a.lineTo,
        point: a.point,
        alert: a.alert,
        server: '#00e676',
        tipBg: 'rgba(13, 18, 30, 0.92)',
        tipText: '#e8edf5',
        tipBorder: 'rgba(255, 255, 255, 0.12)'
      }
    : {
        // 浅底模式下飞线改为 灰(少) -> 强调深色(多), 保证可见度
        mapArea: '#e4ebf4',
        mapHover: '#d3dfec',
        mapBorder: '#ffffff',
        lineFrom: [100, 116, 139] as [number, number, number],
        lineTo: hexToRgb(a.accent2),
        point: a.accent,
        alert: a.alertLight || '#7c3aed',
        server: '#059669',
        tipBg: 'rgba(255, 255, 255, 0.97)',
        tipText: '#17233a',
        tipBorder: 'rgba(15, 23, 42, 0.16)'
      }

  return { dark, css, chart }
}

export function applyThemeVars(theme: ResolvedTheme) {
  const root = document.documentElement
  for (const [k, v] of Object.entries(theme.css)) root.style.setProperty(k, v)
  root.style.colorScheme = theme.dark ? 'dark' : 'light'
}

const ACCENT_KEY = 'arclog-accent'
const MODE_KEY = 'arclog-mode'

export function savedAccentId(): string {
  return localStorage.getItem(ACCENT_KEY) || ACCENTS[0].id
}

export function savedMode(): ModeId {
  return localStorage.getItem(MODE_KEY) === 'light' ? 'light' : 'dark'
}

export function saveAppearance(accentId: string, mode: ModeId) {
  localStorage.setItem(ACCENT_KEY, accentId)
  localStorage.setItem(MODE_KEY, mode)
}
