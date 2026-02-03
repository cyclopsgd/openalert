CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"team_id" integer,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" integer,
	"old_values" jsonb,
	"new_values" jsonb,
	"metadata" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(255) NOT NULL,
	"value" jsonb,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"integration_key" varchar(64) NOT NULL,
	"method" varchar(10) NOT NULL,
	"path" varchar(500) NOT NULL,
	"status_code" integer NOT NULL,
	"request_headers" jsonb,
	"request_body" jsonb,
	"response_body" jsonb,
	"user_agent" text,
	"ip_address" varchar(45),
	"processing_time_ms" integer,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "external_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_provider" varchar(50) DEFAULT 'local';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_logs_integration_key_idx" ON "webhook_logs" ("integration_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_logs_created_at_idx" ON "webhook_logs" ("created_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
