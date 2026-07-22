import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  UseInterceptors,
  UploadedFile,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService, IMAGE_UPLOAD_MAX_BYTES } from './upload.service';
import { AdminAuthGuard, MemberAuthGuard } from '@/auth/auth.guard';
import { Public } from '@/auth/public.decorator';

@Controller('upload')
@UseGuards(AdminAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: IMAGE_UPLOAD_MAX_BYTES } }))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    const result = await this.uploadService.uploadFile(file);
    return {
      code: 200,
      msg: 'Upload successful',
      data: result,
    };
  }

  @Post('image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: IMAGE_UPLOAD_MAX_BYTES } }))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    const result = await this.uploadService.uploadImage(file);
    return {
      code: 200,
      msg: 'Upload successful',
      data: result,
    };
  }

  @Post('video')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 200 * 1024 * 1024 } }))
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file uploaded');
    }
    const result = await this.uploadService.uploadVideo(file);
    return {
      code: 200,
      msg: 'Upload successful',
      data: result,
    };
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Body('userId') userId: string,
  ) {
    if (!file) {
      throw new Error('No file uploaded');
    }
    if (!userId) {
      throw new Error('userId is required');
    }

    const result = await this.uploadService.uploadAvatar(file, userId);
    return {
      code: 200,
      msg: 'Upload successful',
      data: result,
    };
  }

  @Post('document')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    const result = await this.uploadService.uploadDocument(file);
    return {
      code: 200,
      msg: 'Upload successful',
      data: result,
    };
  }

  /** 管理端：登记小程序/控制台云存储 fileID */
  @Post('from-cloud')
  @HttpCode(200)
  async fromCloud(@Body() body: { fileID?: string; filename?: string }) {
    if (!body?.fileID?.trim()) {
      throw new Error('fileID is required');
    }
    const result = await this.uploadService.registerCloudFile(body.fileID.trim(), body.filename);
    return {
      code: 200,
      msg: 'Upload successful',
      data: result,
    };
  }

  @Get('library')
  async listLibrary(
    @Query('type') type?: string,
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const data = await this.uploadService.listMediaLibrary({
      type,
      keyword,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 24,
    });
    return {
      code: 200,
      msg: 'success',
      data,
    };
  }

  @Get('url')
  async getFileUrl(
    @Query('fileId') fileId: string,
    @Query('maxAge') maxAge?: string,
  ) {
    if (!fileId) {
      throw new Error('fileId is required');
    }
    const expireTime = maxAge ? parseInt(maxAge) : 604800; // 默认 7 天
    const url = await this.uploadService.getFileUrl(fileId, expireTime);
    return {
      code: 200,
      msg: 'success',
      data: { url },
    };
  }

  @Post('urls')
  async getFileUrls(@Body('fileIds') fileIds: string[]) {
    if (!fileIds || fileIds.length === 0) {
      throw new Error('fileIds is required');
    }
    const urls = await this.uploadService.getFileUrls(fileIds);
    return {
      code: 200,
      msg: 'success',
      data: urls,
    };
  }

  @Delete()
  async deleteFiles(@Body('fileIds') fileIds: string[]) {
    if (!fileIds || fileIds.length === 0) {
      throw new Error('fileIds is required');
    }

    const result = await this.uploadService.deleteFiles(fileIds);
    return {
      code: 200,
      msg: 'Delete successful',
      data: result,
    };
  }

  @Get('status')
  async getStatus() {
    const envInfo = this.uploadService.getEnvInfo();
    return {
      code: 200,
      msg: 'success',
      data: {
        available: envInfo.available,
        bucket: envInfo.bucket,
        region: envInfo.region,
      },
    };
  }
}

/** 会员推荐落地页：未登录也可上传职业照 */
@Controller('upload/invite')
export class InviteUploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Public()
  @Post('image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: IMAGE_UPLOAD_MAX_BYTES } }))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file uploaded');
    }
    const result = await this.uploadService.uploadImage(file, 'invite');
    return {
      code: 200,
      msg: 'Upload successful',
      data: result,
    };
  }
}

/** 会员端图片上传（人才入驻等） */
@Controller('upload/member')
@UseGuards(MemberAuthGuard)
export class MemberUploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: IMAGE_UPLOAD_MAX_BYTES } }))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file uploaded');
    }
    const result = await this.uploadService.uploadImage(file, 'member');
    return {
      code: 200,
      msg: 'Upload successful',
      data: result,
    };
  }

  @Post('video')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 200 * 1024 * 1024 } }))
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file uploaded');
    }
    const result = await this.uploadService.uploadVideo(file, 'member');
    return {
      code: 200,
      msg: 'Upload successful',
      data: result,
    };
  }

  /**
   * 小程序 callContainer 场景：先 wx.cloud.uploadFile，再登记为业务可用 URL
   * （callContainer 无法直接传 multipart 大图）
   */
  @Post('from-cloud')
  @HttpCode(200)
  async fromCloud(@Body() body: { fileID?: string; filename?: string }) {
    if (!body?.fileID?.trim()) {
      throw new Error('fileID is required');
    }
    const result = await this.uploadService.registerCloudFile(body.fileID.trim(), body.filename);
    return {
      code: 200,
      msg: 'Upload successful',
      data: result,
    };
  }
}
