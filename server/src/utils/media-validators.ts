import { HttpException, HttpStatus } from '@nestjs/common'
import { canonicalizeCloudStorageUrl, isCloudStorageUrl } from '@/utils/media-url'

export function assertCloudStorageImageUrl(value: unknown, required = true): string | null {
  const url = typeof value === 'string' ? value.trim() : ''
  if (!url) {
    if (required) {
      throw new HttpException('封面图片为必填项，且必须使用微信云托管对象存储 URL', HttpStatus.BAD_REQUEST)
    }
    return null
  }
  if (!isCloudStorageUrl(url)) {
    throw new HttpException('图片必须使用微信云托管对象存储 URL', HttpStatus.BAD_REQUEST)
  }
  return canonicalizeCloudStorageUrl(url)
}

export function normalizeOptionalVideoUrl(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  const url = typeof value === 'string' ? value.trim() : ''
  if (!isCloudStorageUrl(url)) {
    throw new HttpException('视频必须使用微信云托管对象存储 URL', HttpStatus.BAD_REQUEST)
  }
  return canonicalizeCloudStorageUrl(url)
}
