import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Readable } from 'stream';

// 微信云托管官方 SDK
import cloudbase from '@cloudbase/node-sdk';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private app: any = null;

  constructor() {
    this.initCloudBase();
  }

  /**
   * 初始化微信云托管
   * 在微信云托管环境中，SDK 会自动检测环境，无需手动传入 env
   */
  private initCloudBase() {
    try {
      // 微信云托管环境中，可以使用 'default' 或让 SDK 自动检测
      const envId = process.env.TCB_ENV_ID || process.env.ENV_ID || 'default';

      this.app = cloudbase.init({
        env: envId,
      });
      
      this.logger.log(`微信云托管初始化成功，环境ID: ${envId}`);
    } catch (error) {
      this.logger.error('微信云托管初始化失败:', error);
      // 尝试不带参数初始化（自动检测环境）
      try {
        this.app = cloudbase.init({});
        this.logger.log('微信云托管自动检测环境初始化成功');
      } catch (e2) {
        this.logger.error('微信云托管自动检测也失败:', e2);
      }
    }
  }

  /**
   * 上传文件到微信云存储
   * @param file 文件对象（来自 multer）
   * @param folder 存储文件夹
   * @returns 文件信息
   */
  async uploadFile(file: Express.Multer.File, folder: string = 'uploads'): Promise<{
    fileId: string;
    url: string;
    fileName: string;
    size: number;
    mimeType: string;
  }> {
    if (!this.app) {
      throw new Error('微信云托管未初始化，请配置 TCB_ENV_ID 环境变量');
    }

    try {
      // 生成唯一的云存储路径
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const originalName = file.originalname || 'file';
      const cloudPath = `${folder}/${timestamp}_${randomStr}_${originalName}`;

      // 获取文件内容
      let fileContent: Buffer | Readable;
      
      if (file.buffer) {
        // H5 环境：使用 buffer
        fileContent = file.buffer;
      } else if (file.path) {
        // 小程序环境：读取文件
        fileContent = fs.readFileSync(file.path);
      } else {
        throw new Error('无法获取文件内容');
      }

      // 上传到云存储
      const result = await this.app.uploadFile({
        cloudPath,
        fileContent,
      });

      this.logger.log(`文件上传成功: ${cloudPath}, fileID: ${result.fileID}`);

      // 获取文件的临时链接（有效期7天）
      const fileUrl = await this.getFileUrl(result.fileID);

      return {
        fileId: result.fileID,
        url: fileUrl,
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
   * 获取文件的访问 URL
   * @param fileId 文件 ID
   * @param maxAge 链接有效期（秒），默认 7 天
   * @returns 文件访问 URL
   */
  async getFileUrl(fileId: string, maxAge: number = 604800): Promise<string> {
    if (!this.app) {
      throw new Error('微信云托管未初始化');
    }

    try {
      const result = await this.app.getTempFileURL({
        fileList: [fileId],
        maxAge,
      });

      if (result.fileList && result.fileList.length > 0) {
        return result.fileList[0].tempFileURL;
      }

      throw new Error('获取文件 URL 失败');
    } catch (error) {
      this.logger.error('获取文件 URL 失败:', error);
      throw new Error(`获取文件 URL 失败: ${error.message}`);
    }
  }

  /**
   * 批量获取文件 URL
   * @param fileIds 文件 ID 列表
   * @param maxAge 链接有效期（秒）
   * @returns 文件 URL 列表
   */
  async getFileUrls(fileIds: string[], maxAge: number = 604800): Promise<Record<string, string>> {
    if (!this.app) {
      throw new Error('微信云托管未初始化');
    }

    try {
      const result = await this.app.getTempFileURL({
        fileList: fileIds,
        maxAge,
      });

      const urlMap: Record<string, string> = {};
      if (result.fileList) {
        for (const file of result.fileList) {
          urlMap[file.fileID] = file.tempFileURL;
        }
      }

      return urlMap;
    } catch (error) {
      this.logger.error('批量获取文件 URL 失败:', error);
      throw new Error(`批量获取文件 URL 失败: ${error.message}`);
    }
  }

  /**
   * 删除云存储中的文件
   * @param fileIdList 文件 ID 列表
   * @returns 删除结果
   */
  async deleteFiles(fileIdList: string[]): Promise<{ success: boolean; message: string }> {
    if (!this.app) {
      throw new Error('微信云托管未初始化');
    }

    try {
      const result = await this.app.deleteFile({
        fileList: fileIdList,
      });

      this.logger.log(`文件删除成功: ${fileIdList.join(', ')}`);

      return {
        success: true,
        message: `成功删除 ${result.fileList?.length || 0} 个文件`,
      };
    } catch (error) {
      this.logger.error('文件删除失败:', error);
      throw new Error(`文件删除失败: ${error.message}`);
    }
  }

  /**
   * 上传图片（带压缩）
   * @param file 文件对象
   * @param folder 存储文件夹
   * @returns 文件信息
   */
  async uploadImage(file: Express.Multer.File, folder: string = 'images'): Promise<{
    fileId: string;
    url: string;
    fileName: string;
    size: number;
    mimeType: string;
  }> {
    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error('只支持 JPG、PNG、GIF、WebP 格式的图片');
    }

    // 验证文件大小（最大 10MB）
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('图片大小不能超过 10MB');
    }

    return this.uploadFile(file, folder);
  }

  /**
   * 上传头像
   * @param file 文件对象
   * @param userId 用户 ID
   * @returns 文件信息
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
   * @param file 文件对象
   * @param folder 存储文件夹
   * @returns 文件信息
   */
  async uploadDocument(file: Express.Multer.File, folder: string = 'documents'): Promise<{
    fileId: string;
    url: string;
    fileName: string;
    size: number;
    mimeType: string;
  }> {
    // 验证文件大小（最大 50MB）
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
    return this.app !== null;
  }

  /**
   * 获取环境信息
   */
  getEnvInfo(): { envId: string; available: boolean } {
    const envId = process.env.TCB_ENV_ID || process.env.ENV_ID || '';
    return {
      envId,
      available: this.isAvailable(),
    };
  }
}
