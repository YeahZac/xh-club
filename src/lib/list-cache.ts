type CacheEntry<T> = {
  expireAt: number
  value: T
}

const store = new Map<string, CacheEntry<unknown>>()

/** 内存短缓存：用于列表页秒开，不落盘，进程内有效 */
export function getListCache<T>(key: string): T | null {
  const hit = store.get(key)
  if (!hit) return null
  if (Date.now() > hit.expireAt) {
    store.delete(key)
    return null
  }
  return hit.value as T
}

export function setListCache<T>(key: string, value: T, ttlMs = 90_000) {
  store.set(key, { value, expireAt: Date.now() + Math.max(5_000, ttlMs) })
}

export function invalidateListCache(prefix?: string) {
  if (!prefix) {
    store.clear()
    return
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}

/** 列表请求默认附带 fields=list，旧后端会忽略未知参数 */
export const LIST_FIELDS_QUERY = 'fields=list'

/** 列表默认条数：够首屏；过大易触发云托管 callContainer 响应体限制 */
export const LIST_PAGE_SIZE = 40

/**
 * 有缓存时先回填再后台刷新；无缓存时直接请求。
 */
export async function loadWithListCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: {
    ttlMs?: number
    force?: boolean
    onData?: (data: T, meta: { fromCache: boolean }) => void
  },
): Promise<T> {
  const ttlMs = options?.ttlMs ?? 90_000
  const onData = options?.onData

  if (!options?.force) {
    const hit = getListCache<T>(key)
    if (hit != null) {
      onData?.(hit, { fromCache: true })
      void fetcher()
        .then((fresh) => {
          setListCache(key, fresh, ttlMs)
          onData?.(fresh, { fromCache: false })
        })
        .catch(() => undefined)
      return hit
    }
  }

  const data = await fetcher()
  setListCache(key, data, ttlMs)
  onData?.(data, { fromCache: false })
  return data
}
