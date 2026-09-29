import { useEffect, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import { ui } from '@/components/brand-ui'
import { isDisplayableImageUrl } from '@/lib/media-url'
import {
  buildPhotoBackdropStyle,
  composeTalentThumbTempFile,
  defaultPhotoPalette,
  extractPhotoPalette,
  type PhotoPalette,
} from '@/lib/photo-palette'

type TalentPhotoThumbProps = {
  src?: string | null
  name?: string
  onImageError?: () => void
}

/**
 * 列表人才头像：与项目封面同宽。
 * 先采样照片环境色，再 Canvas 合成（同色铺底 + 线纹 + 人像 + 左右羽化），避免 letterbox 硬边。
 */
export const TalentPhotoThumb = ({ src, name, onImageError }: TalentPhotoThumbProps) => {
  const url = String(src || '').trim()
  const ok = isDisplayableImageUrl(url)
  const [palette, setPalette] = useState<PhotoPalette>(defaultPhotoPalette)
  const [composedSrc, setComposedSrc] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!ok) {
      setPalette(defaultPhotoPalette)
      setComposedSrc('')
      return
    }
    setComposedSrc('')
    void (async () => {
      try {
        const nextPalette = await extractPhotoPalette(url)
        if (cancelled) return
        setPalette(nextPalette)
        const composed = await composeTalentThumbTempFile(url)
        if (!cancelled) setComposedSrc(composed)
      } catch (error) {
        console.warn('[TalentPhotoThumb] compose failed', error)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ok, url])

  if (!ok) {
    return (
      <View className={ui.listRowThumb} style={buildPhotoBackdropStyle(defaultPhotoPalette)}>
        <View className="flex h-full w-full items-center justify-center">
          <Text className="block text-lg font-semibold text-foreground">
            {(name || '?')[0]}
          </Text>
        </View>
      </View>
    )
  }

  // 合成完成后整图铺满，无接缝；合成前用忠实环境色过渡
  if (composedSrc) {
    return (
      <View className={ui.listRowThumb} style={{ backgroundColor: palette.mid }}>
        <Image
          key={composedSrc}
          src={composedSrc}
          mode="aspectFill"
          className="h-full w-full"
          onError={onImageError}
        />
      </View>
    )
  }

  return (
    <View className={ui.listRowThumb} style={buildPhotoBackdropStyle(palette)}>
      <Image
        key={`talent-fit-${url}`}
        src={url}
        mode="aspectFit"
        className="relative z-10 h-full w-full"
        lazyLoad
        onError={onImageError}
      />
    </View>
  )
}
