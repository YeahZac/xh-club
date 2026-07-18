import { Injectable, Logger } from '@nestjs/common';
import { queryRows, queryOne, queryExecute, withTransaction } from '@/storage/database/mysql-client';
import { ensureSchemaColumns } from '@/storage/database/ensure-schema-columns';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';
import { canonicalizeCloudStorageUrl, isCloudStorageUrl } from '@/utils/media-url';
import { UploadService } from '@/upload/upload.service';
import { PointsEngineService } from '@/points/points-engine.service';
import { InvitationEngineService } from '@/invitation/invitation-engine.service';

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

  constructor(
    private readonly uploadService: UploadService,
    private readonly pointsEngine: PointsEngineService,
    private readonly invitationEngine: InvitationEngineService,
  ) {}

  private grantInviteMallReward(memberId: string | number, referenceId?: string | number) {
    void this.invitationEngine
      .grantConditionRewards(memberId, 'invitee_mall_order', {
        description: '推荐会员完成商城兑换',
        referenceId,
      })
      .catch((err) => this.logger.warn(`invitee_mall_order reward failed: ${err?.message || err}`))
  }

  // ==================== 商品管理 ====================

  async getProducts(category?: string) {
    try {
      if (category && category !== 'all') {
        const rows = await queryRows<ProductRow>(
          'SELECT * FROM mall_products WHERE status = ? AND category = ? ORDER BY sort_order DESC',
          ['active', category]
        );
        return {
          code: 200,
          msg: 'success',
          data: await this.uploadService.signRowsFields(rows, ['image_url', 'video_url']),
        };
      }
      const rows = await queryRows<ProductRow>(
        'SELECT * FROM mall_products WHERE status = ? ORDER BY sort_order DESC',
        ['active']
      );
      return {
        code: 200,
        msg: 'success',
        data: await this.uploadService.signRowsFields(rows, ['image_url', 'video_url']),
      };
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
      return {
        code: 200,
        msg: 'success',
        data: await this.uploadService.signDetailMediaFields(
          row,
          ['image_url', 'video_url'],
          ['description'],
        ),
      };
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
      await ensureSchemaColumns();
      const result = await queryExecute(
        `INSERT INTO mall_products (name, description, image_url, video_url, points_price, cash_price, stock, category, enable_distribution, distribution_rate, status, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0)`,
        [data.name, data.description || null, canonicalizeCloudStorageUrl(data.image_url),
         data.video_url ? canonicalizeCloudStorageUrl(data.video_url) : null,
         data.points_price, data.cash_price || '0', data.stock, data.category,
         data.enable_distribution || false, data.distribution_rate || '0']
      );
      const row = await queryOne<ProductRow>('SELECT * FROM mall_products WHERE id = ?', [result.insertId]);
      return {
        code: 200,
        msg: '创建成功',
        data: row ? await this.uploadService.signRowFields(row, ['image_url', 'video_url']) : row,
      };
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

  /** 订单状态：paid 待发货 → shipped 已发货 → completed 已收货 */
  private formatOrder(row: any) {
    if (!row) return row
    const status = String(row.status || '')
    const statusMap: Record<string, string> = {
      pending: '待支付',
      paid: '待发货',
      shipped: '已发货',
      completed: '已收货',
      cancelled: '已取消',
    }
    return {
      ...row,
      status_label: statusMap[status] || status,
      logistics: {
        company: row.logistics_company || '',
        no: row.logistics_no || '',
        shipped_at: row.shipped_at || null,
        received_at: row.received_at || null,
      },
    }
  }

  async createOrder(data: {
    member_id: string;
    product_id: string;
    quantity: number;
    points_used?: number;
    referrer_id?: string;
    contact_name?: string;
    contact_phone?: string;
    shipping_address?: string;
    remark?: string;
  }) {
    if (!Number.isInteger(data.quantity) || data.quantity <= 0) {
      return { code: 400, msg: '商品数量必须为正整数', data: null };
    }
    const contactName = String(data.contact_name || '').trim()
    const contactPhone = String(data.contact_phone || '').trim()
    const shippingAddress = String(data.shipping_address || '').trim()
    if (!contactName || !contactPhone || !shippingAddress) {
      return { code: 400, msg: '请填写收货人、手机号与收货地址', data: null }
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

        const pointsNeeded = Number(product.points_price) * data.quantity
        if (!Number.isFinite(pointsNeeded) || pointsNeeded <= 0) {
          return { code: 400, msg: '商品积分价格无效', data: null }
        }

        const [memberRows] = await connection.query<MemberRow[]>(
          'SELECT * FROM members WHERE id = ? FOR UPDATE',
          [data.member_id],
        );
        const member = memberRows[0];
        if (!member) return { code: 404, msg: '会员不存在', data: null };
        if (Number(member.available_points) < pointsNeeded) {
          return { code: 400, msg: '积分不足', data: null };
        }

        const orderNo = `ORD${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const totalAmount = parseFloat(product.cash_price || '0') * data.quantity;
        const [orderResult] = await connection.query<ResultSetHeader>(
          `INSERT INTO mall_orders
             (order_no, member_id, product_id, product_name, quantity, total_amount, points_used, cash_amount,
              actual_amount, referrer_id, status, payment_method, contact_name, contact_phone, shipping_address, remark)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'points', ?, ?, ?, ?)`,
          [
            orderNo,
            data.member_id,
            data.product_id,
            product.name,
            data.quantity,
            totalAmount.toString(),
            pointsNeeded,
            '0',
            '0',
            data.referrer_id || null,
            contactName,
            contactPhone,
            shippingAddress,
            String(data.remark || '').trim() || null,
          ],
        );

        const balanceAfter = Number(member.available_points) - pointsNeeded
        await connection.query(
          'UPDATE members SET available_points = GREATEST(0, ?), updated_at = NOW() WHERE id = ?',
          [balanceAfter, data.member_id],
        );
        await connection.query(
          'UPDATE mall_products SET stock = stock - ?, sales_count = sales_count + ?, updated_at = NOW() WHERE id = ?',
          [data.quantity, data.quantity, data.product_id],
        );

        await this.writePointsSpendRecord(connection, {
          memberId: data.member_id,
          points: pointsNeeded,
          balanceAfter,
          orderId: orderResult.insertId,
          description: `积分兑换「${product.name}」x${data.quantity}`,
        })

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
        return { code: 200, msg: '支付成功，等待发货', data: this.formatOrder(orderRows[0] || null) };
      }).then(async (result) => {
        if (result?.code === 200) {
          void this.pointsEngine
            .evaluate(data.member_id, 'mall_exchange', {
              referenceType: 'mall_order',
              referenceId: result.data?.id,
              description: '完成商城兑换奖励积分',
            })
            .catch((err) => this.logger.warn(`mall_exchange points failed: ${err?.message || err}`))
          this.grantInviteMallReward(data.member_id, result.data?.id)
        }
        return result
      })
    } catch (error) {
      this.logger.error('创建订单失败', error);
      return { code: 500, msg: '创建订单失败', data: null };
    }
  }

  /** 写入积分消耗流水，兼容多套表结构 */
  private async writePointsSpendRecord(
    connection: PoolConnection,
    payload: {
      memberId: string | number
      points: number
      balanceAfter: number
      orderId: string | number
      description: string
    },
  ) {
    const attempts: Array<{ sql: string; params: any[] }> = [
      {
        sql: `INSERT INTO points_records (member_id, type, amount, balance, source, source_id, description)
              VALUES (?, 'spend', ?, ?, 'mall', ?, ?)`,
        params: [
          payload.memberId,
          payload.points,
          payload.balanceAfter,
          String(payload.orderId),
          payload.description,
        ],
      },
      {
        sql: `INSERT INTO points_records (member_id, type, points, description)
              VALUES (?, 'spend', ?, ?)`,
        params: [payload.memberId, payload.points, payload.description],
      },
      {
        sql: `INSERT INTO points_records (user_id, type, amount, description, related_id)
              VALUES (?, 'spend', ?, ?, ?)`,
        params: [
          payload.memberId,
          -Math.abs(payload.points),
          payload.description,
          String(payload.orderId),
        ],
      },
    ]

    let lastError: unknown = null
    for (const attempt of attempts) {
      try {
        await connection.query(attempt.sql, attempt.params)
        return
      } catch (error) {
        lastError = error
      }
    }
    this.logger.warn(
      `points_records insert failed after fallbacks: ${(lastError as Error)?.message || lastError}`,
    )
  }

  /** 购物车一次性结算（仅积分），同一事务校验并扣减积分、生成订单 */
  async checkout(data: {
    member_id: string
    items: Array<{ product_id: string; quantity: number }>
    contact_name: string
    contact_phone: string
    shipping_address: string
    remark?: string
    referrer_id?: string
  }) {
    const contactName = String(data.contact_name || '').trim()
    const contactPhone = String(data.contact_phone || '').trim()
    const shippingAddress = String(data.shipping_address || '').trim()
    if (!contactName || !contactPhone || !shippingAddress) {
      return { code: 400, msg: '请填写收货人、手机号与收货地址', data: null }
    }

    const items = (data.items || [])
      .map((item) => ({
        product_id: String(item?.product_id || ''),
        quantity: Math.floor(Number(item?.quantity) || 0),
      }))
      .filter((item) => item.product_id && item.quantity > 0)
    if (!items.length) return { code: 400, msg: '请选择商品', data: null }

    try {
      return await withTransaction(async (connection) => {
        const [memberRows] = await connection.query<MemberRow[]>(
          'SELECT * FROM members WHERE id = ? FOR UPDATE',
          [data.member_id],
        )
        const member = memberRows[0]
        if (!member) return { code: 404, msg: '会员不存在', data: null }

        const prepared: Array<{
          product: ProductRow
          quantity: number
          pointsNeeded: number
          cashAmount: number
        }> = []
        let totalPointsNeeded = 0

        for (const item of items) {
          const [productRows] = await connection.query<ProductRow[]>(
            'SELECT * FROM mall_products WHERE id = ? FOR UPDATE',
            [item.product_id],
          )
          const product = productRows[0]
          if (!product) return { code: 404, msg: `商品不存在（#${item.product_id}）`, data: null }
          if (product.status !== 'active') {
            return { code: 400, msg: `「${product.name}」已下架`, data: null }
          }
          if (product.stock < item.quantity) {
            return { code: 400, msg: `「${product.name}」库存不足`, data: null }
          }
          const pointsNeeded = Number(product.points_price) * item.quantity
          if (!Number.isFinite(pointsNeeded) || pointsNeeded <= 0) {
            return { code: 400, msg: `「${product.name}」积分价格无效`, data: null }
          }
          totalPointsNeeded += pointsNeeded
          prepared.push({
            product,
            quantity: item.quantity,
            pointsNeeded,
            cashAmount: parseFloat(product.cash_price || '0') * item.quantity,
          })
        }

        const available = Number(member.available_points || 0)
        if (available < totalPointsNeeded) {
          return {
            code: 400,
            msg: `积分不足，需要 ${totalPointsNeeded}，当前可用 ${available}`,
            data: null,
          }
        }

        let balance = available
        const orders: any[] = []
        for (const row of prepared) {
          balance -= row.pointsNeeded
          const orderNo = `ORD${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`
          const [orderResult] = await connection.query<ResultSetHeader>(
            `INSERT INTO mall_orders
               (order_no, member_id, product_id, product_name, quantity, total_amount, points_used, cash_amount,
                actual_amount, referrer_id, status, payment_method, contact_name, contact_phone, shipping_address, remark)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'points', ?, ?, ?, ?)`,
            [
              orderNo,
              data.member_id,
              row.product.id,
              row.product.name,
              row.quantity,
              row.cashAmount.toString(),
              row.pointsNeeded,
              '0',
              '0',
              data.referrer_id || null,
              contactName,
              contactPhone,
              shippingAddress,
              String(data.remark || '').trim() || null,
            ],
          )

          await connection.query(
            'UPDATE mall_products SET stock = stock - ?, sales_count = sales_count + ?, updated_at = NOW() WHERE id = ?',
            [row.quantity, row.quantity, row.product.id],
          )

          await this.writePointsSpendRecord(connection, {
            memberId: data.member_id,
            points: row.pointsNeeded,
            balanceAfter: balance,
            orderId: orderResult.insertId,
            description: `积分兑换「${row.product.name}」x${row.quantity}`,
          })

          if (data.referrer_id && row.product.enable_distribution) {
            await this.processDistribution(
              connection,
              data.referrer_id,
              data.member_id,
              String(orderResult.insertId),
              row.product,
            )
          }

          const [orderRows] = await connection.query<RowDataPacket[]>(
            'SELECT * FROM mall_orders WHERE id = ?',
            [orderResult.insertId],
          )
          orders.push(this.formatOrder(orderRows[0] || null))
        }

        await connection.query(
          'UPDATE members SET available_points = GREATEST(0, ?), updated_at = NOW() WHERE id = ?',
          [balance, data.member_id],
        )

        return {
          code: 200,
          msg: '支付成功，等待发货',
          data: {
            orders,
            points_used: totalPointsNeeded,
            available_points: balance,
          },
        }
      }).then(async (result) => {
        if (result?.code === 200) {
          void this.pointsEngine
            .evaluate(data.member_id, 'mall_exchange', {
              referenceType: 'mall_checkout',
              referenceId: result.data?.orders?.[0]?.id,
              description: '完成商城兑换奖励积分',
            })
            .catch((err) => this.logger.warn(`mall_exchange points failed: ${err?.message || err}`))
          this.grantInviteMallReward(data.member_id, result.data?.orders?.[0]?.id)
        }
        return result
      })
    } catch (error) {
      this.logger.error('购物车结算失败', error)
      return { code: 500, msg: '支付失败，请稍后重试', data: null }
    }
  }

  async getMemberOrders(memberId: string, status?: string) {
    try {
      let sql = `SELECT o.*, p.image_url AS product_image
                 FROM mall_orders o
                 LEFT JOIN mall_products p ON p.id = o.product_id
                 WHERE o.member_id = ?`
      const params: any[] = [memberId]
      if (status && status !== 'all') {
        sql += ' AND o.status = ?'
        params.push(status)
      }
      sql += ' ORDER BY o.created_at DESC'
      const rows = await queryRows(sql, params)
      const signed = await this.uploadService.signRowsFields(rows || [], ['product_image'])
      return { code: 200, msg: 'success', data: (signed || []).map((r) => this.formatOrder(r)) }
    } catch (error) {
      this.logger.error('获取订单列表失败', error)
      return { code: 500, msg: '获取订单列表失败', data: null }
    }
  }

  async getOrderById(id: string, memberId?: string) {
    try {
      const row = await queryOne('SELECT * FROM mall_orders WHERE id = ?', [id])
      if (!row) return { code: 404, msg: '订单不存在', data: null }
      if (memberId && String((row as any).member_id) !== String(memberId)) {
        return { code: 403, msg: '无权查看该订单', data: null }
      }
      let productImage: string | null = null
      try {
        const product = await queryOne<ProductRow>('SELECT image_url FROM mall_products WHERE id = ?', [
          (row as any).product_id,
        ])
        if (product?.image_url) {
          const signed = await this.uploadService.signRowFields(product, ['image_url'])
          productImage = (signed?.image_url as string) || product.image_url
        }
      } catch {
        /* ignore */
      }
      return {
        code: 200,
        msg: 'success',
        data: { ...this.formatOrder(row), product_image: productImage },
      }
    } catch (error) {
      this.logger.error('获取订单详情失败', error)
      return { code: 500, msg: '获取订单详情失败', data: null }
    }
  }

  async confirmReceipt(orderId: string, memberId: string) {
    try {
      const row = await queryOne<RowDataPacket>('SELECT * FROM mall_orders WHERE id = ?', [orderId])
      if (!row) return { code: 404, msg: '订单不存在', data: null }
      if (String(row.member_id) !== String(memberId)) {
        return { code: 403, msg: '无权操作该订单', data: null }
      }
      if (row.status !== 'shipped') {
        return { code: 400, msg: '仅已发货订单可确认收货', data: null }
      }
      await queryExecute(
        `UPDATE mall_orders SET status = 'completed', received_at = NOW(), updated_at = NOW() WHERE id = ?`,
        [orderId],
      )
      return this.getOrderById(orderId, memberId)
    } catch (error) {
      this.logger.error('确认收货失败', error)
      return { code: 500, msg: '确认收货失败', data: null }
    }
  }

  async shipOrder(
    orderId: string,
    data: { logistics_company: string; logistics_no: string },
  ) {
    const company = String(data.logistics_company || '').trim()
    const logisticsNo = String(data.logistics_no || '').trim()
    if (!company || !logisticsNo) {
      return { code: 400, msg: '请填写物流公司与运单号', data: null }
    }
    try {
      const row = await queryOne<RowDataPacket>('SELECT * FROM mall_orders WHERE id = ?', [orderId])
      if (!row) return { code: 404, msg: '订单不存在', data: null }
      if (row.status !== 'paid' && row.status !== 'pending') {
        return { code: 400, msg: '当前状态不可发货', data: null }
      }
      await queryExecute(
        `UPDATE mall_orders
         SET status = 'shipped', logistics_company = ?, logistics_no = ?, shipped_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [company, logisticsNo, orderId],
      )
      return this.getOrderById(orderId)
    } catch (error) {
      this.logger.error('发货失败', error)
      return { code: 500, msg: '发货失败', data: null }
    }
  }

  async getAllOrders(status?: string) {
    try {
      let sql = `SELECT o.*, m.name AS member_name, m.phone AS member_phone
                 FROM mall_orders o
                 LEFT JOIN members m ON m.id = o.member_id`
      const params: any[] = []
      if (status && status !== 'all') {
        sql += ' WHERE o.status = ?'
        params.push(status)
      }
      sql += ' ORDER BY o.created_at DESC LIMIT 200'
      const rows = await queryRows(sql, params)
      return { code: 200, msg: 'success', data: (rows || []).map((r) => this.formatOrder(r)) }
    } catch (error) {
      this.logger.error('获取全部订单失败', error)
      return { code: 500, msg: '获取订单失败', data: null }
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
