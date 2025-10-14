# Focus · Aim · Create — Interactive Dartboard Homepage

主题：**人生选择与专注** · 核心视觉：11 区（0–10）同心飞镖盘作为信息与体验的主导航。

本项目已从概念原型迭代为具有：呼吸高亮、即时命中、信息浮层、键盘导航、引导首屏、粒子背景与彩蛋模块的交互主页基座。

## ✨ Feature Highlights

- Dartboard Navigation：SVG 动态生成 0–10 环，半径比例精确计算。
- Breathing Hover / Focus Glow：聚焦当前环区，增加专注感。
- Instant Pinned Dart：点击（或键盘 Enter）即在点击坐标“插入”飞镖（不再飞行轨迹），伴随冲击涟漪 + 合成音效。
- Info Card System：弹性定位；智能偏移避免遮挡 viewport 边缘。
- Keyboard Accessibility：方向键循环焦点，Enter 触发，Esc 关闭内容卡片。
- Particle Background：轻量 Canvas 粒子层，保持 60fps 优先。
- Intro Reveal Sequence：初始只显示 “Focus. Aim. Create.”，点击后标题平滑上移，飞镖盘淡入出现。
- Easter Egg (Ring 10)：注入迷你玩法（占位逻辑，可扩展计分 / Combo）。
- Preference Persistence：为声音 / 对比度等预留 localStorage 钩子（UI 待补）。
- Progressive Enhancement：核心信息在无 JS 时仍可回退展示（计划中的轻降级）。

## 🧭 Ring → Module Mapping
| Ring | 模块 | 描述 |
| ---- | ---- | ---- |
| 0 | 关于我 | 核心简介 / 使命宣言 |
| 1 | 职业经历 | 公司 / 角色 / 价值 |
| 2 | 项目作品 | Demo / GitHub / Showcases |
| 3 | 技术栈 | 语言 / 框架 / 能力层级 |
| 4 | 博客 | 文章聚合入口 |
| 5 | 摄影 | 视觉与审美延展 |
| 6 | 兴趣 | 标签化兴趣地图 |
| 7 | 演讲 | Talks / Slides / 分享 |
| 8 | 简历 | PDF / 在线版本 |
| 9 | 联系 | 邮件 / 社交链接 |
| 10 | 彩蛋 | 隐藏互动 / 小游戏 |

> 中心 = 0（Bullseye），向外依次 1–10。

## 🏗 Tech Stack
- Build：Vite + TypeScript
- Rendering：SVG + DOM + Canvas (particles)
- Animation：CSS Transitions / Keyframes + Web Animations API
- Audio：WebAudio 生成命中声（纯代码合成，无外部资源）
- State：ES 模块 + 局部闭包；localStorage 持久化偏好
- 可拓展方向：GSAP、OffscreenCanvas、WebGL、WASM 分析层

## 📁 Structure
```
├── index.html
├── package.json
├── tsconfig.json
├── src
│   ├── main.ts        # 入口 / 状态编排 / 动画调度
│   ├── dartboard.ts   # Dartboard 类：绘制 + 命中判定 + 键盘焦点
│   ├── modules.ts     # 模块数据（环区 → 内容）
│   └── styles.css     # 全局样式 + 动画 + 布局
```

## 🆕 Recent Iterations
- 飞镖交互：由“飞行轨迹”改为“即时插入”→ 更直接、减少视觉冗余。
- 引导首屏：单行宣言 → 点击后平滑上移并让位于飞镖盘。
- 动态布局：计算标题与飞镖盘相对位移，桌面与高屏幕下保持视觉黄金区。
- 命中表现：加入冲击涟漪 + 弹性缩放出现。
- 性能守护：限制累计插入飞镖数量（超过阈值自动回收最早 DOM）。
- 可访问性：方向键循环焦点；Esc 快速关闭卡片（后续补充 ARIA label）。

## 🗺 Roadmap / Next Steps
- [ ] Settings 面板（声音 / 对比度 / 清除全部飞镖）
- [ ] 为每个 ring 补充 `aria-label` 与角色语义
- [ ] 移动端触控优化（扩大命中容差 / 双指缩放预案）
- [ ] 粒子层自适应密度（基于帧时间抽样）
- [ ] 彩蛋小游戏：计分机制 + 连击反馈 + 排行本地缓存
- [ ] 内容数据真实化（项目 / 文章 / 媒体）
- [ ] 主题切换（夜 / 暖光 / 高对比）
- [ ] 性能分析（CLS / LCP / 内存快照）
- [ ] 可选复古“飞行轨迹模式”开关

## 🔧 Customization
- 修改 `modules.ts` 调整文案 / 链接。
- 在 `:root` 中定制主题变量（色板 / 阴影 / 半径 / 动画时长）。
- 若需新增 ring，可在 `dartboard.ts` 中扩展环数并同步 `modules.ts`。

## 🚀 Development
安装依赖并启动：
```bash
npm install  # 或 pnpm / yarn
npm run dev
```
生产构建：
```bash
npm run build
```
本地预览生产包：
```bash
npm run preview
```

## 📜 License
个人自用展示项目。可参考交互与结构；转载或二次创作请保留署名。欢迎 issue / PR 共建。

---
Focus the intent · Aim the craft · Create the impact.

## 🌍 GitHub Pages 部署

已添加 GitHub Actions 工作流 `.github/workflows/deploy.yml`：

1. 将仓库推送到 GitHub，并确保默认分支为 `main`（或 `master`，工作流已兼容）。
2. 在 GitHub 仓库 Settings → Pages：
	- Build and deployment 选择 "GitHub Actions"。
3. 每次推送到主分支会自动：安装依赖 → `npm run build` → 发布 `dist` 到 Pages。
4. 首次执行后几分钟可访问：`https://booojchai.github.io/`（用户主页仓库名必须是 `booojchai/booojchai.github.io`）。

如果你使用的是普通项目仓库（例如 `homepage`），而不是用户主页仓库，则需要：
```html
<!-- 在 index.html 或 vite.config 中设置正确的 base -->
<script type="module" src="/offbeat/main.js"></script>
```
并在 `vite.config.ts` 设置 `base: '/仓库名/'`。当前假设你要部署到用户主页仓库，可以保持默认 `base`。

### 可选：添加 CNAME
如需自定义域名：在仓库根目录创建 `CNAME` 文件（内容为你的域名），Actions 会一并发布。

### 手动触发
在 Actions 选项卡中选择 "Deploy to GitHub Pages" 工作流，点击 "Run workflow" 可立即触发。
