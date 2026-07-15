import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { S3Storage } from 'coze-coding-dev-sdk';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly storage: S3Storage;

  constructor() {
    // 初始化 S3Storage，使用微信云托管对象存储
    this.storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL || '',
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME || '7072-prod-d6g34e4cna470ab7e-1451142205',
      region: process.env.COZE_BUCKET_REGION || 'ap-shanghai',
    });
    this.logger.log(`S3Storage initialized with bucket: ${process.env.COZE_BUCKET_NAME || '7072-prod-d6g34e4cna470ab7e-1451142205'}, region: ap-shanghai`);
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'general'): Promise<any> {
    try {
      const ext = path.extname(file.originalname);
      const filename = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
      
      // 使用 S3Storage 上传文件到微信云托管对象存储
      const fileContent = file.buffer || Buffer.from('');
      const actualKey = await this.storage.uploadFile({
        fileContent,
        fileName: filename,
        contentType: file.mimetype,
      });

      this.logger.log(`File uploaded successfully: ${actualKey}`);

      // 生成签名 URL（有效期 30 天）
      const signedUrl = await this.storage.generatePresignedUrl({
        key: actualKey,
        expireTime: 2592000, // 30 天
      });

      return {
        url: signedUrl,
        key: actualKey,
        filename: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      };
    } catch (error) {
      this.logger.error(`File upload error: ${(error as Error).message}`, (error as Error).stack);
      throw new Error(`File upload error: ${(error as Error).message}`);
    }
  }

  async deleteFile(fileKey: string): Promise<boolean> {
    try {
      const ok = await this.storage.deleteFile({ fileKey });
      this.logger.log(`File deleted: ${fileKey}, success: ${ok}`);
      return ok;
    } catch (error) {
      this.logger.error(`File delete error: ${(error as Error).message}`);
      throw new Error(`File delete error: ${(error as Error).message}`);
    }
  }

  async listFiles(folder: string = 'general'): Promise<any[]> {
    try {
      const result = await this.storage.listFiles({ prefix: folder, maxKeys: 100 });
      return result.keys.map((key: string) => ({
        key,
        path: key,
      }));
    } catch (error) {
      this.logger.error(`File list error: ${(error as Error).message}`);
      throw new Error(`File list error: ${(error as Error).message}`);
    }
  }

  async getFileUrl(fileKey: string, expireTime: number = 86400): Promise<string> {
    try {
      return await this.storage.generatePresignedUrl({
        key: fileKey,
        expireTime,
      });
    } catch (error) {
      this.logger.error(`Generate presigned URL error: ${(error as Error).message}`);
      throw new Error(`Generate presigned URL error: ${(error as Error).message}`);
    }
  }
}
