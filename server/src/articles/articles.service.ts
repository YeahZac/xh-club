import { BadRequestException, Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../storage/database/supabase-compat';
import { queryExecute } from '@/storage/database/mysql-client';
import { canonicalizeCloudStorageUrl, isCloudStorageUrl } from '@/utils/media-url';
import { UploadService } from '@/upload/upload.service';

@Injectable()
export class ArticlesService {
  constructor(private readonly uploadService: UploadService) {}

  private client() { return getSupabaseClient() }

  async findAll() {
    const { data, error } = await this.client()
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return this.uploadService.signRowsFields(data || [], ['cover_image', 'video_url']);
  }

  async findOne(id: string) {
    const { data, error } = await this.client()
      .from('articles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    try {
      await queryExecute(
        'UPDATE articles SET view_count = IFNULL(view_count, 0) + 1 WHERE id = ?',
        [id],
      );
    } catch (err) {
      console.warn('[ArticlesService] increment article view_count failed:', err);
    }
    const signed = await this.uploadService.signDetailMediaFields(
      data,
      ['cover_image', 'video_url'],
      ['content'],
    );
    return {
      ...signed,
      view_count: Number((data as any)?.view_count || 0) + 1,
    };
  }

  async create(data: any) {
    this.validateMedia(data, true);
    const payload = {
      ...data,
      cover_image: canonicalizeCloudStorageUrl(data.cover_image),
      video_url: data.video_url ? canonicalizeCloudStorageUrl(data.video_url) : null,
    };
    const { data: article, error } = await this.client()
      .from('articles')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return this.uploadService.signRowFields(article, ['cover_image', 'video_url']);
  }

  async update(id: string, data: any) {
    this.validateMedia(data, false);
    const payload = { ...data, updated_at: new Date() };
    if (data.cover_image !== undefined) {
      payload.cover_image = canonicalizeCloudStorageUrl(data.cover_image);
    }
    if (data.video_url !== undefined) {
      payload.video_url = data.video_url ? canonicalizeCloudStorageUrl(data.video_url) : null;
    }
    const { data: article, error } = await this.client()
      .from('articles')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.uploadService.signRowFields(article, ['cover_image', 'video_url']);
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
