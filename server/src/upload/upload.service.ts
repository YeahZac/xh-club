import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as COS from 'cos-nodejs-sdk-v5';
import {
  canonicalizeCloudStorageUrl,
  extractCosObjectInfo,
  normalizeMediaUrl,
} from '@/utils/media-url';

const DEFAULT_SIGNED_URL_EXPIRES = 7200;

type MediaLibraryType = 'image' | 'video' | 'document' | 'all';

const LIBRARY_PREFIXES: Record<MediaLibraryType, string[]> = {
  image: ['images/', 'member/', 'avatars/', 'uploads/'],
  video: ['videos/'],
  document: ['documents/', 'uploads/'],
  all: ['images/', 'videos/', 'documents/', 'member/', 'avatars/', 'uploads/'],
};

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'm4v']);
const DOCUMENT_EXTS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'zip', 'rar', '7z',
]);

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private cos: COS | null = null;
  private bucket: string = '';
  private region: string = 'ap-shanghai';
  private credentialsExpireAt: number = 0;
  private usingPermanentKeys = false;
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

  private getExtension(fileName: string, mimeType?: string): string {
    const fromName = fileName.match(/\.([a-zA-Z0-9]{1,10})$/)?.[1]?.toLowerCase();
    if (fromName) return fromName;
    if (mimeType?.startsWith('image/')) return mimeType.split('/')[1] || 'jpg';
    if (mimeType?.startsWith('video/')) {
      if (mimeType.includes('quicktime')) return 'mov';
      return mimeType.split('/')[1] || 'mp4';
    }
    return 'bin';
  }

  private matchLibraryType(key: string, type: MediaLibraryType): boolean {
    const ext = key.split('.').pop()?.toLowerCase() || '';
    if (type === 'all') {
      return IMAGE_EXTS.has(ext) || VIDEO_EXTS.has(ext) || DOCUMENT_EXTS.has(ext);
    }
    if (type === 'image') return IMAGE_EXTS.has(ext);
    if (type === 'video') return VIDEO_EXTS.has(ext);
    return DOCUMENT_EXTS.has(ext) || (!IMAGE_EXTS.has(ext) && !VIDEO_EXTS.has(ext));
  }

  private buildCanonicalUrl(key: string, bucket?: string, region?: string): string {
    const b = bucket || this.bucket;
    const r = region || this.region;
    return `https://${b}.cos.${r}.myqcloud.com/${key}`;
  }

  private async readFileBuffer(file: Express.Multer.File): Promise<Buffer> {
    if (file.buffer) return file.buffer;
    if (file.path) return fs.promises.readFile(file.path);
    throw new Error('无法获取文件内容');
  }

  private async objectExists(key: string): Promise<boolean> {
    if (!this.cos || !this.bucket) return false;
    return new Promise((resolve) => {
      this.cos!.headObject(
        {
          Bucket: this.bucket,
          Region: this.region,
          Key: key,
        },
        (err) => resolve(!err),
      );
    });
  }

  private async listBucketPage(prefix: string, marker = '', maxKeys = 100): Promise<{
    contents: Array<{ Key?: string; Size?: string | number; LastModified?: string; ETag?: string }>;
    nextMarker: string;
    isTruncated: boolean;
  }> {
    if (!this.cos || !this.bucket) {
      throw new Error('云存储未初始化');
    }
    return new Promise((resolve, reject) => {
      this.cos!.getBucket(
        {
          Bucket: this.bucket,
          Region: this.region,
          Prefix: prefix,
          Marker: marker || undefined,
          MaxKeys: maxKeys,
        },
        (err, data) => {
          if (err) return reject(err);
          resolve({
            contents: (data?.Contents || []) as Array<{
              Key?: string;
              Size?: string | number;
              LastModified?: string;
              ETag?: string;
            }>,
            nextMarker: data?.NextMarker || data?.Contents?.at(-1)?.Key || '',
            isTruncated: Boolean(data?.IsTruncated),
          });
        },
      );
    });
  }

  /**
   * 获取临时密钥并初始化 COS SDK
   * 优先使用环境变量永久密钥；否则走微信云托管 getauth
   */
  private async ensureCOSInitialized(): Promise<void> {
    // 提前 30 分钟刷新临时密钥：签名 URL 的实际有效期受密钥剩余寿命限制，
    // 刷新过晚会导致刚签出的 URL 很快 403
    if (this.cos && this.credentialsExpireAt > Date.now() + 30 * 60 * 1000) {
      return;
    }

    // 密钥即将刷新：清空旧签名缓存，避免继续返回已失效的 STS URL
    this.signedUrlCache.clear();

    const secretId = process.env.COS_SECRET_ID || '';
    const secretKey = process.env.COS_SECRET_KEY || '';
    if (secretId && secretKey) {
      this.cos = new COS({
        SecretId: secretId,
        SecretKey: secretKey,
      });
      this.credentialsExpireAt = Date.now() + 24 * 60 * 60 * 1000;
      this.usingPermanentKeys = true;
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
    // STS 模式下签名时长不得超过密钥剩余寿命，否则微信侧会提前 403
    let effectiveExpires = Math.max(60, Math.floor(expires));
    if (!this.usingPermanentKeys && this.credentialsExpireAt > Date.now()) {
      const remainingSec = Math.floor((this.credentialsExpireAt - Date.now()) / 1000) - 60;
      if (remainingSec > 0) {
        effectiveExpires = Math.min(effectiveExpires, remainingSec);
      }
    }
    return await new Promise<string>((resolve, reject) => {
      this.cos!.getObjectUrl(
        {
          Bucket: bucket,
          Region: region,
          Key: key,
          Sign: true,
          Expires: effectiveExpires,
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
      // 临时密钥签出的 URL 在密钥过期后即失效（即使 q-sign-time 仍在有效期内），
      // 缓存有效期必须取「签名时长」与「密钥剩余寿命」的较小值
      const credentialCap = this.usingPermanentKeys
        ? Number.MAX_SAFE_INTEGER
        : this.credentialsExpireAt - 60_000;
      const expireAt = Math.min(Date.now() + expires * 1000, credentialCap);
      this.signedUrlCache.set(cacheKey, { url, expireAt });
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
   * 为富文本 HTML 内的 COS / cloud:// 媒体地址生成预签名 URL
   * （私有桶下未签名的 img/src 在小程序端会加载失败）
   */
  async signHtmlMedia(html: unknown, maxAge?: number): Promise<string> {
    if (typeof html !== 'string' || !html.trim()) {
      return typeof html === 'string' ? html : '';
    }

    const candidates = new Set<string>();
    const collect = (raw: string) => {
      const value = raw.trim();
      if (!value) return;
      if (
        value.startsWith('cloud://')
        || /(?:\.myqcloud\.com|\.tcb\.qcloud\.la)/i.test(value)
        || /^images\//i.test(value)
        || /^uploads\//i.test(value)
      ) {
        candidates.add(value);
      }
    };

    html.replace(/(?:src|href)=["']([^"']+)["']/gi, (_m, url: string) => {
      collect(url);
      return _m;
    });

    if (!candidates.size) return html;

    let next = html;
    for (const url of candidates) {
      const signed = await this.signMediaUrl(url, maxAge);
      if (signed && signed !== url) {
        next = next.split(url).join(signed);
      }
    }
    return next;
  }

  async signDetailMediaFields<T extends Record<string, any>>(
    row: T,
    imageFields: string[] = ['cover_image', 'video_url', 'image_url', 'photo_url', 'card_image_url', 'avatar_url'],
    htmlFields: string[] = ['content', 'description'],
    maxAge?: number,
  ): Promise<T> {
    if (!row) return row;
    let next = await this.signRowFields(row, imageFields, maxAge);
    const patched: Record<string, any> = { ...next };
    await Promise.all(
      htmlFields.map(async (field) => {
        if (patched[field]) {
          patched[field] = await this.signHtmlMedia(patched[field], maxAge);
        }
      }),
    );
    return patched as T;
  }

  /**
   * 列出 COS 中已有媒体，供管理台媒体库复用
   */
  async listMediaLibrary(params: {
    type?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }) {
    await this.ensureCOSInitialized();
    if (!this.cos || !this.bucket) {
      throw new Error('云存储未初始化，请确认服务部署在微信云托管环境中');
    }

    const type = (['image', 'video', 'document', 'all'].includes(String(params.type || ''))
      ? String(params.type)
      : 'image') as MediaLibraryType;
    const keyword = String(params.keyword || '').trim().toLowerCase();
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.max(1, Math.min(60, Number(params.pageSize) || 24));
    const prefixes = LIBRARY_PREFIXES[type];
    const seen = new Set<string>();
    const collected: Array<{
      key: string;
      size: number;
      lastModified: string;
    }> = [];

    for (const prefix of prefixes) {
      let marker = '';
      for (let round = 0; round < 4; round += 1) {
        const pageData = await this.listBucketPage(prefix, marker, 100);
        for (const item of pageData.contents) {
          const key = item.Key || '';
          if (!key || key.endsWith('/') || seen.has(key)) continue;
          if (!this.matchLibraryType(key, type)) continue;
          if (keyword && !key.toLowerCase().includes(keyword)) continue;
          seen.add(key);
          collected.push({
            key,
            size: Number(item.Size || 0),
            lastModified: item.LastModified || '',
          });
        }
        if (!pageData.isTruncated) break;
        marker = pageData.nextMarker;
        if (!marker) break;
      }
    }

    collected.sort((a, b) => {
      const ta = a.lastModified ? new Date(a.lastModified).getTime() : 0;
      const tb = b.lastModified ? new Date(b.lastModified).getTime() : 0;
      return tb - ta;
    });

    const total = collected.length;
    const start = (page - 1) * pageSize;
    const slice = collected.slice(start, start + pageSize);
    const list = await Promise.all(
      slice.map(async (item) => {
        const canonicalUrl = this.buildCanonicalUrl(item.key);
        const previewUrl = await this.signMediaUrl(canonicalUrl);
        const fileName = item.key.split('/').pop() || item.key;
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        let mediaType: MediaLibraryType = 'document';
        if (IMAGE_EXTS.has(ext)) mediaType = 'image';
        else if (VIDEO_EXTS.has(ext)) mediaType = 'video';
        return {
          key: item.key,
          fileName,
          size: item.size,
          lastModified: item.lastModified,
          mediaType,
          url: canonicalUrl,
          canonicalUrl,
          previewUrl: previewUrl || canonicalUrl,
        };
      }),
    );

    return {
      list,
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total,
    };
  }

  /**
   * 上传文件到微信云托管对象存储（相同内容哈希复用，避免重复占空间）
   */
  async uploadFile(file: Express.Multer.File, folder: string = 'uploads'): Promise<{
    fileId: string;
    url: string;
    canonicalUrl: string;
    fileName: string;
    size: number;
    mimeType: string;
    reused?: boolean;
  }> {
    await this.ensureCOSInitialized();

    if (!this.cos || !this.bucket) {
      throw new Error('云存储未初始化，请确认服务部署在微信云托管环境中');
    }

    try {
      const originalName = file.originalname || 'file';
      const extension = this.getExtension(originalName, file.mimetype);
      const body = await this.readFileBuffer(file);
      const hash = crypto.createHash('md5').update(body).digest('hex');
      const key = `${folder}/${hash}.${extension}`;
      const canonicalUrl = this.buildCanonicalUrl(key);
      const fileId = `cloud://${key}`;
      const exists = await this.objectExists(key);

      if (!exists) {
        await new Promise<void>((resolve, reject) => {
          this.cos!.putObject({
            Bucket: this.bucket,
            Region: this.region,
            Key: key,
            Body: body,
            ContentType: file.mimetype,
          }, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        this.logger.log(`文件上传成功: ${key}`);
      } else {
        this.logger.log(`文件内容已存在，复用: ${key}`);
      }

      const signedUrl = await this.signMediaUrl(canonicalUrl);

      return {
        fileId,
        url: signedUrl || canonicalUrl,
        canonicalUrl,
        fileName: originalName,
        size: file.size || body.length,
        mimeType: file.mimetype,
        reused: exists,
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
    canonicalUrl: string;
    fileName: string;
    size: number;
    mimeType: string;
    reused?: boolean;
  }> {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/octet-stream',
      '',
    ];
    if (file.mimetype && !allowedTypes.includes(file.mimetype) && !file.mimetype.startsWith('image/')) {
      throw new Error('只支持 JPG、PNG、GIF、WebP 格式的图片');
    }

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('图片大小不能超过 2MB');
    }

    return this.uploadFile(file, folder);
  }

  /**
   * 登记小程序 wx.cloud.uploadFile 产生的 cloud:// fileID，返回与 uploadImage 一致的结构
   */
  async registerCloudFile(fileID: string, filename?: string): Promise<{
    fileId: string;
    url: string;
    canonicalUrl: string;
    fileName: string;
    size: number;
    mimeType: string;
    reused?: boolean;
  }> {
    await this.ensureCOSInitialized();

    const info = extractCosObjectInfo(fileID);
    if (!info?.key) {
      throw new Error('无效的云文件 ID');
    }

    const bucket = info.bucket || this.bucket;
    const region = info.region || this.region;
    if (!this.cos || !bucket) {
      throw new Error('云存储未初始化');
    }

    const headOnce = () =>
      new Promise<boolean>((resolve) => {
        this.cos!.headObject(
          { Bucket: bucket, Region: region, Key: info.key },
          (err) => resolve(!err),
        );
      });

    let exists = await headOnce();
    if (!exists) {
      await new Promise((r) => setTimeout(r, 400));
      exists = await headOnce();
      if (!exists) {
        this.logger.warn(`云文件尚未在 COS 可见: ${fileID} -> ${info.key}`);
      }
    }

    const canonicalUrl = this.buildCanonicalUrl(info.key, bucket, region);
    const signedUrl = await this.signMediaUrl(fileID);
    const fileName = filename || info.key.split('/').pop() || 'file';
    const ext = this.getExtension(fileName);
    const mimeType = IMAGE_EXTS.has(ext)
      ? `image/${ext === 'jpg' ? 'jpeg' : ext}`
      : VIDEO_EXTS.has(ext)
        ? `video/${ext}`
        : 'application/octet-stream';

    return {
      fileId: fileID,
      url: signedUrl || canonicalUrl,
      canonicalUrl,
      fileName,
      size: 0,
      mimeType,
      reused: true,
    };
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
    canonicalUrl: string;
    fileName: string;
    size: number;
    mimeType: string;
    reused?: boolean;
  }> {
    return this.uploadImage(file, `avatars/${userId}`);
  }

  /**
   * 上传文档
   */
  async uploadDocument(file: Express.Multer.File, folder: string = 'documents'): Promise<{
    fileId: string;
    url: string;
    canonicalUrl: string;
    fileName: string;
    size: number;
    mimeType: string;
    reused?: boolean;
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
