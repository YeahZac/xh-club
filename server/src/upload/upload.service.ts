import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as COS from 'cos-nodejs-sdk-v5';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private cos: COS | null = null;
  private bucket: string = '';
  private region: string = 'ap-shanghai';
  private credentialsExpireAt: number = 0;

  constructor() {
    // 从环境变量获取存储桶和地域配置（可选，也可从控制台获取）
    this.bucket = process.env.COS_BUCKET || '';
    this.region = process.env.COS_REGION || 'ap-shanghai';
  }

  /**
   * 获取临时密钥并初始化 COS SDK
   * 微信云托管容器内可通过 http://api.weixin.qq.com/_/cos/getauth 获取临时密钥
   */
  private async ensureCOSInitialized(): Promise<void> {
    // 如果凭证还没过期（提前5分钟刷新），直接返回
    if (this.cos && this.credentialsExpireAt > Date.now() + 300000) {
      return;
    }

    try {
      // 从微信云托管容器内部接口获取临时密钥
      const response = await fetch('http://api.weixin.qq.com/_/cos/getauth', {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`获取临时密钥失败: HTTP ${response.status}`);
      }

      const data = await response.json() as any;
      
      if (data.errcode) {
        throw new Error(`获取临时密钥失败: ${data.errmsg}`);
      }

      const {
        TmpSecretId,
        TmpSecretKey,
        SecurityToken,
        Bucket,
        Region,
        ExpiredTime,
      } = data;

      // 如果环境变量没有配置 bucket，使用接口返回的
      if (!this.bucket && Bucket) {
        this.bucket = Bucket;
      }
      if (Region) {
        this.region = Region;
      }

      this.credentialsExpireAt = (ExpiredTime || Math.floor(Date.now() / 1000) + 43200) * 1000;

      // 初始化 COS SDK
      this.cos = new COS({
        SecretId: TmpSecretId,
        SecretKey: TmpSecretKey,
        SecurityToken: SecurityToken,
      });

      this.logger.log(`COS SDK 初始化成功，Bucket: ${this.bucket}, Region: ${this.region}`);
    } catch (error) {
      this.logger.error('COS SDK 初始化失败:', error);
      throw new Error(`云存储初始化失败: ${error.message}。请确认服务部署在微信云托管环境中。`);
    }
  }

  /**
   * 上传文件到微信云托管对象存储
   */
  async uploadFile(file: Express.Multer.File, folder: string = 'uploads'): Promise<{
    fileId: string;
    url: string;
    fileName: string;
    size: number;
    mimeType: string;
  }> {
    await this.ensureCOSInitialized();

    if (!this.cos || !this.bucket) {
      throw new Error('云存储未初始化，请确认服务部署在微信云托管环境中');
    }

    try {
      // 生成唯一的存储路径
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const originalName = file.originalname || 'file';
      const key = `${folder}/${timestamp}_${randomStr}_${originalName}`;

      // 获取文件内容
      let body: Buffer | fs.ReadStream;
      if (file.buffer) {
        body = file.buffer;
      } else if (file.path) {
        body = fs.createReadStream(file.path);
      } else {
        throw new Error('无法获取文件内容');
      }

      // 上传到 COS
      await new Promise<void>((resolve, reject) => {
        this.cos!.putObject({
          Bucket: this.bucket,
          Region: this.region,
          Key: key,
          Body: body,
        }, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // 构造文件 URL
      const url = `https://${this.bucket}.cos.${this.region}.myqcloud.com/${key}`;
      const fileId = `cloud://${key}`;

      this.logger.log(`文件上传成功: ${key}`);

      return {
        fileId,
        url,
        fileName: originalName,
        size: file.size,
        mimeType: file.mimetype,
      };
    } catch (error) {
      this.logger.error('文件上传失败:', error);
      throw new Error(`文件上传失败: ${error.message}`);
    }
  }

  /**
   * 获取文件的访问 URL（COS 文件直接通过 URL 访问）
   */
  async getFileUrl(fileId: string, _maxAge?: number): Promise<string> {
    // 如果是 cloud:// 格式，转换为 COS URL
    if (fileId.startsWith('cloud://')) {
      const key = fileId.replace('cloud://', '');
      return `https://${this.bucket}.cos.${this.region}.myqcloud.com/${key}`;
    }
    // 如果已经是完整 URL，直接返回
    if (fileId.startsWith('http')) {
      return fileId;
    }
    // 否则当作 key 处理
    return `https://${this.bucket}.cos.${this.region}.myqcloud.com/${fileId}`;
  }

  /**
   * 批量获取文件 URL
   */
  async getFileUrls(fileIds: string[]): Promise<Record<string, string>> {
    const urlMap: Record<string, string> = {};
    for (const fileId of fileIds) {
      urlMap[fileId] = await this.getFileUrl(fileId);
    }
    return urlMap;
  }

  /**
   * 删除云存储中的文件
   */
  async deleteFiles(fileIds: string[]): Promise<{ success: boolean; message: string }> {
    await this.ensureCOSInitialized();

    if (!this.cos || !this.bucket) {
      throw new Error('云存储未初始化');
    }

    let deletedCount = 0;
    for (const fileId of fileIds) {
      try {
        let key = fileId;
        if (fileId.startsWith('cloud://')) {
          key = fileId.replace('cloud://', '');
        } else if (fileId.startsWith('http')) {
          // 从 URL 中提取 key
          const urlObj = new URL(fileId);
          key = urlObj.pathname.substring(1);
        }

        await new Promise<void>((resolve, reject) => {
          this.cos!.deleteObject({
            Bucket: this.bucket,
            Region: this.region,
            Key: key,
          }, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        deletedCount++;
      } catch (error) {
        this.logger.warn(`删除文件失败: ${fileId}`, error);
      }
    }

    return {
      success: true,
      message: `成功删除 ${deletedCount}/${fileIds.length} 个文件`,
    };
  }

  /**
   * 上传图片
   */
  async uploadImage(file: Express.Multer.File, folder: string = 'images'): Promise<{
    fileId: string;
    url: string;
    fileName: string;
    size: number;
    mimeType: string;
  }> {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error('只支持 JPG、PNG、GIF、WebP 格式的图片');
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('图片大小不能超过 10MB');
    }

    return this.uploadFile(file, folder);
  }

  /**
   * 上传头像
   */
  async uploadAvatar(file: Express.Multer.File, userId: string): Promise<{
    fileId: string;
    url: string;
    fileName: string;
    size: number;
    mimeType: string;
  }> {
    return this.uploadImage(file, `avatars/${userId}`);
  }

  /**
   * 上传文档
   */
  async uploadDocument(file: Express.Multer.File, folder: string = 'documents'): Promise<{
    fileId: string;
    url: string;
    fileName: string;
    size: number;
    mimeType: string;
  }> {
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('文档大小不能超过 50MB');
    }

    return this.uploadFile(file, folder);
  }

  /**
   * 检查云存储是否可用
   */
  isAvailable(): boolean {
    return this.cos !== null && this.bucket !== '';
  }

  /**
   * 获取环境信息
   */
  getEnvInfo(): { bucket: string; region: string; available: boolean } {
    return {
      bucket: this.bucket,
      region: this.region,
      available: this.isAvailable(),
    };
  }
}
