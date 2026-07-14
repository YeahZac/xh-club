import { Injectable, Logger } from '@nestjs/common';
import { queryRows, queryOne, queryExecute } from '@/storage/database/mysql-client';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface ProductRow extends RowDataPacket {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  points_price: number;
  cash_price: string | null;
  stock: number;
  sales_count: number;
  category: string;
  status: string;
  enable_distribution: boolean;
  distribution_rate: string;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface MemberRow extends RowDataPacket {
  id: string;
  name: string | null;
  avatar: string | null;
  company_name: string | null;
  available_points: number;
}

@Injectable()
export class MallService {
  private readonly logger = new Logger(MallService.name);

  // ==================== 商品管理 ====================

  async getProducts(category?: string) {
    try {
      if (category && category !== 'all') {
        const rows = await queryRows<ProductRow>(
          'SELECT * FROM mall_products WHERE status = ? AND category = ? ORDER BY sort_order DESC',
          ['active', category]
        );
        return { code: 200, msg: 'success', data: rows };
      }
      const rows = await queryRows<ProductRow>(
        'SELECT * FROM mall_products WHERE status = ? ORDER BY sort_order DESC',
        ['active']
      );
      return { code: 200, msg: 'success', data: rows };
    } catch (error) {
      this.logger.error('获取商品列表失败', error);
      return { code: 500, msg: '获取商品列表失败', data: null };
    }
  }

  async getProductById(id: string) {
    try {
      const row = await queryOne<ProductRow>('SELECT * FROM mall_products WHERE id = ?', [id]);
      if (!row) {
        return { code: 404, msg: '商品不存在', data: null };
      }
      return { code: 200, msg: 'success', data: row };
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
      const result = await queryExecute(
        `INSERT INTO mall_products (name, description, image_url, points_price, cash_price, stock, category, enable_distribution, distribution_rate, status, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0)`,
        [data.name, data.description || null, data.image_url || null,
         data.points_price, data.cash_price || '0', data.stock, data.category,
         data.enable_distribution || false, data.distribution_rate || '0']
      );
      const row = await queryOne<ProductRow>('SELECT * FROM mall_products WHERE id = ?', [result.insertId]);
      return { code: 200, msg: '创建成功', data: row };
    } catch (error) {
      this.logger.error('创建商品失败', error);
      return { code: 500, msg: '创建商品失败', data: null };
    }
  }

  async updateProduct(id: string, data: any) {
    try {
      const setClauses: string[] = [];
      const values: any[] = [];
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          setClauses.push(`${key} = ?`);
          values.push(value);
        }
      }
      if (setClauses.length === 0) {
        return { code: 400, msg: '没有要更新的字段', data: null };
      }
      setClauses.push('updated_at = NOW()');
      values.push(id);
      const result = await queryExecute(
        `UPDATE mall_products SET ${setClauses.join(', ')} WHERE id = ?`,
        values
      );
      if (result.affectedRows === 0) {
        return { code: 404, msg: '商品不存在', data: null };
      }
      const row = await queryOne<ProductRow>('SELECT * FROM mall_products WHERE id = ?', [id]);
      return { code: 200, msg: '更新成功', data: row };
    } catch (error) {
      this.logger.error('更新商品失败', error);
      return { code: 500, msg: '更新商品失败', data: null };
    }
  }

  async deleteProduct(id: string) {
    try {
      await queryExecute('DELETE FROM mall_products WHERE id = ?', [id]);
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
      const product = await queryOne<ProductRow>('SELECT * FROM mall_products WHERE id = ?', [data.product_id]);
      if (!product) {
        return { code: 404, msg: '商品不存在', data: null };
      }

      // 检查库存
      if (product.stock < data.quantity) {
        return { code: 400, msg: '库存不足', data: null };
      }

      // 检查会员积分
      const member = await queryOne<MemberRow>('SELECT * FROM members WHERE id = ?', [data.member_id]);
      if (!member) {
        return { code: 404, msg: '会员不存在', data: null };
      }
      if (member.available_points < data.points_used) {
        return { code: 400, msg: '积分不足', data: null };
      }

      // 生成订单号
      const orderNo = `ORD${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const totalAmount = parseFloat(product.cash_price || '0') * data.quantity;
      const cashAmount = totalAmount;

      // 创建订单
      const orderResult = await queryExecute(
        `INSERT INTO mall_orders (order_no, member_id, product_id, product_name, quantity, total_amount, points_used, cash_amount, referrer_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid')`,
        [orderNo, data.member_id, data.product_id, product.name, data.quantity,
         totalAmount.toString(), data.points_used, cashAmount.toString(), data.referrer_id || null]
      );

      // 扣减积分
      await queryExecute(
        'UPDATE members SET available_points = available_points - ?, updated_at = NOW() WHERE id = ?',
        [data.points_used, data.member_id]
      );

      // 扣减库存，增加销量
      await queryExecute(
        'UPDATE mall_products SET stock = stock - ?, sales_count = sales_count + ?, updated_at = NOW() WHERE id = ?',
        [data.quantity, data.quantity, data.product_id]
      );

      // 处理分销
      if (data.referrer_id && product.enable_distribution) {
        await this.processDistribution(data.referrer_id, data.member_id, String(orderResult.insertId), product);
      }

      // 查询新创建的订单
      const order = await queryOne('SELECT * FROM mall_orders WHERE id = ?', [orderResult.insertId]);
      return { code: 200, msg: '下单成功', data: order };
    } catch (error) {
      this.logger.error('创建订单失败', error);
      return { code: 500, msg: '创建订单失败', data: null };
    }
  }

  async processDistribution(referrerId: string, buyerId: string, orderId: string, product: any) {
    try {
      const relations = await queryRows(
        'SELECT * FROM distribution_relations WHERE child_id = ?',
        [buyerId]
      );
      for (const relation of relations) {
        if (relation.parent_id === referrerId || relation.level === 1) {
          const rate = parseFloat(product.distribution_rate || '0');
          const amount = parseFloat(product.cash_price || '0') * rate / 100;
          if (amount > 0) {
            await queryExecute(
              `INSERT INTO distribution_earnings (member_id, order_id, from_member_id, amount, rate, level, status)
               VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
              [referrerId, orderId, buyerId, amount.toString(), rate.toString(), relation.level]
            );
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
      const earnings = await queryOne(
        `SELECT 
          COALESCE(SUM(amount), 0) as total,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending,
          COALESCE(SUM(CASE WHEN status = 'settled' THEN amount ELSE 0 END), 0) as settled
         FROM distribution_earnings WHERE member_id = ?`,
        [memberId]
      );

      const subordinates = await queryOne(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN level = 1 THEN 1 ELSE 0 END) as direct,
          SUM(CASE WHEN level = 2 THEN 1 ELSE 0 END) as indirect
         FROM distribution_relations WHERE parent_id = ?`,
        [memberId]
      );

      return {
        code: 200,
        msg: 'success',
        data: {
          total_earnings: parseFloat((earnings as any)?.total || '0'),
          pending_earnings: parseFloat((earnings as any)?.pending || '0'),
          settled_earnings: parseFloat((earnings as any)?.settled || '0'),
          subordinate_count: parseInt((subordinates as any)?.total || '0'),
          direct_count: parseInt((subordinates as any)?.direct || '0'),
          indirect_count: parseInt((subordinates as any)?.indirect || '0'),
        }
      };
    } catch (error) {
      this.logger.error('获取分销统计失败', error);
      return { code: 500, msg: '获取分销统计失败', data: null };
    }
  }

  async getSubordinates(memberId: string) {
    try {
      const rows = await queryRows(
        `SELECT m.id, m.name, m.avatar, m.company_name, dr.level, dr.created_at
         FROM distribution_relations dr
         LEFT JOIN members m ON dr.child_id = m.id
         WHERE dr.parent_id = ?
         ORDER BY dr.created_at DESC`,
        [memberId]
      );
      return { code: 200, msg: 'success', data: rows };
    } catch (error) {
      this.logger.error('获取下级列表失败', error);
      return { code: 500, msg: '获取下级列表失败', data: null };
    }
  }
}
