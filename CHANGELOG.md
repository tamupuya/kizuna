# Kizuna 更新日志

> 从 2026-08-18 起，开发工作根目录迁移至 `D:\deepseekharness\datachange\kizuna\`。
> 后续所有代码改动、归档、CHANGELOG 都以此目录为准（永久记忆）。

---



## v0.10.5-share (2026-10-07)

### 修复
- **头像上传失败（根因）**：Supabase Storage 三个桶（`kizuna-avatars` / `zhonggu-images` / `oc-artworks`）从未创建，上传返回 404 NoSuchBucket。新增 `sql/migration-storage-buckets-2026-10-07.sql`（建 3 桶 + 每桶 4 策略，全幂等）。需用户在 Supabase 跑一次，跑完不需重打 APK。
- **分享功能是假的**：`PreviewView.shareCard()` 分享 `window.location.href`，在 Capacitor 里是 `http://localhost`，别人打不开。改为 A+C 两种形态（见下）。
- **pnpm 符号链接损坏**：node_modules 从旧目录拷来导致 24 个包 symlink 目标不存在（vite/vue 等全断），`tsc` 报 `Cannot find type definition file for 'vite/client'`。新增 `scripts/_fix-symlinks.cjs` 扫描并重建为 junction。

### 新增
- `src/components/ShareCard.vue`：导出用竖版人设卡（复刻 ProfileView MUJI 竖版卡设计）
- `src/lib/share.ts`：`exportCardPng` / `shareCardImage` / `shareCardText` / `buildCardText`
- `tests/share.spec.ts`：8 条单测（含「不含联系方式」隐私底线）
- 依赖：`@capacitor/share@8.0.3`、`@capacitor/filesystem@8.1.4`、`html-to-image@1.11.13`

### 改动
- `PreviewView.vue`：「分享」按钮 → 「分享图片」+「复制文本」（走系统分享面板，降级复制）；新增离屏卡 Teleport 避免祖先 transform 破坏 `position: fixed`
- `ProfileView.vue`：同源接入图片/文本分享
- `share.ts`：`toPng` 加 `imagePlaceholder`（头像跨域取不到时用透明占位，不让整张导出失败）

### 验证
- tsc EXIT=0 / build 4.43s 成功 / vitest **49/49** 通过（5 文件）
- cap sync EXIT=0（识别 3 插件）/ Gradle BUILD SUCCESSFUL
- APK 深核验：SharePlugin + FilesystemPlugin 在 DEX 中 OK；share chunk 含 `kizuna-card-`、`来自「绊 KIZUNA」`
- 安全核验：`kizuna-2026-r1kk-admin` / `admin_audit_logs` 均 0

