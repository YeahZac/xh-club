import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import {
  assertRequiredFormAnswers,
  normalizeRegisterFormFields,
  resolveRegisterFormDefaults,
} from '@/common/form-defaults'
import { getSupabaseClient } from '@/storage/database/supabase-compat'
import { queryExecute, queryOne, queryRows } from '@/storage/database/mysql-client'
import { canonicalizeCloudStorageUrl, isCloudStorageUrl } from '@/utils/media-url'
import { UploadService } from '@/upload/upload.service'
import { PointsEngineService } from '@/points/points-engine.service'
import { InvitationEngineService } from '@/invitation/invitation-engine.service'
import { createNotification } from '@/common/notify'

@Injectable()
export class EventsService {
  constructor(
    private readonly uploadService: UploadService,
    private readonly pointsEngine: PointsEngineService,
    private readonly invitationEngine: InvitationEngineService,
  ) {}

  private client() { return getSupabaseClient() }

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
      .order('start_time', { ascending: false })
      .range(from, to)

    if (params.event_type) query = query.eq('event_type', params.event_type)
    if (params.status) query = query.eq('status', params.status)

    const { data, error, count } = await query
    if (error) throw new HttpException(`查询失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)

    let list = await this.uploadService.signRowsFields(data || [], ['cover_image', 'video_url'])
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
    const isRegistered = memberId
      ? (registrations || []).some((item: any) => String(item.member_id) === String(memberId))
      : false
    return {
      ...signed,
      form_fields: formFields.length ? formFields : signed.form_fields,
      form_defaults: formDefaultsBundle.defaults,
      talent_defaults: formDefaultsBundle.talentDefaults,
      current_participants: currentParticipants,
      registration_count: registrationCount,
      registrations: [],
      member_state: {
        is_registered: isRegistered,
        can_register: !isRegistered && signed.status === 'open',
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
      .select('title, max_participants, current_participants, status, form_fields')
      .eq('id', eventId)
      .single()

    if (!event || event.status !== 'open') throw new HttpException('活动不可报名', HttpStatus.BAD_REQUEST)
    if (event.current_participants >= event.max_participants) throw new HttpException('活动名额已满', HttpStatus.BAD_REQUEST)

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

    // 更新参与人数
    await this.client()
      .from('events')
      .update({ current_participants: event.current_participants + 1 })
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

    // 更新参与人数
    const { data: event } = await this.client()
      .from('events')
      .select('current_participants')
      .eq('id', eventId)
      .single()

    if (event) {
      await this.client()
        .from('events')
        .update({ current_participants: Math.max(0, event.current_participants - 1) })
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
       ORDER BY p.created_at DESC
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

  /** 获取项目详情（含评分维度） */
  async getProjectById(id: string, memberId?: string | number) {
    const data = await queryOne('SELECT * FROM projects WHERE id = ?', [id])
    if (!data) throw new HttpException('项目不存在', HttpStatus.NOT_FOUND)

    const auditStatus = String((data as any).audit_status || 'approved')
    const isOwner = memberId && String((data as any).submitter_id) === String(memberId)
    if (auditStatus !== 'approved' && !isOwner) {
      throw new HttpException('项目不存在或未通过审核', HttpStatus.NOT_FOUND)
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
    return {
      ...signed,
      avg_score: Number(data.avg_score || 0),
      score_count: Number(data.score_count || 0),
      score_dimensions: dimensions || [],
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

    const talents = await queryRows(
      `SELECT DISTINCT t.member_id, t.real_name, t.company_name, t.job_title
       FROM talent_applications t
       INNER JOIN members m ON m.id = t.member_id AND m.status = 'active'
       WHERE t.status = 'approved'
         AND t.member_id IS NOT NULL
         AND t.member_id != ?
       ORDER BY t.real_name ASC, t.id DESC`,
      [fromMemberId],
    )

    return (talents || []).map((talent: any) => ({
      member_id: String(talent.member_id),
      name: talent.real_name || '未命名人才',
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

    const placeholders = selectedIds.map(() => '?').join(', ')
    const talents = await queryRows(
      `SELECT DISTINCT t.member_id
       FROM talent_applications t
       INNER JOIN members m ON m.id = t.member_id AND m.status = 'active'
       WHERE t.status = 'approved' AND t.member_id IN (${placeholders})`,
      selectedIds,
    )
    if (!talents.length) {
      throw new HttpException('所选人才不可接收分享', HttpStatus.BAD_REQUEST)
    }

    const sender = await queryOne('SELECT name FROM members WHERE id = ?', [fromMemberId])
    let sent = 0
    for (const talent of talents || []) {
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
    const result = await queryExecute(
      `INSERT INTO projects
         (title, description, cover_image, video_url, industry, stage, amount_max, status,
          audit_status, submitter_id, view_count, avg_score, score_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 'pending', ?, 0, 0, 0)`,
      [
        String(dto.title).trim(),
        dto.description || null,
        canonicalizeCloudStorageUrl(dto.cover_image),
        dto.video_url ? canonicalizeCloudStorageUrl(dto.video_url) : null,
        dto.industry || null,
        dto.stage || 'seed',
        dto.amount_max || null,
        memberId,
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
        dto.amount_max || null,
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
