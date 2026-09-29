import type { ReactNode, ComponentType, CSSProperties } from "react"
import { Image, ScrollView, Text, View } from "@tarojs/components"
import Taro from "@tarojs/taro"
import { Search, Sparkles } from "lucide-react-taro"

import { Input } from "@/components/ui/input"
import { brandColors, icon, layout, ui } from "@/lib/design-tokens"
import { cn } from "@/lib/utils"

const TAB_PATHS = new Set([
  "/pages/index/index",
  "/pages/business/index",
  "/pages/discover/index",
  "/pages/mall/index",
  "/pages/profile/index",
])

const navigateBackSafely = (fallbackUrl = "/pages/index/index") => {
  Taro.navigateBack({
    fail: () => {
      Taro.switchTab({
        url: TAB_PATHS.has(fallbackUrl) ? fallbackUrl : "/pages/index/index",
      })
    },
  })
}

type BrandIcon = ComponentType<any>

/** @deprecated 请使用 brandColors */
export const brand = {
  ink: brandColors.navyDeep,
  muted: brandColors.muted,
  line: brandColors.line,
  gold: brandColors.gold,
  blue: brandColors.blue,
  mint: brandColors.mint,
  rose: "#F56E9A",
  bg: brandColors.bgAlt,
}

export { brandColors, ui, layout, icon }

export const getStatusBarHeight = () => {
  const env = Taro.getEnv()
  if (env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT) {
    return Taro.getWindowInfo().statusBarHeight || 22
  }
  return 12
}

export const PageShell = ({
  children,
  className,
  scroll = true,
}: {
  children: ReactNode
  className?: string
  /**
   * true：内层 ScrollView（默认，适合 Tab/列表）
   * false：固定视口，需页面自管 ScrollView（适合底栏固定页）
   * page：交给小程序页面原生滚动（适合含大量 Input 的长表单，避免 ScrollView 抢焦点）
   */
  scroll?: boolean | "page"
}) => {
  const content = (
    <View className={cn("bg-background", className)}>
      <View className="relative z-10">{children}</View>
    </View>
  )

  if (scroll === "page") {
    return (
      <View className={cn("box-border min-h-screen bg-background", className)}>
        <View className="relative z-10">{children}</View>
      </View>
    )
  }

  if (!scroll) {
    // 固定视口高度 + column flex，子级 ScrollView 才能用 flex-1 / height:100% 滚动，
    // 避免 min-h-screen + overflow-hidden 把长富文本裁成「只显示首段」。
    return (
      <View
        className={cn("box-border overflow-hidden bg-background", className)}
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <View
          className="relative z-10"
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {children}
        </View>
      </View>
    )
  }

  // Tab 页内用固定高度 ScrollView，避免 overflow-hidden + min-h-screen 把底部菜单裁切掉
  return (
    <ScrollView
      scrollY
      enhanced
      showScrollbar
      className="box-border bg-background"
      style={{ height: "100vh" }}
    >
      {content}
    </ScrollView>
  )
}

const HOME_CONSTELLATION_SVG = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 28" fill="none">
    <circle cx="36" cy="5" r="2.8" fill="#E8D5A8"/>
    <circle cx="10" cy="22" r="2.2" fill="#C9A96E" fill-opacity="0.9"/>
    <circle cx="62" cy="18" r="2.2" fill="#C9A96E" fill-opacity="0.9"/>
    <circle cx="36" cy="20" r="1.6" fill="#FFFFFF" fill-opacity="0.55"/>
    <path d="M36 7.5L11.5 20.5" stroke="#C9A96E" stroke-opacity="0.32" stroke-width="0.9"/>
    <path d="M36 7.5L60.5 16.5" stroke="#C9A96E" stroke-opacity="0.32" stroke-width="0.9"/>
    <path d="M11.5 22.5L36 20.5" stroke="#C9A96E" stroke-opacity="0.22" stroke-width="0.8"/>
    <path d="M60.5 18.5L36 20.5" stroke="#C9A96E" stroke-opacity="0.22" stroke-width="0.8"/>
  </svg>`,
)}`

