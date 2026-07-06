import { Injectable, Logger } from '@nestjs/common';
import { eq, desc, and, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../storage/database/shared/schema';

@Injectable()
export class MallService {
  private readonly logger = new Logger(MallService.name);
  private db: ReturnType<typeof drizzle>;

  constructor() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    this.db = drizzle(pool, { schema });
  }

  // ==================== 商品管理 ====================

  async getProducts(category?: string) {
    try {
      let query = this.db.select().from(schema.mallProducts).where(eq(schema.mallProducts.status, 'active'));
      
      if (category && category !== 'all') {
        query = this.db.select().from(schema.mallProducts).where(
          and(
            eq(schema.mallProducts.status, 'active'),
            eq(schema.mallProducts.category, category)
          )
        );
      }
      
      const products = await query.orderBy(desc(schema.mallProducts.sort_order));
      return { code: 200, msg: 'success', data: products };
    } catch (error) {
      this.logger.error('获取商品列表失败', error);
      return { code: 500, msg: '获取商品列表失败', data: null };
    }
  }

  async getProductById(id: string) {
    try {
      const products = await this.db.select().from(schema.mallProducts).where(eq(schema.mallProducts.id, id));
      if (products.length === 0) {
        return { code: 404, msg: '商品不存在', data: null };
      }
      return { code: 200, msg: 'success', data: products[0] };
    } catch (error) {
      this.logger.error('获取商品详情失败', error);
      return { code: 500, msg: '获取商品详情失败', data: null };
    }
  }

  async createProduct(data: {
    name: string;
    description?: string;
    image_url?: string;
    points_price: number;
    cash_price?: string;
    stock: number;
    category: string;
    enable_distribution?: boolean;
    distribution_rate?: string;
  }) {
    try {
      const result = await this.db.insert(schema.mallProducts).values({
        name: data.name,
        description: data.description,
        image_url: data.image_url,
        points_price: data.points_price,
        cash_price: data.cash_price,
        stock: data.stock,
        category: data.category,
        enable_distribution: data.enable_distribution || false,
        distribution_rate: data.distribution_rate || '0',
      }).returning();
      return { code: 200, msg: '创建成功', data: result[0] };
    } catch (error) {
      this.logger.error('创建商品失败', error);
      return { code: 500, msg: '创建商品失败', data: null };
    }
  }

  async updateProduct(id: string, data: Partial<{
    name: string;
    description?: string;
    image_url?: string;
    points_price: number;
    cash_price?: string;
    stock: number;
    category: string;
    status: string;
    enable_distribution: boolean;
    distribution_rate: string;
  }>) {
    try {
      const result = await this.db.update(schema.mallProducts)
        .set({ ...data, updated_at: new Date() })
        .where(eq(schema.mallProducts.id, id))
        .returning();
      if (result.length === 0) {
        return { code: 404, msg: '商品不存在', data: null };
      }
      return { code: 200, msg: '更新成功', data: result[0] };
    } catch (error) {
      this.logger.error('更新商品失败', error);
      return { code: 500, msg: '更新商品失败', data: null };
    }
  }

  async deleteProduct(id: string) {
    try {
      await this.db.delete(schema.mallProducts).where(eq(schema.mallProducts.id, id));
      return { code: 200, msg: '删除成功', data: null };
    } catch (error) {
      this.logger.error('删除商品失败', error);
      return { code: 500, msg: '删除商品失败', data: null };
    }
  }

  // ==================== 订单管理 ====================

  async createOrder(data: {
    member_id: string;
    product_id: string;
    quantity: number;
    points_used: number;
    referrer_id?: string;
  }) {
    try {
      // 获取商品信息
      const products = await this.db.select().from(schema.mallProducts).where(eq(schema.mallProducts.id, data.product_id));
      if (products.length === 0) {
        return { code: 404, msg: '商品不存在', data: null };
      }
      const product = products[0];

      // 检查库存
      if (product.stock < data.quantity) {
        return { code: 400, msg: '库存不足', data: null };
      }

      // 检查会员积分
      const members = await this.db.select().from(schema.members).where(eq(schema.members.id, data.member_id));
      if (members.length === 0) {
        return { code: 404, msg: '会员不存在', data: null };
      }
      const member = members[0];
      if (member.available_points < data.points_used) {
        return { code: 400, msg: '积分不足', data: null };
      }

      // 生成订单号
      const orderNo = `ORD${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // 计算金额
      const totalAmount = parseFloat(product.cash_price || '0') * data.quantity;
      const cashAmount = totalAmount; // 简化：全部用现金或全部用积分

      // 创建订单
      const orderResult = await this.db.insert(schema.mallOrders).values({
        order_no: orderNo,
        member_id: data.member_id,
        product_id: data.product_id,
        product_name: product.name,
        quantity: data.quantity,
        total_amount: totalAmount.toString(),
        points_used: data.points_used,
        cash_amount: cashAmount.toString(),
        referrer_id: data.referrer_id,
        status: 'paid',
      }).returning();

      // 扣减积分
      await this.db.update(schema.members)
        .set({ 
          available_points: member.available_points - data.points_used,
          updated_at: new Date()
        })
        .where(eq(schema.members.id, data.member_id));

      // 扣减库存，增加销量
      await this.db.update(schema.mallProducts)
        .set({ 
          stock: product.stock - data.quantity,
          sales_count: product.sales_count + data.quantity,
          updated_at: new Date()
        })
        .where(eq(schema.mallProducts.id, data.product_id));

      // 处理分销
      if (data.referrer_id && product.enable_distribution) {
        await this.processDistribution(data.referrer_id, data.member_id, orderResult[0].id, product);
      }

      return { code: 200, msg: '下单成功', data: orderResult[0] };
    } catch (error) {
      this.logger.error('创建订单失败', error);
      return { code: 500, msg: '创建订单失败', data: null };
    }
  }

  async processDistribution(referrerId: string, buyerId: string, orderId: string, product: any) {
    try {
      // 查找分销关系
      const relations = await this.db.select().from(schema.distributionRelations)
        .where(eq(schema.distributionRelations.child_id, buyerId));

      for (const relation of relations) {
        if (relation.parent_id === referrerId || relation.level === 1) {
          // 计算分销收益
          const rate = parseFloat(product.distribution_rate || '0');
          const amount = parseFloat(product.cash_price || '0') * rate / 100;
          
          if (amount > 0) {
            // 创建收益记录
            await this.db.insert(schema.distributionEarnings).values({
              member_id: referrerId,
              order_id: orderId,
              from_member_id: buyerId,
              amount: amount.toString(),
              rate: rate.toString(),
              level: relation.level,
              status: 'pending',
            });
          }
          break;
        }
      }
    } catch (error) {
      this.logger.error('处理分销失败', error);
    }
  }

  // ==================== 分销管理 ====================

  async getDistributionStats(memberId: string) {
    try {
      // 获取总收益
      const earnings = await this.db.select({
        total: sql<string>`COALESCE(SUM(${schema.distributionEarnings.amount}), 0)`,
        pending: sql<string>`COALESCE(SUM(CASE WHEN ${schema.distributionEarnings.status} = 'pending' THEN ${schema.distributionEarnings.amount} ELSE 0 END), 0)`,
        settled: sql<string>`COALESCE(SUM(CASE WHEN ${schema.distributionEarnings.status} = 'settled' THEN ${schema.distributionEarnings.amount} ELSE 0 END), 0)`,
      }).from(schema.distributionEarnings).where(eq(schema.distributionEarnings.member_id, memberId));

      // 获取下级人数
      const subordinates = await this.db.select({
        total: sql<number>`COUNT(*)`,
        direct: sql<number>`COUNT(CASE WHEN ${schema.distributionRelations.level} = 1 THEN 1 END)`,
        indirect: sql<number>`COUNT(CASE WHEN ${schema.distributionRelations.level} = 2 THEN 1 END)`,
      }).from(schema.distributionRelations).where(eq(schema.distributionRelations.parent_id, memberId));

      return {
        code: 200,
        msg: 'success',
        data: {
          total_earnings: parseFloat(earnings[0]?.total || '0'),
          pending_earnings: parseFloat(earnings[0]?.pending || '0'),
          settled_earnings: parseFloat(earnings[0]?.settled || '0'),
          subordinate_count: subordinates[0]?.total || 0,
          direct_count: subordinates[0]?.direct || 0,
          indirect_count: subordinates[0]?.indirect || 0,
        }
      };
    } catch (error) {
      this.logger.error('获取分销统计失败', error);
      return { code: 500, msg: '获取分销统计失败', data: null };
    }
  }

  async getSubordinates(memberId: string) {
    try {
      const relations = await this.db.select({
        id: schema.members.id,
        name: schema.members.name,
        avatar: schema.members.avatar,
        company_name: schema.members.company_name,
        level: schema.distributionRelations.level,
        created_at: schema.distributionRelations.created_at,
      })
      .from(schema.distributionRelations)
      .leftJoin(schema.members, eq(schema.distributionRelations.child_id, schema.members.id))
      .where(eq(schema.distributionRelations.parent_id, memberId))
      .orderBy(desc(schema.distributionRelations.created_at));

      return { code: 200, msg: 'success', data: relations };
    } catch (error) {
      this.logger.error('获取下级列表失败', error);
      return { code: 500, msg: '获取下级列表失败', data: null };
    }
  }
}
