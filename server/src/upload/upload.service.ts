import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads');

  constructor() {
    // 确保上传目录存在
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'general'): Promise<any> {
    try {
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const filename = `${folder}-${timestamp}-${Math.random().toString(36).substring(7)}${ext}`;
      
      const folderPath = path.join(this.uploadDir, folder);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      const filePath = path.join(folderPath, filename);
      
      // 写入文件
      if (file.buffer) {
        fs.writeFileSync(filePath, file.buffer);
      } else if ((file as any).path) {
        fs.copyFileSync((file as any).path, filePath);
      }

      // 返回文件信息（使用相对路径作为 URL）
      const relativePath = `uploads/${folder}/${filename}`;
      
      return {
        url: relativePath,
        path: relativePath,
        filename: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      };
    } catch (error) {
      throw new Error(`File upload error: ${(error as Error).message}`);
    }
  }

  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      return true;
    } catch (error) {
      throw new Error(`File delete error: ${(error as Error).message}`);
    }
  }

  async listFiles(folder: string = 'general'): Promise<any[]> {
    try {
      const folderPath = path.join(this.uploadDir, folder);
      if (!fs.existsSync(folderPath)) {
        return [];
      }

      const files = fs.readdirSync(folderPath);
      return files.map(filename => {
        const stats = fs.statSync(path.join(folderPath, filename));
        return {
          name: filename,
          path: `uploads/${folder}/${filename}`,
          created_at: stats.birthtime.toISOString(),
        };
      }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } catch (error) {
      throw new Error(`File list error: ${(error as Error).message}`);
    }
  }
}
