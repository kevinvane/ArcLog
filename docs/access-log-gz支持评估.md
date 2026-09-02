# 评估读取 access.log.gz 格式的难度

## 现状

- `src/App.vue` 中 `onFile` / `onDrop` 使用 `file.text()` 读取纯文本文件
- 读取后以文本字符串形式通过 `postMessage` 发给 Web Worker 进行解析
- `src/worker/analyzer.worker.ts` 接收文本字符串，按行 `split(/\r?\n/)` 后解析
- `package.json` 无任何 gzip 解压缩依赖
- 文件输入框 `accept` 属性仅允许 `.log,.txt`

## 评估结论

**难度：低到中等**

## 技术方案与改动点

### 1. 引入解压缩库

- 推荐 `fflate`（~5KB，tree-shakeable）或 `pako`（~8KB，API 兼容 zlib）
- 需添加到 `package.json` 依赖并安装

### 2. 修改文件读取逻辑（`src/App.vue`）

- `onFile` 和 `onDrop` 中检测文件后缀是否为 `.gz`
- `.gz` 文件改用 `file.arrayBuffer()` 读取二进制数据
- 使用 `fflate.gunzip()` 或 `pako.ungzip()` 解压缩
- `Uint8Array` → `TextDecoder.decode()` 转为字符串
- 后续流程与当前纯文本文件完全一致

### 3. 更新 file input 的 accept 属性

- 当前 `<input type="file" accept=".log,.txt">`
- 增加 `.gz`：`accept=".log,.txt,.gz"`

### 4. Worker 通信无需变更

- 解压缩在主线程完成，仍以文本字符串发给 worker
- 无需修改 `analyzer.worker.ts`

## 潜在风险

| 风险 | 说明 |
|------|------|
| 内存占用 | 大压缩文件解压后体积膨胀数倍，但当前 `file.text()` 本身已将整个文件读入内存，不引入新问题 |
| 浏览器兼容 | 现代浏览器支持 `DecompressionStream` API，但 Safari 支持较新；引入 `fflate` 比依赖原生 API 更稳妥 |
| 极端大文件 | 数百 MB 的 `.gz` 解压后可能达数 GB，浏览器可能崩溃；可在 UI 层提示文件过大风险 |

## 最小改动方案

1. `npm install fflate`
2. 在 `onFile` / `onDrop` 中判断 `.gz` → `arrayBuffer` → `gunzip` → `TextDecoder.decode()` → `runAnalyze(text)`
3. 更新 `accept` 属性

预计改动量：`App.vue` 约 20-30 行新增代码，无其他文件修改。