### APK
- `C:\Users\19096\Desktop\kizuna\kizuna-v0.10.5-share.apk`
- MD5 `228D047FD72CADAC76D70892A0B27D7F`，8,209,556 bytes（7.83 MB）
- 归档：`C:\Users\19096\Desktop\kizuna-versions\v0.10.5-share\`

---

## v0.10.4-comfort-bugs (2026-10-06)
- 修复 MatchDetailView L0 隐私承诺漏洞（模糊态实际全暴露 → 按 shareLevel 隐藏完整资料）
- 统一头像 fallback 为小猫默认头像（MessagesView/userStore 去除 placehold.co）
- 原生 alert/confirm 在 Android WebView 不弹 → 新增 MUJI 风格确认弹窗 + toast 化全部提示
- 版本号陈旧修正（SelectView/SettingsView 统一 v0.10.4）
- 危险操作确认按钮红色语义化

## v0.9.19.1-env-fix（2026-08-20，已打 APK）

**需求**：修复登录注册"未配置"错误
**根因**：新建项目根缺 `.env.local` → Supabase 未配置 → fallback 返回 not configured
**打包时间**：2026-08-20 23:30
**状态**：✅ 已打 APK / ⏸ 用户装机验证中

**APK**：`C:\Users\19096\Desktop\kizuna\kizuna-v0.9.19.1-env.apk`
- MD5：`6BA8473B7904B9FF25655245DF3AB4D5`
- 大小：4,685,408 字节（4.47 MB）
- 归档：`C:\Users\19096\Desktop\kizuna-versions\v0.9.19.1-env-fix\`

**校验通过**：APK 内 index-Sfxt3bCm.js 含 Supabase URL/ANON_KEY/RadarRoomsView/ExposView/中谷店

---

## v0.9.19-radar-room-stay（2026-08-18，已打 APK）

**APK**：`C:\Users\19096\Desktop\kizuna\kizuna-v0.9.19-radar-room-stay.apk`
- 大小：4,543,600 字节（4.33 MB）
- MD5：`3BB340D2A86EA51C3209B33852AC0F0F`（第一次是 `D13007A8...` 但 APK 仍然是旧代码，详踩坑）
- 归档：`C:\Users\19096\Desktop\kizuna-versions\v0.9.19-radar-room-stay\`

**构建信息**：
- TypeScript: `npx tsc --noEmit` 0 错误
- Vite build: 3.50s, exit 0, PWA 74 entries
- Gradle: `clean` 51s + `assembleDebug --no-daemon` 1m 4s BUILD SUCCESSFUL（109 executed, 14 up-to-date）

**踩坑记录**：
- 第一次 `.\gradlew.bat` 找不到（PowerShell 5 不支持相对路径），改用绝对路径
- Gradle 端口 `Address already in use`，杀 Java 进程后加 `--no-daemon` 重试成功
- **新项目根 `D:\deepseekharness\datachange\kizuna\` 复制时漏掉 android 工程**（gradlew/build.gradle 等）—— 从原项目 `D:\work\persona-card-site-v0911\android` 补复制 176 个文件
- 安全策略拦截删除空目录 `app\android\`，未绕过，保留无碍（Gradle 不读空目录）
- **第一次打包的 APK 是旧代码**（TabBar 第 2 项还显示"同窗会"）—— 根因：`--no-daemon` + `clean assembleDebug` 组合下 gradle 没真正重新打包 web assets，APK 里的 index-*.js hash 仍是旧的（CePh7WK6）。**修复**：单独跑 `npx cap copy` + `npx cap sync` 确保 assets 更新，再 `clean` + `assembleDebug`。**校验脚本** `scripts\check-build.cjs` 比对 dist 与 android assets 的内容 hash 是关键

### 改动 1：RadarRoom 类型加 participants 字段
- `src/lib/mockData.ts`：RadarRoom interface 新增 `participants?: string[]`
- 进入房间时自动把当前用户 ID push 进 participants
- 同步到 Supabase（失败不阻塞，本地立即可见）

### 改动 2：RadarRoomView 返回键解绑（p0 根因修复）
- **根因**：`<button @click="leaveRoom">←</button>` 调用 `leaveRoom`，而 `leaveRoom` 房主分支调用 `closeRadarRoom(id, true)` 立即从本地列表过滤掉 → UI 立刻消失
- **修复**：返回键改为 `goBack`，仅 `router.push('/radar')`，不删数据
- 60s 倒计时删除逻辑保留——只在用户**显式点"解散"按钮**时触发

### 改动 3：RadarRoomsView "我在的房间" 区块（p0 显式展示）
- 顶部新增区块，只在 `myJoinedRooms.length > 0` 时显示
- 数据：自己发起的 + 自己作为参与者加入过的（`participants.includes(uid)`）
- 视觉区分：米色背景 `#fff5dc` + 棕色左边框 `4px #2b2a26` + 阴影
- 徽章：发起显示"房主"、参与显示"我在"
- 没加入任何房间时**完全隐藏**该区块

### 改动 4：发送后保持输入框焦点（p1 修复）
- **根因**：HTML 原生行为—— button click 会让前一个 input blur，导致手机输入法自动收起
- **修复 1**：发送按钮改 `@mousedown.prevent @click="sendMessage"` —— 阻止 mousedown 默认行为（input 失焦），仅响应 click
- **修复 2**：sendMessage 内 `await nextTick(); msgInputEl.value?.focus()` —— 双重保险，发送完强制保持焦点
- **修复 3**：点消息列表空白处（`.rr-messages` 或 `.msg-row`）触发 `onMessagesAreaClick` 让 input blur（QQ/微信 风格）

### 改动文件清单
- `src/lib/mockData.ts` —— RadarRoom interface 加 participants 字段
- `src/views/RadarRoomView.vue` —— 返回键解绑 + addSelfAsParticipant + msgInputEl ref + onMessagesAreaClick
- `src/views/RadarRoomsView.vue` —— 我在的房间区块（myJoinedRooms computed + 模板 + scoped style）

