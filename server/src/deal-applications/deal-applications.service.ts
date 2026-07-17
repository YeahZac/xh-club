import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { queryExecute, queryOne, queryRows } from '@/storage/database/mysql-client'
import { UploadService } from '@/upload/upload.service'
import { assertCloudStorageImageUrl } from '@/utils/media-validators'

const DEAL_STATUSES = ['connecting', 'completed', 'failed'] as const
const AUDIT_STATUSES = ['pending', 'approved', 'rejected'] as const
const PAYMENT_STATUSES = ['unpaid', 'paid'] as const

const parseImages = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : []
  } catch {
    return []
  }
}

const toMysqlDate = (value: unknown): string => {
  const raw = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new HttpException('成交时间格式无效', HttpStatus.BAD_REQUEST)
  }
  return raw
}

@Injectable()
export class DealApplicationsService {
  constructor(private readonly uploadService: UploadService) {}

  private async formatRow(row: any) {
    if (!row) return row
    const imageUrls = await this.uploadService.signMediaUrls(parseImages(row.image_urls))
    return {
      ...row,
      image_urls: imageUrls,
      audit_status_label:
        row.audit_status === 'approved' ? '审核通过' : row.audit_status === 'rejected' ? '审核未通过' : '待审核',
      payment_status_label: row.payment_status === 'paid' ? '已打款' : '未打款',
      deal_status_label:
        row.deal_status === 'completed' ? '已成交' : row.deal_status === 'failed' ? '未成交' : '对接中',
    }
  }

