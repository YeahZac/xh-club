/**
 * 星河俱乐部 · 视觉设计规范（Design Tokens）
 * 色值权威源：src/app.css CSS 变量；业务代码优先用 Tailwind 语义类。
 */

export const brandColors = {
  navy: '#1B2A4A',
  navyDeep: '#10264A',
  navySecondary: '#2D4A7A',
  ink: '#172033',
  foreground: '#1A1D2E',
  gold: '#C9A96E',
  goldLight: '#E8D5A8',
  goldMuted: '#D7BD87',
  goldTint: '#FFF8EB',
  goldSurface: '#F8F4EA',
  blue: '#2457A7',
  blueTint: '#EFF4FF',
  blueSurface: '#EAF0FA',
  mint: '#34C7A2',
  mintTint: '#EBFAF6',
  bg: '#F5F6FA',
  bgAlt: '#F4F7FB',
  surface: '#FFFFFF',
  field: '#F7F8FC',
  line: '#EEF0F5',
  lineSoft: '#F0F2F6',
  muted: '#98A2B3',
  mutedDark: '#6B7280',
  placeholder: '#667085',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
} as const

/** Tailwind 语义 class */
export const ui = {
  page: 'min-h-screen bg-background',
  pagePad: 'px-4',
  sectionGap: 'mb-4',
  listGap: 'gap-4',
  /** Tab 页滚动内容底部留白，避免被自定义 TabBar 遮挡 */
  scrollBottomPad: 'pb-24',

  heroTitle: 'block text-2xl font-semibold tracking-tight text-white',
  /** Hero 副标题：略提高不透明度，避免深底上发灰看不清 */
  heroSubtitle: 'mt-1 block text-xs leading-relaxed text-white text-opacity-80',
  sectionTitle: 'block text-lg font-semibold tracking-tight text-foreground',
  cardTitle: 'block text-sm font-semibold text-foreground leading-relaxed',
  body: 'block text-sm text-foreground leading-relaxed',
  caption: 'block text-xs text-muted-foreground',
  label: 'block text-xs font-medium text-muted-foreground',

  btnPrimary: 'h-11 w-full rounded-2xl',
  btnGold: 'h-11 w-full rounded-2xl',
  btnGhost: 'h-10 rounded-xl',

  card: 'rounded-2xl bg-card shadow-card',
  cardPad: 'p-4',
  /** 列表横排卡片内边距（封面+文案） */
  listCardPad: 'p-3',
  cardBorder: 'rounded-2xl border border-border bg-card shadow-sm',
  fieldWell: 'rounded-xl bg-field px-3 py-2',

  coverThumb: 'overflow-hidden rounded-xl bg-muted',
  coverHero: 'w-full overflow-hidden bg-muted',
  avatar: 'overflow-hidden rounded-full bg-muted',
  /** 列表横排卡片左侧封面：4:3 横图，比正方形更易读（项目/活动/人才统一） */
  listRowThumb: 'relative h-20 w-28 flex-shrink-0 overflow-hidden rounded-xl bg-muted',
  /** @deprecated 人才列表已统一到 listRowThumb；保留兼容旧引用 */
  listRowThumbPortrait: 'relative h-20 w-28 flex-shrink-0 overflow-hidden rounded-xl bg-muted',

  iconXs: 12,
  iconMeta: 14,
  iconInline: 16,
  iconAction: 18,
  iconEmpty: 22,
  iconStroke: 1.75,
} as const

export const icon = {
  xs: ui.iconXs,
  sm: ui.iconMeta,
  md: ui.iconInline,
  lg: ui.iconAction,
  xl: ui.iconEmpty,
  stroke: ui.iconStroke,
  color: {
    default: brandColors.muted,
    primary: brandColors.blue,
    brand: brandColors.gold,
    navy: brandColors.navy,
    inverse: '#ffffff',
  },
} as const

/** 固定底栏 */
export const layout = {
  tabBarOffset: 50,
  bottomBarPad: 'pb-24',
  fixedBottomStyle: {
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex' as const,
    flexDirection: 'row' as const,
    gap: '12px',
    padding: '12px 16px',
    paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
    backgroundColor: '#ffffff',
    borderTop: '1px solid #EEF0F5',
    zIndex: 1000,
    boxShadow: '0 -6px 24px rgba(27,42,74,0.08)',
  },
  fixedBottomAboveTabStyle: {
    position: 'fixed' as const,
    bottom: 50,
    left: 0,
    right: 0,
    display: 'flex' as const,
    flexDirection: 'row' as const,
    gap: '12px',
    padding: '12px 16px',
    paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
    backgroundColor: '#ffffff',
    borderTop: '1px solid #EEF0F5',
    zIndex: 100,
  },
  /** 与 web-view 同列排布，避免小程序原生 web-view 盖住 fixed 底栏 */
  dockedBottomStyle: {
    flexShrink: 0,
    width: '100%',
    boxSizing: 'border-box' as const,
    display: 'flex' as const,
    flexDirection: 'row' as const,
    gap: '12px',
    padding: '12px 16px',
    paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
    backgroundColor: '#ffffff',
    borderTop: '1px solid #EEF0F5',
  },
}
