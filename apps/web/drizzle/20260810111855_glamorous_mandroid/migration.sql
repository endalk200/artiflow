CREATE TABLE "account" (
	"access_token" text,
	"access_token_expires_at" timestamp,
	"account_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY,
	"id_token" text,
	"password" text,
	"provider_id" text NOT NULL,
	"refresh_token" text,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"updated_at" timestamp NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY,
	"ip_address" text,
	"token" text NOT NULL UNIQUE,
	"updated_at" timestamp NOT NULL,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"id" text PRIMARY KEY,
	"image" text,
	"name" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_code" (
	"client_id" text,
	"device_code" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY,
	"last_polled_at" timestamp,
	"polling_interval" integer,
	"scope" text,
	"status" text NOT NULL,
	"user_code" text NOT NULL,
	"user_id" text
);
--> statement-breakpoint
DROP INDEX "projects_creation_idempotency_key_unique";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_owner_creation_idempotency_key_unique" ON "projects" ("owner_user_id","creation_idempotency_key");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_user_id_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "user"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_required" CHECK ("owner_user_id" IS NOT NULL) NOT VALID;