### 验证
- ✅ TypeScript: `npx tsc --noEmit` 0 错误
- ✅ Vite build: 3.50s, exit 0, PWA 74 entries (737.69 KiB)
- 产物：RadarRoomView 7.43 kB（+0.64）、RadarRoomsView 7.92 kB（+2.19）
- ⏸ APK：未打（按用户协议）

### 装机验证待办（用户做）
1. 发起一个房间 → 进入 → 点击"←"返回 → 房间仍在 "我在的房间" 区块，置顶，标"房主"徽章
2. 另一个用户加入该房间（自己注册第二个账户）→ 返回大厅 → 房间仍在 "我在的房间" 区块，标"我在"徽章
3. 输入文字 → 点"发送" → 键盘保持打开，可继续输入
4. 发送后点消息列表空白处 → 键盘收起
5. 显式点"解散"按钮 → 走 60s 倒计时（行为不变）

### 已知遗留（待后续）
- 参与者退出后应从 `participants` 移除（当前未做，仅 init 时加入）
- 倒计时删房间后，RadarRoomsView 应通过 Realtime 自动刷新（依赖现有 subscribeRealtime）
- Supabase `radar_rooms` 表需加 `participants TEXT[]` 列（migration 脚本待跑）

---

## v0.9.18-routing-restructure（2026-08-18，未打 APK）

**需求**：5 Tab 重构 + 首页 quickTab 真按钮化
**用户截图时间**：2026-08-17 23:56
**状态**：✅ 代码完成 + Vite build 成功（17.22s, 0 error）/ ⏸ 未打 APK（等用户指示）

### 改动 1：底部 TabBar 重排（5 Tab）
- **旧**：首页 / 同窗会 / + / 消息 / 我的
- **新**：首页 / **中谷店** / + / 消息 / 我的
- 中谷店从原"同窗会 Tab 内的二级 tab"提升为独立第 2 Tab
- 路由 `/radar` 移除（与中谷店功能分离）

### 改动 2：首页 quickTab 改造（p0）
- **旧**：4 个 quickTab（全部 / 今日漫展 / 中谷店 / 匹配）—— 假按钮，仅 scrollIntoView
- **新**：3 个 quickTab（**全部 / 漫展 / 同窗会**）—— 真按钮，router.push 新页面
  - 全部 → /home
  - 漫展 → /home/expos
  - 同窗会 → /home/radar-rooms

### 改动 3：新建视图
| 视图 | 路径 | 来源 | 行数 |
|---|---|---|---|
| `ExposView.vue` | `/home/expos` | 从 RadarView 提取漫展部分（list + map） | 5585 字节 |
| `RadarRoomsView.vue` | `/home/radar-rooms` | 从 RadarView 提取同窗会房间部分 | 4386 字节 |
| `ZhongguView.vue` | `/zhonggu` | 已存在（174 行） | 沿用 |

### 改动 4：删除首页中谷店 section
- HomeView 移除 `section-zhonggu`（中谷店 · 广场）
- 中谷店不再出现在首页
- 用户要求"中谷店内容不出现在首页"

### 改动 5：路由清理
- 路由 `/radar` **移除**（同窗会入口迁到 `/home/radar-rooms`）
- 路由 `/radar/launch` `/radar/room/:id` `/radar/:expoId` **保留**（同窗会房间详情、发起页）
- 路由 `/expo/:id` 保留（漫展详情）
- `/zhonggu` 指向 ZhongguView（独立中谷店页）

### 改动文件清单
- `src/components/TabBar.vue` —— tabs 数组改为 首页/中谷店/+/消息/我的，SVG icon 改中谷店
- `src/router/index.ts` —— 5 Tab 顺序调整 + 新增 3 个 quickTab 路由
- `src/views/HomeView.vue` —— quickTab 改 3 个 + push 路由 + 删中谷店 section + 3 处 /radar 引用改 /home/expos 或 /expo
- `src/views/ExposView.vue` —— **新建**（漫展列表/地图）
- `src/views/RadarRoomsView.vue` —— **新建**（同窗会房间列表）
- `src/views/RadarView.vue` —— **保留**（历史兼容，未挂载到路由，但代码可用）
- `src/views/ZhongguView.vue` —— **沿用**（独立中谷店 Tab）