/** 首页专用顶栏：品牌名 + 星河装饰，无副标题 */
export const HomeHeroHeader = ({
  children,
  withStatusBar = true,
}: {
  children?: ReactNode
  withStatusBar?: boolean
}) => (
  <View
    className="relative mb-2 overflow-hidden px-4 pb-3"
    style={{
      background: `linear-gradient(168deg, ${brandColors.navyDeep} 0%, ${brandColors.navy} 52%, #243B5C 100%)`,
    }}
  >
    <View
      className="pointer-events-none absolute left-0 right-0 top-0 h-px"
      style={{
        background: `linear-gradient(90deg, transparent 0%, ${brandColors.gold}88 50%, transparent 100%)`,
      }}
    />
    <View
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage: `radial-gradient(circle at 82% 18%, ${brandColors.blue}66 0%, transparent 52%),
          radial-gradient(circle at 12% 88%, ${brandColors.gold}14 0%, transparent 42%),
          radial-gradient(circle at 92% 72%, ${brandColors.mint}12 0%, transparent 36%)`,
      }}
    />
    <View
      className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full"
      style={{ borderWidth: 1, borderStyle: "solid", borderColor: `${brandColors.gold}18` }}
    />
    <View
      className="pointer-events-none absolute -right-4 top-2 h-24 w-24 rounded-full"
      style={{ borderWidth: 1, borderStyle: "solid", borderColor: `${brandColors.gold}12` }}
    />
    <View
      className="pointer-events-none absolute -left-14 bottom-0 h-28 w-28 rounded-full"
      style={{ backgroundColor: `${brandColors.gold}0D` }}
    />
    <View
      className="pointer-events-none absolute bottom-0 left-0 right-0 h-px"
      style={{ backgroundColor: `${brandColors.gold}44` }}
    />

    {withStatusBar ? <View style={{ height: `${getStatusBarHeight()}px` }} /> : null}

    <View className="relative flex flex-col items-center pb-1 pt-2">
      <Image
        src={HOME_CONSTELLATION_SVG}
        mode="aspectFit"
        className="mb-2 h-5 w-16 opacity-90"
      />
      <Text className="block text-center text-lg font-bold tracking-widest text-white">
        星河百谷俱乐部
      </Text>
      <View
        className="mt-2 h-0.5 w-10 rounded-full"
        style={{
          background: `linear-gradient(90deg, transparent, ${brandColors.gold}, transparent)`,
        }}
      />
    </View>

    {children ? <View className="relative mt-3">{children}</View> : null}
  </View>
)

