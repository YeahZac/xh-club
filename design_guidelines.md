# 上星河俱乐部 - 设计指南

## 品牌定位
- 应用定位：社交电商会员俱乐部
- 设计风格：热烈促销感 + 信任感
- 目标用户：追求优惠的年轻消费者

## 配色方案（Tailwind 类名）

| 角色 | 色值 | 用途 | Tailwind |
|------|------|------|----------|
| 主色 | #FF2442 | 按钮、选中态、价格、促销标签 | `bg-[#FF2442]` `text-[#FF2442]` |
| 辅色 | #FF6034 | 渐变终点、次要CTA | `bg-[#FF6034]` `text-[#FF6034]` |
| 金色 | #FFB800 | 会员/积分标识 | `text-[#FFB800]` |
| 背景 | #F4F4F4 | 页面底色 | `bg-[#F4F4F4]` |
| 文字主 | #1A1A1A | 标题、商品名 | `text-[#1A1A1A]` |
| 文字辅 | #888888 | 描述、副标题 | `text-[#888]` |
| 分割线 | #F0F0F0 | 分隔 | `bg-[#F0F0F0]` |

主渐变：`bg-gradient-to-br from-[#FF2442] to-[#FF6034]`

## 字体规范
- H1: text-xl font-bold (商品标题、页面标题)
- H2: text-base font-semibold (区块标题)
- Body: text-sm font-normal (正文)
- Caption: text-xs text-gray-500 (辅助信息)
- Price: text-lg font-extrabold text-[#FF2442] (价格)

## 间距系统
- 页面边距: px-4 (16px)
- 卡片内边距: p-3 (12px)
- 卡片间距: gap-2 (8px)
- 列表项间距: gap-2

## 容器样式
- 卡片圆角: rounded-xl (12px)
- 按钮圆角: rounded-full
- 卡片阴影: shadow-sm
- 输入框圆角: rounded-full

## 组件使用原则
- 通用 UI 组件优先使用 `@/components/ui/*`
- 按钮: `@/components/ui/button`
- 输入框: `@/components/ui/input`
- 卡片: `@/components/ui/card`
- 标签: `@/components/ui/badge`
- 标签页: `@/components/ui/tabs`
- 弹窗: `@/components/ui/dialog`
- 提示: `@/components/ui/sonner`
- 开关: `@/components/ui/switch`
- 骨架屏: `@/components/ui/skeleton`

## 导航结构
- TabBar 四页: 首页 / 分类 / 购物车 / 我的
- TabBar 选中色: #FF2442, 未选中色: #999999
- 首页 → 商品详情 (navigateTo)
- 购物车 → 结算确认 (navigateTo)
- 我的 → 订单列表 (navigateTo)

## 小程序约束
- 图片资源走 TOS 对象存储
- TabBar 图标使用本地 PNG (81x81)
- 列表使用虚拟滚动优化
- 首屏数据预加载
