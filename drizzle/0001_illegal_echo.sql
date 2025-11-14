CREATE TABLE "registrationKeys" (
	"id" serial PRIMARY KEY NOT NULL,
	"keyCode" varchar(255) NOT NULL,
	"email" varchar(320),
	"courseId" integer NOT NULL,
	"activatedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" integer NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"notes" text,
	"expiresAt" timestamp,
	CONSTRAINT "registrationKeys_keyCode_unique" UNIQUE("keyCode")
);
--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "registrationKeyId" integer;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "activatedViaKey" boolean DEFAULT false NOT NULL;