### 验证
- ✅ TypeScript: `npx tsc --noEmit` 0 错误
- ✅ Vite build: 17.22s, 200 modules, PWA 73 entries (734.67 KiB)
- ⏸ APK：未打（用户要求"先不打 APK"）

### 装机验证待办（用户做）
1. 启动 App → 首页 4 个 quickTab 是否变 3 个（全部/漫展/同窗会）
2. 点击"漫展"是否 push 到 /home/expos（新界面）
3. 点击"同窗会"是否 push 到 /home/radar-rooms
4. 底部 TabBar 是否变成 首页/中谷店/+/消息/我的
5. 中谷店 Tab 是否显示"我的挂出/广场"二级 tab
6. 中谷店 Tab 空状态是否显示"暂无商品"
7. 首页是否已移除"中谷店 · 广场"section

---

## 历史版本

- **v0.9.17**（2026-08-16）—— 死代码清理
- **v0.9.16.1**（2026-08-15）—— 非房主退出按钮
- **v0.9.16**（2026-08-14）—— 雷达房间 6 增强（消息持久化/解散按钮/线上线下/分享人设卡/键盘保持/倒计时）
- **v0.9.15.1**（2026-08-14）—— 启动屏乱码修复
- **v0.9.15**（2026-08-14）—— 同窗会改名 + 4 项修复
- **v0.9.14**（2026-08-13）—— store 拆分
- **v0.9.13.4**（2026-08-12）—— 隐私删除（物理删除）
- **v0.9.13.3**（2026-08-12）—— 实时聊天
- **v0.9.13.2**（2026-08-10）—— TDZ 修复
- **v0.9.13.1**（2026-08-09）—— 雷达房间加固（12 项）
- **v0.9.13**（2026-08-08）—— 雷达房间（同窗会房间 4 要求）
- **v0.9.12**（2026-08-08）—— 4 层可见度 + trust_score
- **v0.9.11**（2026-08-07）—— 雷达 v3
- **v0.9.10.9**（2026-08-08）—— 漫展详情
- **v0.9.10.8**（2026-08-08）—— 签名 bio
- **v0.9.10.7**（2026-08-08）—— TDZ 修复
- **v0.9.10.6**（2026-08-08）—— 兴趣图鉴 ABC 三态
- 完整历史见 `D:\work\persona-card-site-v0911\` 历史归档

## v0.9.20-quicktab-keep-ui��2026-08-21��δ�� APK��

**����**��p0 - quickTab ���������ҳ�棬���������� UI ���䣨B վЧ����
**�Ķ�**��
- ·�ɣ�ɾ�� /home/expos �� /home/radar-rooms��ע�ͱ�����ExposView/RadarRoomsView �ļ��������󱸣�
- HomeView ��д���ϲ� ExposView ����չ�б� + RadarRoomsView ��ͬ���᷿���б�
- quickTab ��Ϊ -show + scrollIntoView������ 
outer.push��
- 4 �� stat����չ���Ҳ��Ϊ�л� quickTab ����չ������ҳ��

**Լ��**�����ļ� 300 ��Լ��ȡ����HomeView ���� 1099 �У�

**����**��TSC 0 errors��Vite build 4.50s��HomeView 14.38 kB��PWA 70 entries (945.78 KiB)
**״̬**��? δ�� APK�����û�ָʾ��

**װ����֤�嵥**��
1. ��ҳ quickTab 3 ����ȫ�� / ��չ / ͬ���ᣩ�л�����
2. ȫ������ʾ match banner + ��չ section + ͬ���� section
3. ��չ��ֻ��ʾ��չ section��ͬ�������أ�����������չ
4. ͬ���᣺ֻ��ʾͬ���� section����չ���أ���������ͬ����
5. ��չ section ��ɸѡ��ȫ��/������/������ʼ��
6. ͬ���� section �������ڵķ��䡹�ö�����
7. stat ��Ƭ��չ����л� quickTab ����չ
8. ������ҳ�棨·�ɲ��뿪 /home��

---



## v0.9.21-zhonggu-blank-detail（2026-08-21，未打 APK）

**需求**：p1 - 中谷店列表商品可点击 + 点击进入空白详情页（带返回键）

**改动**：
- ZhongguDetailView.vue：705 行 → 71 行空白页（返回键 + 标题 + "暂无内容 / 商品详情正在设计中"）
- ZhongguCard.vue：根 div 加 `@click="onCardClick"` + defineEmits('click')
- ZhongguView.vue：两个 ZhongguCard 循环都加 `@click="router.push('/zhonggu/${listing.id}')"`（我的挂出 + 广场）

**未做（用户明确）**：
- 不做顶部搜索栏
- 不做 tab 行（关注/推荐/服饰/道具/谷子）
- 不做卖家信息、价格、属性、交易须知等详情 UI
- 不做后端 migration（不加 condition/wants_count/views_count/tags 等字段）
- 不改列表布局

**构建**：TSC 0 errors；Vite build 4.36s；ZhongguDetailView 0.73 kB（之前 11.74 kB）；ZhongguCard 逻辑并入 ZhongguView 8.90 kB；PWA 70 entries (927.08 KiB)

**状态**：⏸ 未打 APK（按用户指示）

**装机验证清单**：
1. 中谷店 Tab → 我的挂出/广场 列表
2. 点击任一商品 → 跳转 /zhonggu/:id 空白页（"商品详情正在设计中"）
3. 空白页左上角返回键 → 返回中谷店列表

---


## v0.9.21-zhonggu-v3（2026-08-21，p1 全量版 + 关注系统）

**APK**: `kizuna-v0.9.21-zhonggu-v3.apk`（4.60 MB，MD5 `F24DD030BD74CBE3E174A74AA5A59839`）

### 改动

**后端 migration**（`sql/migration-zhonggu-v3.sql`，4 段）：
- `zhonggu_listings` 加 `condition` / `wants_count` / `views_count` / `tags TEXT[]` / `free_shipping` / `attributes JSONB` + GIN 索引
- `users` 加 `last_active_at`
- 新建 `follows` 表 + 索引
- `follows` RLS（公开读 / 自己写自己）

**前端 store**：
- 新建 `followStore.ts`（fetchFollows / toggleFollow / isFollowing / myFollowingIds / followingCount / followerCount + localStorage fallback `kizuna.follows`）
- `kizuna.ts` 聚合层加 followStore 代理
- `mockData.ts` ZhongguListing 加 5 字段；新建 Follow 接口

**前端视图**：
- 新建 `ZhongguCardCompact.vue`（双列卡片 6.2 KB）
- 重写 `ZhongguView.vue`（10.3 KB）：
  - 顶部搜索栏（返回 + 实时搜索框 + 搜索图标 + 拍照）
  - 5 tab：关注 / 推荐 / 服饰 / 道具 / 谷子
  - 双列网格（`repeat(2, 1fr)` + gap 10px）
  - 我的挂出快览（推荐 tab 顶部 3 张）
  - 关注空态 + 搜索空态

**ZhongguDetailView**：保持 71 行空白占位（用户决策"详情 UI 之后想好再告诉我"）

### 不做（用户决策）
- ❌ 详情页 UI（保持空白）
- ❌ "立即购买"按钮（产品约束不碰钱）

### 构建

- TSC 0 errors
- Vite build 4.40s（PWA 70 entries / 935.42 KiB）
- dist hash `fhtK0YSd` 与 android assets 一致
- Gradle BUILD SUCCESSFUL in 37s

### 用户需手动跑

1. Supabase SQL Editor 跑 `sql/migration-zhonggu-v3.sql`（4 段）
2. 卸载旧 APK 重装
3. 装机验证清单：
   - 5 tab 切换（关注/推荐/服饰/道具/谷子）
   - 搜索栏实时过滤
   - 双列网格
   - 点击商品 → `/zhonggu/:id` 空白页
   - 关注 tab 空态显示

---


## v0.9.22-muji-calibrate（2026-08-21，设计校准）

**APK MD5**: `1EC9DD130FC47BB9D57842ADBCE160BB`（4.59 MB）
**APK 路径**: `C:\Users\19096\Desktop\kizuna\kizuna-v0.9.22-muji-calibrate.apk`
**归档**: `C:\Users\19096\Desktop\kizuna-versions\v0.9.22-muji-calibrate\`

**目标**：将全局视觉样式校准到 muji design.md
**范围**：仅 `src/assets/style.css`（不动组件级 hardcode，按一致性原则）
**跳过**：MUJI Red `#7f0019`（用户取消）

