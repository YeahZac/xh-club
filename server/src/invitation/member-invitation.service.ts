import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { queryExecute, queryOne, queryRows } from '@/storage/database/mysql-client'

const normalizePhone = (value: unknown) => String(value || '').replace(/\D/g, '')

@Injectable()
export class MemberInvitationService {
  async previewByInviteCode(inviteCodeRaw: string) {
    const inviteCode = String(inviteCodeRaw || '').trim().toUpperCase()
    if (!inviteCode) {
      throw new HttpException('缺少推荐码', HttpStatus.BAD_REQUEST)
    }
    const inviter = await queryOne(
      `SELECT id, name, invite_code, company_name, company_position
       FROM members
       WHERE UPPER(TRIM(invite_code)) = ?
       LIMIT 1`,
      [inviteCode],
    )
    if (!inviter) {
      throw new HttpException('推荐码无效', HttpStatus.NOT_FOUND)
    }
    return {
      invite_code: String(inviter.invite_code || inviteCode),
      inviter_id: inviter.id,
      inviter_name: inviter.name || '星河会员',
      inviter_company: inviter.company_name || '',
      inviter_position: inviter.company_position || '',
    }
  }

  async submitLead(dto: any) {
    const inviteCode = String(dto.invite_code || '').trim().toUpperCase()
    const inviteeName = String(dto.name || '').trim()
    const inviteePhone = normalizePhone(dto.phone)
    const companyName = String(dto.company_name || '').trim() || null
    const position = String(dto.position || '').trim() || null
    const photoUrl = String(dto.photo_url || '').trim() || null
    let industryTags: string[] | null = null
    if (Array.isArray(dto.industry_tags)) {
      industryTags = dto.industry_tags.map((item: unknown) => String(item || '').trim()).filter(Boolean)
    } else if (typeof dto.industry_tags === 'string' && dto.industry_tags.trim()) {
      try {
        const parsed = JSON.parse(dto.industry_tags)
        if (Array.isArray(parsed)) {
          industryTags = parsed.map((item: unknown) => String(item || '').trim()).filter(Boolean)
        }
      } catch {
        industryTags = dto.industry_tags.split(',').map((item: string) => item.trim()).filter(Boolean)
      }
    }

    if (!inviteCode) throw new HttpException('缺少推荐码', HttpStatus.BAD_REQUEST)
    if (!inviteeName) throw new HttpException('请填写姓名', HttpStatus.BAD_REQUEST)
    if (!/^1\d{10}$/.test(inviteePhone)) {
      throw new HttpException('请填写正确的手机号', HttpStatus.BAD_REQUEST)
    }

    const inviter = await queryOne(
      `SELECT id, name, invite_code FROM members WHERE UPPER(TRIM(invite_code)) = ? LIMIT 1`,
      [inviteCode],
    )
    if (!inviter) throw new HttpException('推荐码无效', HttpStatus.BAD_REQUEST)

    const registered = await this.findMemberByPhone(inviteePhone)

    const result = await queryExecute(
      `INSERT INTO member_invitations
        (inviter_id, invite_code, invitee_name, invitee_phone, company_name, position,
         photo_url, industry_tags, is_registered, registered_member_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        inviter.id,
        String(inviter.invite_code || inviteCode),
        inviteeName,
        inviteePhone,
        companyName,
        position,
        photoUrl,
        industryTags ? JSON.stringify(industryTags) : null,
        registered ? 1 : 0,
        registered?.id || null,
      ],
    )

    return {
      id: result.insertId,
      inviter_id: inviter.id,
      inviter_name: inviter.name || '星河会员',
      invitee_name: inviteeName,
      invitee_phone: inviteePhone,
      company_name: companyName,
      position,
      photo_url: photoUrl,
      industry_tags: industryTags || [],
      is_registered: !!registered,
      registered_member_id: registered?.id || null,
      registered_member_name: registered?.name || null,
      created_at: new Date().toISOString(),
    }
  }

  async listMine(inviterId: string | number) {
    const rows = await queryRows(
      `SELECT mi.*,
              rm.name AS registered_member_name,
              rm.phone AS registered_member_phone
       FROM member_invitations mi
       LEFT JOIN members rm ON rm.id = mi.registered_member_id
       WHERE mi.inviter_id = ?
       ORDER BY mi.created_at DESC`,
      [inviterId],
    )
    return rows.map((row) => this.formatRow(row))
  }

  async adminList(query: any = {}) {
    const where: string[] = []
    const values: any[] = []
    const keyword = String(query.keyword || '').trim()
    if (keyword) {
      where.push(
        `(mi.invitee_name LIKE ? OR mi.invitee_phone LIKE ? OR mi.company_name LIKE ?
          OR inv.name LIKE ? OR inv.phone LIKE ? OR mi.invite_code LIKE ?)`,
      )
      const like = `%${keyword}%`
      values.push(like, like, like, like, like, like)
    }
    if (query.is_registered === '1' || query.is_registered === '0') {
      where.push('mi.is_registered = ?')
      values.push(Number(query.is_registered))
    }
    const rows = await queryRows(
      `SELECT mi.*,
              inv.name AS inviter_name,
              inv.phone AS inviter_phone,
              rm.name AS registered_member_name,
              rm.phone AS registered_member_phone
       FROM member_invitations mi
       LEFT JOIN members inv ON inv.id = mi.inviter_id
       LEFT JOIN members rm ON rm.id = mi.registered_member_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY mi.created_at DESC
       LIMIT 500`,
      values,
    )
    return rows.map((row) => this.formatRow(row))
  }

  private async findMemberByPhone(phone: string) {
    const exact = await queryOne(
      `SELECT id, name, phone FROM members WHERE phone = ? LIMIT 1`,
      [phone],
    )
    if (exact) return exact
    const digits = await queryOne(
      `SELECT id, name, phone FROM members
       WHERE REPLACE(REPLACE(REPLACE(IFNULL(phone,''),' ',''),'-',''),'+','') = ?
       LIMIT 1`,
      [phone],
    )
    return digits || null
  }

  private formatRow(row: any) {
    if (!row) return row
    return {
      ...row,
      is_registered: Number(row.is_registered) === 1,
      is_registered_label: Number(row.is_registered) === 1 ? '已注册' : '未注册',
    }
  }
}