  private validate(dto: any) {
    const businessId = Number(dto.business_id)
    const contractAmount = Number(dto.contract_amount)
    const commissionRate = Number(dto.commission_rate)
    const contactName = String(dto.contact_name || '').trim()
    const dealStatus = String(dto.deal_status || '').trim()
    if (!Number.isFinite(businessId) || businessId <= 0) {
      throw new HttpException('请选择对接项目', HttpStatus.BAD_REQUEST)
    }
    if (!Number.isFinite(contractAmount) || contractAmount < 0) {
      throw new HttpException('合同金额无效', HttpStatus.BAD_REQUEST)
    }
    if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
      throw new HttpException('分成比例应在 0-100 之间', HttpStatus.BAD_REQUEST)
    }
    if (!contactName) throw new HttpException('请填写对接人姓名', HttpStatus.BAD_REQUEST)
    if (!(DEAL_STATUSES as readonly string[]).includes(dealStatus)) {
      throw new HttpException('对接状态无效', HttpStatus.BAD_REQUEST)
    }
    const images = parseImages(dto.image_urls).map((url) => assertCloudStorageImageUrl(url, true))
    return {
      businessId,
      dealTime: toMysqlDate(dto.deal_time),
      contractAmount,
      commissionRate,
      contactName,
      dealStatus,
      images,
      cooperationDescription: String(dto.cooperation_description || '').trim() || null,
    }
  }

  async projectOptions() {
    return queryRows(
      `SELECT id, title, category
       FROM business_opportunities
       WHERE status = 'published'
         AND (audit_status = 'approved' OR audit_status IS NULL OR audit_status = '')
       ORDER BY created_at DESC`,
    )
  }

  async create(memberId: string | number, dto: any) {
    const payload = this.validate(dto)
    const project = await queryOne(
      `SELECT id, title FROM business_opportunities
       WHERE id = ? AND status = 'published'
         AND (audit_status = 'approved' OR audit_status IS NULL OR audit_status = '')`,
      [payload.businessId],
    )
    if (!project) throw new HttpException('所选项目不存在或未上架', HttpStatus.BAD_REQUEST)

    const result = await queryExecute(
      `INSERT INTO project_deal_applications
        (member_id, business_id, project_name, deal_time, contract_amount, commission_rate,
         contact_name, deal_status, image_urls, cooperation_description, audit_status, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid')`,
      [
        memberId,
        payload.businessId,
        project.title,
        payload.dealTime,
        payload.contractAmount,
        payload.commissionRate,
        payload.contactName,
        payload.dealStatus,
        JSON.stringify(payload.images),
        payload.cooperationDescription,
      ],
    )
    return this.getMineById(String(result.insertId), memberId)
  }

  async updateMine(id: string, memberId: string | number, dto: any) {
    const existing = await queryOne(
      'SELECT * FROM project_deal_applications WHERE id = ? AND member_id = ?',
      [id, memberId],
    )
    if (!existing) throw new HttpException('申请记录不存在', HttpStatus.NOT_FOUND)
    if (existing.payment_status === 'paid') {
      throw new HttpException('已打款记录不可修改', HttpStatus.BAD_REQUEST)
    }
    const payload = this.validate({ ...existing, ...dto })
    const project = await queryOne('SELECT id, title FROM business_opportunities WHERE id = ?', [payload.businessId])
    if (!project) throw new HttpException('所选项目不存在', HttpStatus.BAD_REQUEST)

    await queryExecute(
      `UPDATE project_deal_applications SET
         business_id = ?, project_name = ?, deal_time = ?, contract_amount = ?, commission_rate = ?,
         contact_name = ?, deal_status = ?, image_urls = ?, cooperation_description = ?,
         audit_status = 'pending', reject_reason = NULL, reviewed_by = NULL, reviewed_at = NULL,
         updated_at = NOW()
       WHERE id = ? AND member_id = ?`,
      [
        payload.businessId,
        project.title,
        payload.dealTime,
        payload.contractAmount,
        payload.commissionRate,
        payload.contactName,
        payload.dealStatus,
        JSON.stringify(payload.images),
        payload.cooperationDescription,
        id,
        memberId,
      ],
    )
    return this.getMineById(id, memberId)
  }

  async listMine(memberId: string | number) {
    const rows = await queryRows(
      `SELECT d.* FROM project_deal_applications d
       WHERE d.member_id = ? ORDER BY d.updated_at DESC`,
      [memberId],
    )
    return Promise.all(rows.map((row) => this.formatRow(row)))
  }

  async getMineById(id: string, memberId: string | number) {
    const row = await queryOne(
      'SELECT * FROM project_deal_applications WHERE id = ? AND member_id = ?',
      [id, memberId],
    )
    if (!row) throw new HttpException('申请记录不存在', HttpStatus.NOT_FOUND)
    return this.formatRow(row)
  }

  async adminList(query: any = {}) {
    const where: string[] = []
    const values: any[] = []
    if (query.audit_status && (AUDIT_STATUSES as readonly string[]).includes(query.audit_status)) {
      where.push('d.audit_status = ?')
      values.push(query.audit_status)
    }
    if (query.payment_status && (PAYMENT_STATUSES as readonly string[]).includes(query.payment_status)) {
      where.push('d.payment_status = ?')
      values.push(query.payment_status)
    }
    const keyword = String(query.keyword || '').trim()
    if (keyword) {
      where.push('(d.project_name LIKE ? OR d.contact_name LIKE ? OR m.name LIKE ? OR m.phone LIKE ?)')
      const like = `%${keyword}%`
      values.push(like, like, like, like)
    }
    const rows = await queryRows(
      `SELECT d.*, m.name AS member_name, m.phone AS member_phone
       FROM project_deal_applications d
       LEFT JOIN members m ON m.id = d.member_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY CASE WHEN d.audit_status = 'pending' THEN 0 ELSE 1 END, d.updated_at DESC`,
      values,
    )
    return Promise.all(rows.map((row) => this.formatRow(row)))
  }

  async adminGetById(id: string) {
    const row = await queryOne(
      `SELECT d.*, m.name AS member_name, m.phone AS member_phone
       FROM project_deal_applications d
       LEFT JOIN members m ON m.id = d.member_id
       WHERE d.id = ?`,
      [id],
    )
    if (!row) throw new HttpException('申请记录不存在', HttpStatus.NOT_FOUND)
    return this.formatRow(row)
  }

  async audit(id: string, adminId: string | number, dto: any) {
    const row = await queryOne('SELECT * FROM project_deal_applications WHERE id = ?', [id])
    if (!row) throw new HttpException('申请记录不存在', HttpStatus.NOT_FOUND)
    const status = String(dto.audit_status || '')
    if (status !== 'approved' && status !== 'rejected') {
      throw new HttpException('审核状态无效', HttpStatus.BAD_REQUEST)
    }
    const reason = status === 'rejected' ? String(dto.reject_reason || '').trim() : ''
    if (status === 'rejected' && !reason) {
      throw new HttpException('请填写未通过原因', HttpStatus.BAD_REQUEST)
    }
    await queryExecute(
      `UPDATE project_deal_applications SET
         audit_status = ?, reject_reason = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [status, reason || null, adminId, id],
    )
    await this.notify(row.member_id, {
      title: status === 'approved' ? '项目成交申请审核通过' : '项目成交申请审核未通过',
      content:
        status === 'approved'
          ? `您提交的「${row.project_name}」成交申请已审核通过`
          : `您提交的「${row.project_name}」成交申请未通过：${reason}`,
      link: `/pages/deal-applications/detail/index?id=${id}`,
    })
    return this.adminGetById(id)
  }

  async updatePayment(id: string, dto: any) {
    const row = await queryOne('SELECT * FROM project_deal_applications WHERE id = ?', [id])
    if (!row) throw new HttpException('申请记录不存在', HttpStatus.NOT_FOUND)
    const status = String(dto.payment_status || '')
    if (!(PAYMENT_STATUSES as readonly string[]).includes(status)) {
      throw new HttpException('打款状态无效', HttpStatus.BAD_REQUEST)
    }
    if (row.audit_status !== 'approved' && status === 'paid') {
      throw new HttpException('申请审核通过后才能标记已打款', HttpStatus.BAD_REQUEST)
    }
    await queryExecute(
      `UPDATE project_deal_applications
       SET payment_status = ?, paid_at = ?, updated_at = NOW() WHERE id = ?`,
      [status, status === 'paid' ? new Date() : null, id],
    )
    await this.notify(row.member_id, {
      title: status === 'paid' ? '项目成交款项已打款' : '项目成交款项状态更新',
      content: `「${row.project_name}」当前打款状态：${status === 'paid' ? '已打款' : '未打款'}`,
      link: `/pages/deal-applications/detail/index?id=${id}`,
    })
    return this.adminGetById(id)
  }

  private async notify(memberId: string | number, payload: { title: string; content: string; link: string }) {
    try {
      await queryExecute(
        `INSERT INTO notifications (member_id, type, title, content, is_read, link)
         VALUES (?, 'deal', ?, ?, 0, ?)`,
        [memberId, payload.title, payload.content, payload.link],
      )
    } catch (error) {
      console.warn('[DealApplicationsService] 写入通知失败:', (error as Error)?.message || error)
    }
  }
}
