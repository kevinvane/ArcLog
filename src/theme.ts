// 内置主题: UI 走 CSS 变量, 图表配色走 chart 对象
export interface ChartColors {
  mapArea: string
  mapHover: string
  mapBorder: string
  lineFrom: [number, number, number] // 飞线渐变·量少(浅)
  lineTo: [number, number, number] // 飞线渐变·量大(深)
  point: string // 来源涟漪点
  alert: string // 可疑预警点
  server: string // 服务器标记
  tipBg: string
  tipText: string
  tipBorder: string
}

export interface Theme {
  id: string
  label: string
  dark: boolean
  css: Record<string, string>
  chart: ChartColors
}

export const THEMES: Theme[] = [
  {
    id: 'ember',
    label: '曜石红',
    dark: true,
    css: {
      '--bg': '#0a0e17',
      '--glow': 'rgba(230, 45, 60, 0.05)',
      '--panel': 'rgba(255, 255, 255, 0.03)',
      '--panel-2': 'rgba(255, 255, 255, 0.05)',
      '--border': 'rgba(255, 255, 255, 0.06)',
      '--border-2': 'rgba(255, 255, 255, 0.13)',
      '--text': '#e8edf5',
      '--strong': '#ffffff',
      '--dim': '#8b97ad',
      '--muted': '#5d6b85',
      '--accent': '#ff4d5e',
      '--accent-2': '#c9184a',
      '--accent-soft': 'rgba(255, 77, 94, 0.12)',
      '--hover': 'rgba(255, 255, 255, 0.06)',
      '--bar-track': 'rgba(255, 255, 255, 0.07)',
      '--input-bg': 'rgba(255, 255, 255, 0.05)',
      '--input-border': 'rgba(255, 255, 255, 0.1)',
      '--overlay': 'rgba(10, 14, 23, 0.65)',
      '--float-bg': 'rgba(12, 17, 28, 0.75)'
    },
    chart: {
      mapArea: '#1b2436',
      mapHover: '#2a3a55',
      mapBorder: '#3a4a66',
      lineFrom: [230, 255, 250],
      lineTo: [225, 28, 45],
      point: '#ff7a45',
      alert: '#c084fc',
      server: '#00e676',
      tipBg: 'rgba(13, 18, 30, 0.92)',
      tipText: '#e8edf5',
      tipBorder: 'rgba(255, 255, 255, 0.12)'
    }
  },
  {
    id: 'ocean',
    label: '深海蓝',
    dark: true,
    css: {
      '--bg': '#060b16',
      '--glow': 'rgba(56, 160, 255, 0.06)',
      '--panel': 'rgba(120, 180, 255, 0.04)',
      '--panel-2': 'rgba(120, 180, 255, 0.07)',
      '--border': 'rgba(140, 190, 255, 0.09)',
      '--border-2': 'rgba(140, 190, 255, 0.22)',
      '--text': '#e3edf9',
      '--strong': '#ffffff',
      '--dim': '#84a0c0',
      '--muted': '#54708f',
      '--accent': '#38bdf8',
      '--accent-2': '#2563eb',
      '--accent-soft': 'rgba(56, 189, 248, 0.12)',
      '--hover': 'rgba(120, 180, 255, 0.08)',
      '--bar-track': 'rgba(140, 190, 255, 0.12)',
      '--input-bg': 'rgba(120, 180, 255, 0.06)',
      '--input-border': 'rgba(140, 190, 255, 0.16)',
      '--overlay': 'rgba(6, 11, 22, 0.65)',
      '--float-bg': 'rgba(8, 16, 32, 0.78)'
    },
    chart: {
      mapArea: '#0f1b2e',
      mapHover: '#1a2c49',
      mapBorder: '#27405f',
      lineFrom: [215, 238, 255],
      lineTo: [37, 99, 235],
      point: '#22d3ee',
      alert: '#f472b6',
      server: '#34d399',
      tipBg: 'rgba(8, 15, 30, 0.92)',
      tipText: '#e3edf9',
      tipBorder: 'rgba(140, 190, 255, 0.2)'
    }
  },
  {
    id: 'aurora',
    label: '极光绿',
    dark: true,
    css: {
      '--bg': '#071010',
      '--glow': 'rgba(52, 211, 153, 0.05)',
      '--panel': 'rgba(110, 240, 190, 0.03)',
      '--panel-2': 'rgba(110, 240, 190, 0.06)',
      '--border': 'rgba(110, 240, 190, 0.09)',
      '--border-2': 'rgba(110, 240, 190, 0.22)',
      '--text': '#e2f4ec',
      '--strong': '#ffffff',
      '--dim': '#7ba394',
      '--muted': '#4e6f63',
      '--accent': '#34d399',
      '--accent-2': '#047857',
      '--accent-soft': 'rgba(52, 211, 153, 0.12)',
      '--hover': 'rgba(110, 240, 190, 0.07)',
      '--bar-track': 'rgba(110, 240, 190, 0.1)',
      '--input-bg': 'rgba(110, 240, 190, 0.05)',
      '--input-border': 'rgba(110, 240, 190, 0.15)',
      '--overlay': 'rgba(7, 16, 16, 0.65)',
      '--float-bg': 'rgba(9, 22, 19, 0.78)'
    },
    chart: {
      mapArea: '#10201b',
      mapHover: '#1a332b',
      mapBorder: '#2b4a41',
      lineFrom: [218, 255, 240],
      lineTo: [5, 150, 105],
      point: '#bef264',
      alert: '#fb7185',
      server: '#ffd24d',
      tipBg: 'rgba(7, 20, 17, 0.92)',
      tipText: '#e2f4ec',
      tipBorder: 'rgba(110, 240, 190, 0.18)'
    }
  },
  {
    id: 'violet',
    label: '落日紫',
    dark: true,
    css: {
      '--bg': '#0d0a17',
      '--glow': 'rgba(167, 139, 250, 0.06)',
      '--panel': 'rgba(180, 150, 255, 0.04)',
      '--panel-2': 'rgba(180, 150, 255, 0.07)',
      '--border': 'rgba(180, 150, 255, 0.1)',
      '--border-2': 'rgba(180, 150, 255, 0.24)',
      '--text': '#ece8fa',
      '--strong': '#ffffff',
      '--dim': '#9a8dbd',
      '--muted': '#65588c',
      '--accent': '#a78bfa',
      '--accent-2': '#6d28d9',
      '--accent-soft': 'rgba(167, 139, 250, 0.13)',
      '--hover': 'rgba(180, 150, 255, 0.08)',
      '--bar-track': 'rgba(180, 150, 255, 0.12)',
      '--input-bg': 'rgba(180, 150, 255, 0.06)',
      '--input-border': 'rgba(180, 150, 255, 0.18)',
      '--overlay': 'rgba(13, 10, 23, 0.65)',
      '--float-bg': 'rgba(17, 13, 31, 0.78)'
    },
    chart: {
      mapArea: '#1c1730',
      mapHover: '#2b2350',
      mapBorder: '#3d3466',
      lineFrom: [238, 234, 255],
      lineTo: [124, 58, 237],
      point: '#f472b6',
      alert: '#fbbf24',
      server: '#34d399',
      tipBg: 'rgba(16, 12, 30, 0.92)',
      tipText: '#ece8fa',
      tipBorder: 'rgba(180, 150, 255, 0.22)'
    }
  },
  {
    id: 'daylight',
    label: '日间模式',
    dark: false,
    css: {
      '--bg': '#f2f5fa',
      '--glow': 'rgba(225, 29, 72, 0.05)',
      '--panel': '#ffffff',
      '--panel-2': 'rgba(15, 23, 42, 0.04)',
      '--border': 'rgba(15, 23, 42, 0.09)',
      '--border-2': 'rgba(15, 23, 42, 0.2)',
      '--text': '#17233a',
      '--strong': '#000000',
      '--dim': '#5d6b85',
      '--muted': '#94a3b8',
      '--accent': '#e11d48',
      '--accent-2': '#9f1239',
      '--accent-soft': 'rgba(225, 29, 72, 0.1)',
      '--hover': 'rgba(15, 23, 42, 0.06)',
      '--bar-track': 'rgba(15, 23, 42, 0.09)',
      '--input-bg': '#ffffff',
      '--input-border': 'rgba(15, 23, 42, 0.16)',
      '--overlay': 'rgba(242, 245, 250, 0.72)',
      '--float-bg': 'rgba(255, 255, 255, 0.88)'
    },
    chart: {
      mapArea: '#e4ebf4',
      mapHover: '#d3dfec',
      mapBorder: '#ffffff',
      lineFrom: [100, 116, 139],
      lineTo: [190, 18, 60],
      point: '#ea580c',
      alert: '#7c3aed',
      server: '#059669',
      tipBg: 'rgba(255, 255, 255, 0.97)',
      tipText: '#17233a',
      tipBorder: 'rgba(15, 23, 42, 0.16)'
    }
  }
]

const STORAGE_KEY = 'arclog-theme'

export function defaultThemeId(): string {
  return localStorage.getItem(STORAGE_KEY) || THEMES[0].id
}

export function findTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

export function applyThemeVars(theme: Theme) {
  const root = document.documentElement
  for (const [k, v] of Object.entries(theme.css)) root.style.setProperty(k, v)
  root.style.colorScheme = theme.dark ? 'dark' : 'light'
}

export function saveThemeId(id: string) {
  localStorage.setItem(STORAGE_KEY, id)
}
