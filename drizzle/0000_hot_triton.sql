CREATE TYPE "public"."apiStatus" AS ENUM('pending', 'success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."level" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."paymentStatus" AS ENUM('pending', 'completed', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TABLE "admins" (
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
CREATE TABLE "courses" (
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
CREATE TABLE "enrollments" (
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
	"subscriptionEndDate" timestamp
);
--> statement-breakpoint
CREATE TABLE "episodeProgress" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"episodeId" integer NOT NULL,
	"courseId" integer NOT NULL,
	"watchedDuration" integer DEFAULT 0 NOT NULL,
	"isCompleted" boolean DEFAULT false NOT NULL,
	"lastWatchedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episodes" (
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
CREATE TABLE "lexaiMessages" (
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
CREATE TABLE "lexaiSubscriptions" (
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
CREATE TABLE "users" (
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
