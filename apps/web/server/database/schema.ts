import {
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

export const authUserTable = pgTable("user", {
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	id: text("id").primaryKey(),
	image: text("image"),
	name: text("name").notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const authSessionTable = pgTable(
	"session",
	{
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		id: text("id").primaryKey(),
		ipAddress: text("ip_address"),
		token: text("token").notNull().unique(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.$onUpdate(() => new Date())
			.notNull(),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => authUserTable.id, { onDelete: "cascade" }),
	},
	(table) => [index("session_userId_idx").on(table.userId)],
);

export const authAccountTable = pgTable(
	"account",
	{
		accessToken: text("access_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", {
			withTimezone: true,
		}),
		accountId: text("account_id").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		id: text("id").primaryKey(),
		idToken: text("id_token"),
		password: text("password"),
		providerId: text("provider_id").notNull(),
		refreshToken: text("refresh_token"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
			withTimezone: true,
		}),
		scope: text("scope"),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.$onUpdate(() => new Date())
			.notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => authUserTable.id, { onDelete: "cascade" }),
	},
	(table) => [index("account_userId_idx").on(table.userId)],
);

export const authVerificationTable = pgTable(
	"verification",
	{
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
		value: text("value").notNull(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const deviceCodeTable = pgTable("device_code", {
	clientId: text("client_id"),
	deviceCode: text("device_code").notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	id: text("id").primaryKey(),
	lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
	pollingInterval: integer("polling_interval"),
	scope: text("scope"),
	status: text("status").notNull(),
	userCode: text("user_code").notNull(),
	userId: text("user_id"),
});

export const projectsTable = pgTable(
	"projects",
	{
		createdAt: timestamp("created_at", {
			mode: "string",
			withTimezone: true,
		}).notNull(),
		creationIdempotencyKey: text("creation_idempotency_key").notNull(),
		creationRequestHash: text("creation_request_hash").notNull(),
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		ownerUserId: text("owner_user_id").references(() => authUserTable.id, {
			onDelete: "cascade",
		}),
		updatedAt: timestamp("updated_at", {
			mode: "string",
			withTimezone: true,
		}).notNull(),
	},
	(table) => [
		uniqueIndex("projects_owner_creation_idempotency_key_unique").on(
			table.ownerUserId,
			table.creationIdempotencyKey,
		),
	],
);

export const artifactsTable = pgTable("artifacts", {
	createdAt: timestamp("created_at", {
		mode: "string",
		withTimezone: true,
	}).notNull(),
	currentRevisionNumber: integer("current_revision_number").notNull(),
	id: text("id").primaryKey(),
	projectId: text("project_id")
		.notNull()
		.references(() => projectsTable.id, { onDelete: "cascade" }),
	updatedAt: timestamp("updated_at", {
		mode: "string",
		withTimezone: true,
	}).notNull(),
});

export const revisionsTable = pgTable(
	"revisions",
	{
		artifactId: text("artifact_id")
			.notNull()
			.references(() => artifactsTable.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", {
			mode: "string",
			withTimezone: true,
		}).notNull(),
		description: text("description"),
		id: text("id").primaryKey(),
		number: integer("number").notNull(),
		publicationIdempotencyKey: text("publication_idempotency_key").notNull(),
		publicationRequestHash: text("publication_request_hash").notNull(),
		source: text("source").notNull(),
		sourceFormatVersion: integer("source_format_version").notNull(),
		title: text("title").notNull(),
	},
	(table) => [
		uniqueIndex("revisions_artifact_number_unique").on(
			table.artifactId,
			table.number,
		),
		uniqueIndex("revisions_publication_idempotency_key_unique").on(
			table.publicationIdempotencyKey,
		),
	],
);
