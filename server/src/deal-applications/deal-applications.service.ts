import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { queryExecute, queryOne, queryRows } from '@/storage/database/mysql-client'
import { UploadService } from '@/upload/upload.service'
import { assertCloudStorageImageUrl } from '@/utils/media-validators'
import { PointsEngineService } from '@/points/points-engine.service'
import { InvitationEngineService } from '@/invitation/invitation-engine.service'
import { createNotification } from '@/common/notify'

const DEAL_STATUSES = ['connecting', 'completed', 'failed'] as const
const CONFIRM_STATUSES = ['pending', 'approved', 'rejected'] as const
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
  constructor(
    private readonly uploadService: UploadService,
    private readonly pointsEngine: PointsEngineService,
    private readonly invitationEngine: InvitationEngineService,
  ) {}

  private async formatRow(row: any) {
    if (!row) return row
    const imageUrls = await this.uploadService.signMediaUrls(parseImages(row.image_urls))
    const paymentProofUrls = await this.uploadService.signMediaUrls(parseImages(row.payment_proof_urls))
    const confirm = String(row.audit_status || 'pending')
    const isDeal = Number(row.is_deal) === 1 || row.deal_status === 'completed'
    return {
      ...row,
      image_urls: imageUrls,
      payment_proof_urls: paymentProofUrls,
      confirm_status: confirm,
      confirm_status_label:
        confirm === 'approved' ? '负责人已同意' : confirm === 'rejected' ? '负责人已拒绝' : '待负责人确认',
      audit_status: confirm,
      audit_status_label:
        confirm === 'approved' ? '负责人已同意' : confirm === 'rejected' ? '负责人已拒绝' : '待负责人确认',
      is_deal: isDeal,
      is_deal_label: isDeal ? '已成交' : '未成交',
      payment_status_label: row.payment_status === 'paid' ? '已打款' : '未打款',
      deal_status_label:
        row.deal_status === 'completed' ? '已成交' : row.deal_status === 'failed' ? '未成交' : '对接中',
      owner_name: row.owner_name || '',
      member_name: row.member_name || '',
    }
  }

  private validate(dto: any, options?: { requireOwner?: boolean }) {
    const businessId = Number(dto.business_id)
    const ownerMemberId = Number(dto.owner_member_id)
    const contractAmount = Number(dto.contract_amount)
    const commissionRate = Number(dto.commission_rate)
    const contactName = String(dto.contact_name || '').trim()
    const dealStatus = String(dto.deal_status || 'connecting').trim()
    if (!Number.isFinite(businessId) || businessId <= 0) {
      throw new HttpException('请选择对接项目', HttpStatus.BAD_REQUEST)
    }
    if (options?.requireOwner !== false && (!Number.isFinite(ownerMemberId) || ownerMemberId <= 0)) {
      throw new HttpException('请选择项目负责人', HttpStatus.BAD_REQUEST)
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
    const isDeal =
      dto.is_deal === true ||
      dto.is_deal === 1 ||
      dto.is_deal === '1' ||
      dealStatus === 'completed'
    return {
      businessId,
      ownerMemberId: Number.isFinite(ownerMemberId) && ownerMemberId > 0 ? ownerMemberId : null,
      dealTime: toMysqlDate(dto.deal_time),
      contractAmount,
      commissionRate,
      contactName,
      dealStatus: isDeal ? 'completed' : dealStatus === 'failed' ? 'failed' : 'connecting',
      isDeal: isDeal ? 1 : 0,
      images,
      cooperationDescription: String(dto.cooperation_description || '').trim() || null,
    }
  }

  async projectOptions() {
    return queryRows(
      `SELECT id, title, industry AS category, status
       FROM projects
       WHERE (audit_status = 'approved' OR audit_status IS NULL OR audit_status = '')
         AND status IN ('active', 'funded', 'published')
       ORDER BY created_at DESC`,
    )
  }

  async memberOptions(keyword?: string) {
    const values: any[] = []
    let where = `status = 'active'`
    if (keyword) {
      where += ' AND (name LIKE ? OR phone LIKE ? OR company_name LIKE ?)'
      const like = `%${keyword}%`
      values.push(like, like, like)
    }
    const rows = await queryRows(
      `SELECT id, name, avatar, phone, company_name, company_position
       FROM members
       WHERE ${where}
       ORDER BY updated_at DESC, id DESC
       LIMIT 100`,
      values,
    )
    return (rows || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      avatar: row.avatar,
      phone: row.phone ? String(row.phone).replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : null,
      company_name: row.company_name,
      company_position: row.company_position,
    }))
  }

  async create(memberId: string | number, dto: any) {
    const payload = this.validate(dto, { requireOwner: true })
    if (String(payload.ownerMemberId) === String(memberId)) {
      throw new HttpException('项目负责人不能是自己', HttpStatus.BAD_REQUEST)
    }
    const project = await queryOne(`SELECT id, title FROM projects WHERE id = ?`, [payload.businessId])
    if (!project) throw new HttpException('所选项目不存在', HttpStatus.BAD_REQUEST)
    const owner = await queryOne(`SELECT id, name FROM members WHERE id = ? AND status = 'active'`, [
      payload.ownerMemberId,
    ])
    if (!owner) throw new HttpException('项目负责人不存在', HttpStatus.BAD_REQUEST)

    const result = await queryExecute(
      `INSERT INTO project_deal_applications
        (member_id, owner_member_id, business_id, project_name, deal_time, contract_amount, commission_rate,
         contact_name, deal_status, is_deal, image_urls, cooperation_description, audit_status, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid')`,
      [
        memberId,
        payload.ownerMemberId,
        payload.businessId,
        project.title,
        payload.dealTime,
        payload.contractAmount,
        payload.commissionRate,
        payload.contactName,
        payload.dealStatus,
        payload.isDeal,
        JSON.stringify(payload.images),
        payload.cooperationDescription,
      ],
    )
    const id = String(result.insertId)
    const applicant = await queryOne('SELECT name FROM members WHERE id = ?', [memberId])
    // 通知项目负责人确认
    await createNotification({
      memberId: payload.ownerMemberId!,
      type: 'deal',
      title: '收到项目对接申请',
      content: `${applicant?.name || '会员'}申请对接「${project.title}」，请确认同意或拒绝`,
      link: `/pages/deal-applications/detail/index?id=${id}&role=owner`,
      bizType: 'deal_application',
      bizId: id,
      result: 'pending',
    })
    // 通知申请人提交成功
    await createNotification({
      memberId,
      type: 'deal',
      title: '对接申请已提交',
      content: `您已向「${owner.name || '项目负责人'}」申请对接项目「${project.title}」，请等待对方确认`,
      link: `/pages/deal-applications/detail/index?id=${id}`,
      bizType: 'deal_application',
      bizId: id,
      result: 'pending',
    })
    return this.getAccessibleById(id, memberId)
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

    const requestedOwnerId = Number(dto.owner_member_id ?? existing.owner_member_id)
    const ownerChanged = String(requestedOwnerId) !== String(existing.owner_member_id || '')
    const canResubmit = existing.audit_status !== 'approved' || ownerChanged
    const payload = this.validate(
      { ...existing, ...dto, owner_member_id: dto.owner_member_id ?? existing.owner_member_id },
      { requireOwner: canResubmit },
    )
    const project = await queryOne('SELECT id, title FROM projects WHERE id = ?', [payload.businessId])
    if (!project) throw new HttpException('所选项目不存在', HttpStatus.BAD_REQUEST)

    if (ownerChanged) {
      const owner = await queryOne(`SELECT id FROM members WHERE id = ? AND status = 'active'`, [
        payload.ownerMemberId,
      ])
      if (!owner) throw new HttpException('项目负责人不存在', HttpStatus.BAD_REQUEST)
    }
    const nextConfirm = canResubmit ? 'pending' : existing.audit_status
    await queryExecute(
      `UPDATE project_deal_applications SET
         business_id = ?, owner_member_id = ?, project_name = ?, deal_time = ?, contract_amount = ?,
         commission_rate = ?, contact_name = ?, deal_status = ?, is_deal = ?, image_urls = ?,
         cooperation_description = ?, audit_status = ?, reject_reason = ?,
         reviewed_by = ?, reviewed_at = ?, updated_at = NOW()
       WHERE id = ? AND member_id = ?`,
      [
        payload.businessId,
        payload.ownerMemberId || existing.owner_member_id,
        project.title,
        payload.dealTime,
        payload.contractAmount,
        payload.commissionRate,
        payload.contactName,
        payload.dealStatus,
        payload.isDeal,
        JSON.stringify(payload.images),
        payload.cooperationDescription,
        nextConfirm,
        canResubmit ? null : existing.reject_reason,
        canResubmit ? null : existing.reviewed_by,
        canResubmit ? null : existing.reviewed_at,
        id,
        memberId,
      ],
    )

    if (canResubmit && payload.ownerMemberId) {
      const applicant = await queryOne('SELECT name FROM members WHERE id = ?', [memberId])
      await createNotification({
        memberId: payload.ownerMemberId,
        type: 'deal',
        title: '项目对接申请已更新',
        content: `${applicant?.name || '会员'}更新了「${project.title}」对接申请，请重新确认`,
        link: `/pages/deal-applications/detail/index?id=${id}&role=owner`,
        bizType: 'deal_application',
        bizId: id,
        result: 'pending',
      })
    }
    return this.getAccessibleById(id, memberId)
  }

  async updateStatuses(id: string, memberId: string | number, dto: any) {
    const row = await this.getRawAccessible(id, memberId)
    if (row.audit_status !== 'approved') {
      throw new HttpException('负责人同意后才能更新成交/打款状态', HttpStatus.BAD_REQUEST)
    }
    const isOwner = String(row.owner_member_id) === String(memberId)
    const isApplicant = String(row.member_id) === String(memberId)
    if (!isOwner && !isApplicant) {
      throw new HttpException('无权操作', HttpStatus.FORBIDDEN)
    }

    const wasDeal = Number(row.is_deal) === 1 || row.deal_status === 'completed'
    let nextIsDeal = wasDeal
    const updates: string[] = []
    const params: any[] = []
    if (dto.is_deal !== undefined || dto.deal_status !== undefined) {
      const isDeal =
        dto.is_deal === true ||
        dto.is_deal === 1 ||
        dto.is_deal === '1' ||
        dto.deal_status === 'completed'
      nextIsDeal = isDeal
      updates.push('is_deal = ?', 'deal_status = ?')
      params.push(isDeal ? 1 : 0, isDeal ? 'completed' : dto.deal_status === 'failed' ? 'failed' : 'connecting')
      if (!isDeal && row.payment_status === 'paid' && dto.payment_status === undefined) {
        updates.push('payment_status = ?', 'paid_at = ?')
        params.push('unpaid', null)
      }
    }
    if (dto.payment_status !== undefined) {
      if (!isOwner) {
        throw new HttpException('仅项目负责人可更新打款状态', HttpStatus.FORBIDDEN)
      }
      const payment = String(dto.payment_status)
      if (!(PAYMENT_STATUSES as readonly string[]).includes(payment)) {
        throw new HttpException('打款状态无效', HttpStatus.BAD_REQUEST)
      }
      updates.push('payment_status = ?', 'paid_at = ?')
      params.push(payment, payment === 'paid' ? new Date() : null)
    }
    if (dto.payment_proof_urls !== undefined) {
      if (!isOwner) {
        throw new HttpException('仅项目负责人可上传打款凭证', HttpStatus.FORBIDDEN)
      }
      const rawList = Array.isArray(dto.payment_proof_urls) ? dto.payment_proof_urls : []
      if (rawList.length > 5) {
        throw new HttpException('打款凭证最多 5 张', HttpStatus.BAD_REQUEST)
      }
      const proofUrls: string[] = []
      for (const item of rawList) {
        const url = String(item || '').trim()
        if (!url) continue
        assertCloudStorageImageUrl(url)
        proofUrls.push(url)
      }
      updates.push('payment_proof_urls = ?')
      params.push(JSON.stringify(proofUrls))
    }
    if (!updates.length) throw new HttpException('没有可更新的字段', HttpStatus.BAD_REQUEST)
    params.push(id)
    await queryExecute(
      `UPDATE project_deal_applications SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params,
    )

    const notifyTarget = isOwner ? row.member_id : row.owner_member_id
    if (notifyTarget) {
      const paymentChanged = dto.payment_status !== undefined || dto.payment_proof_urls !== undefined
      await createNotification({
        memberId: notifyTarget,
        type: 'deal',
        title: paymentChanged ? '打款信息已更新' : '项目对接状态已更新',
        content: paymentChanged
          ? `「${row.project_name}」打款状态或凭证已更新，请查看详情`
          : `「${row.project_name}」成交/打款状态已更新`,
        link: `/pages/deal-applications/detail/index?id=${id}`,
        bizType: 'deal_application',
        bizId: id,
        result: 'updated',
      })
    }
    if (!wasDeal && nextIsDeal) {
      void this.pointsEngine
        .evaluate(row.member_id, 'deal_complete', {
          referenceType: 'deal_application',
          referenceId: id,
          description: '项目成交奖励积分',
        })
        .catch((err) => console.warn('[DealApplications] points evaluate failed', err))
      void this.invitationEngine
        .grantConditionRewards(row.member_id, 'invitee_deal', {
          description: '推荐会员完成项目成交',
          referenceId: id,
        })
        .catch((err) => console.warn('[DealApplications] invite reward failed', err))
    }
    return this.getAccessibleById(id, memberId)
  }

  async ownerConfirm(id: string, ownerId: string | number, dto: any) {
    const row = await queryOne(
      'SELECT * FROM project_deal_applications WHERE id = ? AND owner_member_id = ?',
      [id, ownerId],
    )
    if (!row) throw new HttpException('申请记录不存在或无权处理', HttpStatus.NOT_FOUND)
    if (row.audit_status !== 'pending') {
      throw new HttpException('该申请已处理', HttpStatus.BAD_REQUEST)
    }
    const status = String(dto.confirm_status || dto.audit_status || '')
    if (status !== 'approved' && status !== 'rejected') {
      throw new HttpException('确认状态无效', HttpStatus.BAD_REQUEST)
    }
    const reason = status === 'rejected' ? String(dto.reject_reason || '').trim() : ''
    if (status === 'rejected' && !reason) {
      throw new HttpException('请填写拒绝原因', HttpStatus.BAD_REQUEST)
    }

    await queryExecute(
      `UPDATE project_deal_applications SET
         audit_status = ?, reject_reason = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [status, reason || null, ownerId, id],
    )

    await createNotification({
      memberId: row.member_id,
      type: 'deal',
      title: status === 'approved' ? '项目对接已同意' : '项目对接已拒绝',
      content:
        status === 'approved'
          ? `负责人已同意「${row.project_name}」对接申请`
          : `负责人拒绝了「${row.project_name}」对接申请：${reason}`,
      link: `/pages/deal-applications/detail/index?id=${id}`,
      bizType: 'deal_application',
      bizId: id,
      result: status,
    })

    return this.getAccessibleById(id, ownerId)
  }

  async listMine(memberId: string | number) {
    const rows = await queryRows(
      `SELECT d.*,
              m.name AS member_name,
              o.name AS owner_name
       FROM project_deal_applications d
       LEFT JOIN members m ON m.id = d.member_id
       LEFT JOIN members o ON o.id = d.owner_member_id
       WHERE d.member_id = ? OR d.owner_member_id = ?
       ORDER BY d.updated_at DESC`,
      [memberId, memberId],
    )
    return Promise.all(rows.map((row) => this.formatRow(row)))
  }

  private async getRawAccessible(id: string, memberId: string | number) {
    const row = await queryOne(
      `SELECT d.*, m.name AS member_name, o.name AS owner_name
       FROM project_deal_applications d
       LEFT JOIN members m ON m.id = d.member_id
       LEFT JOIN members o ON o.id = d.owner_member_id
       WHERE d.id = ? AND (d.member_id = ? OR d.owner_member_id = ?)`,
      [id, memberId, memberId],
    )
    if (!row) throw new HttpException('申请记录不存在', HttpStatus.NOT_FOUND)
    return row
  }

  async getAccessibleById(id: string, memberId: string | number) {
    return this.formatRow(await this.getRawAccessible(id, memberId))
  }

  async adminList(query: any = {}) {
    const where: string[] = []
    const values: any[] = []
    if (query.audit_status && (CONFIRM_STATUSES as readonly string[]).includes(query.audit_status)) {
      where.push('d.audit_status = ?')
      values.push(query.audit_status)
    }
    if (query.payment_status && (PAYMENT_STATUSES as readonly string[]).includes(query.payment_status)) {
      where.push('d.payment_status = ?')
      values.push(query.payment_status)
    }
    const keyword = String(query.keyword || '').trim()
    if (keyword) {
      where.push('(d.project_name LIKE ? OR d.contact_name LIKE ? OR m.name LIKE ? OR o.name LIKE ?)')
      const like = `%${keyword}%`
      values.push(like, like, like, like)
    }
    const rows = await queryRows(
      `SELECT d.*, m.name AS member_name, m.phone AS member_phone, o.name AS owner_name
       FROM project_deal_applications d
       LEFT JOIN members m ON m.id = d.member_id
       LEFT JOIN members o ON o.id = d.owner_member_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY d.updated_at DESC`,
      values,
    )
    return Promise.all(rows.map((row) => this.formatRow(row)))
  }

  async adminGetById(id: string) {
    const row = await queryOne(
      `SELECT d.*, m.name AS member_name, m.phone AS member_phone, o.name AS owner_name
       FROM project_deal_applications d
       LEFT JOIN members m ON m.id = d.member_id
       LEFT JOIN members o ON o.id = d.owner_member_id
       WHERE d.id = ?`,
      [id],
    )
    if (!row) throw new HttpException('申请记录不存在', HttpStatus.NOT_FOUND)
    return this.formatRow(row)
  }

  /** 后台可编辑全部字段，不再走审核门槛 */
  async adminUpdate(id: string, dto: any) {
    const existing = await queryOne('SELECT * FROM project_deal_applications WHERE id = ?', [id])
    if (!existing) throw new HttpException('申请记录不存在', HttpStatus.NOT_FOUND)
    const payload = this.validate(
      { ...existing, ...dto, owner_member_id: dto.owner_member_id ?? existing.owner_member_id },
      { requireOwner: false },
    )
    const project = await queryOne('SELECT id, title FROM projects WHERE id = ?', [payload.businessId])
    if (!project) throw new HttpException('所选项目不存在', HttpStatus.BAD_REQUEST)

    const confirm = String(dto.audit_status || dto.confirm_status || existing.audit_status || 'pending')
    if (!(CONFIRM_STATUSES as readonly string[]).includes(confirm)) {
      throw new HttpException('确认状态无效', HttpStatus.BAD_REQUEST)
    }
    const payment = String(dto.payment_status || existing.payment_status || 'unpaid')
    if (!(PAYMENT_STATUSES as readonly string[]).includes(payment)) {
      throw new HttpException('打款状态无效', HttpStatus.BAD_REQUEST)
    }
    if (payment === 'paid' && !payload.isDeal) {
      throw new HttpException('项目成交后才能标记为已打款', HttpStatus.BAD_REQUEST)
    }

    await queryExecute(
      `UPDATE project_deal_applications SET
         business_id = ?, owner_member_id = ?, project_name = ?, deal_time = ?, contract_amount = ?,
         commission_rate = ?, contact_name = ?, deal_status = ?, is_deal = ?, image_urls = ?,
         cooperation_description = ?, audit_status = ?, reject_reason = ?, payment_status = ?,
         paid_at = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        payload.businessId,
        payload.ownerMemberId || existing.owner_member_id,
        project.title,
        payload.dealTime,
        payload.contractAmount,
        payload.commissionRate,
        payload.contactName,
        payload.dealStatus,
        payload.isDeal,
        JSON.stringify(payload.images),
        payload.cooperationDescription,
        confirm,
        dto.reject_reason != null ? String(dto.reject_reason || '').trim() || null : existing.reject_reason,
        payment,
        payment === 'paid' ? existing.paid_at || new Date() : null,
        id,
      ],
    )

    await createNotification({
      memberId: existing.member_id,
      type: 'deal',
      title: '项目对接信息已由后台更新',
      content: `「${project.title}」对接记录已被管理员更新`,
      link: `/pages/deal-applications/detail/index?id=${id}`,
      bizType: 'deal_application',
      bizId: id,
      result: 'admin_updated',
    })
    return this.adminGetById(id)
  }

  /** @deprecated 保留兼容旧管理台按钮，转发为确认状态更新 */
  async audit(id: string, adminId: string | number, dto: any) {
    return this.adminUpdate(id, {
      audit_status: dto.audit_status,
      reject_reason: dto.reject_reason,
      reviewed_by: adminId,
    })
  }

  async updatePayment(id: string, dto: any) {
    return this.adminUpdate(id, { payment_status: dto.payment_status })
  }
}
