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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { AdminAuthGuard, MemberAuthGuard } from '@/auth/auth.guard';

@Controller('upload')
@UseGuards(AdminAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
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
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
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

/** 会员端图片上传（人才入驻等） */
@Controller('upload/member')
@UseGuards(MemberAuthGuard)
export class MemberUploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
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
}
