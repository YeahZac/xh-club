import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import {
  assertRequiredFormAnswers,
  normalizeRegisterFormFields,
  resolveRegisterFormDefaults,
} from '@/common/form-defaults'
import { getSupabaseClient } from '@/storage/database/supabase-compat'
import { queryExecute, queryOne, queryRows } from '@/storage/database/mysql-client'
import { canonicalizeCloudStorageUrl, isCloudStorageUrl } from '@/utils/media-url'
import { parseJsonUrlList, serializeJsonUrlList } from '@/utils/media-json'
import { UploadService } from '@/upload/upload.service'
import { PointsEngineService } from '@/points/points-engine.service'
import { InvitationEngineService } from '@/invitation/invitation-engine.service'
import { createNotification } from '@/common/notify'
import { TalentService } from '@/talent/talent.service'
import { resolveEventStatus } from '@/common/event-status'
import {
  normalizePromoCoopMode,
  promoCoopModeLabel,
} from '@/common/project-promo'
import { userCategoryLabel, normalizeUserCategory } from '@/common/user-category'

function normalizeProjectUrlList(value: unknown): string[] {
  return parseJsonUrlList(value)
    .map((url) => canonicalizeCloudStorageUrl(url))
    .filter((url) => isCloudStorageUrl(url))
}

const DEFAULT_PROJECT_SCORE_DIMENSIONS = ['项目吸引力', '项目门槛', '变现能力'] as const

function isFullHtmlProjectBody(html?: string | null): boolean {
  const value = String(html || '').trim()
  if (!value) return false
  if (/<!DOCTYPE\s+html/i.test(value) || /<html[\s>]/i.test(value)) return true
  if (/<style[\s>]/i.test(value) && /<\/style>/i.test(value) && value.length > 600) return true
  if (/<head[\s>]/i.test(value) && /<body[\s>]/i.test(value)) return true
  return false
}

@Injectable()
export class EventsService {
  constructor(
    private readonly uploadService: UploadService,
    private readonly pointsEngine: PointsEngineService,
    private readonly invitationEngine: InvitationEngineService,
    private readonly talentService: TalentService,
  ) {}

  private client() { return getSupabaseClient() }

  private async syncEventRuntimeStatus(row: any) {
    if (!row || String(row.status) === 'draft') return row
    const next = resolveEventStatus({
      status: row.status,
      start_time: row.start_time,
      end_time: row.end_time,
      max_participants: row.max_participants,
      current_participants: row.current_participants,
    })
    if (String(row.status) !== next) {
      try {
        await queryExecute(
          `UPDATE events SET status = ? WHERE id = ? AND status <> 'draft'`,
          [next, row.id],
        )
      } catch (error) {
        console.warn('[EventsService] syncEventRuntimeStatus failed', error)
      }
      return { ...row, status: next }
    }
    return { ...row, status: next }
  }

