import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-compat';

@Injectable()
export class EventRegistrationService {
  /** 提交报名 */
  async create(body: {
    name: string;
    gender: string;
    birthday: string;
    age?: number;
    industry: string;
    phone: string;
    contact_method?: string;
    referrer?: string;
  }) {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('event_form_registrations')
      .insert({
        name: body.name,
        gender: body.gender,
        birthday: body.birthday,
        age: body.age ?? null,
        industry: body.industry,
        phone: body.phone,
        contact_method: body.contact_method || null,
        referrer: body.referrer || null,
      })
      .select()
      .single();

    if (error) throw new Error(`报名失败: ${error.message}`);
    return data;
  }

  /** 获取报名列表 */
  async findAll(keyword?: string) {
    const client = getSupabaseClient();
    let query = client
      .from('event_form_registrations')
      .select('*')
      .order('created_at', { ascending: false });

    if (keyword && keyword.trim()) {
      const kw = keyword.trim();
      query = query.or(
        `name.ilike.%${kw}%,phone.ilike.%${kw}%,industry.ilike.%${kw}%,referrer.ilike.%${kw}%`
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(`查询失败: ${error.message}`);
    return data;
  }

  /** 删除报名 */
  async remove(id: string) {
    const client = getSupabaseClient();
    const { error } = await client
      .from('event_form_registrations')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`删除失败: ${error.message}`);
  }

  /** 导出CSV */
  async exportCsv(): Promise<string> {
    const records = await this.findAll();
    const headers = ['姓名', '性别', '生日', '年龄', '行业', '电话', '联系方式', '引荐人', '报名时间'];
    const rows = (records || []).map((r: any) => [
      r.name || '',
      r.gender || '',
      r.birthday || '',
      r.age ?? '',
      r.industry || '',
      r.phone || '',
      r.contact_method || '',
      r.referrer || '',
      r.created_at ? new Date(r.created_at).toLocaleString('zh-CN') : '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((row: string[]) => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    return csvContent;
  }
}
