/** 管理台列表分页参数解析 */

export interface AdminPageParams {
  page: number
  pageSize: number
  offset: number
}

export interface AdminPageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 500

export function parseAdminPage(query: Record<string, unknown> | null | undefined): AdminPageParams {
  const page = Math.max(1, Number(query?.page) || 1)
  const raw = Number(query?.pageSize ?? query?.limit)
  const pageSize = Math.max(
    1,
    Math.min(MAX_PAGE_SIZE, Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_PAGE_SIZE),
  )
  return { page, pageSize, offset: (page - 1) * pageSize }
}

export function emptyAdminPage<T = never>(query?: Record<string, unknown> | null): AdminPageResult<T> {
  const { page, pageSize } = parseAdminPage(query)
  return { list: [], total: 0, page, pageSize }
}
