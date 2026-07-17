CREATE TABLE "artifacts" (
	"created_at" timestamp with time zone NOT NULL,
	"current_revision_number" integer NOT NULL,
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"created_at" timestamp with time zone NOT NULL,
	"creation_idempotency_key" text NOT NULL,
	"creation_request_hash" text NOT NULL,
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revisions" (
	"artifact_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"description" text,
	"id" text PRIMARY KEY,
	"number" integer NOT NULL,
	"publication_idempotency_key" text NOT NULL,
	"publication_request_hash" text NOT NULL,
	"source" text NOT NULL,
	"source_format_version" integer NOT NULL,
	"title" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "projects_creation_idempotency_key_unique" ON "projects" ("creation_idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "revisions_artifact_number_unique" ON "revisions" ("artifact_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "revisions_publication_idempotency_key_unique" ON "revisions" ("publication_idempotency_key");--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_artifact_id_artifacts_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE CASCADE;