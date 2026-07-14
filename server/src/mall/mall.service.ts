import { Injectable, Logger } from '@nestjs/common';
import { getPool } from '@/storage/database/mysql-client';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

interface ProductRow extends RowDataPacket {
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

interface MemberRow extends RowDataPacket {
  id: string;
  name: string | null;
  avatar: string | null;
  company_name: string | null;
  available_points: number;
}

interface OrderRow extends RowDataPacket {
  id: string;
  order_no: string;
  member_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  total_amount: string;
  points_used: number;
  cash_amount: string;
  referrer_id: string | null;
  status: string;
  created_at: Date;
}

interface EarningRow extends RowDataPacket {
  total: string;
  pending: string;
  settled: string;
}

interface SubordinateRow extends RowDataPacket {
  id: string;
  name: string | null;
  avatar: string | null;
  company_name: string | null;
  level: number;
  created_at: Date;
}

@Injectable()
export class MallService {
  private readonly logger = new Logger(MallService.name);

  // ==================== 商品管理 ====================

  async getProducts(category?: string) {
    try {
      const pool = getPool();
      if (!pool) {
        return { code: 500, msg: '数据库未连接', data: null };
      }

      let sql = 'SELECT * FROM mall_products WHERE status = ?';
      const params: any[] = ['active'];

      if (category && category !== 'all') {
        sql += ' AND category = ?';
        params.push(category);
      }

      sql += ' ORDER BY sort_order DESC';

      const [rows] = await pool.query(sql, params) as [RowDataPacket[], any];
      return { code: 200, msg: 'success', data: rows };
    } catch (error) {
      this.logger.error('获取商品列表失败', error);
      return { code: 500, msg: '获取商品列表失败', data: null };
    }
  }

  async getProductById(id: string) {
    try {
      const pool = getPool();
      if (!pool) {
        return { code: 500, msg: '数据库未连接', data: null };
      }

      const [rows] = await pool.query(
        'SELECT * FROM mall_products WHERE id = ?',
        [id]
      );

      if (rows.length === 0) {
        return { code: 404, msg: '商品不存在', data: null };
      }
      return { code: 200, msg: 'success', data: rows[0] };
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
      const pool = getPool();
      if (!pool) {
        return { code: 500, msg: '数据库未连接', data: null };
      }

      const [result] = await pool.query(
        `INSERT INTO mall_products (name, description, image_url, points_price, cash_price, stock, category, enable_distribution, distribution_rate, status, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0)`,
        [
          data.name,
          data.description || null,
          data.image_url || null,
          data.points_price,
          data.cash_price || '0',
          data.stock,
          data.category,
          data.enable_distribution || false,
          data.distribution_rate || '0'
        ]
      );

      // 查询新创建的记录
      const [rows] = await pool.query(
        'SELECT * FROM mall_products WHERE id = ?',
        [result.insertId]
      );

      return { code: 200, msg: '创建成功', data: rows[0] };
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
    sort_order: number;
  }>) {
    try {
      const pool = getPool();
      if (!pool) {
        return { code: 500, msg: '数据库未连接', data: null };
      }

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

      const [result] = await pool.query(
        `UPDATE mall_products SET ${setClauses.join(', ')} WHERE id = ?`,
        values
      );

      if (result.affectedRows === 0) {
        return { code: 404, msg: '商品不存在', data: null };
      }

      // 查询更新后的记录
      const [rows] = await pool.query(
        'SELECT * FROM mall_products WHERE id = ?',
        [id]
      );

      return { code: 200, msg: '更新成功', data: rows[0] };
    } catch (error) {
      this.logger.error('更新商品失败', error);
      return { code: 500, msg: '更新商品失败', data: null };
    }
  }

