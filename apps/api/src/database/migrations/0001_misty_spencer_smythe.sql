CREATE TABLE IF NOT EXISTS "status_page_components" (
	"id" serial PRIMARY KEY NOT NULL,
	"status_page_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'operational' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "status_page_incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"status_page_id" integer NOT NULL,
	"internal_incident_id" integer,
	"title" varchar(500) NOT NULL,
	"status" varchar(50) DEFAULT 'investigating' NOT NULL,
	"impact" varchar(50) DEFAULT 'minor' NOT NULL,
	"component_ids" jsonb,
	"scheduled_for" timestamp,
	"scheduled_until" timestamp,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "status_page_updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"incident_id" integer NOT NULL,
	"status" varchar(50) NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "status_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"team_id" integer NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"custom_domain" varchar(255),
	"logo_url" varchar(500),
	"header_html" text,
	"footer_html" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "status_pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "status_updates_incident_idx" ON "status_page_updates" ("incident_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "status_updates_created_at_idx" ON "status_page_updates" ("created_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "status_page_components" ADD CONSTRAINT "status_page_components_status_page_id_status_pages_id_fk" FOREIGN KEY ("status_page_id") REFERENCES "status_pages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "status_page_incidents" ADD CONSTRAINT "status_page_incidents_status_page_id_status_pages_id_fk" FOREIGN KEY ("status_page_id") REFERENCES "status_pages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "status_page_incidents" ADD CONSTRAINT "status_page_incidents_internal_incident_id_incidents_id_fk" FOREIGN KEY ("internal_incident_id") REFERENCES "incidents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "status_page_updates" ADD CONSTRAINT "status_page_updates_incident_id_status_page_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "status_page_incidents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "status_pages" ADD CONSTRAINT "status_pages_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
