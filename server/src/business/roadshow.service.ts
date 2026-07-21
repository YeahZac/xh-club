import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import {
  assertRequiredFormAnswers,
  normalizeRegisterFormFields,
  resolveRegisterFormDefaults,
  type FormFieldLike,
} from '@/common/form-defaults'
import { createNotification } from '@/common/notify'
import { queryExecute, queryOne, queryRows } from '@/storage/database/mysql-client'
import { ensureSchemaColumns } from '@/storage/database/ensure-schema-columns'
import { UploadService } from '@/upload/upload.service'
import { assertCloudStorageImageUrl } from '@/utils/media-validators'

export interface RoadshowFormField extends FormFieldLike {
  label: string
  type: string
  required?: boolean
  reuse_last?: boolean
  options?: string[]
}

export interface RoadshowProjectInput {
  project_id: number | string
  cover_image?: string | null
  sort_order?: number
}

export interface RoadshowDimensionInput {
  id?: number | string
  name: string
  sort_order?: number
}

function toMysqlDateTime(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string' && !(value instanceof Date)) return null
  const raw = value instanceof Date ? value.toISOString() : value.trim()
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    return raw.length === 16 ? `${raw}:00` : raw
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    const normalized = raw.replace('T', ' ')
    return normalized.length === 16 ? `${normalized}:00` : normalized
  }
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
}

@Injectable()
export class RoadshowService {
  constructor(private readonly uploadService: UploadService) {}

  async ensureSchema() {
    await ensureSchemaColumns()
  }

  parseJsonValue(value: unknown): unknown {
    if (value == null || value === '') return null
    if (typeof value === 'object') return value
    if (typeof value !== 'string') return null
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }

  normalizeFormFields(value: unknown): RoadshowFormField[] | null {
    const fields = normalizeRegisterFormFields(value)
    return fields.length ? (fields as RoadshowFormField[]) : null
  }

  private normalizeFormAnswers(value: unknown): Record<string, unknown> {
    const parsed = this.parseJsonValue(value)
    if (!parsed) return {}
    if (Array.isArray(parsed)) {
      const mapped: Record<string, unknown> = {}
      parsed.forEach((item) => {
        if (!item || typeof item !== 'object') return
        const row = item as Record<string, unknown>
        const label = String(row.label || row.name || '').trim()
        if (!label) return
        mapped[label] = row.value ?? ''
      })
      return mapped
    }
    if (typeof parsed === 'object') return parsed as Record<string, unknown>
    return {}
  }

  private async getBusinessOrThrow(businessId: string) {
    await this.ensureSchema()
    const row = await queryOne('SELECT * FROM business_opportunities WHERE id = ?', [businessId])
    if (!row) throw new HttpException('商机不存在', HttpStatus.NOT_FOUND)
    if (row.category !== 'roadshow') {
      throw new HttpException('仅项目路演类型支持该操作', HttpStatus.BAD_REQUEST)
    }
    return row
  }

  private isBeforeEnd(endTime?: string | Date | null) {
    if (!endTime) return true
    const end = new Date(endTime)
    return !Number.isNaN(end.getTime()) && Date.now() <= end.getTime()
  }

  private getScoringPhase(startTime?: string | Date | null, endTime?: string | Date | null): 'before' | 'active' | 'ended' {
    const now = Date.now()
    if (startTime) {
      const start = new Date(startTime).getTime()
      if (!Number.isNaN(start) && now < start) return 'before'
    }
    if (endTime) {
      const end = new Date(endTime).getTime()
      if (!Number.isNaN(end) && now > end) return 'ended'
    }
    return 'active'
  }

  private isWithinScoringWindow(startTime?: string | Date | null, endTime?: string | Date | null) {
    return this.getScoringPhase(startTime, endTime) === 'active'
  }

