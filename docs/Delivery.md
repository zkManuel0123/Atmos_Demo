# Delivery Notes

最后更新：2026-03-29

## 任务理解

根据 [Introduction.md](/D:/Interview/deepwisdom/docs/Introduction.md) 的要求，这次笔试最关键的不是复刻完整 Atoms，而是在有限时间里交付一个：

- 可运行
- 有真实交互
- 有数据持久化
- 有 Agent 驱动流程
- 有类似 Atoms 的产品体验
- 可在线访问和演示

因此当前 Demo 的实现方向被收敛为：

`AI Web Builder / Dashboard Builder`

它不是一个通用 AI 开发平台，而是一个更适合在面试时间预算内完整交付的原型：

1. 用户访问公开首页
2. 首次点击生成时登录 / 注册
3. 登录后发起自然语言任务
4. 系统运行完整 agent tool loop
5. 左侧聊天流可视化展示 Agent 执行过程
6. 右侧展示生成出的真实网页结果
7. 用户继续 refinement，并保留版本历史

## 当前版本概况

当前完成度可以定义为：

`主流程已跑通，线上已可访问，认证、生成、可视化、预览、版本记忆都已经具备。`

当前线上链接：

- 产品链接：`https://deepwisdom-six.vercel.app`
- 登录页：`https://deepwisdom-six.vercel.app/sign-in`
- 注册页：`https://deepwisdom-six.vercel.app/sign-up`

源码仓库：

- `https://github.com/zkManuel0123/Atmos_Demo`

## 已完成内容

### 1. 首页与访问入口

- 已实现公开可访问的首页
- 支持中文示例 prompt
- 支持从首页直接输入需求
- 首次点击“开始生成”时再要求登录，而不是一上来强制登录

### 2. 登录 / 注册

- 已接入 Clerk
- 已实现登录页和注册页
- 已实现首页公开、生成前登录的拦截策略

这部分对应题目中“基本使用流程（如初始化 / 注册 / 核心主流程）”的要求。

### 3. Kimi K2.5 接入

- 已接入 `Kimi K2.5`
- 当前优先级为：
  - `KIMI_API_KEY`
  - `OPENAI_API_KEY`
  - mock fallback
- 已处理 Kimi 在多轮 tool calling 下的兼容问题
- 已处理 fenced JSON 返回导致的解析问题

### 4. 完整 Agent Tool Loop

当前后端已实现流式 `/api/generate/stream` 链路，而不是单次请求一次性返回。

已实现：

- SSE 流式事件返回
- 多轮 `model -> tool call -> tool result -> next round`
- 工具执行事件持续推送到前端
- 前端实时消费并渲染为会话流

当前内置工具包括：

- `todo_write`
- `set_build_mode`
- `capture_brief`
- `define_dashboard_schema`
- `define_information_architecture`
- `log_agent_decision`
- `finalize_spec`
- `build_artifact`

### 5. Agent 执行可视化

左侧已经不是静态卡片，而是更接近 Agent 产品的聊天流结构。

当前可见内容包括：

- 用户输入
- 执行计划
- 工具调用
- 工具结果
- Agent 输出
- 最终回答

用户可以看到：

- 现在在做哪一步
- Agent 做了什么决策
- 工具调用了什么
- 结果是怎样生成出来的

### 6. 真实网页结果预览

- 右侧结果通过 `iframe srcDoc` 渲染真实网页
- 不再只是静态 schema 或说明文字
- 结果区域已经收敛成 `chat + preview` 结构

### 7. 版本与 refinement

- 每次生成保存一个版本
- 支持基于当前版本继续 refinement
- 支持切换历史版本查看结果

### 8. 数据持久化

当前使用浏览器本地持久化：

- 项目列表
- 当前项目
- 版本历史
- 生成 artifact

这满足题目中的“具备数据持久化（不限技术方案）”。

### 9. 场景专项生成

针对 `dashboard / 数据大盘 / 销售看板 / revenue / pipeline` 这类需求做了专项优化。

例如：

- “帮我制作面向销售的业务数据大盘页面”

会优先按 dashboard 模式生成。

## 对照题目要求

### 1. 可运行的网页应用

已满足。

当前可完成：

- 访问首页
- 登录 / 注册
- 输入需求
- 调用模型
- 展示 Agent 执行过程
- 预览结果网页
- 继续 refinement
- 查看版本历史

### 2. 类似 Atoms 的能力与 UI 交互体验

已基本满足。

当前已具备：

- 自然语言驱动生成
- Agent 过程可视化
- 结果网页预览
- 继续迭代修改

和 Atoms 的差距仍主要在：

- 视觉细节精致度
- 更复杂的多 Agent 协作深度
- 更完整的发布与云端能力

### 3. 真实交互，而非纯静态展示

已满足。

当前不是静态壳子，而是真实的：

- 登录
- prompt 输入
- 模型调用
- tool loop 执行
- 事件流返回
- 结果生成
- refinement

### 4. 数据持久化

已满足当前 MVP。

当前方案是本地持久化，后续可升级为服务端数据库。

### 5. 基本使用流程

已覆盖：

1. 首页访问
2. 登录 / 注册
3. 输入需求
4. 发起生成
5. 观察 Agent 执行
6. 查看结果
7. 继续 refinement
8. 切换历史版本

### 6. 至少一个延展或衍生能力

已满足。

当前已具备：

- refinement
- 版本历史
- dashboard 专项模式
- provider fallback

## 关键取舍

为了保证在面试时间里交付完整可演示的产品原型，当前主动没有做这些内容：

- 任意应用类型的完整生成平台
- 复杂代码沙箱
- 服务端数据库
- 多人协作
- 真正的发布系统

当前取舍是优先保证：

- 主流程完整
- 在线可访问
- 有登录
- 有 Agent 感
- 有结果预览
- 有持久化

## 当前不足

当前仍未完全收尾的部分：

- UI 细节还可以继续向 Atoms / Adorable 收敛
- 生成质量仍受模型稳定性影响
- 持久化仍是本地浏览器级别，不是账号级服务端存储
- 线上还没有分享链接、发布链接和协作能力

## 如果继续投入时间，我会如何扩展

优先级如下：

### P1

- 接入 Supabase / Postgres，把项目和版本迁移到服务端
- 将登录态与项目数据绑定，形成真实账号级持久化

### P2

- 继续提升 dashboard、官网首页、B2B SaaS 三类高频场景的生成质量
- 让结构、布局和内容稳定性更好

### P3

- 增加分享链接和发布能力
- 让生成结果可以被第三方直接查看

### P4

- 扩展工具集，从单文件 artifact 向多文件项目演进
- 增加局部修改、模块替换、模板选择等能力

## 当前阶段结论

截至目前，这个 Demo 已满足题目里的核心方向：

- 有公开可访问链接
- 有 public GitHub 仓库
- 有登录 / 注册
- 有真实 Agent 执行链路
- 有执行过程可视化
- 有网页结果预览
- 有版本历史与 refinement
- 有数据持久化

当前最值得继续投入的方向，已经不是“能不能跑起来”，而是：

- UI 精修
- 结果生成质量
- 服务端持久化与发布能力
