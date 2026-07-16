interface PaginatedData<T> {
  list?: T[]
}

export const getResponseList = <T>(data: unknown): T[] => {
  if (Array.isArray(data)) return data as T[]

  if (data && typeof data === 'object') {
    const paginated = data as PaginatedData<T>
    if (Array.isArray(paginated.list)) return paginated.list
  }

  return []
}
