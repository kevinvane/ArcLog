import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        // 拆分大体积依赖: 图表库与框架单独分包, 便于缓存与并行加载
        manualChunks: {
          echarts: ['echarts', 'zrender'],
          vue: ['vue', 'vue-echarts']
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    open: true
  }
})