  async deleteProduct(id: string) {
    try {
      const pool = getPool();
      if (!pool) {
        return { code: 500, msg: '数据库未连接', data: null };
      }

      await pool.query('DELETE FROM mall_products WHERE id = ?', [id]);
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
      const pool = getPool();
      if (!pool) {
        return { code: 500, msg: '数据库未连接', data: null };
      }

      // 获取商品信息
      const [products] = await pool.query(
        'SELECT * FROM mall_products WHERE id = ?',
        [data.product_id]
      );
      if (products.length === 0) {
        return { code: 404, msg: '商品不存在', data: null };
      }
      const product = products[0];

      // 检查库存
      if (product.stock < data.quantity) {
        return { code: 400, msg: '库存不足', data: null };
      }

      // 检查会员积分
      const [members] = await pool.query(
        'SELECT * FROM members WHERE id = ?',
        [data.member_id]
      );
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
      const cashAmount = totalAmount;

      // 创建订单
      const [orderResult] = await pool.query(
        `INSERT INTO mall_orders (order_no, member_id, product_id, product_name, quantity, total_amount, points_used, cash_amount, referrer_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid')`,
        [
          orderNo,
          data.member_id,
          data.product_id,
          product.name,
          data.quantity,
          totalAmount.toString(),
          data.points_used,
          cashAmount.toString(),
          data.referrer_id || null
        ]
      );

      // 扣减积分
      await pool.query(
        'UPDATE members SET available_points = available_points - ?, updated_at = NOW() WHERE id = ?',
        [data.points_used, data.member_id]
      );

      // 扣减库存，增加销量
      await pool.query(
        'UPDATE mall_products SET stock = stock - ?, sales_count = sales_count + ?, updated_at = NOW() WHERE id = ?',
        [data.quantity, data.quantity, data.product_id]
      );

      // 处理分销
      if (data.referrer_id && product.enable_distribution) {
        await this.processDistribution(data.referrer_id, data.member_id, orderResult.insertId.toString(), product);
      }

      // 查询新创建的订单
      const [orders] = await pool.query(
        'SELECT * FROM mall_orders WHERE id = ?',
        [orderResult.insertId]
      );

      return { code: 200, msg: '下单成功', data: orders[0] };
    } catch (error) {
      this.logger.error('创建订单失败', error);
      return { code: 500, msg: '创建订单失败', data: null };
    }
  }

  async processDistribution(referrerId: string, buyerId: string, orderId: string, product: any) {
    try {
      const pool = getPool();
      if (!pool) return;

      // 查找分销关系
      const [relations] = await pool.query(
        'SELECT * FROM distribution_relations WHERE child_id = ?',
        [buyerId]
      );

      for (const relation of relations) {
        if (relation.parent_id === referrerId || relation.level === 1) {
          // 计算分销收益
          const rate = parseFloat(product.distribution_rate || '0');
          const amount = parseFloat(product.cash_price || '0') * rate / 100;
          
          if (amount > 0) {
            // 创建收益记录
            await pool.query(
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
      const pool = getPool();
      if (!pool) {
        return { code: 500, msg: '数据库未连接', data: null };
      }

      // 获取总收益
      const [earnings] = await pool.query(
        `SELECT 
          COALESCE(SUM(amount), 0) as total,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending,
          COALESCE(SUM(CASE WHEN status = 'settled' THEN amount ELSE 0 END), 0) as settled
         FROM distribution_earnings WHERE member_id = ?`,
        [memberId]
      );

      // 获取下级人数
      const [subordinates] = await pool.query(
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
          total_earnings: parseFloat(earnings[0]?.total || '0'),
          pending_earnings: parseFloat(earnings[0]?.pending || '0'),
          settled_earnings: parseFloat(earnings[0]?.settled || '0'),
          subordinate_count: parseInt(subordinates[0]?.total || '0'),
          direct_count: parseInt(subordinates[0]?.direct || '0'),
          indirect_count: parseInt(subordinates[0]?.indirect || '0'),
        }
      };
    } catch (error) {
      this.logger.error('获取分销统计失败', error);
      return { code: 500, msg: '获取分销统计失败', data: null };
    }
  }

  async getSubordinates(memberId: string) {
    try {
      const pool = getPool();
      if (!pool) {
        return { code: 500, msg: '数据库未连接', data: null };
      }

      const [relations] = await pool.query(
        `SELECT m.id, m.name, m.avatar, m.company_name, dr.level, dr.created_at
         FROM distribution_relations dr
         LEFT JOIN members m ON dr.child_id = m.id
         WHERE dr.parent_id = ?
         ORDER BY dr.created_at DESC`,
        [memberId]
      );

      return { code: 200, msg: 'success', data: relations };
    } catch (error) {
      this.logger.error('获取下级列表失败', error);
      return { code: 500, msg: '获取下级列表失败', data: null };
    }
  }
}
