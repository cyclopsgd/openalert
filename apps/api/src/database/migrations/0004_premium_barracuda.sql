DO $$ BEGIN
 CREATE TYPE "service_status" AS ENUM('operational', 'degraded', 'outage', 'maintenance');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_dependencies" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"depends_on_service_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "status" "service_status" DEFAULT 'operational' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_service_dependency" ON "service_dependencies" ("service_id","depends_on_service_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_dependencies_service_idx" ON "service_dependencies" ("service_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_dependencies_depends_on_idx" ON "service_dependencies" ("depends_on_service_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_dependencies" ADD CONSTRAINT "service_dependencies_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_dependencies" ADD CONSTRAINT "service_dependencies_depends_on_service_id_services_id_fk" FOREIGN KEY ("depends_on_service_id") REFERENCES "services"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
