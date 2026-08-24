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
  // 支持日期或到分钟的北京时间：YYYY-MM-DD / YYYY-MM-DD HH:mm / YYYY-MM-DD HH:mm:ss
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw} 00:00:00`
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/.test(raw)) {
    return `${raw.replace('T', ' ')}:00`
  }
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(raw)) {
    return raw.slice(0, 19).replace('T', ' ')
  }
  throw new HttpException('成交时间格式无效', HttpStatus.BAD_REQUEST)
}

/** 详情返回：北京时间墙钟，精确到分 */
const formatDealTimeLabel = (value: unknown): string => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const wall = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/)
  if (wall && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    return `${wall[1]} ${wall[2]}:${wall[3]}`
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw} 00:00`
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw.slice(0, 16)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00'
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
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
      deal_time: formatDealTimeLabel(row.deal_time) || row.deal_time,
      deal_time_label: formatDealTimeLabel(row.deal_time) || '-',
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

  private validate(dto: any, options?: { requireOwner?: boolean; requireFinancial?: boolean }) {
    const businessId = Number(dto.business_id)
    const ownerMemberId = Number(dto.owner_member_id)
    const requireFinancial = options?.requireFinancial !== false
    const contractAmount = Number(dto.contract_amount ?? 0)
    const commissionRate = Number(dto.commission_rate ?? 0)
    const contactName = String(dto.contact_name || '').trim()
    const dealStatus = String(dto.deal_status || 'connecting').trim()
    if (!Number.isFinite(businessId) || businessId <= 0) {
      throw new HttpException('请选择对接项目', HttpStatus.BAD_REQUEST)
    }
    if (options?.requireOwner !== false && (!Number.isFinite(ownerMemberId) || ownerMemberId <= 0)) {
      throw new HttpException('请选择项目负责人', HttpStatus.BAD_REQUEST)
    }
    if (requireFinancial) {
      if (!Number.isFinite(contractAmount) || contractAmount < 0) {
        throw new HttpException('合同金额无效', HttpStatus.BAD_REQUEST)
      }
      if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
        throw new HttpException('分成比例应在 0-100 之间', HttpStatus.BAD_REQUEST)
      }
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

  /** 可选为对接负责人的会员：注册默认 active；后台审核通过曾写成 approved */
  private readonly ownerMemberStatusSql = `status IN ('active', 'approved')`

  /** 从项目详情带入申请表单：项目名 + 默认负责人 */
  async projectPrefill(id: string) {
    const project = await queryOne(
      `SELECT id, title, submitter_id, company_name
       FROM projects
       WHERE id = ?
         AND (audit_status = 'approved' OR audit_status IS NULL OR audit_status = '')
         AND status IN ('active', 'funded', 'published')`,
      [id],
    )
    if (!project) return null
    let ownerName: string | null = null
    let ownerCompany: string | null = null
    const ownerId = project.submitter_id || null
    if (ownerId) {
      const owner = await queryOne(
        `SELECT id, name, company_name FROM members WHERE id = ? AND ${this.ownerMemberStatusSql}`,
        [ownerId],
      )
      ownerName = owner?.name || null
      ownerCompany = owner?.company_name || null
    }
    return {
      id: project.id,
      title: project.title || '',
      submitter_id: ownerId,
      owner_member_id: ownerId,
      owner_name: ownerName,
      company_name: String(project.company_name || '').trim() || ownerCompany || null,
    }
  }

  async memberOptions(keyword?: string, memberId?: string) {
    const values: any[] = []
    let where = this.ownerMemberStatusSql
    if (memberId) {
      where += ' AND id = ?'
      values.push(memberId)
    } else if (keyword) {
      where += ' AND (name LIKE ? OR phone LIKE ? OR company_name LIKE ?)'
      const like = `%${keyword}%`
      values.push(like, like, like)
    }
    const rows = await queryRows(
      `SELECT id, name, avatar, phone, company_name, company_position, user_category
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
      user_category: row.user_category || 'normal',
      user_category_label:
        row.user_category === 'promoter'
          ? '推广员'
          : row.user_category === 'member_unit'
            ? '会员单位'
            : '普通用户',
    }))
  }

  async create(memberId: string | number, dto: any) {
    const payload = this.validate(dto, { requireOwner: true, requireFinancial: false })
    if (String(payload.ownerMemberId) === String(memberId)) {
      throw new HttpException('项目负责人不能是自己', HttpStatus.BAD_REQUEST)
    }
    const project = await queryOne(
      `SELECT id, title, submitter_id FROM projects WHERE id = ?`,
      [payload.businessId],
    )
    if (!project) throw new HttpException('所选项目不存在', HttpStatus.BAD_REQUEST)
    if (project.submitter_id && String(project.submitter_id) === String(memberId)) {
      throw new HttpException('不能为自己发布的项目申请成交记录', HttpStatus.BAD_REQUEST)
    }
    const owner = await queryOne(
      `SELECT id, name FROM members WHERE id = ? AND ${this.ownerMemberStatusSql}`,
      [payload.ownerMemberId],
    )
    if (!owner) throw new HttpException('项目负责人不存在', HttpStatus.BAD_REQUEST)

    // 会员侧创建时强制未成交，需负责人确认后再更新成交状态
    const result = await queryExecute(
      `INSERT INTO project_deal_applications
        (member_id, owner_member_id, business_id, project_name, deal_time, contract_amount, commission_rate,
         contact_name, deal_status, is_deal, image_urls, cooperation_description, audit_status, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'connecting', 0, ?, ?, 'pending', 'unpaid')`,
      [
        memberId,
        payload.ownerMemberId,
        payload.businessId,
        project.title,
        payload.dealTime,
        payload.contractAmount,
        payload.commissionRate,
        payload.contactName,
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
      replaceUnreadSameBiz: true,
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
      replaceUnreadSameBiz: true,
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
      if (String(payload.ownerMemberId) === String(memberId)) {
        throw new HttpException('项目负责人不能是自己', HttpStatus.BAD_REQUEST)
      }
      const owner = await queryOne(
        `SELECT id FROM members WHERE id = ? AND ${this.ownerMemberStatusSql}`,
        [payload.ownerMemberId],
      )
      if (!owner) throw new HttpException('项目负责人不存在', HttpStatus.BAD_REQUEST)
    }
    const nextConfirm = canResubmit ? 'pending' : existing.audit_status
    // 待确认或重新提交时不允许直接标记成交
    const nextDealStatus = canResubmit ? 'connecting' : payload.dealStatus
    const nextIsDeal = canResubmit ? 0 : payload.isDeal
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
        nextDealStatus,
        nextIsDeal,
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
        replaceUnreadSameBiz: true,
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
      if (!isOwner) {
        throw new HttpException('申请人请通过「修改申请信息」更新成交状态', HttpStatus.BAD_REQUEST)
      }
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
        replaceUnreadSameBiz: true,
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
    if (status === 'approved') {
      const contractAmount = Number(dto.contract_amount)
      const commissionRate = Number(dto.commission_rate)
      if (!Number.isFinite(contractAmount) || contractAmount < 0) {
        throw new HttpException('请填写合同金额', HttpStatus.BAD_REQUEST)
      }
      if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
        throw new HttpException('分成比例应在 0-100 之间', HttpStatus.BAD_REQUEST)
      }
      await queryExecute(
        `UPDATE project_deal_applications SET
           audit_status = ?, reject_reason = ?, reviewed_by = ?, reviewed_at = NOW(),
           contract_amount = ?, commission_rate = ?, updated_at = NOW()
         WHERE id = ?`,
        [status, null, ownerId, contractAmount, commissionRate, id],
      )
    } else {
      await queryExecute(
        `UPDATE project_deal_applications SET
           audit_status = ?, reject_reason = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [status, reason || null, ownerId, id],
      )
    }

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
      replaceUnreadSameBiz: true,
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

    const wasDeal = Number(existing.is_deal) === 1 || existing.deal_status === 'completed'
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

    if (!wasDeal && payload.isDeal && confirm === 'approved') {
      void this.pointsEngine
        .evaluate(existing.member_id, 'deal_complete', {
          referenceType: 'deal_application',
          referenceId: id,
          description: '项目成交奖励积分',
        })
        .catch((err) => console.warn('[DealApplications] admin points evaluate failed', err))
      void this.invitationEngine
        .grantConditionRewards(existing.member_id, 'invitee_deal', {
          description: '推荐会员完成项目成交',
          referenceId: id,
        })
        .catch((err) => console.warn('[DealApplications] admin invite reward failed', err))
    }

    await createNotification({
      memberId: existing.member_id,
      type: 'deal',
      title: '项目对接信息已由后台更新',
      content: `「${project.title}」对接记录已被管理员更新`,
      link: `/pages/deal-applications/detail/index?id=${id}`,
      bizType: 'deal_application',
      bizId: id,
      result: 'admin_updated',
      replaceUnreadSameBiz: true,
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
