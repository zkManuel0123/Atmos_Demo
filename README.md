# Atoms Studio Demo

在线访问链接：`https://deepwisdom-six.vercel.app`

源码仓库：`https://github.com/zkManuel0123/Atmos_Demo`

## 项目定位

这是一个面向 ROOT 全栈岗位笔试的 `Atoms-like Demo`。

我没有尝试复刻完整 Atoms，而是把问题收敛成一个更适合 6-8 小时交付的产品原型：

- 用户先进入公开产品首页
- 第一次点击“开始生成”时要求登录 / 注册
- 登录后通过自然语言发起网页生成任务
- 左侧以聊天流形式展示 Agent 执行过程
- 右侧展示真实网页结果
- 支持继续 refinement 和切换历史版本

这个方向参考了 Atoms 当前公开产品里最重要的体验特征：

- 自然语言驱动生成
- 多角色 / 多步骤 Agent 协作感
- 可视化结果预览
- 继续迭代修改

参考来源：

- Atoms 官网：https://atoms.dev/
- Atoms Overview：https://help.atoms.dev/en/articles/12087744-overview
- Your Agents Team：https://help.atoms.dev/en/articles/12129380-your-agents-team
- App Viewer：https://help.atoms.dev/en/articles/12129698-app-viewer
- Atoms Cloud：https://help.atoms.dev/en/articles/13036940-atoms-cloud

## 实现思路与关键取舍

### 1. 产品范围收敛

题目要求的是“一个可运行的 Atoms Demo”，而不是一个完整的通用 AI 开发平台。

因此当前实现刻意收敛为：

`AI Web Builder / Dashboard Builder`

而不是：

- 通用任意 App Builder
- 复杂沙箱执行平台
- 多端协作平台

这样做的原因是，在有限时间里，更重要的是交付：

- 清晰可演示的主流程
- 真实的 Agent 执行体验
- 可预览的最终结果
- 有记忆和迭代能力

### 2. Agent 实现策略

当前不是“单次 prompt -> 一次性返回整包结果”的简单生成器，而是一个完整的流式 agent tool loop：

- 前端请求 `/api/generate/stream`
- 后端循环执行 `model -> tool call -> tool result -> next round`
- 前端持续接收 SSE 事件并展示在聊天流中

当前内置工具包括：

- `todo_write`
- `set_build_mode`
- `capture_brief`
- `define_dashboard_schema`
- `define_information_architecture`
- `log_agent_decision`
- `finalize_spec`
- `build_artifact`

### 3. 结果生成策略

为了兼顾可控性和演示效果，当前生成目标不是“产出一整个真实项目文件树”，而是：

- 生成结构化 spec
- 再生成单文件网页 artifact
- 用 `iframe srcDoc` 直接渲染结果

这个取舍的好处是：

- 演示时稳定性更高
- 错误面更小
- refinement 更容易做
- 更符合面试交付的时间预算

### 4. 持久化策略

当前使用 `localStorage` 做本地持久化，而不是云端数据库。

这样做的原因是：

- 零部署门槛
- 版本切换和本地演示立即可用
- 避免数据库和鉴权系统拉长主流程开发时间

同时，这仍然满足题目中“具备数据持久化（不限技术方案）”的要求。

### 5. 登录策略

为了覆盖“初始化 / 注册 / 核心主流程”，当前接入了 `Clerk`：

- 首页公开可访问
- 第一次点击“开始生成”时要求登录 / 注册
- 登录后返回首页继续生成

这比“打开网站先被强制登录”更符合产品演示逻辑，也更利于面试官快速先看产品首页。

## 当前完成程度

### 已完成

- 公开可访问的线上链接
- GitHub public 源码仓库
- 首页输入体验
- Clerk 登录 / 注册
- 首次生成前登录拦截
- Kimi K2.5 接入
- Kimi 优先，OpenAI / mock fallback
- 流式 agent tool loop
- Agent 执行过程可视化
- 左侧聊天流展示执行过程
- 右侧网页结果预览
- 版本历史
- refinement
- dashboard / 业务大盘类 prompt 的专项生成
- 本地持久化
- Vercel 部署

### 已做但仍可继续优化

- 当前 UI 已收敛到 `chat + preview` 骨架，但细节还可以继续向 Atoms / Adorable 靠拢
- 当前网页生成质量已经可演示，但还可以继续提高稳定性和审美一致性
- 当前登录流程可用，但还没和服务端项目数据做真正绑定

### 还没做

- 服务端数据库持久化
- 共享项目 / 分享链接
- 一键发布生成页面
- 更复杂的多 Agent 编排
- 真实代码沙箱和文件系统级编辑
- 团队协作 / 多用户会话

## 如果继续投入时间，我会如何扩展

优先级判断如下：

### P1

- 接入 Supabase / Postgres，把项目、版本、会话迁移到服务端
- 将登录态与项目数据真正绑定
- 让不同设备 / 不同用户访问时拥有真实账号级持久化

### P2

- 继续优化网页生成质量，尤其是 dashboard、B2B SaaS、官网首页三类高频场景
- 强化生成结果的组件结构、图表布局和信息架构稳定性

### P3

- 增加“发布”能力，让生成结果拥有稳定公开链接
- 增加项目分享、只读访问、版本回退等更像产品的功能

### P4

- 扩展工具集，让 Agent 能操作模板、模块和局部区域
- 从当前单文件 artifact 逐步升级到多文件项目生成

## 本地运行

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:3000
```

## 环境变量

复制 `.env.example` 到 `.env.local` 后至少配置：

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

KIMI_API_KEY=your_kimi_key
KIMI_MODEL=kimi-k2.5
KIMI_BASE_URL=https://api.moonshot.cn/v1
```

可选 OpenAI fallback：

```bash
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-5.4-mini
```

优先级是：

`KIMI_API_KEY -> OPENAI_API_KEY -> mock fallback`

## 当前线上访问方式

当前线上策略是：

1. 打开首页可直接看到产品页
2. 第一次点击“开始生成”时，会跳转到登录 / 注册
3. 登录完成后返回首页
4. 再次点击生成，进入真实 Agent 执行流程

更多实现细节见 [docs/Delivery.md](./docs/Delivery.md)。
