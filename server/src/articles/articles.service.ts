import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../storage/database/supabase-client';

@Injectable()
export class ArticlesService {
  private client() { return getSupabaseClient() }

  async findAll() {
    const { data, error } = await this.client()
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async findOne(id: string) {
    const { data, error } = await this.client()
      .from('articles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async create(data: any) {
    const { data: article, error } = await this.client()
      .from('articles')
      .insert([data])
      .select()
      .single();

    if (error) throw error;
    return article;
  }

  async update(id: string, data: any) {
    const { data: article, error } = await this.client()
      .from('articles')
      .update({ ...data, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return article;
  }

  async delete(id: string) {
    const { error } = await this.client()
      .from('articles')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  }

  async publish(id: string) {
    return this.update(id, { status: 'published', published_at: new Date() });
  }

  async unpublish(id: string) {
    return this.update(id, { status: 'draft', published_at: null });
  }
}
