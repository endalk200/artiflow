CREATE TABLE "user" (
	"id" TEXT NOT NULL,
	"name" TEXT NOT NULL,
	"email" TEXT NOT NULL,
	"emailVerified" BOOLEAN NOT NULL DEFAULT false,
	"image" TEXT,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,

	CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "session" (
	"id" TEXT NOT NULL,
	"expiresAt" TIMESTAMP(3) NOT NULL,
	"token" TEXT NOT NULL,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,
	"ipAddress" TEXT,
	"userAgent" TEXT,
	"userId" TEXT NOT NULL,

	CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "account" (
	"id" TEXT NOT NULL,
	"accountId" TEXT NOT NULL,
	"providerId" TEXT NOT NULL,
	"userId" TEXT NOT NULL,
	"accessToken" TEXT,
	"refreshToken" TEXT,
	"idToken" TEXT,
	"accessTokenExpiresAt" TIMESTAMP(3),
	"refreshTokenExpiresAt" TIMESTAMP(3),
	"scope" TEXT,
	"password" TEXT,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,

	CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "verification" (
	"id" TEXT NOT NULL,
	"identifier" TEXT NOT NULL,
	"value" TEXT NOT NULL,
	"expiresAt" TIMESTAMP(3) NOT NULL,
	"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3),

	CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");
CREATE INDEX "session_userId_idx" ON "session"("userId");
CREATE INDEX "account_userId_idx" ON "account"("userId");
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

ALTER TABLE "session"
	ADD CONSTRAINT "session_userId_fkey"
	FOREIGN KEY ("userId") REFERENCES "user"("id")
	ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "account"
	ADD CONSTRAINT "account_userId_fkey"
	FOREIGN KEY ("userId") REFERENCES "user"("id")
	ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "user" (
	"id",
	"name",
	"email",
	"emailVerified",
	"createdAt",
	"updatedAt"
)
VALUES (
	'legacy-post-owner',
	'Legacy Post Owner',
	'legacy-post-owner@support.endalk200.com',
	true,
	CURRENT_TIMESTAMP,
	CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO NOTHING;

ALTER TABLE "posts" ADD COLUMN "user_id" TEXT;

UPDATE "posts"
SET "user_id" = 'legacy-post-owner'
WHERE "user_id" IS NULL;

ALTER TABLE "posts" ALTER COLUMN "user_id" SET NOT NULL;

ALTER TABLE "posts"
	ADD CONSTRAINT "posts_user_id_fkey"
	FOREIGN KEY ("user_id") REFERENCES "user"("id")
	ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "posts_id_user_id_key" ON "posts"("id", "user_id");
CREATE INDEX "posts_user_id_created_at_idx" ON "posts"("user_id", "created_at");
