import { useEffect, useState, type ReactNode } from 'react'
import { CoverView, RichText, ScrollView, Text, View, WebView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { resolveHtmlPageUrl } from '@/lib/open-html-content'
import { extractHtmlBody, normalizeRichHtml, type HtmlRenderType } from '@/lib/rich-html'
import { normalizeWebViewPageUrl } from '@/lib/webview-url'
import { brandColors } from '@/lib/design-tokens'
import { cn } from '@/lib/utils'

interface HtmlDetailFrameProps {
  html?: string | null
  type: HtmlRenderType
  params: { key?: string; id?: string | number }
  /** 覆盖在 web-view 上的底部操作区（须用 CoverView 子树，保证可点） */
  bottomBar?: ReactNode
  className?: string
  loadingText?: string
  errorText?: string
}

/**
 * 后台配置了完整 H5 时：整页只展示该 H5（web-view），
 * 可选底部 CoverView 操作栏（报名/兑换等原生逻辑仍可用）。
 */
export const HtmlDetailFrame = ({
  html,
  type,
  params,
  bottomBar,
  className,
  loadingText = '加载图文中...',
  errorText = '完整页面加载失败',
}: HtmlDetailFrameProps) => {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [useRichFallback, setUseRichFallback] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fallbackNodes = normalizeRichHtml(extractHtmlBody(html))
    void (async () => {
      setLoading(true)
      setFailed(false)
      setUseRichFallback(false)
      setUrl('')
      try {
        const next = normalizeWebViewPageUrl((await resolveHtmlPageUrl(type, params)) || '')
        if (cancelled) return
        if (next) {
          setUrl(next)
          return
        }
        if (fallbackNodes) {
          setUseRichFallback(true)
          return
        }
        setFailed(true)
      } catch (error) {
        console.error('[HtmlDetailFrame]', error)
        if (!cancelled) {
          if (fallbackNodes) setUseRichFallback(true)
          else setFailed(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [html, type, params.key, params.id])

  const richFallbackNodes = normalizeRichHtml(extractHtmlBody(html))

  if (loading) {
    return (
      <View className={cn('flex min-h-screen items-center justify-center bg-background', className)}>
        <Text className="block text-sm text-muted-foreground">{loadingText}</Text>
      </View>
    )
  }

  if (useRichFallback) {
    return (
      <View className={cn('relative box-border min-h-screen bg-background', className)}>
        <ScrollView scrollY className="box-border h-screen">
          <View className="px-4 py-3">
            <View className="mb-3 rounded-xl bg-amber-50 px-3 py-3">
              <Text className="block text-xs leading-relaxed text-amber-900">
                完整 H5 样式需在云托管绑定已备案 HTTPS 域名，并在小程序后台配置为「业务域名」。当前为简化预览。
              </Text>
            </View>
            {richFallbackNodes ? <RichText nodes={richFallbackNodes} /> : null}
          </View>
        </ScrollView>
        {bottomBar ? (
          <CoverView
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: '12px',
              paddingLeft: '16px',
              paddingRight: '16px',
              paddingTop: '12px',
              paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
              backgroundColor: 'rgba(255,255,255,0.96)',
              borderTop: '1px solid rgba(26,29,46,0.08)',
            }}
          >
            {bottomBar}
          </CoverView>
        ) : null}
      </View>
    )
  }

  if (failed || !url) {
    return (
      <View className={cn('flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6', className)}>
        <Text className="block text-sm text-muted-foreground">{errorText}</Text>
        <Text
          className="block text-sm text-primary"
          onClick={() => {
            setLoading(true)
            setFailed(false)
            void resolveHtmlPageUrl(type, params).then((raw) => {
              const next = normalizeWebViewPageUrl(raw || '')
              if (next) {
                setUrl(next)
                setUseRichFallback(false)
                setFailed(false)
              } else if (richFallbackNodes) {
                setUseRichFallback(true)
                setFailed(false)
              } else {
                setFailed(true)
              }
              setLoading(false)
            })
          }}
        >
          点击重试
        </Text>
      </View>
    )
  }

  return (
    <View className={cn('relative box-border bg-background', className)} style={{ height: '100vh' }}>
      <WebView src={url} />
      {bottomBar ? (
        <CoverView
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '12px',
            paddingLeft: '16px',
            paddingRight: '16px',
            paddingTop: '12px',
            paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
            backgroundColor: 'rgba(255,255,255,0.96)',
            borderTop: '1px solid rgba(26,29,46,0.08)',
          }}
        >
          {bottomBar}
        </CoverView>
      ) : null}
    </View>
  )
}

/** CoverView 内可用的主按钮（web-view 上层可点击） */
export const CoverActionButton = ({
  label,
  onClick,
  disabled = false,
  variant = 'brand',
}: {
  label: string
  onClick?: () => void
  disabled?: boolean
  variant?: 'brand' | 'secondary' | 'gold' | 'outline'
}) => {
  const bg =
    disabled
      ? brandColors.line
      : variant === 'secondary'
        ? brandColors.field
        : variant === 'gold'
          ? brandColors.gold
          : variant === 'outline'
            ? brandColors.surface
            : brandColors.navy
  const color =
    disabled
      ? brandColors.muted
      : variant === 'secondary' || variant === 'outline'
        ? brandColors.navy
        : '#FFFFFF'

  return (
    <CoverView
      style={{
        flex: 1,
        height: '44px',
        borderRadius: '12px',
        backgroundColor: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: variant === 'outline' ? `1px solid ${brandColors.line}` : 'none',
        opacity: disabled ? 0.85 : 1,
      }}
      onClick={() => {
        if (disabled) {
          Taro.showToast({ title: label, icon: 'none' })
          return
        }
        onClick?.()
      }}
    >
      <CoverView style={{ color, fontSize: '15px', fontWeight: '600' }}>{label}</CoverView>
    </CoverView>
  )
}
