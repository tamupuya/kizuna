# 绊 Kizuna

> 泛二次元社区的「连接」工具 —— 解决 ACG 用户「漫展上认识难、活动信息乱、二手交易险」三件事。

**核心立场**：做连接，不做社交 feed；平台不碰钱，只做信任与匹配；安全是底线。

---

## 项目状态

**阶段**：P0 —— 单场景（漫展）最小闭环，三模块已实现

**当前版本**：v0.10.6（20+ 个可安装 APK，每版 MD5 归档）

---

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | Vue 3 + Vite + TypeScript |
| 状态 | Pinia |
| 样式 | Tailwind CSS + MUJI 设计规范 |
| 路由 | Vue Router 4（hash 模式） |
| 后端 | Supabase（Postgres + Auth + Storage + Realtime） |
| 地图 | 腾讯地图 JSAPI GL |
| 移动端 | Capacitor 8（Android APK） |
| 测试 | Vitest |

---

## 三大模块

1. **人设卡（Persona Card）** —— 兴趣图鉴三态、MBTI、意图、OC 卡、可分享（图片/文本）
2. **漫展雷达 / 同窗会** —— 五维匹配算法、双人配对（推窗→看卡片→接受/跳过→开房）、临时房间（散场即删）
3. **中谷店** —— 二手谷子交易，8 态状态机（含取消/申诉/下架/重上架），协商制「我想要」而非支付

---

## 快速开始

### 1. 安装依赖
```bash
pnpm install
```

### 2. 配置环境变量
复制 `env.example` 为 `.env.local`，填入：
- Supabase URL + Anon Key（注册 https://supabase.com 后获取）
- 腾讯地图 API Key（https://lbs.qq.com/）

### 3. 部署数据库
在 Supabase Dashboard → SQL Editor 中，按顺序运行 `sql/` 目录下的迁移文件。

### 4. 启动开发
```bash
pnpm dev
```

### 5. 构建生产
```bash
pnpm build
```

---

## 目录结构

```
.
├── docs/                    # PRD、设计文档（唯一真理来源）
├── sql/                     # Supabase 迁移 SQL（幂等）
├── src/
│   ├── main.ts              # Vue 入口
│   ├── App.vue              # 根组件
│   ├── router/              # 路由配置
│   ├── stores/              # Pinia stores
│   ├── views/               # 页面组件
│   ├── components/          # 可复用组件
│   ├── lib/                 # 工具库（匹配算法、状态机、隐私、信任分等）
│   └── assets/              # 样式
├── android/                 # Capacitor Android 工程
├── scripts/                 # 构建/校验脚本
├── tests/                   # Vitest 单元测试
├── package.json
├── vite.config.ts
└── env.example
```

---

## 关键设计决策

- **隐私四层 L0-L2**：L0 仅匹配度% → L0.5 虚拟 ID → L1 完整卡 → L2 联系方式，逐层授权
- **交易状态机 8 态**：active→reserved→shipped→completed，含 cancel/dispute/archive/reopen，XState 建模
- **雷达五维匹配**：场景 30 + 兴趣 25 + 意图 20 + 身份 15 + 地区 10，100 分制
- **trust_score 信任分**：见面×3 + 交易成功×2 + 完成活动×1，上限 20
- **双人配对**：配对不排他、跳过不落库、分数只用于排序不用于许可
- **女性安全**：NG 过滤、昵称隐私化、临时数据物理删除、举报

---

## 文档

- **PRD**：`docs/PRD-kizuna-p0.md`（9 章 + 对抗性审查附录）
- **同窗会双人配对设计**：`docs/同窗会-双人配对设计_2026-10-03.md`
- **分享功能设计**：`docs/分享功能设计_2026-10-07.md`
- **意图留存设计**：`docs/意图留存设计_2026-10-05.md`
- **版本历史**：`CHANGELOG.md`

---

## License

[MIT](./LICENSE) © 2026 tamupuya