  async getProjects(businessId: string) {
    const rows = await queryRows(
      `SELECT rp.id, rp.business_id, rp.project_id, rp.cover_image, rp.sort_order,
              p.title AS project_title, p.cover_image AS project_cover_image
       FROM roadshow_projects rp
       INNER JOIN projects p ON p.id = rp.project_id
       WHERE rp.business_id = ?
       ORDER BY rp.sort_order ASC, rp.id ASC`,
      [businessId],
    )
    return this.uploadService.signRowsFields(
      rows.map((row: any) => ({
        ...row,
        title: row.project_title,
        cover_image: row.cover_image || row.project_cover_image,
      })),
      ['cover_image', 'project_cover_image'],
    )
  }

  async getDimensions(businessId: string) {
    return queryRows(
      `SELECT id, business_id, name, sort_order
       FROM roadshow_score_dimensions
       WHERE business_id = ?
       ORDER BY sort_order ASC, id ASC`,
      [businessId],
    )
  }

  async enrichBusinessRow(row: any, memberId?: string | number) {
    if (row.category !== 'roadshow') return row

    const formFields = this.normalizeFormFields(row.form_fields)
    const projects = await this.getProjects(String(row.id))
    const dimensions = await this.getDimensions(String(row.id))

    let memberState: Record<string, unknown> = {
      is_registered: false,
      can_register: this.isBeforeEnd(row.end_time),
      can_score: false,
      can_view_results: false,
      scoring_phase: this.getScoringPhase(row.start_time, row.end_time),
      has_scored: false,
      my_scores: [] as any[],
    }

    let scoreSummary: Awaited<ReturnType<RoadshowService['getScoreSummary']>> | undefined

    if (memberId) {
      const registration = await queryOne(
        'SELECT id FROM roadshow_registrations WHERE business_id = ? AND member_id = ?',
        [row.id, memberId],
      )
      const isRegistered = Boolean(registration)
      const scoringPhase = this.getScoringPhase(row.start_time, row.end_time)
      const myScores = isRegistered
        ? await queryRows(
            `SELECT project_id, dimension_id, stars
             FROM roadshow_scores
             WHERE business_id = ? AND member_id = ?`,
            [row.id, memberId],
          )
        : []
      const canScore = isRegistered && scoringPhase === 'active' && dimensions.length > 0
      const canViewResults = isRegistered && scoringPhase === 'ended'
      memberState = {
        is_registered: isRegistered,
        can_register: !isRegistered && this.isBeforeEnd(row.end_time),
        can_score: canScore,
        can_view_results: canViewResults,
        scoring_phase: scoringPhase,
        has_scored: (myScores || []).length > 0,
        my_scores: myScores,
      }
      if (canViewResults) {
        scoreSummary = await this.getScoreSummary(String(row.id))
      }
    }

    const formDefaultsBundle = memberId
      ? await resolveRegisterFormDefaults(memberId, formFields, 'roadshow')
      : { defaults: {}, talentDefaults: {} }

    return {
      ...row,
      form_fields: formFields,
      form_defaults: formDefaultsBundle.defaults,
      talent_defaults: formDefaultsBundle.talentDefaults,
      roadshow_projects: projects,
      score_dimensions: dimensions,
      score_summary: scoreSummary,
      registration_count: Number(
        (
          await queryOne(
            'SELECT COUNT(*) AS total FROM roadshow_registrations WHERE business_id = ?',
            [row.id],
          )
        )?.total || 0,
      ),
      member_state: memberId ? memberState : undefined,
    }
  }

