// @ts-nocheck
import { Injectable, Logger } from '@nestjs/common';
import * as OSS from 'ali-oss';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

/**
 * 阿里云 OSS 存储服务
 * 用于处理图片、视频等文件的上传和管理
 */
@Injectable()
export class OssService {
  private readonly logger = new Logger(OssService.name);
  private client: OSS;
  private bucket: string;
  private region: string;

  constructor(private configService: ConfigService) {
    this.region = this.configService.get<string>('ALIYUN_OSS_REGION', 'oss-cn-shenzhen');
    this.bucket = this.configService.get<string>('ALIYUN_OSS_BUCKET', '');
    
    const accessKeyId = this.configService.get<string>('ALIYUN_OSS_ACCESS_KEY_ID', '');
    const accessKeySecret = this.configService.get<string>('ALIYUN_OSS_ACCESS_KEY_SECRET', '');
    
    if (accessKeyId && accessKeySecret && this.bucket) {
      this.client = new OSS({
        region: this.region,
        accessKeyId,
        accessKeySecret,
        bucket: this.bucket,
        // 可选：使用内网 endpoint 节省流量费用
        // internal: true,
      });
      this.logger.log(`OSS 客户端初始化成功: ${this.bucket}.${this.region}.aliyuncs.com`);
    } else {
      this.logger.warn('OSS 配置不完整，文件上传功能将不可用');
    }
  }

  /**
   * 上传文件到 OSS
   * @param file Buffer 或 Stream
   * @param filename 文件名（含路径）
   * @param mimeType MIME 类型
   * @returns 文件访问 URL
   */
  async uploadFile(
    file: Buffer | Readable,
    filename: string,
    mimeType?: string,
  ): Promise<string> {
    if (!this.client) {
      throw new Error('OSS 客户端未初始化');
    }

    try {
      const result = await this.client.put(filename, file, {
        mime: mimeType,
        headers: {
          'x-oss-object-acl': 'public-read',
        },
      });

      this.logger.log(`文件上传成功: ${filename}`);
      return result.url;
    } catch (error) {
      this.logger.error(`文件上传失败: ${filename}`, error);
      throw error;
    }
  }

  /**
   * 上传 Base64 图片
   * @param base64Data Base64 编码的图片数据
   * @param filename 文件名
   * @returns 文件访问 URL
   */
  async uploadBase64Image(base64Data: string, filename: string): Promise<string> {
    const buffer = Buffer.from(base64Data, 'base64');
    return this.uploadFile(buffer, filename, 'image/png');
  }

  /**
   * 删除文件
   * @param filename 文件名
   */
  async deleteFile(filename: string): Promise<void> {
    if (!this.client) {
      throw new Error('OSS 客户端未初始化');
    }

    try {
      await this.client.delete(filename);
      this.logger.log(`文件删除成功: ${filename}`);
    } catch (error) {
      this.logger.error(`文件删除失败: ${filename}`, error);
      throw error;
    }
  }

  /**
   * 获取文件签名 URL（用于私有文件临时访问）
   * @param filename 文件名
   * @param expires 过期时间（秒）
   * @returns 签名 URL
   */
  getSignedUrl(filename: string, expires = 3600): string {
    if (!this.client) {
      throw new Error('OSS 客户端未初始化');
    }

    return this.client.signatureUrl(filename, {
      expires,
    });
  }

  /**
   * 生成唯一文件名
   * @param originalName 原始文件名
   * @param prefix 路径前缀
   * @returns 唯一文件名
   */
  generateUniqueFilename(originalName: string, prefix = 'uploads'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = originalName.split('.').pop() || 'jpg';
    return `${prefix}/${timestamp}_${random}.${ext}`;
  }

  /**
   * 检查 OSS 是否可用
   */
  isAvailable(): boolean {
    return !!this.client;
  }

  /**
   * 获取 Bucket 信息
   */
  getBucketInfo() {
    return {
      bucket: this.bucket,
      region: this.region,
      available: this.isAvailable(),
    };
  }
}
