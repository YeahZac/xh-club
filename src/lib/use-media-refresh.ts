import { useCallback, useEffect, useRef } from 'react'
import { useDidShow } from '@tarojs/taro'

/** 签名 URL 默认约 2 小时；提前主动刷新，避免停留页时图片静默失效 */
const MEDIA_REFRESH_INTERVAL_MS = 50 * 60 * 1000
const IMAGE_ERROR_DEBOUNCE_MS = 1200
/** 短时间往返页面不强制重拉，避免图片被反复卸载重载 */
const SHOW_RELOAD_MIN_INTERVAL_MS = 3 * 60 * 1000

/**
 * 列表/详情页媒体刷新：
 * - 再次进入页面：距上次拉取超过阈值才重请求（保留 Image 缓存）
 * - 停留页定时刷新签名 URL
 * - 图片 onError 时防抖重拉
 *
 * 注意：不要用递增 key 强制重挂载 Image，否则每次进页都会闪一下重新加载。
 */
export function useMediaRefresh(
  reload: () => void | Promise<void>,
  options?: { skipFirstShow?: boolean; intervalMs?: number; showReloadMinIntervalMs?: number },
) {
  const reloadRef = useRef(reload)
  reloadRef.current = reload
  const skipFirstShowRef = useRef(options?.skipFirstShow !== false)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshingRef = useRef(false)
  const lastReloadAtRef = useRef(0)

  const runReload = useCallback(async (force = false) => {
    if (refreshingRef.current) return
    const minInterval = options?.showReloadMinIntervalMs ?? SHOW_RELOAD_MIN_INTERVAL_MS
    if (!force && lastReloadAtRef.current && Date.now() - lastReloadAtRef.current < minInterval) {
      return
    }
    refreshingRef.current = true
    try {
      await reloadRef.current()
      lastReloadAtRef.current = Date.now()
    } finally {
      refreshingRef.current = false
    }
  }, [options?.showReloadMinIntervalMs])

  useDidShow(() => {
    if (skipFirstShowRef.current) {
      skipFirstShowRef.current = false
      lastReloadAtRef.current = Date.now()
      return
    }
    void runReload(false)
  })

  useEffect(() => {
    const intervalMs = options?.intervalMs ?? MEDIA_REFRESH_INTERVAL_MS
    const timer = setInterval(() => {
      void runReload(true)
    }, intervalMs)
    return () => {
      clearInterval(timer)
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current)
        errorTimerRef.current = null
      }
    }
  }, [options?.intervalMs, runReload])

  const onImageError = useCallback(() => {
    if (errorTimerRef.current) return
    errorTimerRef.current = setTimeout(() => {
      errorTimerRef.current = null
      void runReload(true)
    }, IMAGE_ERROR_DEBOUNCE_MS)
  }, [runReload])

  return { onImageError, refreshMedia: () => runReload(true) }
}
