import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import { getPool, initMySQL } from '../storage/database/mysql-client'

@Injectable()
export class CommunityService {
  private async getDb() {
    await initMySQL()
    return getPool()!
  }

  /** 获取动态列表 */
  async getPosts(params: { type?: string; member_id?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(params.page) || 1)
    // MySQL prepared statements may quote LIMIT/OFFSET placeholders as strings — interpolate safe ints.
    const pageSize = Math.max(1, Math.min(100, Number(params.pageSize) || 20))
    const offset = (page - 1) * pageSize
    const pool = await this.getDb()

    let where = "WHERE p.status = 'published'"
    const values: any[] = []
    if (params.type) {
      where += ' AND p.type = ?'
      values.push(params.type)
    }
    if (params.member_id) {
      where += ' AND p.member_id = ?'
      values.push(params.member_id)
    }

    // Get count
    const [countResult]: any = await pool.query(`SELECT COUNT(*) as total FROM posts p ${where}`, values)
    const total = countResult[0]?.total || 0

    // Get posts with member info
    const [rows]: any = await pool.query(
      `SELECT p.*, m.name as member_name, m.avatar as member_avatar, m.company_name, m.membership_level
       FROM posts p
       LEFT JOIN members m ON p.member_id = m.id
       ${where}
       ORDER BY p.is_featured DESC, p.created_at DESC
       LIMIT ${pageSize} OFFSET ${offset}`,
      values
    )

    const list = rows.map((row: any) => ({
      ...row,
      images: row.images_json ? JSON.parse(row.images_json) : [],
      member: {
        id: row.member_id,
        name: row.member_name,
        avatar: row.member_avatar,
        company_name: row.company_name,
        membership_level: row.membership_level,
      }
    }))

    return { list, total, page, pageSize }
  }

  /** 发布动态 */
  async createPost(dto: any) {
    const pool = await this.getDb()
    const [result]: any = await pool.query(
      `INSERT INTO posts (member_id, type, title, content, images_json, status, is_featured, view_count, like_count, comment_count)
       VALUES (?, ?, ?, ?, ?, 'published', 0, 0, 0, 0)`,
      [dto.member_id, dto.type || 'thought', dto.title || null, dto.content, JSON.stringify(dto.images || [])]
    )

    const [rows]: any = await pool.query('SELECT * FROM posts WHERE id = ?', [result.insertId])
    return rows[0]
  }

  /** 获取动态详情 */
  async getPostDetail(id: string) {
    const pool = await this.getDb()
    const [rows]: any = await pool.query(
      `SELECT p.*, m.name as member_name, m.avatar as member_avatar, m.company_name, m.membership_level
       FROM posts p
       LEFT JOIN members m ON p.member_id = m.id
       WHERE p.id = ?`,
      [id]
    )
    if (!rows[0]) throw new HttpException('动态不存在', HttpStatus.NOT_FOUND)

    await pool.query('UPDATE posts SET view_count = view_count + 1 WHERE id = ?', [id])

    const post = rows[0]
    return {
      ...post,
      images: post.images_json ? JSON.parse(post.images_json) : [],
      member: {
        id: post.member_id,
        name: post.member_name,
        avatar: post.member_avatar,
        company_name: post.company_name,
        membership_level: post.membership_level,
      }
    }
  }

  /** 点赞 */
  async likePost(dto: { post_id: string; member_id: string }) {
    const pool = await this.getDb()
    await pool.query('UPDATE posts SET like_count = like_count + 1 WHERE id = ?', [dto.post_id])
    return { liked: true }
  }

  /** 评论列表 */
  async getComments(postId: string) {
    const pool = await this.getDb()
    const [rows]: any = await pool.query(
      `SELECT c.*, m.name as member_name, m.avatar as member_avatar
       FROM comments c
       LEFT JOIN members m ON c.member_id = m.id
       WHERE c.post_id = ?
       ORDER BY c.created_at DESC`,
      [postId]
    )
    return rows
  }

  /** 发表评论 */
  async commentPost(dto: { post_id: string; member_id: string; content: string; parent_id?: string }) {
    const pool = await this.getDb()
    const [result]: any = await pool.query(
      `INSERT INTO comments (post_id, member_id, content, parent_id) VALUES (?, ?, ?, ?)`,
      [dto.post_id, dto.member_id, dto.content, dto.parent_id || null]
    )
    await pool.query('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?', [dto.post_id])

    const [rows]: any = await pool.query('SELECT * FROM comments WHERE id = ?', [result.insertId])
    return rows[0]
  }

  /** 获取资源列表 */
  async getResources(query: any) {
    const pool = await this.getDb()
    const limit = Math.max(1, Math.min(100, parseInt(String(query.limit || '10'), 10) || 10))
    const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1)
    const offset = (page - 1) * limit

    const [rows]: any = await pool.query(
      `SELECT * FROM resources WHERE status = 'active' ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
    )
    return rows
  }
}
