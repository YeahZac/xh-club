import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
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
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    // Validate image type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error('Invalid file type. Only JPEG, PNG, GIF, WebP are allowed');
    }

    const result = await this.uploadService.uploadFile(file, 'images');
    return {
      code: 200,
      msg: 'Upload successful',
      data: result,
    };
  }

  @Post('file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFileGeneric(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file uploaded');
    }
    const result = await this.uploadService.uploadFile(file, 'files');
    return {
      code: 200,
      msg: 'Upload successful',
      data: result,
    };
  }

  @Get('files')
  async listFiles(@Query('folder') folder: string = 'general') {
    const files = await this.uploadService.listFiles(folder);
    return {
      code: 200,
      msg: 'success',
      data: files,
    };
  }

  @Delete()
  async deleteFile(@Body('path') filePath: string) {
    if (!filePath) {
      throw new Error('File path is required');
    }

    await this.uploadService.deleteFile(filePath);
    return {
      code: 200,
      msg: 'Delete successful',
      data: null,
    };
  }
}
