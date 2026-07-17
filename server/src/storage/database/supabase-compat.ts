/**
 * Supabase 兼容层 - 使用 MySQL 实现
 * 提供类似 Supabase 的 API，方便迁移
 */

import { getPool } from './mysql-client'
import { RowDataPacket, ResultSetHeader } from 'mysql2'

/** MySQL DATETIME/TIMESTAMP 不接受带 Z 的 ISO 字符串，统一转成 Date 交给 mysql2 */
function toMysqlParam(value: any): any {
  if (value instanceof Date) return value
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.test(value)) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return value
}

function mapMysqlParams(values: any[]): any[] {
  return values.map(toMysqlParam)
}

class QueryBuilder {
  private tableName: string
  private conditions: string[] = []
  private params: any[] = []
  private orderByField: string = ''
  private orderByDir: string = 'ASC'
  private limitCount: number = 0
  private offsetCount: number = 0
  private selectFields: string = '*'
  private isCountQuery: boolean = false

  constructor(tableName: string) {
    this.tableName = tableName
  }

  select(fields: string = '*', options?: { count?: string; head?: boolean }) {
    if (options?.count) {
      this.isCountQuery = true
    }
    this.selectFields = fields
    return this
  }

  eq(field: string, value: any): this {
    if (value === null) {
      this.conditions.push(`${field} IS NULL`)
    } else {
      this.conditions.push(`${field} = ?`)
      this.params.push(value)
    }
    return this
  }

  neq(field: string, value: any): this {
    if (value === null) {
      this.conditions.push(`${field} IS NOT NULL`)
    } else {
      this.conditions.push(`${field} != ?`)
      this.params.push(value)
    }
    return this
  }

  in(field: string, values: any[]): this {
    if (values.length === 0) {
      this.conditions.push('1 = 0')
    } else {
      const placeholders = values.map(() => '?').join(', ')
      this.conditions.push(`${field} IN (${placeholders})`)
      this.params.push(...values)
    }
    return this
  }

  like(field: string, pattern: string): this {
    this.conditions.push(`${field} LIKE ?`)
    this.params.push(pattern)
    return this
  }

  gt(field: string, value: any): this {
    this.conditions.push(`${field} > ?`)
    this.params.push(value)
    return this
  }

  gte(field: string, value: any): this {
    this.conditions.push(`${field} >= ?`)
    this.params.push(value)
    return this
  }

  lt(field: string, value: any): this {
    this.conditions.push(`${field} < ?`)
    this.params.push(value)
    return this
  }

  lte(field: string, value: any): this {
    this.conditions.push(`${field} <= ?`)
    this.params.push(value)
    return this
  }

  isNull(field: string): this {
    this.conditions.push(`${field} IS NULL`)
    return this
  }

  not(field: string, operator: string, value: any): this {
    if (operator === 'in') {
      if (value.length === 0) {
        this.conditions.push('1 = 1')
      } else {
        const placeholders = value.map(() => '?').join(', ')
        this.conditions.push(`${field} NOT IN (${placeholders})`)
        this.params.push(...value)
      }
    } else if (operator === 'is') {
      if (value === null) {
        this.conditions.push(`${field} IS NOT NULL`)
      } else {
        this.conditions.push(`${field} != ?`)
        this.params.push(value)
      }
    }
    return this
  }

  or(condition: string): this {
    // Simple OR support - parse condition string
    // Format: "field.eq.value,field2.eq.value2"
    const parts = condition.split(',')
    const orConditions: string[] = []
    
    for (const part of parts) {
      const [field, op, value] = part.split('.')
      if (op === 'eq') {
        if (value === 'null') {
          orConditions.push(`${field} IS NULL`)
        } else {
          orConditions.push(`${field} = ?`)
          this.params.push(value)
        }
      }
    }
    
    if (orConditions.length > 0) {
      this.conditions.push(`(${orConditions.join(' OR ')})`)
    }
    return this
  }

  order(field: string, options?: { ascending?: boolean }): this {
    this.orderByField = field
    this.orderByDir = options?.ascending === false ? 'DESC' : 'ASC'
    return this
  }

