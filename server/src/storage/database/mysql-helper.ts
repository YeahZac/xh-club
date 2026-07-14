/**
 * MySQL 通用 CRUD 辅助模块
 * 提供类似 Supabase 的链式查询 API
 */

import { getPool } from './mysql-client'
import { RowDataPacket, ResultSetHeader } from 'mysql2'

// 通用查询构建器
export class MySQLQueryBuilder<T extends RowDataPacket = RowDataPacket> {
  private tableName: string
  private conditions: string[] = []
  private params: any[] = []
  private orderByClause: string = ''
  private limitClause: string = ''
  private selectFields: string = '*'
  private offsetClause: string = ''

  constructor(tableName: string) {
    this.tableName = tableName
  }

  select(fields: string | string[] = '*'): this {
    if (Array.isArray(fields)) {
      this.selectFields = fields.join(', ')
    } else {
      this.selectFields = fields
    }
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
      this.conditions.push('1 = 0') // Always false
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

  isNotNull(field: string): this {
    this.conditions.push(`${field} IS NOT NULL`)
    return this
  }

  or(conditions: Array<{ field: string; value: any; operator?: string }>): this {
    const orConditions = conditions.map(c => {
      const op = c.operator || '='
      if (c.value === null) {
        return op === '=' ? `${c.field} IS NULL` : `${c.field} IS NOT NULL`
      }
      this.params.push(c.value)
      return `${c.field} ${op} ?`
    })
    if (orConditions.length > 0) {
      this.conditions.push(`(${orConditions.join(' OR ')})`)
    }
    return this
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.orderByClause = ` ORDER BY ${field} ${direction.toUpperCase()}`
    return this
  }

  limit(count: number): this {
    this.limitClause = ` LIMIT ${count}`
    return this
  }

  offset(count: number): this {
    this.offsetClause = ` OFFSET ${count}`
    return this
  }

  private buildWhereClause(): string {
    if (this.conditions.length === 0) {
      return ''
    }
    return ' WHERE ' + this.conditions.join(' AND ')
  }

  // 执行查询，返回多条记录
  async findMany(): Promise<T[]> {
    const pool = getPool()
    if (!pool) {
      console.error('[MySQLQueryBuilder] Pool is not initialized')
      return []
    }

    const sql = `SELECT ${this.selectFields} FROM ${this.tableName}${this.buildWhereClause()}${this.orderByClause}${this.limitClause}${this.offsetClause}`
    console.log('[MySQLQueryBuilder] Query:', sql, 'Params:', this.params)

    const [rows] = await pool.query(sql, this.params)
    return rows as T[]
  }

  // 执行查询，返回单条记录
  async findFirst(): Promise<T | null> {
    this.limit(1)
    const rows = await this.findMany()
    return rows[0] || null
  }

  // 执行查询，返回单条记录（必须存在）
  async findSingle(): Promise<T | null> {
    return this.findFirst()
  }

  // 统计数量
  async count(): Promise<number> {
    const pool = getPool()
    if (!pool) {
      console.error('[MySQLQueryBuilder] Pool is not initialized')
      return 0
    }

    const sql = `SELECT COUNT(*) as count FROM ${this.tableName}${this.buildWhereClause()}`
    const [rows] = await pool.query(sql, this.params)
    return (rows[0] as any).count
  }
}

// 创建查询构建器
export function from<T extends RowDataPacket = RowDataPacket>(tableName: string): MySQLQueryBuilder<T> {
  return new MySQLQueryBuilder<T>(tableName)
}

// 插入数据
export async function insert<T extends RowDataPacket = RowDataPacket>(
  tableName: string,
  data: Record<string, any>
): Promise<T | null> {
  const pool = getPool()
  if (!pool) {
    console.error('[MySQL] Pool is not initialized')
    return null
  }

  const fields = Object.keys(data)
  const placeholders = fields.map(() => '?').join(', ')
  const values = Object.values(data)

  const sql = `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders})`
  console.log('[MySQL] Insert:', sql, 'Values:', values)

  const [result] = await pool.query(sql, values) as [ResultSetHeader, any]
  
  // 查询插入的记录
  const [rows] = await pool.query(
    `SELECT * FROM ${tableName} WHERE id = ?`,
    [result.insertId]
  )
  
  return (rows[0] as T) || null
}

// 批量插入
export async function insertMany<T extends RowDataPacket = RowDataPacket>(
  tableName: string,
  dataArray: Record<string, any>[]
): Promise<T[]> {
  const pool = getPool()
  if (!pool) {
    console.error('[MySQL] Pool is not initialized')
    return []
  }

  if (dataArray.length === 0) return []

  const results: T[] = []
  for (const data of dataArray) {
    const result = await insert<T>(tableName, data)
    if (result) results.push(result)
  }
  return results
}

// 更新数据
export async function update<T extends RowDataPacket = RowDataPacket>(
  tableName: string,
  data: Record<string, any>,
  conditions: Record<string, any>
): Promise<T | null> {
  const pool = getPool()
  if (!pool) {
    console.error('[MySQL] Pool is not initialized')
    return null
  }

  const setFields = Object.keys(data)
  const setClause = setFields.map(f => `${f} = ?`).join(', ')
  const setValues = Object.values(data)

  const condFields = Object.keys(conditions)
  const condClause = condFields.map(f => `${f} = ?`).join(' AND ')
  const condValues = Object.values(conditions)

  const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${condClause}`
  const values = [...setValues, ...condValues]
  console.log('[MySQL] Update:', sql, 'Values:', values)

  await pool.query(sql, values)

  // 查询更新后的记录
  const selectSql = `SELECT * FROM ${tableName} WHERE ${condClause}`
  const [rows] = await pool.query(selectSql, condValues) as [RowDataPacket[], any]
  
  return (rows[0] as T) || null
}

// 删除数据
export async function remove(
  tableName: string,
  conditions: Record<string, any>
): Promise<boolean> {
  const pool = getPool()
  if (!pool) {
    console.error('[MySQL] Pool is not initialized')
    return false
  }

  const condFields = Object.keys(conditions)
  const condClause = condFields.map(f => `${f} = ?`).join(' AND ')
  const condValues = Object.values(conditions)

  const sql = `DELETE FROM ${tableName} WHERE ${condClause}`
  console.log('[MySQL] Delete:', sql, 'Values:', condValues)

  const [result] = await pool.query(sql, condValues) as [ResultSetHeader, any]
  return result.affectedRows > 0
}

// 执行原始 SQL
export async function query<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const pool = getPool()
  if (!pool) {
    console.error('[MySQL] Pool is not initialized')
    return []
  }

  console.log('[MySQL] Query:', sql, 'Params:', params)
  const [rows] = await pool.query(sql, params) as [RowDataPacket[], any]
  return rows as T[]
}

// 执行原始 SQL（无返回）
export async function execute(
  sql: string,
  params: any[] = []
): Promise<ResultSetHeader> {
  const pool = getPool()
  if (!pool) {
    throw new Error('MySQL Pool is not initialized')
  }

  console.log('[MySQL] Execute:', sql, 'Params:', params)
  const [result] = await pool.query(sql, params)
  return result
}
