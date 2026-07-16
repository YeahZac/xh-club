interface PaginatedData<T> {
  list?: T[]
  data?: unknown
}

/**
 * 解包接口列表数据，兼容：
 * - T[]
 * - { list: T[] }
 * - { data: T[] }
 * - { code, data: T[] } / 多层 data 嵌套
 */
export const getResponseList = <T>(data: unknown): T[] => {
  let current: unknown = data

  for (let depth = 0; depth < 4; depth += 1) {
    if (Array.isArray(current)) {
      return current as T[]
    }

    if (!current || typeof current !== 'object') {
      break
    }

    const obj = current as PaginatedData<T> & Record<string, unknown>
    if (Array.isArray(obj.list)) {
      return obj.list
    }

    if ('data' in obj) {
      current = obj.data
      continue
    }

    break
  }

  return []
}
