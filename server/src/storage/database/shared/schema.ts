import { pgTable, serial, timestamp, index, varchar, integer, boolean, numeric, jsonb, text } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// ============================================================
// 系统表（保留，禁止删除）
// ============================================================
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ============================================================
// 1. 会员体系
// ============================================================

/** 会员主表 */
export const members = pgTable("members", {
  id: varchar("id", { length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
  phone: varchar("phone", { length: 32 }).notNull().unique(),
  password_hash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  avatar: varchar("avatar", { length: 500 }),
  gender: varchar("gender", { length: 10 }),
  birthday: varchar("birthday", { length: 20 }),

  // 公司信息
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

  // 个人信息
  city: varchar("city", { length: 64 }),
  wechat_id: varchar("wechat_id", { length: 128 }),
  bio: text("bio"),

  // 会员身份
  member_type: varchar("member_type", { length: 32 }).notNull().default("unpaid"), // paid/unpaid/promoter
  membership_level: varchar("membership_level", { length: 32 }).notNull().default("normal"), // normal/silver/gold/diamond
  credit_score: integer("credit_score").notNull().default(60),
  active_score: integer("active_score").notNull().default(0),
  contribution_score: integer("contribution_score").notNull().default(0),
  total_points: integer("total_points").notNull().default(0),
  available_points: integer("available_points").notNull().default(0),

  // 推荐关系
  referrer_id: varchar("referrer_id", { length: 36 }).references(() => members.id),
  join_source: varchar("join_source", { length: 64 }), // referral/self/invite/event

  // 状态
  status: varchar("status", { length: 32 }).notNull().default("pending"), // pending/active/frozen/exited
  approved_at: timestamp("approved_at", { withTimezone: true }),
  approved_by: varchar("approved_by", { length: 36 }).references(() => members.id),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
  index("members_phone_idx").on(table.phone),
  index("members_status_idx").on(table.status),
  index("members_referrer_id_idx").on(table.referrer_id),
  index("members_member_type_idx").on(table.member_type),
  index("members_city_idx").on(table.city),
  index("members_industry_primary_idx").on(table.industry_primary),
  index("members_created_at_idx").on(table.created_at),
]);

/** 会员标签表 */
export const memberTags = pgTable("member_tags", {
  id: varchar("id", { length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
  member_id: varchar("member_id", { length: 36 }).notNull().references(() => members.id, { onDelete: "cascade" }),
  tag_type: varchar("tag_type", { length: 32 }).notNull(), // identity/ability/resource/social/credit
  tag_value: varchar("tag_value", { length: 128 }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("member_tags_member_id_idx").on(table.member_id),
  index("member_tags_tag_type_idx").on(table.tag_type),
  index("member_tags_tag_value_idx").on(table.tag_value),
]);

/** 组织架构表（总会/分会/部门） */
export const organizations = pgTable("organizations", {
  id: varchar("id", { length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
  parent_id: varchar("parent_id", { length: 36 }).references(() => organizations.id),
  org_type: varchar("org_type", { length: 32 }).notNull(), // headquarters/branch/department
  name: varchar("name", { length: 128 }).notNull(),
  level: integer("level").notNull().default(0),
  leader_id: varchar("leader_id", { length: 36 }).references(() => members.id),
  description: text("description"),
  sort_order: integer("sort_order").notNull().default(0),
  status: varchar("status", { length: 32 }).notNull().default("active"), // active/inactive
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("organizations_parent_id_idx").on(table.parent_id),
  index("organizations_org_type_idx").on(table.org_type),
  index("organizations_sort_order_idx").on(table.sort_order),
]);

/** 会员-组织关联表 */
export const memberOrganizations = pgTable("member_organizations", {
  id: varchar("id", { length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
  member_id: varchar("member_id", { length: 36 }).notNull().references(() => members.id, { onDelete: "cascade" }),
  org_id: varchar("org_id", { length: 36 }).notNull().references(() => organizations.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 64 }).notNull().default("member"), // president/vice/secretary/director/member
  joined_at: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("member_organizations_member_id_idx").on(table.member_id),
  index("member_organizations_org_id_idx").on(table.org_id),
]);

// ============================================================
// 2. 项目与商机
// ============================================================

/** 项目表 */
export const projects = pgTable("projects", {
  id: varchar("id", { length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  cover_image: varchar("cover_image", { length: 500 }),
  industry: varchar("industry", { length: 64 }),
  stage: varchar("stage", { length: 32 }), // seed/angel/a/b/c/ipo
  amount_min: numeric("amount_min", { precision: 14, scale: 2 }),
  amount_max: numeric("amount_max", { precision: 14, scale: 2 }),
  amount_raised: numeric("amount_raised", { precision: 14, scale: 2 }).default("0"),
  status: varchar("status", { length: 32 }).notNull().default("draft"), // draft/active/funded/closed
  owner_id: varchar("owner_id", { length: 36 }).notNull().references(() => members.id),
  is_featured: boolean("is_featured").notNull().default(false),
  view_count: integer("view_count").notNull().default(0),
  tags_json: jsonb("tags_json"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
  index("projects_status_idx").on(table.status),
  index("projects_owner_id_idx").on(table.owner_id),
  index("projects_industry_idx").on(table.industry),
  index("projects_is_featured_idx").on(table.is_featured),
  index("projects_created_at_idx").on(table.created_at),
]);

/** 融资项目表 */
export const financing = pgTable("financing", {
  id: varchar("id", { length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
  project_id: varchar("project_id", { length: 36 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
  target_amount: numeric("target_amount", { precision: 14, scale: 2 }).notNull(),
  raised_amount: numeric("raised_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  valuation: numeric("valuation", { precision: 14, scale: 2 }),
  equity_ratio: numeric("equity_ratio", { precision: 5, scale: 2 }),
  deadline: timestamp("deadline", { withTimezone: true }),
  status: varchar("status", { length: 32 }).notNull().default("active"), // active/completed/failed
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("financing_project_id_idx").on(table.project_id),
  index("financing_status_idx").on(table.status),
]);

/** 资源供需表 */
export const resources = pgTable("resources", {
  id: varchar("id", { length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
  member_id: varchar("member_id", { length: 36 }).notNull().references(() => members.id),
  type: varchar("type", { length: 16 }).notNull(), // supply/demand
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 64 }),
  industry: varchar("industry", { length: 64 }),
  region: varchar("region", { length: 64 }),
  contact_info: varchar("contact_info", { length: 255 }),
  status: varchar("status", { length: 32 }).notNull().default("active"), // active/matched/closed
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("resources_member_id_idx").on(table.member_id),
  index("resources_type_idx").on(table.type),
  index("resources_category_idx").on(table.category),
  index("resources_status_idx").on(table.status),
  index("resources_created_at_idx").on(table.created_at),
]);

// ============================================================
// 3. 活动与路演
// ============================================================

/** 活动表 */
export const events = pgTable("events", {
  id: varchar("id", { length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  cover_image: varchar("cover_image", { length: 500 }),
  event_type: varchar("event_type", { length: 32 }).notNull(), // salon/roadshow/annual/training/meeting
  start_time: timestamp("start_time", { withTimezone: true }).notNull(),
  end_time: timestamp("end_time", { withTimezone: true }).notNull(),
  location: varchar("location", { length: 500 }),
  max_participants: integer("max_participants"),
  current_participants: integer("current_participants").notNull().default(0),
  fee: numeric("fee", { precision: 10, scale: 2 }).default("0"),
  organizer_id: varchar("organizer_id", { length: 36 }).references(() => members.id),
  org_id: varchar("org_id", { length: 36 }).references(() => organizations.id),
  status: varchar("status", { length: 32 }).notNull().default("draft"), // draft/open/full/ended/cancelled
  is_featured: boolean("is_featured").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
  index("events_status_idx").on(table.status),
  index("events_event_type_idx").on(table.event_type),
  index("events_organizer_id_idx").on(table.organizer_id),
  index("events_start_time_idx").on(table.start_time),
  index("events_is_featured_idx").on(table.is_featured),
]);

/** 活动报名表 */
export const eventRegistrations = pgTable("event_registrations", {
  id: varchar("id", { length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
  event_id: varchar("event_id", { length: 36 }).notNull().references(() => events.id, { onDelete: "cascade" }),
  member_id: varchar("member_id", { length: 36 }).notNull().references(() => members.id),
  status: varchar("status", { length: 32 }).notNull().default("registered"), // registered/confirmed/cancelled/attended
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("event_registrations_event_id_idx").on(table.event_id),
  index("event_registrations_member_id_idx").on(table.member_id),
  index("event_registrations_status_idx").on(table.status),
]);

/** 路演表 */
export const roadshows = pgTable("roadshows", {
  id: varchar("id", { length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
  project_id: varchar("project_id", { length: 36 }).notNull().references(() => projects.id),
  event_id: varchar("event_id", { length: 36 }).references(() => events.id),
  presenter_id: varchar("presenter_id", { length: 36 }).notNull().references(() => members.id),
  presentation_order: integer("presentation_order"),
  score_avg: numeric("score_avg", { precision: 5, scale: 2 }),
  status: varchar("status", { length: 32 }).notNull().default("scheduled"), // scheduled/live/completed
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("roadshows_project_id_idx").on(table.project_id),
  index("roadshows_event_id_idx").on(table.event_id),
  index("roadshows_presenter_id_idx").on(table.presenter_id),
]);

// ============================================================
// 4. 交易与积分
// ============================================================

/** 成交记录表 */
export const transactions = pgTable("transactions", {
  id: varchar("id", { length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
  project_name: varchar("project_name", { length: 255 }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  category: varchar("category", { length: 64 }),
  description: text("description"),
  party_a_id: varchar("party_a_id", { length: 36 }).notNull().references(() => members.id),
  party_b_id: varchar("party_b_id", { length: 36 }).notNull().references(() => members.id),
  matcher_id: varchar("matcher_id", { length: 36 }).references(() => members.id),
  status: varchar("status", { length: 32 }).notNull().default("pending"), // pending/confirmed/completed/disputed
  confirmed_by_a: boolean("confirmed_by_a").notNull().default(false),
  confirmed_by_b: boolean("confirmed_by_b").notNull().default(false),
  points_awarded: boolean("points_awarded").notNull().default(false),
  milestone_json: jsonb("milestone_json"),
  rating_a: integer("rating_a"),
  rating_b: integer("rating_b"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completed_at: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  index("transactions_party_a_id_idx").on(table.party_a_id),
  index("transactions_party_b_id_idx").on(table.party_b_id),
  index("transactions_matcher_id_idx").on(table.matcher_id),
  index("transactions_status_idx").on(table.status),
  index("transactions_created_at_idx").on(table.created_at),
]);

/** 积分流水表 */
export const pointsRecords = pgTable("points_records", {
  id: varchar("id", { length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
  member_id: varchar("member_id", { length: 36 }).notNull().references(() => members.id),
  type: varchar("type", { length: 16 }).notNull(), // earn/spend
  amount: integer("amount").notNull(),
  balance_after: integer("balance_after").notNull(),
  source: varchar("source", { length: 32 }).notNull(), // transaction/event/referral/mall/admin
  source_id: varchar("source_id", { length: 36 }),
  description: varchar("description", { length: 255 }),
  expires_at: timestamp("expires_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("points_records_member_id_idx").on(table.member_id),
  index("points_records_type_idx").on(table.type),
  index("points_records_source_idx").on(table.source),
  index("points_records_created_at_idx").on(table.created_at),
]);

/** 积分兑换记录表 */
export const pointsExchanges = pgTable("points_exchanges", {
  id: varchar("id", { length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
  member_id: varchar("member_id", { length: 36 }).notNull().references(() => members.id),
  product_id: varchar("product_id", { length: 36 }).notNull().references(() => mallProducts.id),
  points_cost: integer("points_cost").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("pending"), // pending/fulfilled/cancelled
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("points_exchanges_member_id_idx").on(table.member_id),
  index("points_exchanges_product_id_idx").on(table.product_id),
  index("points_exchanges_status_idx").on(table.status),
]);

// ============================================================
// 5. 社区与沟通
// ============================================================

/** 动态/帖子表 */
export const posts = pgTable("posts", {
  id: varchar("id", { length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
  member_id: varchar("member_id", { length: 36 }).notNull().references(() => members.id),
  type: varchar("type", { length: 32 }).notNull().default("insight"), // insight/project_update/achievement/thought
  title: varchar("title", { length: 255 }),
  content: text("content").notNull(),
  images_json: jsonb("images_json"),
  is_featured: boolean("is_featured").notNull().default(false),
  view_count: integer("view_count").notNull().default(0),
  like_count: integer("like_count").notNull().default(0),
  comment_count: integer("comment_count").notNull().default(0),
  status: varchar("status", { length: 32 }).notNull().default("published"), // draft/published/hidden
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
  index("posts_member_id_idx").on(table.member_id),
  index("posts_type_idx").on(table.type),
  index("posts_status_idx").on(table.status),
  index("posts_is_featured_idx").on(table.is_featured),
  index("posts_created_at_idx").on(table.created_at),
]);

/** 评论表 */
export const comments = pgTable("comments", {
  id: varchar("id", { length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
  post_id: varchar("post_id", { length: 36 }).notNull().references(() => posts.id, { onDelete: "cascade" }),
  member_id: varchar("member_id", { length: 36 }).notNull().references(() => members.id),
  content: text("content").notNull(),
  parent_id: varchar("parent_id", { length: 36 }).references(() => comments.id),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("comments_post_id_idx").on(table.post_id),
  index("comments_member_id_idx").on(table.member_id),
  index("comments_parent_id_idx").on(table.parent_id),
  index("comments_created_at_idx").on(table.created_at),
]);

/** 私信表 */
export const messages = pgTable("messages", {
  id: varchar("id", { length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
  sender_id: varchar("sender_id", { length: 36 }).notNull().references(() => members.id),
  receiver_id: varchar("receiver_id", { length: 36 }).notNull().references(() => members.id),
  content: text("content").notNull(),
  type: varchar("type", { length: 16 }).notNull().default("text"), // text/image/system
  is_read: boolean("is_read").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("messages_sender_id_idx").on(table.sender_id),
  index("messages_receiver_id_idx").on(table.receiver_id),
  index("messages_is_read_idx").on(table.is_read),
  index("messages_created_at_idx").on(table.created_at),
]);

/** 通知表 */
export const notifications = pgTable("notifications", {
  id: varchar("id", { length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
  member_id: varchar("member_id", { length: 36 }).notNull().references(() => members.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 32 }).notNull(), // system/activity/approval/commission/credit
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  is_read: boolean("is_read").notNull().default(false),
  link: varchar("link", { length: 500 }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("notifications_member_id_idx").on(table.member_id),
  index("notifications_type_idx").on(table.type),
  index("notifications_is_read_idx").on(table.is_read),
  index("notifications_created_at_idx").on(table.created_at),
]);

// ============================================================
// 6. 配置与管理
// ============================================================

/** 轮播图/Banner表 */
export const banners = pgTable("banners", {
  id: varchar("id", { length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  image_url: varchar("image_url", { length: 500 }).notNull(),
  link_type: varchar("link_type", { length: 32 }), // project/event/web/profile
  link_id: varchar("link_id", { length: 36 }),
  sort_order: integer("sort_order").notNull().default(0),
  is_active: boolean("is_active").notNull().default(true),
  start_time: timestamp("start_time", { withTimezone: true }),
  end_time: timestamp("end_time", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("banners_is_active_idx").on(table.is_active),
  index("banners_sort_order_idx").on(table.sort_order),
]);

/** 会员商城商品表 */
export const mallProducts = pgTable("mall_products", {
  id: varchar("id", { length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  image_url: varchar("image_url", { length: 500 }),
  points_price: integer("points_price").notNull(),
  cash_price: numeric("cash_price", { precision: 10, scale: 2 }),
  stock: integer("stock").notNull().default(0),
  category: varchar("category", { length: 32 }).notNull(), // rights/service/gift/activity/learning
  status: varchar("status", { length: 32 }).notNull().default("active"), // active/offline
  sort_order: integer("sort_order").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("mall_products_category_idx").on(table.category),
  index("mall_products_status_idx").on(table.status),
  index("mall_products_sort_order_idx").on(table.sort_order),
]);

/** 系统配置表 */
export const systemConfig = pgTable("system_config", {
  id: varchar("id", { length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
  config_key: varchar("config_key", { length: 128 }).notNull().unique(),
  config_value: text("config_value").notNull(),
  description: varchar("description", { length: 500 }),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("system_config_config_key_idx").on(table.config_key),
]);

/** 管理员表 */
export const admins = pgTable("admins", {
  id: varchar("id", { length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  password_hash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  role: varchar("role", { length: 32 }).notNull().default("admin"), // super_admin/admin/operator
  status: varchar("status", { length: 32 }).notNull().default("active"), // active/disabled
  last_login_at: timestamp("last_login_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("admins_username_idx").on(table.username),
  index("admins_role_idx").on(table.role),
]);
