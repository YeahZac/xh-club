# 粤商汇 — 设计指南

## 品牌定位
- 应用定位：商会会员管理与商机对接平台
- 设计风格：商务大气 + 尊贵信任感
- 目标用户：企业家、投资人、商会会员（30-55岁为主）

## 配色方案（Tailwind 类名）

| 角色 | 色值 | 用途 | Tailwind |
|------|------|------|----------|
| 主色 | #1B2A4A | 导航栏、按钮、主标题 | `bg-[#1B2A4A]` `text-[#1B2A4A]` |
| 主色亮 | #2D4A7A | 渐变终点、次要强调 | `bg-[#2D4A7A]` `text-[#2D4A7A]` |
| 金色 | #C9A96E | 会员标识、等级、重要标签 | `text-[#C9A96E]` `bg-[#C9A96E]` |
| 金色亮 | #E8D5A8 | 轻量金色点缀 | `text-[#E8D5A8]` `bg-[#E8D5A8]` |
| 背景 | #F5F6FA | 页面底色 | `bg-[#F5F6FA]` |
| 文字主 | #1A1D2E | 标题 | `text-[#1A1D2E]` |
| 文字辅 | #6B7280 | 描述、副标题 | `text-gray-500` |
| 分割线 | #E8EAF0 | 分隔 | `bg-[#E8EAF0]` |
| 成功 | #10B981 | 成交、已确认 | `text-emerald-500` |
| 警示 | #F59E0B | 待审批、限时 | `text-amber-500` |

主渐变：`bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A]`
金渐变：`bg-gradient-to-r from-[#C9A96E] to-[#E8D5A8]`

## 字体规范
- H1: text-xl font-bold (页面标题)
- H2: text-base font-semibold (区块标题)
- Body: text-sm font-normal (正文)
- Caption: text-xs text-gray-500 (辅助信息)
- Number: text-lg font-bold tabular-nums (金额、积分)

## 间距系统
- 页面边距: px-4
- 卡片内边距: p-4
- 卡片间距: gap-3
- 列表项间距: gap-2
- 区块标题与内容: mb-3

## 容器样式
- 卡片圆角: rounded-2xl (16px)
- 按钮圆角: rounded-xl
- 输入框圆角: rounded-xl
- 卡片阴影: shadow-sm
- 大图Banner圆角: rounded-2xl
- 金色装饰线: 4px宽左侧竖线

## 组件使用原则
- 通用 UI 组件优先使用 `@/components/ui/*`
- 按钮: `@/components/ui/button`
- 输入框: `@/components/ui/input`
- 卡片: `@/components/ui/card`
- 标签: `@/components/ui/badge`
- 标签页: `@/components/ui/tabs`
- 弹窗: `@/components/ui/dialog`
- 提示: `@/components/ui/sonner`
- 骨架屏: `@/components/ui/skeleton`
- 轮播: `@/components/ui/carousel`
- 头像: `@/components/ui/avatar`
- 进度条: `@/components/ui/progress`

## 导航结构
- TabBar 五页: 首页 / 商机 / 发现 / 消息 / 我的
- TabBar 选中色: #C9A96E (金色), 未选中色: #999999
- 页面跳转: navigateTo (普通页) / switchTab (TabBar页)

## 大图策略
- Banner位：首页顶部、路演详情、活动详情，使用大图+深色渐变叠加+白色文字
- 人物卡片：头像大图 + 金色边框
- 项目封面：16:9大图 + 项目信息叠加
- 所有图片后台可配置，前端通过URL引用

## 小程序约束
- 图片资源走 TOS 对象存储，代码中使用URL
- TabBar 图标使用本地 PNG (81x81)
- 列表使用虚拟滚动优化
- 首屏数据预加载
- 大图懒加载
