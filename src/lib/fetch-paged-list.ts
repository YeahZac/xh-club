import { getResponseList } from '@/lib/api-response'
import { LIST_FIELDS_QUERY, LIST_PAGE_SIZE } from '@/lib/list-cache'
import { Network } from '@/network'

/**
 * 把分页列表拉全。公开接口有 page/pageSize/total，前端只请求第一页时
 * 精选/近期会占满首页，更早内容在后续页永远进不了列表。
 */
export async function fetchAllPagedList<T>(path: string): Promise<T[]> {
  const pageSize = LIST_PAGE_SIZE
  const collected: T[] = []
  let page = 1
  const maxPages = 30

  while (page <= maxPages) {
    const joiner = path.includes('?') ? '&' : '?'
    const res = await Network.request({
      url: `${path}${joiner}page=${page}&pageSize=${pageSize}&${LIST_FIELDS_QUERY}`,
    })
    const payload = res?.data?.data
    const chunk = getResponseList<T>(payload)
    collected.push(...chunk)
    const total = Number(payload?.total)
    if (!chunk.length) break
    if (Number.isFinite(total) && collected.length >= total) break
    if (chunk.length < pageSize) break
    page += 1
  }

  return collected
}
