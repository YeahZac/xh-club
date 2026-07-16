import { BadRequestException, Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../storage/database/supabase-compat';
import { isCloudStorageUrl } from '@/utils/media-url';

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
    this.validateMedia(data, true);
    const { data: article, error } = await this.client()
      .from('articles')
      .insert([data])
      .select()
      .single();

    if (error) throw error;
    return article;
  }

  async update(id: string, data: any) {
    this.validateMedia(data, false);
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

  private validateMedia(data: any, requireImage: boolean) {
    if ((requireImage || data.cover_image !== undefined) && !isCloudStorageUrl(data.cover_image)) {
      throw new BadRequestException('文章封面图片为必填项');
    }
    if (data.video_url && !isCloudStorageUrl(data.video_url)) {
      throw new BadRequestException('文章视频必须使用微信云托管对象存储 URL');
    }
  }
}