### 改动

**主色板**：
- 主文字/深色按钮 `#2b2a26` → `#3c3c43`（muji text primary）
- 背景 `#fafaf8` → `#fff` 纯白
- Kinari `#fff5dc` → `#f4eede`（muji 标准）
- 文字 soft/faint 对齐 muji gray 700/500

**字体**：
- 优先级反转：Helvetica Neue / Arial → Noto Sans JP → PingFang SC
- 全局 `line-height: 1.6`
- 全局 `letter-spacing: normal`（禁用 muji palt）
- `word-break: break-all`
- `font-feature-settings: normal`
- 字体 size 体系：12/14/16/26/26/32px（h1=26, h2=32, h3=26）
- h3 例外：line-height 1.15 + letter-spacing 2.4px

**圆角**：
- sm/md/lg 全部统一 4px（muji 上限）
- pill `999px` → 4px
- input 0 圆角（muji 风格）

**阴影**：减至 2 级
- `shadow-sm` = `0 1px 2px rgba(0,0,0,0.08)`（hover 1 级）
- `shadow-md/lg` = `0 2px 8px rgba(0,0,0,0.1)`（dropdown 2 级）
- `shadow-card` 改为 hover-sm 强度
- 默认卡片扁平无 shadow

**间距 12 段**（4-96px）：
`--kizuna-space-xxxxs` 4px → `--kizuna-space-xxxxl` 96px
保留旧别名（xs/sm/md/lg）做兼容

