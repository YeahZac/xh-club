import { relations } from "drizzle-orm"
import { members, memberTags, organizations, memberOrganizations, projects, financing, resources, events, eventRegistrations, roadshows, transactions, pointsRecords, pointsExchanges, mallProducts, posts, comments, messages, notifications, banners, systemConfig, admins } from "./schema"

// ============================================================
// 会员关系
// ============================================================
export const membersRelations = relations(members, ({ many, one }) => ({
  tags: many(memberTags),
  organizations: many(memberOrganizations),
  projects: many(projects, { relationName: "projectOwner" }),
  posts: many(posts),
  referrer: one(members, { fields: [members.referrer_id], references: [members.id], relationName: "referrer" }),
  approvedBy: one(members, { fields: [members.approved_by], references: [members.id], relationName: "approver" }),
}))

export const memberTagsRelations = relations(memberTags, ({ one }) => ({
  member: one(members, { fields: [memberTags.member_id], references: [members.id] }),
}))

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  parent: one(organizations, { fields: [organizations.parent_id], references: [organizations.id], relationName: "orgParent" }),
  children: many(organizations, { relationName: "orgParent" }),
  members: many(memberOrganizations),
  leader: one(members, { fields: [organizations.leader_id], references: [members.id] }),
}))

export const memberOrganizationsRelations = relations(memberOrganizations, ({ one }) => ({
  member: one(members, { fields: [memberOrganizations.member_id], references: [members.id] }),
  organization: one(organizations, { fields: [memberOrganizations.org_id], references: [organizations.id] }),
}))

// ============================================================
// 项目关系
// ============================================================
export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(members, { fields: [projects.owner_id], references: [members.id], relationName: "projectOwner" }),
  financing: many(financing),
  roadshows: many(roadshows),
}))

export const financingRelations = relations(financing, ({ one }) => ({
  project: one(projects, { fields: [financing.project_id], references: [projects.id] }),
}))

export const resourcesRelations = relations(resources, ({ one }) => ({
  member: one(members, { fields: [resources.member_id], references: [members.id] }),
}))

// ============================================================
// 活动关系
// ============================================================
export const eventsRelations = relations(events, ({ one, many }) => ({
  organizer: one(members, { fields: [events.organizer_id], references: [members.id] }),
  organization: one(organizations, { fields: [events.org_id], references: [organizations.id] }),
  registrations: many(eventRegistrations),
  roadshows: many(roadshows),
}))

export const eventRegistrationsRelations = relations(eventRegistrations, ({ one }) => ({
  event: one(events, { fields: [eventRegistrations.event_id], references: [events.id] }),
  member: one(members, { fields: [eventRegistrations.member_id], references: [members.id] }),
}))

export const roadshowsRelations = relations(roadshows, ({ one }) => ({
  project: one(projects, { fields: [roadshows.project_id], references: [projects.id] }),
  event: one(events, { fields: [roadshows.event_id], references: [events.id] }),
  presenter: one(members, { fields: [roadshows.presenter_id], references: [members.id] }),
}))

// ============================================================
// 交易关系
// ============================================================
export const transactionsRelations = relations(transactions, ({ one }) => ({
  partyA: one(members, { fields: [transactions.party_a_id], references: [members.id], relationName: "partyA" }),
  partyB: one(members, { fields: [transactions.party_b_id], references: [members.id], relationName: "partyB" }),
  matcher: one(members, { fields: [transactions.matcher_id], references: [members.id], relationName: "matcher" }),
}))

export const pointsRecordsRelations = relations(pointsRecords, ({ one }) => ({
  member: one(members, { fields: [pointsRecords.member_id], references: [members.id] }),
}))

export const pointsExchangesRelations = relations(pointsExchanges, ({ one }) => ({
  member: one(members, { fields: [pointsExchanges.member_id], references: [members.id] }),
  product: one(mallProducts, { fields: [pointsExchanges.product_id], references: [mallProducts.id] }),
}))

// ============================================================
// 社区关系
// ============================================================
export const postsRelations = relations(posts, ({ one, many }) => ({
  member: one(members, { fields: [posts.member_id], references: [members.id] }),
  comments: many(comments),
}))

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, { fields: [comments.post_id], references: [posts.id] }),
  member: one(members, { fields: [comments.member_id], references: [members.id] }),
  parent: one(comments, { fields: [comments.parent_id], references: [comments.id], relationName: "commentParent" }),
}))

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(members, { fields: [messages.sender_id], references: [members.id], relationName: "sender" }),
  receiver: one(members, { fields: [messages.receiver_id], references: [members.id], relationName: "receiver" }),
}))

export const notificationsRelations = relations(notifications, ({ one }) => ({
  member: one(members, { fields: [notifications.member_id], references: [members.id] }),
}))
