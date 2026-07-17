/** 可展示的媒体地址（封面/头像等），兼容 COS 签名 URL 与其它 https 图床 */
export const isDisplayableImageUrl = (url?: string | null): url is string => {
  if (!url || typeof url !== 'string') return false
  const value = url.trim()
  if (!value) return false
  if (/^https?:\/\//i.test(value)) return true
  if (value.startsWith('cloud://')) return true
  return false
}
