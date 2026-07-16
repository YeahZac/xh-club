import { mysqlTable, int, varchar, text, decimal, boolean, timestamp, json, index, serial } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

// ============================================================
// 系统表
// ============================================================
export const healthCheck = mysqlTable("health_check", {
  id: serial("id").primaryKey(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================
// 1. 会员体系
// ============================================================

export const members = mysqlTable("members", {
  id: varchar("id", { length: 36 }).default(sql`(UUID())`).primaryKey().notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  wx_openid: varchar("wx_openid", { length: 128 }),
  password_hash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  avatar: varchar("avatar", { length: 500 }),
  gender: varchar("gender", { length: 10 }),
  birthday: varchar("birthday", { length: 20 }),
  company_name: varchar("company_name", { length: 255 }),
  company_position: varchar("company_position", { length: 128 }),
  industry_primary: varchar("industry_primary", { length: 64 }),
  industry_secondary: varchar("industry_secondary", { length: 64 }),
  company_scale: varchar("company_scale", { length: 32 }),
  company_founded: varchar("company_founded", { length: 10 }),
  company_address: varchar("company_address", { length: 500 }),
  company_website: varchar("company_website", { length: 500 }),
  business_description: text("business_description"),
  core_advantage: varchar("core_advantage", { length: 500 }),
  resources_supply: text("resources_supply"),
  resources_demand: text("resources_demand"),
  city: varchar("city", { length: 64 }),
  wechat_id: varchar("wechat_id", { length: 128 }),
  bio: text("bio"),
  member_type: varchar("member_type", { length: 32 }).notNull().default("unpaid"),
  membership_level: varchar("membership_level", { length: 32 }).notNull().default("normal"),
  credit_score: int("credit_score").notNull().default(60),
  active_score: int("active_score").notNull().default(0),
  contribution_score: int("contribution_score").notNull().default(0),
  total_points: int("total_points").notNull().default(0),
  available_points: int("available_points").notNull().default(0),
  referrer_id: varchar("referrer_id", { length: 36 }),
  join_source: varchar("join_source", { length: 64 }),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  approved_at: timestamp("approved_at"),
  approved_by: varchar("approved_by", { length: 36 }),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").onUpdateNow(),
}, (table) => [
  index("members_phone_idx").on(table.phone),
  index("members_wx_openid_idx").on(table.wx_openid),
  index("members_status_idx").on(table.status),
  index("members_referrer_id_idx").on(table.referrer_id),
  index("members_member_type_idx").on(table.member_type),
  index("members_city_idx").on(table.city),
  index("members_industry_primary_idx").on(table.industry_primary),
  index("members_created_at_idx").on(table.created_at),
]);

// ============================================================
// 2. 项目与商机
// ============================================================

export const projects = mysqlTable("projects", {
  id: varchar("id", { length: 36 }).default(sql`(UUID())`).primaryKey().notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  cover_image: varchar("cover_image", { length: 500 }).notNull(),
  video_url: varchar("video_url", { length: 500 }),
  industry: varchar("industry", { length: 64 }),
  stage: varchar("stage", { length: 32 }),
  amount_min: decimal("amount_min", { precision: 14, scale: 2 }),
  amount_max: decimal("amount_max", { precision: 14, scale: 2 }),
  amount_raised: decimal("amount_raised", { precision: 14, scale: 2 }).default("0"),
  status: varchar("status", { length: 32 }).notNull().default("draft"),
  owner_id: varchar("owner_id", { length: 36 }).notNull(),
  is_featured: boolean("is_featured").notNull().default(false),
  view_count: int("view_count").notNull().default(0),
  tags_json: json("tags_json"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").onUpdateNow(),
}, (table) => [
  index("projects_status_idx").on(table.status),
  index("projects_owner_id_idx").on(table.owner_id),
  index("projects_industry_idx").on(table.industry),
  index("projects_is_featured_idx").on(table.is_featured),
  index("projects_created_at_idx").on(table.created_at),
]);

// ============================================================
// 3. 活动
// ============================================================

export const events = mysqlTable("events", {
  id: varchar("id", { length: 36 }).default(sql`(UUID())`).primaryKey().notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  cover_image: varchar("cover_image", { length: 500 }).notNull(),
  video_url: varchar("video_url", { length: 500 }),
  event_type: varchar("event_type", { length: 32 }).notNull(),
  start_time: timestamp("start_time").notNull(),
  end_time: timestamp("end_time").notNull(),
  location: varchar("location", { length: 500 }),
  max_participants: int("max_participants"),
  current_participants: int("current_participants").notNull().default(0),
  fee: decimal("fee", { precision: 10, scale: 2 }).default("0"),
  organizer_id: varchar("organizer_id", { length: 36 }),
  org_id: varchar("org_id", { length: 36 }),
  status: varchar("status", { length: 32 }).notNull().default("draft"),
  is_featured: boolean("is_featured").notNull().default(false),
  form_fields: json("form_fields"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").onUpdateNow(),
}, (table) => [
  index("events_status_idx").on(table.status),
  index("events_event_type_idx").on(table.event_type),
  index("events_organizer_id_idx").on(table.organizer_id),
  index("events_start_time_idx").on(table.start_time),
  index("events_is_featured_idx").on(table.is_featured),
]);

// ============================================================
// 4. 商城
// ============================================================

export const mallProducts = mysqlTable("mall_products", {
  id: varchar("id", { length: 36 }).default(sql`(UUID())`).primaryKey().notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  image_url: varchar("image_url", { length: 500 }).notNull(),
  video_url: varchar("video_url", { length: 500 }),
  points_price: int("points_price").notNull(),
  cash_price: decimal("cash_price", { precision: 10, scale: 2 }),
  stock: int("stock").notNull().default(0),
  category: varchar("category", { length: 32 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  sort_order: int("sort_order").notNull().default(0),
  enable_distribution: boolean("enable_distribution").notNull().default(false),
  distribution_rate: decimal("distribution_rate", { precision: 5, scale: 2 }).default("0"),
  sales_count: int("sales_count").notNull().default(0),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").onUpdateNow(),
}, (table) => [
  index("mall_products_category_idx").on(table.category),
  index("mall_products_status_idx").on(table.status),
  index("mall_products_sort_order_idx").on(table.sort_order),
]);

export const mallOrders = mysqlTable("mall_orders", {
  id: varchar("id", { length: 36 }).default(sql`(UUID())`).primaryKey().notNull(),
  order_no: varchar("order_no", { length: 64 }).notNull(),
  member_id: varchar("member_id", { length: 36 }).notNull(),
  product_id: varchar("product_id", { length: 36 }).notNull(),
  product_name: varchar("product_name", { length: 255 }).notNull(),
  quantity: int("quantity").notNull().default(1),
  total_amount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  points_used: int("points_used").notNull().default(0),
  cash_amount: decimal("cash_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  referrer_id: varchar("referrer_id", { length: 36 }),
  distribution_amount: decimal("distribution_amount", { precision: 10, scale: 2 }).default("0"),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").onUpdateNow(),
}, (table) => [
  index("mall_orders_member_id_idx").on(table.member_id),
  index("mall_orders_product_id_idx").on(table.product_id),
  index("mall_orders_status_idx").on(table.status),
  index("mall_orders_created_at_idx").on(table.created_at),
  index("mall_orders_referrer_id_idx").on(table.referrer_id),
]);

// ============================================================
// 5. 分销
// ============================================================

export const distributionRelations = mysqlTable("distribution_relations", {
  id: varchar("id", { length: 36 }).default(sql`(UUID())`).primaryKey().notNull(),
  parent_id: varchar("parent_id", { length: 36 }).notNull(),
  child_id: varchar("child_id", { length: 36 }).notNull(),
  level: int("level").notNull().default(1),
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("distribution_relations_parent_id_idx").on(table.parent_id),
  index("distribution_relations_child_id_idx").on(table.child_id),
  index("distribution_relations_level_idx").on(table.level),
]);

export const distributionEarnings = mysqlTable("distribution_earnings", {
  id: varchar("id", { length: 36 }).default(sql`(UUID())`).primaryKey().notNull(),
  member_id: varchar("member_id", { length: 36 }).notNull(),
  order_id: varchar("order_id", { length: 36 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  rate: decimal("rate", { precision: 5, scale: 2 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("distribution_earnings_member_id_idx").on(table.member_id),
  index("distribution_earnings_order_id_idx").on(table.order_id),
  index("distribution_earnings_status_idx").on(table.status),
]);
