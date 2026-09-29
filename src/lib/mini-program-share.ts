import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useEffect } from 'react'
import shareCover from '@/assets/share/cover.png'

/** 默认分享缩略图（本地打包，避免 COS 签名过期导致无图） */
export const DEFAULT_SHARE_IMAGE = shareCover as string

const DEFAULT_SHARE_TITLE = '星河百谷俱乐部'

const TAB_SHARE_PAGES = {
  index: {
    title: '星河百谷俱乐部',
    path: '/pages/index/index',
  },
  business: {
    title: '星河百谷 · 商机',
    path: '/pages/business/index',
  },
  discover: {
    title: '星河百谷 · 发现',
    path: '/pages/discover/index',
  },
  mall: {
    title: '星河百谷 · 积分商城',
    path: '/pages/mall/index',
  },
  profile: {
    title: '星河百谷俱乐部',
    path: '/pages/profile/index',
  },
} as const

export type TabSharePageKey = keyof typeof TAB_SHARE_PAGES

export type PageShareOptions = {
  /** 分享标题；可传函数以便读取最新页面状态 */
  title?: string | (() => string)
  /** 转发给朋友的落地 path（含 query）；朋友圈只使用当前页 + query */
  path?: string | (() => string)
  /** 缩略图；不传则用品牌默认图 */
  imageUrl?: string | (() => string | undefined)
  /** 朋友圈额外 query（不含 ?），默认从当前路由解析 */
  query?: string | (() => string)
}

function resolveValue<T>(value: T | (() => T) | undefined, fallback: T): T {
  if (typeof value === 'function') {
    try {
      return (value as () => T)()
    } catch {
      return fallback
    }
  }
  return value === undefined ? fallback : value
}

function currentRouteParts() {
  const pages = Taro.getCurrentPages()
  const cur = pages[pages.length - 1] as { route?: string; options?: Record<string, string> } | undefined
  const route = String(cur?.route || '').replace(/^\//, '')
  const options = cur?.options || {}
  const query = Object.keys(options)
    .filter((key) => options[key] != null && String(options[key]).length > 0)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(options[key]))}`)
    .join('&')
  const path = route ? `/${route}${query ? `?${query}` : ''}` : '/pages/index/index'
  return { path, query, route }
}

function pickImageUrl(raw?: string) {
  const url = String(raw || '').trim()
  if (!url) return DEFAULT_SHARE_IMAGE
  // 过长签名 URL 在部分机型分享卡片不稳定，回退默认图
  if (url.length > 1800) return DEFAULT_SHARE_IMAGE
  return url
}

/**
 * 任意页面启用：转发给朋友 + 分享到朋友圈，并带缩略图。
 * 页面 config 需同时开启 enableShareAppMessage / enableShareTimeline。
 */
export function usePageShare(options: PageShareOptions = {}) {
  useEffect(() => {
    if (process.env.TARO_ENV !== 'weapp') return
    try {
      Taro.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline'],
      } as Taro.showShareMenu.Option)
    } catch {
      /* 旧基础库忽略 */
    }
  }, [])

  useShareAppMessage(() => {
    const { path: fallbackPath } = currentRouteParts()
    const title = resolveValue(options.title, DEFAULT_SHARE_TITLE)
    const path = resolveValue(options.path, fallbackPath)
    const imageUrl = pickImageUrl(resolveValue(options.imageUrl, undefined))
    return {
      title: title || DEFAULT_SHARE_TITLE,
      path: path || fallbackPath,
      imageUrl,
    }
  })

  useShareTimeline(() => {
    const { query: fallbackQuery } = currentRouteParts()
    const title = resolveValue(options.title, DEFAULT_SHARE_TITLE)
    const query = resolveValue(options.query, fallbackQuery)
    const imageUrl = pickImageUrl(resolveValue(options.imageUrl, undefined))
    return {
      title: title || DEFAULT_SHARE_TITLE,
      query: query || '',
      imageUrl,
    }
  })
}

/** 主 Tab 页分享（朋友 / 朋友圈） */
export function useTabShareAppMessage(page: TabSharePageKey) {
  const conf = TAB_SHARE_PAGES[page]
  usePageShare({
    title: conf.title,
    path: conf.path,
    query: '',
    imageUrl: DEFAULT_SHARE_IMAGE,
  })
}

/**
 * 详情类页面：把封面图写入分享缩略图；无封面时用默认图。
 * title/path/query 随内容变化。
 */
export function useDetailPageShare(getShare: () => {
  title?: string
  path?: string
  query?: string
  imageUrl?: string
}) {
  usePageShare({
    title: () => getShare().title || DEFAULT_SHARE_TITLE,
    path: () => getShare().path || currentRouteParts().path,
    query: () => getShare().query || currentRouteParts().query,
    imageUrl: () => getShare().imageUrl,
  })
}

/** 页面 config：开启右上角转发与朋友圈 */
export const tabPageShareConfig = {
  enableShareAppMessage: true,
  enableShareTimeline: true,
} as const
