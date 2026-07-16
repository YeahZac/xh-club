import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { MallService } from './mall.service';
import { AdminAuthGuard, MemberAuthGuard } from '@/auth/auth.guard';

@Controller('mall')
export class MallController {
  constructor(private readonly mallService: MallService) {}

  // ==================== 商品接口 ====================

  @Get('products')
  @HttpCode(HttpStatus.OK)
  async getProducts(@Query('category') category?: string) {
    return this.mallService.getProducts(category);
  }

  @Get('products/:id')
  @HttpCode(HttpStatus.OK)
  async getProduct(@Param('id') id: string) {
    return this.mallService.getProductById(id);
  }

  @Post('products')
  @UseGuards(AdminAuthGuard)
  @HttpCode(HttpStatus.OK)
  async createProduct(@Body() body: {
    name: string;
    description?: string;
    image_url: string;
    video_url?: string;
    points_price: number;
    cash_price?: string;
    stock: number;
    category: string;
    enable_distribution?: boolean;
    distribution_rate?: string;
  }) {
    return this.mallService.createProduct(body);
  }

  @Put('products/:id')
  @UseGuards(AdminAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateProduct(@Param('id') id: string, @Body() body: any) {
    return this.mallService.updateProduct(id, body);
  }

  @Delete('products/:id')
  @UseGuards(AdminAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteProduct(@Param('id') id: string) {
    return this.mallService.deleteProduct(id);
  }

  // ==================== 订单接口 ====================

  @Post('orders')
  @UseGuards(MemberAuthGuard)
  @HttpCode(HttpStatus.OK)
  async createOrder(@Body() body: {
    member_id: string;
    product_id: string;
    quantity: number;
    points_used: number;
    referrer_id?: string;
  }, @Req() request: any) {
    return this.mallService.createOrder({ ...body, member_id: request.user.sub });
  }

  // ==================== 分销接口 ====================

  @Get('distribution/stats/:memberId')
  @UseGuards(MemberAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getDistributionStats(@Param('memberId') memberId: string, @Req() request: any) {
    if (String(memberId) !== String(request.user.sub)) throw new ForbiddenException('无权查看其他会员数据');
    return this.mallService.getDistributionStats(memberId);
  }

  @Get('distribution/subordinates/:memberId')
  @UseGuards(MemberAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getSubordinates(@Param('memberId') memberId: string, @Req() request: any) {
    if (String(memberId) !== String(request.user.sub)) throw new ForbiddenException('无权查看其他会员数据');
    return this.mallService.getSubordinates(memberId);
  }
}
