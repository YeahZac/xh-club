import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Logger,
  Get,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { OssService } from '../storage/oss.service';

/**
 * 文件上传控制器
 * 支持图片、视频等文件的上传
 */
@Controller('upload')
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly ossService: OssService) {}

  /**
   * 上传单个文件
   * 支持图片(jpg/png/gif/webp)和视频(mp4/mov/avi)
   * 最大文件大小: 100MB
   */
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
      },
      fileFilter: (req, file, cb) => {
        // 允许的文件类型
        const allowedMimeTypes = [
          // 图片
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/svg+xml',
          // 视频
          'video/mp4',
          'video/quicktime',
          'video/x-msvideo',
          'video/webm',
          // 文档
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];

        if (allowedMimeTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException(`不支持的文件类型: ${file.mimetype}`), false);
        }
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('请选择要上传的文件');
    }

    this.logger.log(`收到文件上传请求: ${file.originalname}, 大小: ${file.size} bytes`);

    // 检查 OSS 是否可用
    if (!this.ossService.isAvailable()) {
      // 如果 OSS 不可用，返回本地存储的 URL（仅开发环境）
      this.logger.warn('OSS 不可用，使用本地存储模式');
      return {
        code: 200,
        msg: '上传成功（本地模式）',
        data: {
          url: `/uploads/${file.originalname}`,
          filename: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
        },
      };
    }

    // 生成唯一文件名
    const filename = this.ossService.generateUniqueFilename(file.originalname);

    try {
      // 上传到 OSS
      const url = await this.ossService.uploadFile(
        file.buffer,
        filename,
        file.mimetype,
      );

      this.logger.log(`文件上传成功: ${url}`);

      return {
        code: 200,
        msg: '上传成功',
        data: {
          url,
          filename,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
        },
      };
    } catch (error) {
      this.logger.error('文件上传失败', error);
      throw new BadRequestException('文件上传失败，请稍后重试');
    }
  }

  /**
   * 批量上传文件（最多9个）
   */
  @Post('batch')
  @UseInterceptors(
    FileInterceptor('files', {
      storage: memoryStorage(),
      limits: {
        fileSize: 100 * 1024 * 1024,
        files: 9,
      },
    }),
  )
  async uploadMultipleFiles(@UploadedFile() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('请选择要上传的文件');
    }

    this.logger.log(`批量上传请求: ${files.length} 个文件`);

    const results = [];

    for (const file of files) {
      const filename = this.ossService.generateUniqueFilename(file.originalname);

      try {
        const url = await this.ossService.uploadFile(
          file.buffer,
          filename,
          file.mimetype,
        );

        results.push({
          url,
          filename,
          originalName: file.originalname,
          size: file.size,
        });
      } catch (error) {
        this.logger.error(`文件上传失败: ${file.originalname}`, error);
      }
    }

    return {
      code: 200,
      msg: '批量上传完成',
      data: {
        files: results,
        total: results.length,
      },
    };
  }

  /**
   * 获取存储信息
   */
  @Get('info')
  getStorageInfo() {
    return {
      code: 200,
      msg: 'success',
      data: {
        ...this.ossService.getBucketInfo(),
        maxFileSize: '100MB',
        allowedTypes: [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'video/mp4',
          'video/quicktime',
        ],
      },
    };
  }
}
