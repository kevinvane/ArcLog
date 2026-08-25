import { createApp } from 'vue'
import App from './App.vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { GeoComponent, TooltipComponent, TitleComponent, VisualMapComponent } from 'echarts/components'
import { LinesChart, EffectScatterChart, ScatterChart } from 'echarts/charts'
import { registerMap } from 'echarts/core'
import { chinaGeoJson } from './utils/geo'
import './style.css'

use([
  CanvasRenderer,
  GeoComponent,
  TooltipComponent,
  TitleComponent,
  VisualMapComponent,
  LinesChart,
  EffectScatterChart,
  ScatterChart
])

registerMap('china', chinaGeoJson as any)

createApp(App).mount('#app')
