-- Create ENUM types with IF NOT EXISTS logic
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'apiStatus') THEN
        CREATE TYPE "public"."apiStatus" AS ENUM('pending', 'success', 'failed');
    END IF;
END$$;
--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'level') THEN
        CREATE TYPE "public"."level" AS ENUM('beginner', 'intermediate', 'advanced');
    END IF;
END$$;
--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'paymentStatus') THEN
        CREATE TYPE "public"."paymentStatus" AS ENUM('pending', 'completed', 'failed', 'refunded');
    END IF;
END$$;
--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
        CREATE TYPE "public"."role" AS ENUM('user', 'assistant', 'system');
    END IF;
END$$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admins" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"passwordHash" varchar(255) NOT NULL,
	"name" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"titleEn" varchar(255) NOT NULL,
	"titleAr" varchar(255) NOT NULL,
	"descriptionEn" text NOT NULL,
	"descriptionAr" text NOT NULL,
	"thumbnailUrl" text,
	"price" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"isPublished" boolean DEFAULT false NOT NULL,
	"level" "level" DEFAULT 'beginner' NOT NULL,
	"duration" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"courseId" integer NOT NULL,
	"enrolledAt" timestamp DEFAULT now() NOT NULL,
	"lastAccessed" timestamp DEFAULT now() NOT NULL,
	"progressPercentage" integer DEFAULT 0 NOT NULL,
	"completedEpisodes" integer DEFAULT 0 NOT NULL,
	"completedAt" timestamp,
	"paymentStatus" "paymentStatus" DEFAULT 'pending' NOT NULL,
	"paymentAmount" integer,
	"paymentCurrency" varchar(3) DEFAULT 'USD',
	"isSubscriptionActive" boolean DEFAULT true NOT NULL,
	"subscriptionStartDate" timestamp,
	"subscriptionEndDate" timestamp,
	"registrationKeyId" integer,
	"activatedViaKey" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "episodeProgress" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"episodeId" integer NOT NULL,
	"courseId" integer NOT NULL,
	"watchedDuration" integer DEFAULT 0 NOT NULL,
	"isCompleted" boolean DEFAULT false NOT NULL,
	"lastWatchedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "episodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"courseId" integer NOT NULL,
	"titleEn" varchar(255) NOT NULL,
	"titleAr" varchar(255) NOT NULL,
	"descriptionEn" text,
	"descriptionAr" text,
	"videoUrl" text,
	"duration" integer,
	"order" integer NOT NULL,
	"isFree" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lexaiMessages" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"subscriptionId" integer NOT NULL,
	"role" "role" NOT NULL,
	"content" text NOT NULL,
	"imageUrl" text,
	"analysisType" varchar(50),
	"confidence" integer,
	"apiRequestId" varchar(255),
	"apiStatus" "apiStatus" DEFAULT 'pending',
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lexaiSubscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"startDate" timestamp DEFAULT now() NOT NULL,
	"endDate" timestamp NOT NULL,
	"autoRenew" boolean DEFAULT true NOT NULL,
	"paymentStatus" "paymentStatus" DEFAULT 'pending' NOT NULL,
	"paymentAmount" integer NOT NULL,
	"paymentCurrency" varchar(3) DEFAULT 'USD' NOT NULL,
	"messagesUsed" integer DEFAULT 0 NOT NULL,
	"messagesLimit" integer DEFAULT 100 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "registrationKeys" (
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
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"passwordHash" varchar(255) NOT NULL,
	"name" text,
	"phone" varchar(20),
	"emailVerified" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
-- Add columns to enrollments if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'enrollments' AND column_name = 'registrationKeyId') THEN
        ALTER TABLE "enrollments" ADD COLUMN "registrationKeyId" integer;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'enrollments' AND column_name = 'activatedViaKey') THEN
        ALTER TABLE "enrollments" ADD COLUMN "activatedViaKey" boolean DEFAULT false NOT NULL;
    END IF;
END$$;
