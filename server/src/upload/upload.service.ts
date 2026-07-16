import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as COS from 'cos-nodejs-sdk-v5';
import {
  canonicalizeCloudStorageUrl,
  extractCosObjectInfo,
  normalizeMediaUrl,
} from '@/utils/media-url';

const DEFAULT_SIGNED_URL_EXPIRES = 7200;

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private cos: COS | null = null;
  private bucket: string = '';
  private region: string = 'ap-shanghai';
  private credentialsExpireAt: number = 0;
  private readonly signedUrlCache = new Map<string, { url: string; expireAt: number }>();

  constructor() {
    // 从环境变量获取存储桶和地域配置（可选，也可从控制台获取）
    this.bucket = process.env.COS_BUCKET || '';
    this.region = process.env.COS_REGION || 'ap-shanghai';
  }

  private getSignedUrlExpires(): number {
    const raw = Number(process.env.COS_SIGNED_URL_EXPIRES || DEFAULT_SIGNED_URL_EXPIRES);
    if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_SIGNED_URL_EXPIRES;
    return Math.floor(raw);
  }

  /**
   * 获取临时密钥并初始化 COS SDK
   * 优先使用环境变量永久密钥；否则走微信云托管 getauth
   */
  private async ensureCOSInitialized(): Promise<void> {
    // 如果凭证还没过期（提前5分钟刷新），直接返回
    if (this.cos && this.credentialsExpireAt > Date.now() + 300000) {
      return;
    }

    const secretId = process.env.COS_SECRET_ID || '';
    const secretKey = process.env.COS_SECRET_KEY || '';
    if (secretId && secretKey) {
      this.cos = new COS({
        SecretId: secretId,
        SecretKey: secretKey,
      });
      this.credentialsExpireAt = Date.now() + 24 * 60 * 60 * 1000;
      this.logger.log(`COS SDK 使用环境变量密钥初始化，Bucket: ${this.bucket || '(未配置)'}, Region: ${this.region}`);
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

      // 处理多种可能的响应格式
      // 格式1: 嵌套格式 { credentials: { tmpSecretId, tmpSecretKey, sessionToken }, expiredTime, bucket, region }
      // 格式2: STS格式 { TmpSecretId, TmpSecretKey, Token, ExpiredTime, Bucket, Region }
      // 格式3: 小写格式 { tmpSecretId, tmpSecretKey, securityToken, expiredTime, bucket, region }
      let TmpSecretId: string;
      let TmpSecretKey: string;
      let SecurityToken: string;
      let Bucket: string;
      let Region: string;
      let ExpiredTime: number;

      if (data.credentials) {
        // 嵌套格式
        TmpSecretId = data.credentials.tmpSecretId || data.credentials.TmpSecretId;
        TmpSecretKey = data.credentials.tmpSecretKey || data.credentials.TmpSecretKey;
        SecurityToken = data.credentials.sessionToken || data.credentials.SecurityToken || data.credentials.token;
        Bucket = data.bucket || data.Bucket;
        Region = data.region || data.Region;
        ExpiredTime = data.expiredTime || data.ExpiredTime;
      } else if (data.TmpSecretId || data.tmpSecretId) {
        // STS格式或小写格式
        TmpSecretId = data.TmpSecretId || data.tmpSecretId;
        TmpSecretKey = data.TmpSecretKey || data.tmpSecretKey;
        SecurityToken = data.Token || data.SecurityToken || data.sessionToken || data.securityToken;
        Bucket = data.Bucket || data.bucket;
        Region = data.Region || data.region;
        ExpiredTime = data.ExpiredTime || data.expiredTime;
      } else {
        throw new Error(`无法解析临时密钥响应格式，请检查日志中的完整响应`);
      }

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
      throw new Error(`云存储初始化失败: ${error.message}。请确认服务部署在微信云托管环境中，或配置 COS_SECRET_ID/COS_SECRET_KEY。`);
    }
  }

  private async createSignedUrl(key: string, bucket: string, region: string, expires: number): Promise<string> {
    await this.ensureCOSInitialized();
    if (!this.cos) {
      throw new Error('云存储未初始化');
    }
    return await new Promise<string>((resolve, reject) => {
      this.cos!.getObjectUrl(
        {
          Bucket: bucket,
          Region: region,
          Key: key,
          Sign: true,
          Expires: expires,
        },
        (err, data) => {
          if (err) reject(err);
          else resolve(data.Url);
        },
      );
    });
  }

  /**
   * 为私有桶对象生成带时效的预签名访问链接
   */
  async signMediaUrl(input: unknown, maxAge?: number): Promise<string> {
    if (typeof input !== 'string' || !input.trim()) {
      return '';
    }

    const canonical = canonicalizeCloudStorageUrl(input) || normalizeMediaUrl(input);
    const info = extractCosObjectInfo(canonical) || extractCosObjectInfo(input);
    if (!info) {
      return canonical || input.trim();
    }

    const expires = maxAge && maxAge > 0 ? Math.floor(maxAge) : this.getSignedUrlExpires();
    const bucket = info.bucket || this.bucket;
    const region = info.region || this.region;
    if (!bucket) {
      return canonical;
    }

    const cacheKey = `${bucket}:${region}:${info.key}:${expires}`;
    const cached = this.signedUrlCache.get(cacheKey);
    if (cached && cached.expireAt > Date.now() + 60_000) {
      return cached.url;
    }

    try {
      const url = await this.createSignedUrl(info.key, bucket, region, expires);
      this.signedUrlCache.set(cacheKey, {
        url,
        expireAt: Date.now() + expires * 1000,
      });
      return url;
    } catch (error) {
      this.logger.warn(`生成预签名 URL 失败，回退原始地址: ${error.message}`);
      return canonical;
    }
  }

  async signMediaUrls(inputs: unknown[], maxAge?: number): Promise<string[]> {
    return Promise.all(inputs.map((item) => this.signMediaUrl(item, maxAge)));
  }

  async signRowFields<T extends Record<string, any>>(
    row: T,
    fields: string[],
    maxAge?: number,
  ): Promise<T> {
    if (!row) return row;
    const next: Record<string, any> = { ...row };
    await Promise.all(
      fields.map(async (field) => {
        if (next[field] !== undefined && next[field] !== null && next[field] !== '') {
          next[field] = await this.signMediaUrl(next[field], maxAge);
        }
      }),
    );
    return next as T;
  }

  async signRowsFields<T extends Record<string, any>>(
    rows: T[],
    fields: string[],
    maxAge?: number,
  ): Promise<T[]> {
    return Promise.all(rows.map((row) => this.signRowFields(row, fields, maxAge)));
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
      const extension = originalName.match(/\.([a-zA-Z0-9]{1,10})$/)?.[1]?.toLowerCase() || 'bin';
      const key = `${folder}/${timestamp}_${randomStr}.${extension}`;

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

      // 返回规范对象地址 + 预签名可访问地址
      const canonicalUrl = `https://${this.bucket}.cos.${this.region}.myqcloud.com/${key}`;
      const fileId = `cloud://${key}`;
      const signedUrl = await this.signMediaUrl(canonicalUrl);

      this.logger.log(`文件上传成功: ${key}`);

      return {
        fileId,
        url: signedUrl || canonicalUrl,
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
   * 获取文件的访问 URL（私有桶返回预签名链接）
   */
  async getFileUrl(fileId: string, maxAge?: number): Promise<string> {
    return this.signMediaUrl(fileId, maxAge);
  }

  /**
   * 批量获取文件 URL
   */
  async getFileUrls(fileIds: string[]): Promise<Record<string, string>> {
    const urlMap: Record<string, string> = {};
    await Promise.all(
      fileIds.map(async (fileId) => {
        urlMap[fileId] = await this.getFileUrl(fileId);
      }),
    );
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
        const info = extractCosObjectInfo(fileId);
        let key = info?.key || fileId;
        if (!info) {
          if (fileId.startsWith('cloud://')) {
            key = fileId.replace('cloud://', '');
          } else if (fileId.startsWith('http')) {
            const urlObj = new URL(fileId);
            key = decodeURIComponent(urlObj.pathname.substring(1));
          }
        }

        await new Promise<void>((resolve, reject) => {
          this.cos!.deleteObject({
            Bucket: info?.bucket || this.bucket,
            Region: info?.region || this.region,
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

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('图片大小不能超过 2MB');
    }

    return this.uploadFile(file, folder);
  }

  /** 上传内容视频 */
  async uploadVideo(file: Express.Multer.File, folder: string = 'videos') {
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error('只支持 MP4、WebM、MOV 格式的视频');
    }
    const maxSize = 200 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('视频大小不能超过 200MB');
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
    return this.bucket !== '' || !!(process.env.COS_SECRET_ID && process.env.COS_SECRET_KEY);
  }

  /**
   * 获取环境信息
   */
  getEnvInfo(): { bucket: string; region: string; available: boolean; signedUrlExpires: number } {
    return {
      bucket: this.bucket,
      region: this.region,
      available: this.isAvailable(),
      signedUrlExpires: this.getSignedUrlExpires(),
    };
  }
}
