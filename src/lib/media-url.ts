/** 可展示的媒体地址（封面/头像等），兼容 COS 签名 URL、本地临时路径与其它 https 图床 */
export const isDisplayableImageUrl = (url?: string | null): url is string => {
  if (!url || typeof url !== 'string') return false
  const value = url.trim()
  if (!value) return false
  if (/^https?:\/\//i.test(value)) return true
  if (value.startsWith('cloud://')) return true
  if (value.startsWith('wxfile://') || value.startsWith('file://')) return true
  // 微信开发者工具 / 真机本地临时文件
  if (/^(http:\/\/(tmp|usr)\/|\/tmp\/)/i.test(value)) return true
  return false
}
