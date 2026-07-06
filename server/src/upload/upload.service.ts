import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../storage/database/supabase-client';
import * as path from 'path';

@Injectable()
export class UploadService {
  private readonly bucket = 'uploads';
  private client() { return getSupabaseClient() }

  async uploadFile(file: Express.Multer.File, folder: string = 'general'): Promise<any> {
    try {
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const filename = `${folder}/${timestamp}-${Math.random().toString(36).substring(7)}${ext}`;

      const fileData = file.buffer || (file as any).path;
      const { data, error } = await this.client().storage
        .from(this.bucket)
        .upload(filename, fileData, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) throw new Error(`Upload failed: ${error.message}`);

      const { data: urlData } = this.client().storage
        .from(this.bucket)
        .getPublicUrl(data.path);

      return {
        url: urlData.publicUrl,
        path: data.path,
        filename: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      };
    } catch (error) {
      throw new Error(`File upload error: ${error.message}`);
    }
  }

  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const { error } = await this.client().storage
        .from(this.bucket)
        .remove([filePath]);

      if (error) throw new Error(`Delete failed: ${error.message}`);
      return true;
    } catch (error) {
      throw new Error(`File delete error: ${error.message}`);
    }
  }

  async listFiles(folder: string = 'general'): Promise<any[]> {
    try {
      const { data, error } = await this.client().storage
        .from(this.bucket)
        .list(folder, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) {
        throw new Error(`List failed: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      throw new Error(`File list error: ${error.message}`);
    }
  }
}
