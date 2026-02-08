CREATE TABLE `admins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text(320) NOT NULL,
	`passwordHash` text(255) NOT NULL,
	`name` text,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`lastSignedIn` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admins_email_unique` ON `admins` (`email`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`titleEn` text(255) NOT NULL,
	`titleAr` text(255) NOT NULL,
	`descriptionEn` text NOT NULL,
	`descriptionAr` text NOT NULL,
	`thumbnailUrl` text,
	`price` integer DEFAULT 0 NOT NULL,
	`currency` text(3) DEFAULT 'USD' NOT NULL,
	`isPublished` integer DEFAULT 0 NOT NULL,
	`level` text(20) DEFAULT 'beginner' NOT NULL,
	`duration` integer,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `enrollments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`courseId` integer NOT NULL,
	`enrolledAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`lastAccessed` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`progressPercentage` integer DEFAULT 0 NOT NULL,
	`completedEpisodes` integer DEFAULT 0 NOT NULL,
	`completedAt` text,
	`paymentStatus` text(20) DEFAULT 'pending' NOT NULL,
	`paymentAmount` integer,
	`paymentCurrency` text(3) DEFAULT 'USD',
	`isSubscriptionActive` integer DEFAULT 1 NOT NULL,
	`subscriptionStartDate` text,
	`subscriptionEndDate` text,
	`registrationKeyId` integer,
	`activatedViaKey` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `episodeProgress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`episodeId` integer NOT NULL,
	`courseId` integer NOT NULL,
	`watchedDuration` integer DEFAULT 0 NOT NULL,
	`isCompleted` integer DEFAULT 0 NOT NULL,
	`lastWatchedAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `episodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`courseId` integer NOT NULL,
	`titleEn` text(255) NOT NULL,
	`titleAr` text(255) NOT NULL,
	`descriptionEn` text,
	`descriptionAr` text,
	`videoUrl` text,
	`duration` integer,
	`order` integer NOT NULL,
	`isFree` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `flexaiMessages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`subscriptionId` integer,
	`role` text(20) NOT NULL,
	`content` text NOT NULL,
	`imageUrl` text,
	`analysisResult` text,
	`analysisType` text(50),
	`timeframe` text(10),
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `flexaiSubscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`registrationKeyId` integer,
	`status` text(20) DEFAULT 'active',
	`activatedAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`expiresAt` text NOT NULL,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `lexaiMessages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`subscriptionId` integer NOT NULL,
	`role` text(20) NOT NULL,
	`content` text NOT NULL,
	`imageUrl` text,
	`analysisType` text(50),
	`confidence` integer,
	`apiRequestId` text(255),
	`apiStatus` text(20) DEFAULT 'pending',
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lexaiSubscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`isActive` integer DEFAULT 1 NOT NULL,
	`startDate` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`endDate` text NOT NULL,
	`autoRenew` integer DEFAULT 1 NOT NULL,
	`paymentStatus` text(20) DEFAULT 'pending' NOT NULL,
	`paymentAmount` integer NOT NULL,
	`paymentCurrency` text(3) DEFAULT 'USD' NOT NULL,
	`messagesUsed` integer DEFAULT 0 NOT NULL,
	`messagesLimit` integer DEFAULT 100 NOT NULL,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quiz_answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` integer NOT NULL,
	`question_id` integer NOT NULL,
	`selected_option_id` text(1) NOT NULL,
	`is_correct` integer NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quiz_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`quiz_id` integer NOT NULL,
	`score` integer NOT NULL,
	`total_questions` integer NOT NULL,
	`percentage` text NOT NULL,
	`passed` integer NOT NULL,
	`started_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`completed_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`time_taken_seconds` integer
);
--> statement-breakpoint
CREATE TABLE `quiz_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question_id` integer NOT NULL,
	`option_id` text(1) NOT NULL,
	`option_text` text NOT NULL,
	`is_correct` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quiz_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quiz_id` integer NOT NULL,
	`question_text` text NOT NULL,
	`order_num` integer NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`level` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`passing_score` integer DEFAULT 50 NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quizzes_level_unique` ON `quizzes` (`level`);--> statement-breakpoint
CREATE TABLE `registrationKeys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`keyCode` text(255) NOT NULL,
	`email` text(320),
	`courseId` integer NOT NULL,
	`activatedAt` text,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`createdBy` integer NOT NULL,
	`isActive` integer DEFAULT 1 NOT NULL,
	`notes` text,
	`expiresAt` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `registrationKeys_keyCode_unique` ON `registrationKeys` (`keyCode`);--> statement-breakpoint
CREATE TABLE `user_quiz_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`quiz_id` integer NOT NULL,
	`is_unlocked` integer DEFAULT 0 NOT NULL,
	`is_completed` integer DEFAULT 0 NOT NULL,
	`best_score` integer DEFAULT 0,
	`best_percentage` text DEFAULT '0',
	`attempts_count` integer DEFAULT 0,
	`last_attempt_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_user_quiz` ON `user_quiz_progress` (`user_id`,`quiz_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text(320) NOT NULL,
	`passwordHash` text(255) NOT NULL,
	`name` text,
	`phone` text(20),
	`emailVerified` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`lastSignedIn` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`telegram_user_id` text,
	`user_type` text(20) DEFAULT 'web'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_telegram_user_id_unique` ON `users` (`telegram_user_id`);