  async saveConfig(
    businessId: string,
    dto: {
      start_time?: string | null
      end_time?: string | null
      form_fields?: RoadshowFormField[] | null
      projects?: RoadshowProjectInput[]
      dimensions?: RoadshowDimensionInput[]
    },
  ) {
    await this.getBusinessOrThrow(businessId)

    const projects = Array.isArray(dto.projects) ? dto.projects : []
    const dimensions = Array.isArray(dto.dimensions) ? dto.dimensions : []

    if (!projects.length) {
      throw new HttpException('项目路演至少选择一个项目', HttpStatus.BAD_REQUEST)
    }
    if (!dimensions.length) {
      throw new HttpException('请至少配置一个评分维度', HttpStatus.BAD_REQUEST)
    }

    const formFieldsJson =
      dto.form_fields == null ? null : JSON.stringify(dto.form_fields)

    await queryExecute(
      `UPDATE business_opportunities
       SET start_time = ?, end_time = ?, form_fields = ?, updated_at = NOW()
       WHERE id = ?`,
      [toMysqlDateTime(dto.start_time), toMysqlDateTime(dto.end_time), formFieldsJson, businessId],
    )

    await queryExecute('DELETE FROM roadshow_projects WHERE business_id = ?', [businessId])
    const seenProjectIds = new Set<number>()
    for (const [index, item] of projects.entries()) {
      const projectId = Number(item.project_id)
      if (!Number.isInteger(projectId) || projectId <= 0) {
        throw new HttpException('项目选择无效', HttpStatus.BAD_REQUEST)
      }
      if (seenProjectIds.has(projectId)) {
        throw new HttpException(`路演项目不能重复选择（项目 #${projectId}）`, HttpStatus.BAD_REQUEST)
      }
      seenProjectIds.add(projectId)
      const project = await queryOne('SELECT id FROM projects WHERE id = ?', [projectId])
      if (!project) throw new HttpException(`项目 #${projectId} 不存在`, HttpStatus.BAD_REQUEST)
      const coverImage = item.cover_image
        ? assertCloudStorageImageUrl(item.cover_image, true)
        : null
      try {
        await queryExecute(
          `INSERT INTO roadshow_projects (business_id, project_id, cover_image, sort_order)
           VALUES (?, ?, ?, ?)`,
          [businessId, projectId, coverImage, Number(item.sort_order) || index],
        )
      } catch (error: any) {
        const msg = String(error?.message || '')
        if (msg.includes('uk_roadshow_project') || msg.includes('Duplicate entry')) {
          throw new HttpException(`路演项目不能重复选择（项目 #${projectId}）`, HttpStatus.BAD_REQUEST)
        }
        throw error
      }
    }

    const existingDimensions = await queryRows(
      'SELECT id FROM roadshow_score_dimensions WHERE business_id = ?',
      [businessId],
    )
    const keepIds = new Set<number>()
    for (const [index, item] of dimensions.entries()) {
      const name = String(item.name || '').trim()
      if (!name) throw new HttpException('评分维度名称不能为空', HttpStatus.BAD_REQUEST)
      const sortOrder = Number(item.sort_order) || index
      const dimensionId = Number(item.id)
      if (Number.isInteger(dimensionId) && dimensionId > 0) {
        const existing = existingDimensions.find((row: any) => Number(row.id) === dimensionId)
        if (existing) {
          await queryExecute(
            'UPDATE roadshow_score_dimensions SET name = ?, sort_order = ? WHERE id = ? AND business_id = ?',
            [name, sortOrder, dimensionId, businessId],
          )
          keepIds.add(dimensionId)
          continue
        }
      }
      const result = await queryExecute(
        `INSERT INTO roadshow_score_dimensions (business_id, name, sort_order)
         VALUES (?, ?, ?)`,
        [businessId, name, sortOrder],
      )
      keepIds.add(Number(result.insertId))
    }

    for (const row of existingDimensions as any[]) {
      if (!keepIds.has(Number(row.id))) {
        await queryExecute('DELETE FROM roadshow_score_dimensions WHERE id = ?', [row.id])
      }
    }

    return this.getAdminDetail(businessId)
  }

  async register(businessId: string, memberId: string | number, formAnswers?: Record<string, unknown>) {
    const business = await this.getBusinessOrThrow(businessId)
    if (!this.isBeforeEnd(business.end_time)) {
      throw new HttpException('报名已截止', HttpStatus.BAD_REQUEST)
    }

    const existing = await queryOne(
      'SELECT id FROM roadshow_registrations WHERE business_id = ? AND member_id = ?',
      [businessId, memberId],
    )
    if (existing) throw new HttpException('您已报名，请勿重复提交', HttpStatus.BAD_REQUEST)

    const fields = this.normalizeFormFields(business.form_fields) || []
    const answers = formAnswers || {}
    try {
      assertRequiredFormAnswers(fields, answers)
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : '请完善报名字段',
        HttpStatus.BAD_REQUEST,
      )
    }