**按钮**：
- Primary：bg `#3c3c43` + 4px + 12px/700 + min-height 44
- Secondary/Ghost：1px border `#d8d8d9` + 4px
- 旧 hover translateY 装饰动画删除（仅保留 opacity 0.85）
- 旧 `scale(0.98)` active 删除

**输入**：
- 0 圆角 + 1px border `#d8d8d9`
- focus 时 border 变 `#3c3c43`
- 字号 16px

**删除的装饰元素**：
- 3 种品牌渐变（grad-brand / grad-cta / grad-warm）
- 路由切换的 translateY 位移动画
- `kz-rise` / `kz-pop` / `kz-float` 装饰动画
- kz-btn-primary 的 hover translateY(-1px) 和 active scale

**保留的实用功能**：
- 7 状态色（半透底色）
- 强调蓝 `#1565c0`（限使用）
- 缓动曲线 `cubic-bezier(0.16, 1, 0.3, 1)`
- fade-in 路由动画
- shimmer/pulse 加载动画
- TabBar safe-bottom
- reduced-motion 媒体查询

### 不做

- ❌ 组件级 hardcode 改造（如 999px pill 按钮 → 4px）— 保持一致性原则，仅改 token
- ❌ MUJI Red `#7f0019`（用户取消）
- ❌ 入场动画位移（muji 风格仅 fade）

### 验证

- TSC + Vite build 待跑
- 装机验证清单：全 app 看起来更"素朴 / 留白 / 浅色"
- 重点看：按钮、卡片、TabBar、HomeView、ZhongguView

---

## v0.10.0-pairing — 2026-10-03

APK MD5: ECF694DBC1CEDA915484F86B87196A95 (4.53 MB)

### 修复
- **联网发消息也显示红色感叹号**（高优）：根因是 `radar_room_messages` 表无 `status` 列，
  而 sendMessage 把 `status:'sending'` 一起 insert → PGRST204 → 标 failed。
  即「只要发消息就必然失败，与联网无关」。修法为**剥离本地瞬时状态字段**而非加列。
- AddView「更新意图」空白可点击卡片 → 移除该条目
- `fetchAllPresences` 返回 `void` 导致配对拿不到数据 → 改为返回数组

### 新增
- **双人配对（同窗会重构）**：推窗 → 配对（看卡片 / 接受 / 跳过）→ 开房
  - `src/lib/pairing.ts`（19.2 KB）+ `src/views/PairView.vue`（21.2 KB）
  - `sql/migration-pairing.sql`：pair_signals + pairings + radar_rooms.mode/pairing_id + RLS
  - 意图优先权重：填了意图 → 意图 45% / 兴趣 35%；未填 → 兴趣优先
  - 漫展加分沿用 +30 同场同时段 / +22 同场同日 / +15 只有你在场
  - **池子规模可见**：缓解「小池子 × 双向不可见 → 零匹配黑等」
- `tests/pairing.spec.ts`：16 项测试，逐条验证四条核心规则
- `scripts/scan-dead.cjs`：系统性死代码扫描（零引用判定）

