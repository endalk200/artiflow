import {
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

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
		updatedAt: timestamp("updated_at", {
			mode: "string",
			withTimezone: true,
		}).notNull(),
	},
	(table) => [
		uniqueIndex("projects_creation_idempotency_key_unique").on(
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