    const result = await queryExecute(
      `INSERT INTO roadshow_registrations (business_id, member_id, form_answers)
       VALUES (?, ?, ?)`,
      [businessId, memberId, JSON.stringify(answers)],
    )

    await createNotification({
      memberId,
      type: 'activity',
      title: '路演报名成功',
      content: `您已成功报名「${business.title || '路演'}」`,
      link: `/pages/content-detail/index?type=business&id=${businessId}`,
      bizType: 'roadshow_register',
      bizId: businessId,
      result: 'approved',
    })

    return { id: result.insertId, success: true }
  }

  async submitScores(
    businessId: string,
    memberId: string | number,
    scores: Array<{ project_id: number | string; dimension_id: number | string; stars: number }>,
  ) {
    const business = await this.getBusinessOrThrow(businessId)
    const registration = await queryOne(
      'SELECT id FROM roadshow_registrations WHERE business_id = ? AND member_id = ?',
      [businessId, memberId],
    )
    if (!registration) {
      throw new HttpException('仅已报名用户可参与评分', HttpStatus.BAD_REQUEST)
    }
    if (!this.isWithinScoringWindow(business.start_time, business.end_time)) {
      throw new HttpException('当前不在路演评分时间内', HttpStatus.BAD_REQUEST)
    }

    const projects = await this.getProjects(businessId)
    const dimensions = await this.getDimensions(businessId)
    const projectIds = new Set(projects.map((item: any) => Number(item.project_id)))
    const dimensionIds = new Set(dimensions.map((item: any) => Number(item.id)))

    if (!Array.isArray(scores) || !scores.length) {
      throw new HttpException('请提交评分', HttpStatus.BAD_REQUEST)
    }

    for (const item of scores) {
      const projectId = Number(item.project_id)
      const dimensionId = Number(item.dimension_id)
      const stars = Number(item.stars)
      if (!projectIds.has(projectId)) {
        throw new HttpException('评分项目无效', HttpStatus.BAD_REQUEST)
      }
      if (!dimensionIds.has(dimensionId)) {
        throw new HttpException('评分维度无效', HttpStatus.BAD_REQUEST)
      }
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
        throw new HttpException('评分必须为 1 到 5 星', HttpStatus.BAD_REQUEST)
      }
      await queryExecute(
        `INSERT INTO roadshow_scores (business_id, project_id, member_id, dimension_id, stars)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE stars = VALUES(stars), updated_at = NOW()`,
        [businessId, projectId, memberId, dimensionId, stars],
      )
    }

    return { success: true }
  }

  async getRegistrations(businessId: string) {
    await this.getBusinessOrThrow(businessId)
    const business = await queryOne('SELECT form_fields FROM business_opportunities WHERE id = ?', [businessId])
    const formFields = this.normalizeFormFields(business?.form_fields) || []
    const rows = await queryRows(
      `SELECT rr.id, rr.member_id, rr.form_answers, rr.created_at,
              m.name AS member_name, m.phone AS member_phone
       FROM roadshow_registrations rr
       LEFT JOIN members m ON m.id = rr.member_id
       WHERE rr.business_id = ?
       ORDER BY rr.created_at DESC`,
      [businessId],
    )
    return {
      form_fields: formFields,
      list: rows.map((row: any) => ({
        ...row,
        form_answers: this.normalizeFormAnswers(row.form_answers),
      })),
    }
  }

  async getScoreSummary(businessId: string) {
    await this.getBusinessOrThrow(businessId)
    const projects = await this.getProjects(businessId)
    const dimensions = await this.getDimensions(businessId)

    const scoreRows = await queryRows(
      `SELECT project_id, dimension_id, AVG(stars) AS avg_stars, COUNT(*) AS vote_count
       FROM roadshow_scores
       WHERE business_id = ?
       GROUP BY project_id, dimension_id`,
      [businessId],
    )

    const raterRow = await queryOne(
      `SELECT COUNT(DISTINCT member_id) AS total FROM roadshow_scores WHERE business_id = ?`,
      [businessId],
    )
    const registrationRow = await queryOne(
      `SELECT COUNT(*) AS total FROM roadshow_registrations WHERE business_id = ?`,
      [businessId],
    )
    const totalRaters = Number(raterRow?.total || 0)
    const totalRegistrations = Number(registrationRow?.total || 0)

    const scoreMap = new Map<string, { avg_stars: number; vote_count: number }>()
    for (const row of scoreRows as any[]) {
      scoreMap.set(`${row.project_id}:${row.dimension_id}`, {
        avg_stars: Number(row.avg_stars) || 0,
        vote_count: Number(row.vote_count) || 0,
      })
    }

    const projectSummaries = projects.map((project: any) => {
      const dimensionScores = dimensions.map((dimension: any) => {
        const key = `${project.project_id}:${dimension.id}`
        const stat = scoreMap.get(key)
        return {
          dimension_id: dimension.id,
          name: dimension.name,
          avg_stars: stat ? Number(stat.avg_stars.toFixed(2)) : 0,
          vote_count: stat?.vote_count || 0,
        }
      })
      const validScores = dimensionScores.filter((item) => item.vote_count > 0)
      const overallAvg = validScores.length
        ? Number(
            (
              validScores.reduce((sum, item) => sum + item.avg_stars, 0) / validScores.length
            ).toFixed(2),
          )
        : 0
      return {
        project_id: project.project_id,
        title: project.title,
        cover_image: project.cover_image,
        overall_avg: overallAvg,
        dimension_scores: dimensionScores,
      }
    })

    projectSummaries.sort((a, b) => b.overall_avg - a.overall_avg || Number(a.project_id) - Number(b.project_id))
    projectSummaries.forEach((item, index) => {
      ;(item as any).rank = index + 1
    })

    const dimensionRankings = dimensions.map((dimension: any) => {
      const rows = projectSummaries
        .map((project) => {
          const stat = project.dimension_scores.find((item) => item.dimension_id === dimension.id)
          return {
            project_id: project.project_id,
            title: project.title,
            avg_stars: stat?.avg_stars || 0,
            vote_count: stat?.vote_count || 0,
          }
        })
        .filter((item) => item.vote_count > 0)
        .sort((a, b) => b.avg_stars - a.avg_stars || Number(a.project_id) - Number(b.project_id))
      return {
        dimension_id: dimension.id,
        name: dimension.name,
        rankings: rows.map((item, index) => ({ ...item, rank: index + 1 })),
      }
    })

    const topProject = projectSummaries[0]
    const summaryText = totalRaters > 0 && topProject
      ? `本次路演共 ${totalRegistrations} 人报名、${totalRaters} 人参与评分。综合排名第一为「${topProject.title}」（${topProject.overall_avg} 分）。`
      : totalRegistrations > 0
        ? `本次路演共 ${totalRegistrations} 人报名，暂未产生评分数据。`
        : '暂无人报名与评分。'

    const overallJudgement =
      totalRaters > 0 && topProject
        ? topProject.overall_avg >= 4.5
          ? '整体表现优秀，头部项目竞争力突出，建议重点关注排名前列项目。'
          : topProject.overall_avg >= 3.5
            ? '整体表现良好，各项目在不同维度各有亮点，可结合维度排名进一步筛选。'
            : '整体表现仍有提升空间，建议结合各维度得分优化路演内容与项目准备。'
        : '评分数据不足，暂无法给出综合判断。'

    return {
      total_registrations: totalRegistrations,
      total_raters: totalRaters,
      projects: projectSummaries,
      dimension_rankings: dimensionRankings,
      summary_text: summaryText,
      overall_judgement: overallJudgement,
    }
  }

  async getAdminDetail(businessId: string) {
    const business = await this.getBusinessOrThrow(businessId)
    const signed = await this.uploadService.signRowFields(business, ['cover_image'])
    const enriched = await this.enrichBusinessRow(signed)
    const scoreSummary = await this.getScoreSummary(businessId)
    return {
      ...enriched,
      score_summary: scoreSummary,
    }
  }
}
