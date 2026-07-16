import { RichText, View, Text } from '@tarojs/components'
import { normalizeRichHtml } from '@/lib/rich-html'

interface RichHtmlProps {
  html?: string | null
  className?: string
  emptyText?: string
}

/** 按管理台富文本排版渲染 HTML（图片 / 表情 / 附件链接） */
export const RichHtml = ({ html, className, emptyText = '暂无内容' }: RichHtmlProps) => {
  const nodes = normalizeRichHtml(html)
  if (!nodes) {
    return (
      <View className={className}>
        <Text className="block text-sm text-gray-400">{emptyText}</Text>
      </View>
    )
  }
  return (
    <View className={className}>
      <RichText nodes={nodes} />
    </View>
  )
}