export const HeroHeader = ({
  eyebrow,
  title,
  subtitle,
  action,
  children,
  compact = false,
  dense = false,
  brandFirst = false,
  showBack = false,
  withStatusBar = true,
  backFallbackUrl = "/pages/index/index",
  onBack,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  action?: ReactNode
  children?: ReactNode
  compact?: boolean
  dense?: boolean
  /**
   * 品牌优先：eyebrow 作主品牌（放大+团标），title/subtitle 弱化
   * 用于首页等品牌露出页
   */
  brandFirst?: boolean
  /** custom 导航非 Tab 页显示返回箭头 */
  showBack?: boolean
  /** 系统导航栏页面应设为 false，避免双顶栏空白 */
  withStatusBar?: boolean
  backFallbackUrl?: string
  onBack?: () => void
}) => {
  const handleBack = () => {
    if (onBack) {
      onBack()
      return
    }
    navigateBackSafely(backFallbackUrl)
  }

  const backButton = showBack ? (
    <View
      className="mr-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.16)",
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "rgba(232, 213, 168, 0.65)",
      }}
      onClick={handleBack}
    >
      {/*
        lucide Image 图标在部分微信机型上白/浅色描边会整块发白、看不见箭头。
        这里用文字箭头保证返回符号稳定可见。
      */}
      <Text
        className="block text-center text-3xl font-semibold leading-none text-gold-light"
        style={{ marginTop: -2, marginLeft: -1 }}
      >
        ‹
      </Text>
    </View>
  ) : null

  return (
    <View
      className={cn(
        "relative px-4",
        dense ? "pb-2 pt-0" : compact ? "pb-3 pt-0" : "pb-3 pt-1",
        "mb-2",
      )}
      style={{
        background: `linear-gradient(165deg, ${brandColors.navyDeep} 0%, ${brandColors.navy} 55%, #243B5C 100%)`,
      }}
    >
      <View
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-px"
        style={{ backgroundColor: `${brandColors.gold}55` }}
      />
      {withStatusBar ? <View style={{ height: `${getStatusBarHeight()}px` }} /> : null}
      {!dense ? (
        <View
          className={cn(
            "flex flex-row items-start gap-2",
            (Taro.getEnv() === Taro.ENV_TYPE.WEAPP || Taro.getEnv() === Taro.ENV_TYPE.TT) && "pr-24",
          )}
        >
          {backButton}
          <View className="min-w-0 flex-1">
            {brandFirst && eyebrow ? (
              <>
                <View className="mb-2 flex flex-row items-center justify-center">
                  <Text className="block text-center text-xl font-bold tracking-wide text-white">
                    {eyebrow}
                  </Text>
                </View>
                {title || subtitle ? (
                  <View className="flex flex-row flex-wrap items-center justify-center gap-x-1.5">
                    {title ? (
                      <Text className="block text-xs font-medium text-white text-opacity-75">
                        {title}
                      </Text>
                    ) : null}
                    {title && subtitle ? (
                      <Text className="block text-xs text-white text-opacity-40">·</Text>
                    ) : null}
                    {subtitle ? (
                      <Text className="block text-xs text-white text-opacity-55">
                        {subtitle}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : (
              <>
                {eyebrow ? (
                  <View className="mb-2 flex flex-row items-center gap-2">
                    <Sparkles size={icon.sm} color={brandColors.gold} strokeWidth={icon.stroke} />
                    <Text className="block text-xs font-medium tracking-wide text-gold-light">{eyebrow}</Text>
                  </View>
                ) : null}
                <Text className={cn("block font-semibold tracking-tight text-white", compact ? "text-xl" : "text-2xl")}>
                  {title}
                </Text>
                {subtitle ? <Text className={ui.heroSubtitle}>{subtitle}</Text> : null}
              </>
            )}
          </View>
          {action ? <View className="flex-shrink-0">{action}</View> : null}
        </View>
      ) : (
        <View
          className={cn(
            "flex flex-row items-center gap-2",
            (Taro.getEnv() === Taro.ENV_TYPE.WEAPP || Taro.getEnv() === Taro.ENV_TYPE.TT) && "pr-24",
          )}
        >
          {backButton}
          <Text className="block min-w-0 flex-1 truncate text-lg font-semibold text-white">{title}</Text>
          {action ? <View className="ml-2 flex-shrink-0">{action}</View> : null}
        </View>
      )}
      {children ? <View className="mt-3">{children}</View> : null}
    </View>
  )
}

/** @deprecated 使用 SearchBar */
export const SearchPill = (props: Parameters<typeof SearchBar>[0]) => <SearchBar {...props} />

export const SearchBar = ({
  text,
  value,
  placeholder,
  iconColor = brandColors.muted,
  onClick,
  onChange,
  onSubmit,
  mode = "navigate",
  trailing,
  compact = true,
}: {
  text?: string
  value?: string
  placeholder?: string
  iconColor?: string
  onClick?: () => void
  onChange?: (value: string) => void
  onSubmit?: () => void
  mode?: "navigate" | "editable"
  trailing?: ReactNode
  compact?: boolean
}) => {
  const label = placeholder || text || "搜索"
  const isNavigate = mode === "navigate"

  if (isNavigate) {
    return (
      <View className="flex flex-row items-center gap-2">
        <View
          className={cn(
            "flex min-w-0 flex-1 flex-row items-center gap-2 rounded-xl bg-white px-3 shadow-sm",
            compact ? "h-9" : "h-10",
          )}
          onClick={onClick}
        >
          <Search size={icon.md} color={iconColor} strokeWidth={icon.stroke} />
          <Text className="block flex-1 text-sm text-muted-foreground">{text || label}</Text>
        </View>
        {trailing}
      </View>
    )
  }

  return (
    <View className="rounded-xl border border-white border-opacity-15 bg-white bg-opacity-10 p-1">
      <View className={cn("flex flex-row items-center gap-2 rounded-lg bg-white px-2", compact ? "h-9" : "h-10")}>
        <Search size={icon.md} color={iconColor} strokeWidth={icon.stroke} />
        <View className="min-w-0 flex-1">
          <Input
            variant="ghost"
            size="sm"
            className="w-full"
            placeholder={label}
            value={value}
            confirmType="search"
            onInput={(event) => onChange?.(event.detail.value)}
            onConfirm={() => onSubmit?.()}
          />
        </View>
        {trailing}
      </View>
    </View>
  )
}

export const SectionTitle = ({
  title,
  subtitle,
  extra,
  className,
}: {
  title: string
  subtitle?: string
  extra?: ReactNode
  className?: string
}) => (
  <View className={cn("mb-3 flex flex-row items-end justify-between px-1", className)}>
    <View>
      <Text className={cn(ui.sectionTitle)}>{title}</Text>
      {subtitle ? <Text className={cn("mt-1", ui.caption)}>{subtitle}</Text> : null}
    </View>
    {extra}
  </View>
)

export const SoftCard = ({
  children,
  className,
  onClick,
  style,
  elevated = false,
  bordered = false,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
  style?: CSSProperties
  elevated?: boolean
  /** 默认无描边，仅阴影；需要列表分割时可开启 */
  bordered?: boolean
}) => (
  <View
    className={cn(
      "relative rounded-2xl bg-card",
      bordered ? "border border-border" : "shadow-card",
      elevated && "shadow-md",
      className,
    )}
    onClick={onClick}
    style={style}
  >
    {children}
  </View>
)

export const IconBubble = ({
  icon: Icon,
  color = brandColors.blue,
  variant = "gold",
  size = "md",
  className,
}: {
  icon: BrandIcon
  color?: string
  variant?: "gold" | "blue" | "mint"
  size?: "md" | "lg"
  className?: string
}) => {
  const bg =
    variant === "blue" ? "bg-blue-surface" : variant === "mint" ? "bg-mint-tint" : "bg-gold-surface"
  // 略收紧底盒圆角、放大图标，避免「底大标小」
  const dim = size === "lg" ? "h-12 w-12 rounded-xl" : "h-11 w-11 rounded-xl"
  const iconSize = size === "lg" ? icon.xl : icon.lg

  return (
    <View className={cn("flex items-center justify-center", dim, bg, className)}>
      <Icon size={iconSize} color={color} strokeWidth={icon.stroke} />
    </View>
  )
}

export const QuickEntryItem = ({
  label,
  icon: Icon,
  variant = "blue",
  onClick,
}: {
  label: string
  icon: BrandIcon
  variant?: "blue" | "gold" | "mint"
  onClick?: () => void
}) => {
  const iconColor =
    variant === "gold" ? brandColors.gold : variant === "mint" ? brandColors.navySecondary : brandColors.blue

  return (
    <View className="flex flex-col items-center gap-2" onClick={onClick}>
      <IconBubble icon={Icon} color={iconColor} variant={variant} size="lg" />
      <Text className="block text-center text-xs font-medium text-foreground">{label}</Text>
    </View>
  )
}

export const QuickEntryGrid = ({
  entries,
}: {
  entries: Array<{
    label: string
    icon: BrandIcon
    variant?: "blue" | "gold" | "mint"
    onClick?: () => void
  }>
}) => (
  <View className="grid grid-cols-4 gap-x-2 gap-y-5">
    {entries.map((entry) => (
      <QuickEntryItem key={entry.label} {...entry} />
    ))}
  </View>
)

export const MenuListItem = ({
  icon: Icon,
  label,
  badge,
  iconColor = brandColors.blue,
  danger = false,
  onClick,
}: {
  icon: BrandIcon
  label: string
  badge?: string
  iconColor?: string
  danger?: boolean
  onClick?: () => void
}) => (
  <View className="flex flex-row items-center px-4 py-3" onClick={onClick}>
    <View className="mr-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gold-surface bg-opacity-50">
      <Icon size={icon.lg} color={danger ? brandColors.danger : iconColor} strokeWidth={icon.stroke} />
    </View>
    <Text className={cn("block flex-1 text-sm font-medium", danger ? "text-destructive" : "text-foreground")}>
      {label}
    </Text>
    {badge ? (
      <Text className="mr-2 block text-xs text-accent-foreground">{badge}</Text>
    ) : null}
    <Text className="block text-muted-foreground">›</Text>
  </View>
)

export const EmptyState = ({
  title,
  description,
  icon: Icon = Sparkles,
}: {
  title: string
  description?: string
  icon?: BrandIcon
}) => (
  <SoftCard className="flex flex-col items-center justify-center px-6 py-12">
    <View className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-tint">
      <Icon size={ui.iconEmpty} color={brandColors.blue} strokeWidth={ui.iconStroke} />
    </View>
    <Text className={cn(ui.cardTitle)}>{title}</Text>
    {description ? <Text className={cn("mt-1 text-center", ui.caption)}>{description}</Text> : null}
  </SoftCard>
)

export const FieldWell = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => <View className={cn(ui.fieldWell, className)}>{children}</View>

export const MetaRow = ({
  icon: Icon,
  children,
  iconColor = brandColors.muted,
}: {
  icon: BrandIcon
  children: ReactNode
  iconColor?: string
}) => (
  <View className="flex flex-row items-center gap-2">
    <Icon size={ui.iconMeta} color={iconColor} strokeWidth={ui.iconStroke} />
    <Text className={cn(ui.caption, "text-muted-foreground")}>{children}</Text>
  </View>
)

export const FixedBottomBar = ({
  children,
  className,
  aboveTabBar = false,
  mode = 'fixed',
  style,
}: {
  children: ReactNode
  className?: string
  aboveTabBar?: boolean
  /** dock：与 web-view 同列，供完整 H5 详情页使用；fixed：悬浮在页面底部 */
  mode?: 'fixed' | 'dock'
  style?: Record<string, string | number>
}) => (
  <View
    className={className}
    style={{
      ...(mode === 'dock'
        ? layout.dockedBottomStyle
        : aboveTabBar
          ? layout.fixedBottomAboveTabStyle
          : layout.fixedBottomStyle),
      ...style,
    }}
  >
    {children}
  </View>
)

export const CoverThumb = ({
  children,
  className,
  aspect = "square",
}: {
  children: ReactNode
  className?: string
  aspect?: "square" | "video" | "wide"
}) => (
  <View
    className={cn(
      ui.coverThumb,
      aspect === "square" && "aspect-square",
      aspect === "video" && "aspect-video",
      aspect === "wide" && "h-20 w-20",
      className,
    )}
  >
    {children}
  </View>
)

export const ListThumb = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => (
  <CoverThumb aspect="wide" className={cn("h-20 w-20 flex-shrink-0", className)}>
    {children}
  </CoverThumb>
)

export const FilterChip = ({
  label,
  active,
  count,
  onClick,
}: {
  label: string
  active?: boolean
  count?: number
  onClick?: () => void
}) => (
  <View
    className={cn(
      "rounded-lg px-3 py-2",
      active ? "bg-accent" : "bg-card shadow-sm",
    )}
    onClick={onClick}
  >
    <Text
      className={cn(
        "block text-xs font-medium",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      {count !== undefined ? `${label} ${count}` : label}
    </Text>
  </View>
)