  range(from: number, to: number): this {
    this.offsetCount = from
    this.limitCount = to - from + 1
    return this
  }

  limit(count: number): this {
    this.limitCount = count
    return this
  }

  single(): Promise<{ data: any; error: any }> {
    return this.execute().then(result => ({
      data: result.data?.[0] || null,
      error: result.error
    }))
  }

  async then(resolve: (result: { data: any; error: any; count?: number }) => any, reject?: (error: any) => any): Promise<any> {
    try {
      const result = await this.execute()
      return resolve(result)
    } catch (error) {
      if (reject) {
        return reject(error)
      }
      throw error
    }
  }

  private async execute(): Promise<{ data: any; error: any; count?: number }> {
    const pool = getPool()
    if (!pool) {
      return { data: null, error: { message: '数据库未连接' } }
    }

    try {
      const whereClause = this.conditions.length > 0 ? ` WHERE ${this.conditions.join(' AND ')}` : ''
      const orderByClause = this.orderByField ? ` ORDER BY ${this.orderByField} ${this.orderByDir}` : ''
      const limitClause = this.limitCount > 0 ? ` LIMIT ${this.limitCount}` : ''
      const offsetClause = this.offsetCount > 0 ? ` OFFSET ${this.offsetCount}` : ''

      if (this.isCountQuery) {
        const countSql = `SELECT COUNT(*) as count FROM ${this.tableName}${whereClause}`
        const [countRows] = await pool.query(countSql, this.params) as [RowDataPacket[], any]
        const count = (countRows[0] as any)?.count || 0

        const sql = `SELECT ${this.selectFields} FROM ${this.tableName}${whereClause}${orderByClause}${limitClause}${offsetClause}`
        const [rows] = await pool.query(sql, this.params) as [RowDataPacket[], any]
        
        return { data: rows, error: null, count }
      }

      const sql = `SELECT ${this.selectFields} FROM ${this.tableName}${whereClause}${orderByClause}${limitClause}${offsetClause}`
      const [rows] = await pool.query(sql, this.params) as [RowDataPacket[], any]
      
      return { data: rows, error: null }
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } }
    }
  }
}

class InsertBuilder {
  private tableName: string
  private data: any[] = []

  constructor(tableName: string) {
    this.tableName = tableName
  }

  insert(data: any | any[]): this {
    this.data = Array.isArray(data) ? data : [data]
    return this
  }

  select(): this {
    return this
  }

  single(): Promise<{ data: any; error: any }> {
    return this.execute().then(result => ({
      data: result.data?.[0] || null,
      error: result.error
    }))
  }

  async then(resolve: (result: { data: any; error: any }) => any, reject?: (error: any) => any): Promise<any> {
    try {
      const result = await this.execute()
      return resolve(result)
    } catch (error) {
      if (reject) {
        return reject(error)
      }
      throw error
    }
  }

  private async execute(): Promise<{ data: any; error: any }> {
    const pool = getPool()
    if (!pool) {
      return { data: null, error: { message: '数据库未连接' } }
    }

    try {
      if (this.data.length === 0) {
        return { data: [], error: null }
      }

      const results: any[] = []
      for (const item of this.data) {
        const fields = Object.keys(item)
        const placeholders = fields.map(() => '?').join(', ')
        const values = mapMysqlParams(Object.values(item))

        const sql = `INSERT INTO ${this.tableName} (${fields.join(', ')}) VALUES (${placeholders})`
        const [result] = await pool.query(sql, values) as [ResultSetHeader, any]

        // Fetch the inserted record
        const [rows] = await pool.query(
          `SELECT * FROM ${this.tableName} WHERE id = ?`,
          [result.insertId]
        )
        if (rows[0]) {
          results.push(rows[0])
        }
      }

      return { data: results, error: null }
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } }
    }
  }
}

class UpdateBuilder {
  private tableName: string
  private data: any = {}
  private conditions: string[] = []
  private params: any[] = []

  constructor(tableName: string) {
    this.tableName = tableName
  }

  update(data: any): this {
    this.data = data
    return this
  }