### 清理
- 死代码 12 个移入 `_legacy/`：admin 后台 7 个 + 组件 5 个
  （ErrorBoundary / ExpoCard / PullRefresh / TencentMap / VenueMap）
- 一次性脚本 22 个移入 `scripts/_archive/`
- 项目不在 git 下，一律移动保留而非删除

### 测试发现的真实缺陷
- `pickBestMatch` 原用 `score > 0` 过滤 → 无交集时返回 null。
  P0 场景（一场漫展几十人）中「无交集」是常态 → 产品会经常表现为「零匹配」，
  且用户分不清「真没人」与「被算法滤掉」。
  修正原则：**推开窗本身就是信号；分数只用于排序，不该用于许可。**

### 验证
- tsc 0 错误 / vitest 16/16 通过 / vite build 5.43s / Gradle BUILD SUCCESSFUL 51s
- APK 内容核验：含 `pair_signals`×3、`推窗`×3、`跳过`×5；死视图均为 0 次

### 用户待办
- 执行 `sql/migration-pairing.sql`（可选，不执行自动降级本地模式）
- 卸载旧版再装新 APK（PWA 缓存）

---
## v0.9.23.4-network-avatar (2026-08-23)
- p0-1 漫展网络化：expoStore Supabase 优先 + localStorage 缓存 + isOnline/isStale + 断网红 banner + 重试
- p0-2 消息状态机：sending/sent/failed + 失败感叹号点击重发 + 断网禁发提示
- p1 头像 fallback 小猫（EditorView 不再 placehold 首字母 + hasAvatar 判断）
- p1 人设卡+OC 卡横滑 + 圆点 + 统一 168px + 小卡去头像/删虚拟编号 + MBTI/星座去色
- APK MD5 F354820A8BA4EB38644669094FE96035 (4.39 MB)

## [v0.10.1-pairing-audit] — 2026-10-04

### 对抗性审查（用设计承诺反查代码）
- 方法转变：不再只跑已有测试，而是把 `pairing.ts` 顶部每条设计承诺翻译成会失败的测试
- 第一轮失败 6 条 → 暴露 3 个真实缺陷 + 1 个修复过程中引入的缺陷

### 修复
- **假的双向确认（高优）**：单方点「愿意认识」即显示「你们看见了彼此」，
  对方从未表态。新增 `isMutual()` + `pair_decisions` 表 + `waitingMutual` 阶段；
  文案改为「配对成立需要对方也愿意——这件事不能替他决定」
- **「再看看别人」死循环**：已接受的人不在排除列表，会反复推同一个人。
  `pickBestMatch` 新增 `excludeUserIds`，`loadDecidedIds()` 合并接受+跳过
- **池子规模含自己**：文案是「此刻也在这个场景里的人」，数字却算上自己。
  `countOpenSignals` 新增 `excludeUserId`
- **迁移缺表**：`pair_decisions` 在迁移中未定义，会导致「永远无法完成的双向确认」。
  `migration-pairing.sql` 新增第 5 段（含 RLS：不能替别人表态）
- **本地模式无限等待**：无 Supabase 时「对方」物理上不存在，文案分叉，不编造对方

### 测试
- 新增 3 个 spec：`pairing-audit`（承诺反查）、`pairing-decisions`（双向语义）、`pairing-flow`（双人端到端）
- **vitest 4 files / 41 tests / 41 passed**

### 清理
- 删除误导性桩函数 `checkMutual()`（配置 Supabase 时无条件返回 'pending'）
- 全库零引用扫描：0 个死文件

### 教训
> 不要让 UI 宣称代码没做的事。当天已因 ExpoDetailView「在场确认最高 50 分」
> （逻辑从未上线）修过一次，当晚在配对里犯了同型错误。

### APK
- `kizuna-v0.10.1-pairing-audit.apk`（4,751,582 bytes）
- MD5 `D4FB647F6DCC1519260649E711ECC6EC`
- `verify-apk-audit.cjs` 核验通过（密钥 0 次、死视图 0 次）

### 未完成（如实记录）
- `pairings` 表不写入；开房与配对的双向关联（`radar_rooms.pairing_id`）未接
- `PairView` 无 Realtime，靠 5 秒轮询
- 女性安全三项（人数上限/举报/加入需房主确认）
- 密码哈希非真正访问控制（客户端哈希可穷举）