  /** 获取活动列表 */
  async getEvents(
    params: { event_type?: string; status?: string; page?: number; pageSize?: number; limit?: number },
    memberId?: string | number,
  ) {
    const page = Math.max(1, Number(params.page) || 1)
    const pageSize = Math.max(1, Math.min(200, Number(params.pageSize || params.limit) || 10))
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = this.client()
      .from('events')
      .select('*', { count: 'exact' })
      .order('is_featured', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('admin_operated_at', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (params.event_type) query = query.eq('event_type', params.event_type)
    if (params.status) {
      query = query.eq('status', params.status)
    } else {
      query = query.neq('status', 'draft')
    }

    const { data, error, count } = await query
    if (error) throw new HttpException(`查询失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)

    let list = await this.uploadService.signRowsFields(data || [], ['cover_image', 'video_url'])
    list = await Promise.all(list.map((item: any) => this.syncEventRuntimeStatus(item)))
    if (params.status) {
      list = list.filter((item: any) => String(item.status) === String(params.status))
    }
    if (memberId && list.length) {
      const ids = list.map((item: any) => item.id).filter(Boolean)
      let registeredIds = new Set<string>()
      if (ids.length) {
        try {
          const placeholders = ids.map(() => '?').join(', ')
          const rows = await queryRows(
            `SELECT event_id FROM event_registrations
             WHERE member_id = ? AND event_id IN (${placeholders})`,
            [memberId, ...ids],
          )
          registeredIds = new Set((rows || []).map((row: any) => String(row.event_id)))
        } catch (err) {
          console.warn('[EventsService] load list registration flags failed', err)
        }
      }
      list = list.map((item: any) => ({
        ...item,
        is_registered: registeredIds.has(String(item.id)),
      }))
    } else {
      list = list.map((item: any) => ({ ...item, is_registered: false }))
    }
    return { list, total: count || 0, page, pageSize }
  }

  /** 获取活动详情 */
  async getEventById(id: string, memberId?: string | number) {
    const { data, error } = await this.client()
      .from('events')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) throw new HttpException('活动不存在', HttpStatus.NOT_FOUND)
    if (String(data.status) === 'draft') {
      throw new HttpException('活动不存在', HttpStatus.NOT_FOUND)
    }

    try {
      await queryExecute(
        'UPDATE events SET view_count = IFNULL(view_count, 0) + 1 WHERE id = ?',
        [id],
      )
    } catch (error) {
      console.warn('[EventsService] increment event view_count failed:', error)
    }

    // 获取已报名会员
    const { data: registrations } = await this.client()
      .from('event_registrations')
      .select('member_id, status, created_at, members(id, name, avatar, company_name)')
      .eq('event_id', id)

    const signed = await this.uploadService.signDetailMediaFields(
      data,
      ['cover_image', 'video_url'],
      ['description', 'content'],
    )
    const formFields = normalizeRegisterFormFields(signed.form_fields)
    const formDefaultsBundle = memberId
      ? await resolveRegisterFormDefaults(memberId, formFields, 'event')
      : { defaults: {}, talentDefaults: {} }
    const registrationCount = Array.isArray(registrations) ? registrations.length : 0
    const currentParticipants = Math.max(
      Number(signed.current_participants || 0),
      registrationCount,
    )
    const synced = await this.syncEventRuntimeStatus({
      ...signed,
      current_participants: currentParticipants,
    })
    const isRegistered = memberId
      ? (registrations || []).some((item: any) => String(item.member_id) === String(memberId))
      : false
    const runtimeStatus = resolveEventStatus({
      ...synced,
      current_participants: currentParticipants,
    })
    return {
      ...synced,
      status: runtimeStatus,
      view_count: Number(signed.view_count || 0) + 1,
      form_fields: formFields.length ? formFields : synced.form_fields,
      form_defaults: formDefaultsBundle.defaults,
      talent_defaults: formDefaultsBundle.talentDefaults,
      current_participants: currentParticipants,
      registration_count: registrationCount,
      registrations: [],
      member_state: {
        is_registered: isRegistered,
        can_register: !isRegistered && runtimeStatus === 'open',
        register_blocked_reason:
          runtimeStatus === 'ended'
            ? '已结束'
            : runtimeStatus === 'full'
              ? '已满员'
              : runtimeStatus === 'draft'
                ? '活动未开放'
                : null,
      },
    }
  }

  /** 报名活动 */
  async registerEvent(eventId: string, memberId: string, formAnswers?: Record<string, unknown> | null) {
    console.log('[EventsService] registerEvent - eventId:', eventId, 'memberId:', memberId)

    // 检查是否已报名
    const { data: existing } = await this.client()
      .from('event_registrations')
      .select('id')
      .eq('event_id', eventId)
      .eq('member_id', memberId)
      .single()

    if (existing) throw new HttpException('已报名该活动', HttpStatus.CONFLICT)

    // 检查活动名额
    const { data: event } = await this.client()
      .from('events')
      .select('id, title, max_participants, current_participants, status, form_fields, start_time, end_time')
      .eq('id', eventId)
      .single()

    if (!event) throw new HttpException('活动不存在', HttpStatus.NOT_FOUND)

    const countRow = await queryOne(
      'SELECT COUNT(*) AS total FROM event_registrations WHERE event_id = ?',
      [eventId],
    )
    const currentParticipants = Math.max(
      Number(event.current_participants || 0),
      Number(countRow?.total || 0),
    )
    const runtimeStatus = resolveEventStatus({
      ...event,
      current_participants: currentParticipants,
      status: event.status === 'draft' ? 'draft' : 'open',
    })
    if (runtimeStatus === 'draft') throw new HttpException('活动不可报名', HttpStatus.BAD_REQUEST)
    if (runtimeStatus === 'ended') throw new HttpException('已结束', HttpStatus.BAD_REQUEST)
    if (runtimeStatus === 'full') throw new HttpException('已满员', HttpStatus.BAD_REQUEST)
    if (runtimeStatus !== 'open') throw new HttpException('活动不可报名', HttpStatus.BAD_REQUEST)

    const max = Number(event.max_participants)
    if (Number.isFinite(max) && max > 0 && currentParticipants >= max) {
      throw new HttpException('已满员', HttpStatus.BAD_REQUEST)
    }

    const answers =
      formAnswers && typeof formAnswers === 'object' && !Array.isArray(formAnswers)
        ? formAnswers
        : null

    const formFields = normalizeRegisterFormFields(event.form_fields)
    try {
      assertRequiredFormAnswers(formFields, answers || {})
    } catch (err) {
      throw new HttpException(
        err instanceof Error ? err.message : '请完善报名字段',
        HttpStatus.BAD_REQUEST,
      )
    }

    // 插入报名记录
    const { data, error } = await this.client()
      .from('event_registrations')
      .insert({
        event_id: eventId,
        member_id: memberId,
        status: 'registered',
        ...(answers ? { form_answers: JSON.stringify(answers) } : {}),
      })
      .select()
      .single()

    if (error) throw new HttpException(`报名失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)

    // 并发报名兜底：插入后再核验名额，超员则回滚本条
    if (Number.isFinite(max) && max > 0) {
      const afterRow = await queryOne(
        'SELECT COUNT(*) AS total FROM event_registrations WHERE event_id = ?',
        [eventId],
      )
      const afterCount = Number(afterRow?.total || 0)
      if (afterCount > max) {
        await queryExecute(
          'DELETE FROM event_registrations WHERE event_id = ? AND member_id = ?',
          [eventId, memberId],
        )
        throw new HttpException('已满员', HttpStatus.BAD_REQUEST)
      }
    }

    const recount = await queryOne(
      'SELECT COUNT(*) AS total FROM event_registrations WHERE event_id = ?',
      [eventId],
    )
    const nextCount = Number(recount?.total || currentParticipants + 1)
    const nextStatus = resolveEventStatus({
      ...event,
      status: 'open',
      current_participants: nextCount,
    })
    await this.client()
      .from('events')
      .update({ current_participants: nextCount, status: nextStatus })
      .eq('id', eventId)

    void this.pointsEngine
      .evaluate(memberId, 'attend_event', {
        referenceType: 'event',
        referenceId: eventId,
        description: '参加活动奖励积分',
      })
      .catch((err) => console.warn('[EventsService] points evaluate failed', err))

    void this.invitationEngine
      .grantConditionRewards(memberId, 'invitee_event', {
        description: '推荐会员参加活动',
        referenceId: eventId,
      })
      .catch((err) => console.warn('[EventsService] invite reward failed', err))

    await createNotification({
      memberId,
      type: 'activity',
      title: '活动报名成功',
      content: `您已成功报名「${event.title || '活动'}」`,
      link: `/pages/content-detail/index?type=event&id=${eventId}`,
      bizType: 'event_register',
      bizId: eventId,
      result: 'approved',
    })

    return data
  }

  /** 我的报名：活动 + 路演 */
  async getMyRegistrations(memberId: string | number) {
    if (!memberId) throw new HttpException('未登录', HttpStatus.UNAUTHORIZED)

    let eventRows: any[] = []
    try {
      eventRows = await queryRows(
        `SELECT er.id AS registration_id, er.created_at AS registered_at, er.status,
                e.id AS target_id, e.title, e.cover_image, e.start_time, e.end_time, e.location,
                'event' AS type, '活动' AS type_label
         FROM event_registrations er
         INNER JOIN events e ON e.id = er.event_id
         WHERE er.member_id = ?
         ORDER BY er.created_at DESC`,
        [memberId],
      )
    } catch (error) {
      console.warn('[EventsService] load event registrations failed', error)
    }

    let roadshowRows: any[] = []
    try {
      roadshowRows = await queryRows(
        `SELECT rr.id AS registration_id, rr.created_at AS registered_at, 'registered' AS status,
                b.id AS target_id, b.title, b.cover_image, b.start_time, b.end_time, NULL AS location,
                'roadshow' AS type, '路演' AS type_label
         FROM roadshow_registrations rr
         INNER JOIN business_opportunities b ON b.id = rr.business_id
         WHERE rr.member_id = ?
         ORDER BY rr.created_at DESC`,
        [memberId],
      )
    } catch (error) {
      console.warn('[EventsService] load roadshow registrations failed', error)
    }

    const merged = [...(eventRows || []), ...(roadshowRows || [])].sort((a, b) => {
      const ta = new Date(a.registered_at || 0).getTime()
      const tb = new Date(b.registered_at || 0).getTime()
      return tb - ta
    })

    const list = await this.uploadService.signRowsFields(merged, ['cover_image'])
    return { list, total: list.length }
  }

  /** 取消报名 */
  async cancelRegistration(eventId: string, memberId: string) {
    const { error } = await this.client()
      .from('event_registrations')
      .delete()
      .eq('event_id', eventId)
      .eq('member_id', memberId)

    if (error) throw new HttpException(`取消失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)

    const countRow = await queryOne(
      'SELECT COUNT(*) AS total FROM event_registrations WHERE event_id = ?',
      [eventId],
    )
    const total = Number(countRow?.total || 0)
    const { data: event } = await this.client()
      .from('events')
      .select('id, status, start_time, end_time, max_participants')
      .eq('id', eventId)
      .single()

    if (event) {
      const nextStatus =
        String(event.status) === 'draft'
          ? 'draft'
          : resolveEventStatus({
              status: 'open',
              start_time: event.start_time,
              end_time: event.end_time,
              max_participants: event.max_participants,
              current_participants: total,
            })
      await this.client()
        .from('events')
        .update({ current_participants: total, status: nextStatus })
        .eq('id', eventId)
    }

    return { success: true }
  }

  /** 获取项目列表（仅已审核通过） */
  async getProjects(params: {
    industry?: string
    stage?: string
    status?: string
    keyword?: string
    page?: number
    pageSize?: number
  }) {
    const page = Math.max(1, Number(params.page) || 1)
    const pageSize = Math.max(1, Math.min(100, Number(params.pageSize) || 20))
    const offset = (page - 1) * pageSize
    const where = [`(p.audit_status = 'approved' OR p.audit_status IS NULL OR p.audit_status = '')`]
    const values: any[] = []

    if (params.industry) {
      where.push('p.industry = ?')
      values.push(params.industry)
    }
    if (params.stage) {
      where.push('p.stage = ?')
      values.push(params.stage)
    }
    if (params.status) {
      where.push('p.status = ?')
      values.push(params.status)
    } else {
      where.push(`p.status IN ('active', 'funded', 'published')`)
    }
    if (params.keyword) {
      where.push('(p.title LIKE ? OR p.description LIKE ?)')
      const like = `%${params.keyword}%`
      values.push(like, like)
    }

    const whereSql = `WHERE ${where.join(' AND ')}`
    const countRow = await queryOne(`SELECT COUNT(*) AS total FROM projects p ${whereSql}`, values)
    const rows = await queryRows(
      `SELECT p.* FROM projects p
       ${whereSql}
       ORDER BY p.is_featured DESC, p.sort_order ASC,
                COALESCE(p.admin_operated_at, p.created_at) DESC, p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, pageSize, offset],
    )
    const list = await this.uploadService.signRowsFields(rows || [], ['cover_image', 'video_url'])
    return {
      list: (list || []).map((item: any) => ({
        ...item,
        avg_score: Number(item.avg_score || 0),
        score_count: Number(item.score_count || 0),
      })),
      total: Number(countRow?.total || 0),
      page,
      pageSize,
    }
  }

  /** H5 富文本项目若未配置评分维度，自动补齐默认三项 */
  private async ensureDefaultProjectScoreDimensions(
    projectId: string | number,
    projectRow: Record<string, any>,
  ) {
    const body = [projectRow?.description, projectRow?.content]
      .map((v) => String(v || '').trim())
      .find((v) => v && v !== '<p><br></p>')
    if (!isFullHtmlProjectBody(body)) return

    const existing = await queryRows(
      'SELECT id FROM project_score_dimensions WHERE project_id = ? LIMIT 1',
      [projectId],
    )
    if (existing.length) return

    for (let i = 0; i < DEFAULT_PROJECT_SCORE_DIMENSIONS.length; i += 1) {
      await queryExecute(
        `INSERT INTO project_score_dimensions (project_id, name, sort_order) VALUES (?, ?, ?)`,
        [projectId, DEFAULT_PROJECT_SCORE_DIMENSIONS[i], i],
      )
    }
  }

  /** 获取项目详情（含评分维度） */
  async getProjectById(id: string, memberId?: string | number) {
    const data = await queryOne('SELECT * FROM projects WHERE id = ?', [id])
    if (!data) throw new HttpException('项目不存在', HttpStatus.NOT_FOUND)

    const auditStatus = String((data as any).audit_status || 'approved')
    const isOwner = memberId && String((data as any).submitter_id) === String(memberId)
    if (auditStatus !== 'approved' && !isOwner) {
      throw new HttpException('项目不存在或未通过审核', HttpStatus.NOT_FOUND)
    }

    await this.ensureDefaultProjectScoreDimensions(id, data as any)

    if (auditStatus === 'approved') {
      try {
        await queryExecute(
          'UPDATE projects SET view_count = IFNULL(view_count, 0) + 1 WHERE id = ?',
          [id],
        )
      } catch (error) {
        console.warn('[EventsService] increment project view_count failed:', error)
      }
    }

    const dimensions = await queryRows(
      `SELECT id, project_id, name, sort_order
       FROM project_score_dimensions
       WHERE project_id = ?
       ORDER BY sort_order ASC, id ASC`,
      [id],
    )

    let myScores: any[] = []
    let hasScored = false
    if (memberId) {
      myScores = await queryRows(
        `SELECT dimension_id, stars FROM project_scores
         WHERE project_id = ? AND member_id = ?`,
        [id, memberId],
      )
      hasScored = myScores.length > 0
    }

    const signed = await this.uploadService.signDetailMediaFields(
      data,
      ['cover_image', 'video_url'],
      ['description', 'content'],
    )
    const galleryImages = await this.uploadService.signMediaUrls(
      normalizeProjectUrlList((data as any).gallery_images),
    )
    const fileUrls = await this.uploadService.signMediaUrls(
      normalizeProjectUrlList((data as any).file_urls),
    )

    let ownerMemberId = (data as any).submitter_id || null
    let ownerName: string | null = null
    let ownerUserCategory: string | null = null
    let companyName = String((data as any).company_name || '').trim() || null
    if (ownerMemberId) {
      const owner = await queryOne(
        'SELECT id, name, user_category, company_name FROM members WHERE id = ?',
        [ownerMemberId],
      )
      if (owner) {
        ownerName = owner.name || null
        ownerUserCategory = normalizeUserCategory(owner.user_category)
        if (!companyName) companyName = String(owner.company_name || '').trim() || null
      }
    }

    const promoMode = normalizePromoCoopMode((data as any).promo_coop_mode)
    return {
      ...signed,
      gallery_images: galleryImages,
      file_urls: fileUrls,
      view_count:
        auditStatus === 'approved'
          ? Number((data as any).view_count || 0) + 1
          : Number((data as any).view_count || 0),
      avg_score: Number(data.avg_score || 0),
      score_count: Number(data.score_count || 0),
      score_dimensions: dimensions || [],
      submitter_id: ownerMemberId,
      owner_member_id: ownerMemberId,
      owner_name: ownerName,
      company_name: companyName,
      owner_user_category: ownerUserCategory,
      owner_user_category_label: ownerUserCategory ? userCategoryLabel(ownerUserCategory) : null,
      promo_coop_mode: promoMode,
      promo_coop_mode_label: promoMode ? promoCoopModeLabel(promoMode) : null,
      promo_commission_rate:
        (data as any).promo_commission_rate != null
          ? Number((data as any).promo_commission_rate)
          : null,
      promo_amount_wan: null,
      amount_max: null,
      promo_remark: (data as any).promo_remark || null,
      promo_share_count: Number((data as any).promo_share_count || 0),
      member_state: {
        has_scored: hasScored,
        can_score: !hasScored && (dimensions || []).length > 0,
        my_scores: myScores || [],
      },
    }
  }

  private async refreshProjectAvgScore(projectId: string | number) {
    const row = await queryOne(
      `SELECT AVG(stars) AS avg_score, COUNT(DISTINCT member_id) AS score_count
       FROM project_scores WHERE project_id = ?`,
      [projectId],
    )
    await queryExecute(
      `UPDATE projects SET avg_score = ?, score_count = ?, updated_at = NOW() WHERE id = ?`,
      [Number(row?.avg_score || 0).toFixed(2), Number(row?.score_count || 0), projectId],
    )
  }

  /** 提交项目评分（每人仅一次） */
  async submitProjectScores(
    projectId: string,
    memberId: string | number,
    scores: Array<{ dimension_id: number | string; stars: number }>,
  ) {
    const project = await queryOne('SELECT id FROM projects WHERE id = ?', [projectId])
    if (!project) throw new HttpException('项目不存在', HttpStatus.NOT_FOUND)

    const existed = await queryOne(
      'SELECT id FROM project_scores WHERE project_id = ? AND member_id = ? LIMIT 1',
      [projectId, memberId],
    )
    if (existed) throw new HttpException('您已评分，不能重复评分', HttpStatus.BAD_REQUEST)

    const dimensions = await queryRows(
      'SELECT id FROM project_score_dimensions WHERE project_id = ?',
      [projectId],
    )
    if (!dimensions.length) throw new HttpException('该项目暂未配置评分维度', HttpStatus.BAD_REQUEST)

    const map = new Map(
      (scores || []).map((item) => [String(item.dimension_id), Math.min(5, Math.max(1, Number(item.stars) || 0))]),
    )
    for (const dim of dimensions) {
      const stars = map.get(String(dim.id))
      if (!stars) throw new HttpException('请完成全部评分维度', HttpStatus.BAD_REQUEST)
      await queryExecute(
        `INSERT INTO project_scores (project_id, dimension_id, member_id, stars)
         VALUES (?, ?, ?, ?)`,
        [projectId, dim.id, memberId, stars],
      )
    }
    await this.refreshProjectAvgScore(projectId)
    return this.getProjectById(projectId, memberId)
  }

  /** 分享项目给小程序内好友 */
  async shareProjectToMember(projectId: string, fromMemberId: string | number, receiverId: string | number) {
    if (String(fromMemberId) === String(receiverId)) {
      throw new HttpException('不能分享给自己', HttpStatus.BAD_REQUEST)
    }
    const project = await queryOne('SELECT id, title FROM projects WHERE id = ?', [projectId])
    if (!project) throw new HttpException('项目不存在', HttpStatus.NOT_FOUND)
    const receiver = await queryOne(`SELECT id, name FROM members WHERE id = ? AND status = 'active'`, [
      receiverId,
    ])
    if (!receiver) throw new HttpException('好友不存在', HttpStatus.BAD_REQUEST)
    const sender = await queryOne('SELECT name FROM members WHERE id = ?', [fromMemberId])

    await createNotification({
      memberId: receiverId,
      type: 'share',
      title: '好友向您分享了项目',
      content: `${sender?.name || '会员'}向您分享了项目「${project.title}」`,
      link: `/pages/content-detail/index?type=project&id=${projectId}`,
      bizType: 'project_share',
      bizId: projectId,
      result: 'shared',
    })
    return { success: true }
  }

  /** 获取可接收项目分享的已入驻人才 */
  async getShareableTalents(projectId: string, fromMemberId: string | number) {
    const project = await queryOne('SELECT id, title FROM projects WHERE id = ?', [projectId])
    if (!project) throw new HttpException('项目不存在', HttpStatus.NOT_FOUND)

    const fromId = String(fromMemberId || '').trim()
    const { list } = await this.talentService.listApproved({ pageSize: 200 })

    return (Array.isArray(list) ? list : [])
      .filter((talent: any) => {
        const memberId = String(talent?.member_id || '').trim()
        return memberId && memberId !== fromId
      })
      .map((talent: any) => ({
        member_id: String(talent.member_id),
        name: talent.real_name || talent.member_name || '未命名人才',
        company_name: talent.company_name || '',
        job_title: talent.job_title || '',
      }))
  }

  /** 分享项目给指定已入驻人才（每人一条可直达详情的通知） */
  async shareProjectToTalents(
    projectId: string,
    fromMemberId: string | number,
    receiverIds: Array<string | number>,
  ) {
    const project = await queryOne('SELECT id, title FROM projects WHERE id = ?', [projectId])
    if (!project) throw new HttpException('项目不存在', HttpStatus.NOT_FOUND)
    const selectedIds = [...new Set(
      (Array.isArray(receiverIds) ? receiverIds : [])
        .map((id) => String(id || '').trim())
        .filter((id) => id && id !== String(fromMemberId)),
    )]
    if (!selectedIds.length) {
      throw new HttpException('请至少选择一位入驻人才', HttpStatus.BAD_REQUEST)
    }

    const shareable = await this.getShareableTalents(projectId, fromMemberId)
    const talents = shareable.filter((talent) => selectedIds.includes(talent.member_id))
    if (!talents.length) {
      throw new HttpException('所选人才不可接收分享', HttpStatus.BAD_REQUEST)
    }

    const sender = await queryOne('SELECT name FROM members WHERE id = ?', [fromMemberId])
    let sent = 0
    for (const talent of talents) {
      const receiverId = talent.member_id
      await createNotification({
        memberId: receiverId,
        type: 'share',
        title: '收到项目分享',
        content: `${sender?.name || '会员'}向您分享了项目「${project.title}」`,
        link: `/pages/content-detail/index?type=project&id=${projectId}`,
        bizType: 'project_share',
        bizId: projectId,
        result: 'shared',
      })
      sent += 1
    }

    if (sent > 0) {
      try {
        await queryExecute(
          'UPDATE projects SET promo_share_count = IFNULL(promo_share_count, 0) + ?, updated_at = NOW() WHERE id = ?',
          [sent, projectId],
        )
      } catch (error) {
        console.warn('[EventsService] increment promo_share_count failed:', error)
      }
    }

    return { success: true, count: sent }
  }

  /** 会员发布项目（待后台审核） */
  async submitMemberProject(memberId: string | number, dto: any) {
    if (!dto?.title?.trim()) throw new HttpException('请填写项目名称', HttpStatus.BAD_REQUEST)
    if (!isCloudStorageUrl(dto.cover_image)) {
      throw new HttpException('项目封面图片为必填项', HttpStatus.BAD_REQUEST)
    }
    if (dto.video_url && !isCloudStorageUrl(dto.video_url)) {
      throw new HttpException('项目视频必须使用微信云托管对象存储 URL', HttpStatus.BAD_REQUEST)
    }
    const galleryImages = normalizeProjectUrlList(dto.gallery_images)
    const result = await queryExecute(
      `INSERT INTO projects
         (title, description, cover_image, video_url, gallery_images, file_urls, industry, stage, amount_max, status,
          audit_status, submitter_id, view_count, avg_score, score_count,
          promo_coop_mode, promo_commission_rate, promo_amount_wan, promo_remark, promo_share_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'pending', ?, 0, 0, 0, ?, ?, ?, ?, 0)`,
      [
        String(dto.title).trim(),
        dto.description || null,
        canonicalizeCloudStorageUrl(dto.cover_image),
        dto.video_url ? canonicalizeCloudStorageUrl(dto.video_url) : null,
        serializeJsonUrlList(galleryImages),
        serializeJsonUrlList([]),
        dto.industry || null,
        dto.stage || 'seed',
        null,
        memberId,
        normalizePromoCoopMode(dto.promo_coop_mode),
        dto.promo_commission_rate != null && dto.promo_commission_rate !== ''
          ? Number(dto.promo_commission_rate)
          : null,
        null,
        dto.promo_remark != null ? String(dto.promo_remark || '').trim() || null : null,
      ],
    )
    const project = await queryOne('SELECT * FROM projects WHERE id = ?', [result.insertId])
    await createNotification({
      memberId,
      type: 'approval',
      title: '项目已提交审核',
      content: `您发布的项目「${project?.title || dto.title}」已提交，请等待后台审核`,
      link: `/pages/content-detail/index?type=project&id=${result.insertId}`,
      bizType: 'project_audit',
      bizId: result.insertId,
      result: 'pending',
    })
    return project
  }

  /** 创建项目（后台） */
  async createProject(dto: any) {
    console.log('[EventsService] createProject - title:', dto.title)
    if (!isCloudStorageUrl(dto.cover_image)) {
      throw new HttpException('项目封面图片为必填项', HttpStatus.BAD_REQUEST)
    }
    if (dto.video_url && !isCloudStorageUrl(dto.video_url)) {
      throw new HttpException('项目视频必须使用微信云托管对象存储 URL', HttpStatus.BAD_REQUEST)
    }
    const result = await queryExecute(
      `INSERT INTO projects
         (title, description, cover_image, video_url, industry, stage, amount_max, status, audit_status, view_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', 0)`,
      [
        dto.title,
        dto.description || null,
        canonicalizeCloudStorageUrl(dto.cover_image),
        dto.video_url ? canonicalizeCloudStorageUrl(dto.video_url) : null,
        dto.industry || null,
        dto.stage || 'seed',
        null,
        dto.status || 'active',
      ],
    )
    const row = await queryOne('SELECT * FROM projects WHERE id = ?', [result.insertId])
    if (!row) throw new HttpException('创建项目失败', HttpStatus.INTERNAL_SERVER_ERROR)
    return this.uploadService.signRowFields(row, ['cover_image', 'video_url'])
  }

  /** 获取资源供需列表 */
  async getResources(params: { type?: string; category?: string; industry?: string; page?: number; pageSize?: number }) {
    const page = params.page || 1
    const pageSize = params.pageSize || 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = this.client()
      .from('resources')
      .select('*, members(id, name, avatar, company_name, company_position)', { count: 'exact' })
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(from, to)

    if (params.type) query = query.eq('type', params.type)
    if (params.category) query = query.eq('category', params.category)
    if (params.industry) query = query.eq('industry', params.industry)

    const { data, error, count } = await query
    if (error) throw new HttpException(`查询失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)

    return { list: data || [], total: count || 0, page, pageSize }
  }

  /** 发布资源 */
  async createResource(dto: any) {
    console.log('[EventsService] createResource - type:', dto.type)
    const { data, error } = await this.client()
      .from('resources')
      .insert({
        member_id: dto.member_id,
        type: dto.type,
        title: dto.title,
        description: dto.description,
        category: dto.category || null,
        industry: dto.industry || null,
        region: dto.region || null,
        contact_info: dto.contact_info || null,
        status: 'active',
      })
      .select()
      .single()

    if (error) throw new HttpException(`发布失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    return data
  }
}