  eq(field: string, value: any): this {
    if (value === null) {
      this.conditions.push(`${field} IS NULL`)
    } else {
      this.conditions.push(`${field} = ?`)
      this.params.push(value)
    }
    return this
  }

  in(field: string, values: any[]): this {
    if (values.length === 0) {
      this.conditions.push('1 = 0')
    } else {
      const placeholders = values.map(() => '?').join(', ')
      this.conditions.push(`${field} IN (${placeholders})`)
      this.params.push(...values)
    }
    return this
  }

  select(): this {
    return this
  }

  single(): Promise<{ data: any; error: any }> {
    return this.execute().then(result => ({
      data: result.data?.[0] || null,
      error: result.error
    }))
  }

  async then(resolve: (result: { data: any; error: any }) => any, reject?: (error: any) => any): Promise<any> {
    try {
      const result = await this.execute()
      return resolve(result)
    } catch (error) {
      if (reject) {
        return reject(error)
      }
      throw error
    }
  }

  private async execute(): Promise<{ data: any; error: any }> {
    const pool = getPool()
    if (!pool) {
      return { data: null, error: { message: '数据库未连接' } }
    }

    try {
      const setClauses: string[] = []
      const setValues: any[] = []

      for (const [key, value] of Object.entries(this.data)) {
        setClauses.push(`${key} = ?`)
        setValues.push(toMysqlParam(value))
      }

      if (setClauses.length === 0) {
        return { data: null, error: { message: '没有要更新的字段' } }
      }

      const whereClause = this.conditions.length > 0 ? ` WHERE ${this.conditions.join(' AND ')}` : ''
      const sql = `UPDATE ${this.tableName} SET ${setClauses.join(', ')}${whereClause}`
      
      await pool.query(sql, [...setValues, ...this.params])

      // Fetch updated record
      const selectSql = `SELECT * FROM ${this.tableName}${whereClause}`
      const [rows] = await pool.query(selectSql, this.params) as [RowDataPacket[], any] as [RowDataPacket[], any]

      return { data: rows, error: null }
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } }
    }
  }
}

class DeleteBuilder {
  private tableName: string
  private conditions: string[] = []
  private params: any[] = []

  constructor(tableName: string) {
    this.tableName = tableName
  }

  eq(field: string, value: any): this {
    if (value === null) {
      this.conditions.push(`${field} IS NULL`)
    } else {
      this.conditions.push(`${field} = ?`)
      this.params.push(value)
    }
    return this
  }

  async then(resolve: (result: { data: any; error: any }) => any, reject?: (error: any) => any): Promise<any> {
    try {
      const result = await this.execute()
      return resolve(result)
    } catch (error) {
      if (reject) {
        return reject(error)
      }
      throw error
    }
  }

  private async execute(): Promise<{ data: any; error: any }> {
    const pool = getPool()
    if (!pool) {
      return { data: null, error: { message: '数据库未连接' } }
    }

    try {
      const whereClause = this.conditions.length > 0 ? ` WHERE ${this.conditions.join(' AND ')}` : ''
      const sql = `DELETE FROM ${this.tableName}${whereClause}`
      
      await pool.query(sql, this.params)
      return { data: null, error: null }
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } }
    }
  }
}

export class SupabaseCompatClient {
  from(tableName: string) {
    return {
      select: (fields?: string, options?: { count?: string; head?: boolean }) => new QueryBuilder(tableName).select(fields, options),
      insert: (data: any) => new InsertBuilder(tableName).insert(data),
      update: (data: any) => new UpdateBuilder(tableName).update(data),
      delete: () => new DeleteBuilder(tableName)
    }
  }
}

let compatClient: SupabaseCompatClient | null = null

export function getSupabaseCompatClient(): SupabaseCompatClient {
  if (!compatClient) {
    compatClient = new SupabaseCompatClient()
  }
  return compatClient
}

// 兼容旧代码
export function getSupabaseClient(): SupabaseCompatClient {
  console.warn('[SupabaseCompat] getSupabaseClient() is deprecated, use getSupabaseCompatClient() instead')
  return getSupabaseCompatClient()
}
