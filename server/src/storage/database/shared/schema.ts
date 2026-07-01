import { pgTable, serial, timestamp, varchar, integer, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const eventRegistrations = pgTable(
	"event_registrations",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		name: varchar("name", { length: 128 }).notNull(),
		gender: varchar("gender", { length: 10 }).notNull(),
		birthday: varchar("birthday", { length: 20 }).notNull(),
		age: integer("age"),
		industry: varchar("industry", { length: 128 }).notNull(),
		phone: varchar("phone", { length: 32 }).notNull(),
		contact_method: varchar("contact_method", { length: 128 }),
		referrer: varchar("referrer", { length: 128 }),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("event_registrations_phone_idx").on(table.phone),
		index("event_registrations_created_at_idx").on(table.created_at),
	]
);
