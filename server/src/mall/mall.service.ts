import { Injectable, Logger } from '@nestjs/common';
import { queryRows, queryOne, queryExecute, withTransaction } from '@/storage/database/mysql-client';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';
import { isCloudStorageUrl } from '@/utils/media-url';

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
    image_url: string;
    video_url?: string;
    points_price: number;
    cash_price?: string;
    stock: number;
    category: string;
    enable_distribution?: boolean;
    distribution_rate?: string;
  }) {
    if (!isCloudStorageUrl(data.image_url)) {
      return { code: 400, msg: '商品图片为必填项', data: null };
    }
    if (data.video_url && !isCloudStorageUrl(data.video_url)) {
      return { code: 400, msg: '商品视频必须使用微信云托管对象存储 URL', data: null };
    }
    try {
      const result = await queryExecute(
        `INSERT INTO mall_products (name, description, image_url, video_url, points_price, cash_price, stock, category, enable_distribution, distribution_rate, status, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0)`,
        [data.name, data.description || null, data.image_url, data.video_url || null,
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
    if (!Number.isInteger(data.quantity) || data.quantity <= 0) {
      return { code: 400, msg: '商品数量必须为正整数', data: null };
    }
    if (!Number.isInteger(data.points_used) || data.points_used < 0) {
      return { code: 400, msg: '使用积分不能为负数', data: null };
    }

    try {
      return await withTransaction(async connection => {
        const [productRows] = await connection.query<ProductRow[]>(
          'SELECT * FROM mall_products WHERE id = ? FOR UPDATE',
          [data.product_id],
        );
        const product = productRows[0];
        if (!product) return { code: 404, msg: '商品不存在', data: null };
        if (product.status !== 'active') return { code: 400, msg: '商品已下架', data: null };
        if (product.stock < data.quantity) return { code: 400, msg: '库存不足', data: null };

        const [memberRows] = await connection.query<MemberRow[]>(
          'SELECT * FROM members WHERE id = ? FOR UPDATE',
          [data.member_id],
        );
        const member = memberRows[0];
        if (!member) return { code: 404, msg: '会员不存在', data: null };
        if (member.available_points < data.points_used) {
          return { code: 400, msg: '积分不足', data: null };
        }

        const orderNo = `ORD${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const totalAmount = parseFloat(product.cash_price || '0') * data.quantity;
        const [orderResult] = await connection.query<ResultSetHeader>(
          `INSERT INTO mall_orders
             (order_no, member_id, product_id, product_name, quantity, total_amount, points_used, cash_amount, referrer_id, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
          [
            orderNo,
            data.member_id,
            data.product_id,
            product.name,
            data.quantity,
            totalAmount.toString(),
            data.points_used,
            totalAmount.toString(),
            data.referrer_id || null,
          ],
        );

        await connection.query(
          'UPDATE members SET available_points = available_points - ?, updated_at = NOW() WHERE id = ?',
          [data.points_used, data.member_id],
        );
        await connection.query(
          'UPDATE mall_products SET stock = stock - ?, sales_count = sales_count + ?, updated_at = NOW() WHERE id = ?',
          [data.quantity, data.quantity, data.product_id],
        );

        if (data.referrer_id && product.enable_distribution) {
          await this.processDistribution(
            connection,
            data.referrer_id,
            data.member_id,
            String(orderResult.insertId),
            product,
          );
        }

        const [orderRows] = await connection.query<RowDataPacket[]>(
          'SELECT * FROM mall_orders WHERE id = ?',
          [orderResult.insertId],
        );
        return { code: 200, msg: '下单成功', data: orderRows[0] || null };
      });
    } catch (error) {
      this.logger.error('创建订单失败', error);
      return { code: 500, msg: '创建订单失败', data: null };
    }
  }

  private async processDistribution(
    connection: PoolConnection,
    referrerId: string,
    buyerId: string,
    orderId: string,
    product: ProductRow,
  ) {
    const [relations] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM distribution_relations WHERE child_id = ?',
      [buyerId],
    );
    for (const relation of relations) {
      if (String(relation.parent_id) === String(referrerId) || relation.level === 1) {
        const rate = parseFloat(product.distribution_rate || '0');
        const amount = parseFloat(product.cash_price || '0') * rate / 100;
        if (amount > 0) {
          await connection.query(
            `INSERT INTO distribution_earnings
               (member_id, order_id, from_member_id, amount, rate, level, status)
             VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
            [referrerId, orderId, buyerId, amount.toString(), rate.toString(), relation.level],
          );
        }
        break;
      }
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
