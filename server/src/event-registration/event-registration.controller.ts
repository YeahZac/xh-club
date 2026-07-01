import { Controller, Get, Post, Delete, Body, Param, Query, Res, HttpCode } from '@nestjs/common';
import { Response } from 'express';
import { EventRegistrationService } from './event-registration.service';

@Controller('event-registration')
export class EventRegistrationController {
  constructor(private readonly service: EventRegistrationService) {}

  /** 提交报名 */
  @Post()
  @HttpCode(200)
  async create(@Body() body: {
    name: string;
    gender: string;
    birthday: string;
    age?: number;
    industry: string;
    phone: string;
    contact_method?: string;
    referrer?: string;
  }) {
    console.log('[EventRegistration] POST /api/event-registration', JSON.stringify(body));
    const data = await this.service.create(body);
    return { code: 200, msg: '报名成功', data };
  }

  /** 获取报名列表（管理员） */
  @Get()
  async findAll(@Query('keyword') keyword?: string) {
    console.log('[EventRegistration] GET /api/event-registration', keyword ? `keyword=${keyword}` : '');
    const data = await this.service.findAll(keyword);
    return { code: 200, msg: '获取成功', data };
  }

  /** 导出CSV（管理员） */
  @Get('export')
  async exportCsv(@Res() res: Response) {
    console.log('[EventRegistration] GET /api/event-registration/export');
    const csv = await this.service.exportCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=registration_list.csv');
    // BOM for Excel UTF-8
    res.send('\uFEFF' + csv);
  }

  /** 删除报名（管理员） */
  @Delete(':id')
  @HttpCode(200)
  async remove(@Param('id') id: string) {
    console.log('[EventRegistration] DELETE /api/event-registration/' + id);
    await this.service.remove(id);
    return { code: 200, msg: '删除成功' };
  }
}
