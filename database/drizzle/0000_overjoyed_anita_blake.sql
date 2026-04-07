CREATE TABLE `admin_actions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`adminId` integer NOT NULL,
	`userId` integer NOT NULL,
	`action` text NOT NULL,
	`details` text,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admin_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`settingKey` text NOT NULL,
	`settingValue` text,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_settings_settingKey_unique` ON `admin_settings` (`settingKey`);--> statement-breakpoint
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
CREATE TABLE `articles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text(255) NOT NULL,
	`titleEn` text(255) NOT NULL,
	`titleAr` text(255) NOT NULL,
	`contentEn` text,
	`contentAr` text,
	`excerptEn` text,
	`excerptAr` text,
	`thumbnailUrl` text,
	`authorId` integer,
	`isPublished` integer DEFAULT false NOT NULL,
	`publishedAt` text,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `articles_slug_unique` ON `articles` (`slug`);--> statement-breakpoint
CREATE TABLE `authEmailOtps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text(320) NOT NULL,
	`purpose` text(20) DEFAULT 'login' NOT NULL,
	`codeHash` text(128) NOT NULL,
	`salt` text(64) NOT NULL,
	`ipHash` text(128),
	`userAgentHash` text(128),
	`sentAtMs` integer NOT NULL,
	`expiresAtMs` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `broker_onboarding` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`brokerId` integer NOT NULL,
	`step` text NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`proofUrl` text,
	`proofType` text,
	`aiConfidence` real,
	`aiResult` text,
	`adminNote` text,
	`rejectionReason` text,
	`submittedAt` text,
	`reviewedAt` text,
	`reviewedBy` integer,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `brokers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nameEn` text NOT NULL,
	`nameAr` text NOT NULL,
	`descriptionEn` text,
	`descriptionAr` text,
	`logoUrl` text,
	`affiliateUrl` text NOT NULL,
	`supportWhatsapp` text,
	`minDeposit` integer DEFAULT 0,
	`minDepositCurrency` text DEFAULT 'USD',
	`featuresEn` text,
	`featuresAr` text,
	`isActive` integer DEFAULT true NOT NULL,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text(50) NOT NULL,
	`discount_type` text(20) NOT NULL,
	`discount_value` integer NOT NULL,
	`max_uses` integer,
	`used_count` integer DEFAULT 0 NOT NULL,
	`min_order_amount` integer,
	`valid_from` text,
	`valid_until` text,
	`is_active` integer DEFAULT true NOT NULL,
	`package_id` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_code_unique` ON `coupons` (`code`);--> statement-breakpoint
CREATE TABLE `course_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`course_id` integer NOT NULL,
	`rating` integer DEFAULT 5 NOT NULL,
	`comment` text,
	`is_approved` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_reviews_user_id_course_id_unique` ON `course_reviews` (`user_id`,`course_id`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`titleEn` text(255) NOT NULL,
	`titleAr` text(255) NOT NULL,
	`descriptionEn` text NOT NULL,
	`descriptionAr` text NOT NULL,
	`thumbnailUrl` text,
	`price` integer DEFAULT 0 NOT NULL,
	`currency` text(3) DEFAULT 'USD' NOT NULL,
	`isPublished` integer DEFAULT false NOT NULL,
	`level` text(20) DEFAULT 'beginner' NOT NULL,
	`duration` integer,
	`stageNumber` integer DEFAULT 0,
	`introVideoUrl` text,
	`hasPdf` integer DEFAULT false,
	`hasIntroVideo` integer DEFAULT false,
	`pdfUrl` text,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `email_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`emailType` text NOT NULL,
	`metadata` text,
	`sentAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `engagement_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`entity_type` text,
	`entity_id` integer,
	`metadata` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
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
	`isSubscriptionActive` integer DEFAULT true NOT NULL,
	`subscriptionStartDate` text,
	`subscriptionEndDate` text,
	`registrationKeyId` integer,
	`activatedViaKey` integer DEFAULT false NOT NULL,
	`isAdminSkipped` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `episodeProgress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`episodeId` integer NOT NULL,
	`courseId` integer NOT NULL,
	`watchedDuration` integer DEFAULT 0 NOT NULL,
	`isCompleted` integer DEFAULT false NOT NULL,
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
	`isFree` integer DEFAULT false NOT NULL,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`titleEn` text(255) NOT NULL,
	`titleAr` text(255) NOT NULL,
	`descriptionEn` text,
	`descriptionAr` text,
	`eventType` text(20) DEFAULT 'live' NOT NULL,
	`eventDate` text NOT NULL,
	`eventEndDate` text,
	`imageUrl` text,
	`linkUrl` text,
	`isPublished` integer DEFAULT false NOT NULL,
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
CREATE TABLE `job_application_answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`application_id` integer NOT NULL,
	`question_id` integer NOT NULL,
	`answer` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `job_applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`applicant_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`country` text,
	`cv_file_url` text,
	`cv_file_key` text,
	`status` text(20) DEFAULT 'new' NOT NULL,
	`submitted_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`ai_score` integer,
	`ai_summary` text
);
--> statement-breakpoint
CREATE TABLE `job_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`question_ar` text NOT NULL,
	`question_en` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title_ar` text NOT NULL,
	`title_en` text NOT NULL,
	`description_ar` text NOT NULL,
	`description_en` text,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
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
	`isActive` integer DEFAULT true NOT NULL,
	`isPaused` integer DEFAULT false NOT NULL,
	`isPendingActivation` integer DEFAULT false NOT NULL,
	`studentActivatedAt` text,
	`maxActivationDate` text,
	`startDate` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`endDate` text NOT NULL,
	`autoRenew` integer DEFAULT true NOT NULL,
	`paymentStatus` text(20) DEFAULT 'pending' NOT NULL,
	`paymentAmount` integer NOT NULL,
	`paymentCurrency` text(3) DEFAULT 'USD' NOT NULL,
	`messagesUsed` integer DEFAULT 0 NOT NULL,
	`messagesLimit` integer DEFAULT 100 NOT NULL,
	`pausedAt` text,
	`pausedReason` text,
	`pausedRemainingDays` integer,
	`frozenUntil` text,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lexai_support_cases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`assignedToUserId` integer,
	`assignedByUserId` integer,
	`lastMessageAt` text,
	`lastReviewedAt` text,
	`resolvedAt` text,
	`resolvedByUserId` integer,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lexai_support_cases_userId_unique` ON `lexai_support_cases` (`userId`);--> statement-breakpoint
CREATE TABLE `lexai_support_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`caseId` integer NOT NULL,
	`authorUserId` integer NOT NULL,
	`noteType` text DEFAULT 'note' NOT NULL,
	`content` text NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `offer_agreements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fullName` text NOT NULL,
	`email` text NOT NULL,
	`phone` text DEFAULT '',
	`offerSlug` text DEFAULT 'eid-fitr-2026' NOT NULL,
	`agreedAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`ipAddress` text DEFAULT ''
);
--> statement-breakpoint
CREATE UNIQUE INDEX `offer_agreements_email_offerSlug_unique` ON `offer_agreements` (`email`,`offerSlug`);--> statement-breakpoint
CREATE TABLE `orderItems` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`orderId` integer NOT NULL,
	`itemType` text(20) DEFAULT 'package' NOT NULL,
	`packageId` integer,
	`courseId` integer,
	`priceAtPurchase` integer DEFAULT 0 NOT NULL,
	`currency` text(3) DEFAULT 'USD' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`status` text(20) DEFAULT 'pending' NOT NULL,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`discountAmount` integer DEFAULT 0 NOT NULL,
	`vatRate` integer DEFAULT 16 NOT NULL,
	`vatAmount` integer DEFAULT 0 NOT NULL,
	`totalAmount` integer DEFAULT 0 NOT NULL,
	`currency` text(3) DEFAULT 'USD' NOT NULL,
	`paymentMethod` text(30),
	`paymentReference` text,
	`paymentProofUrl` text,
	`isGift` integer DEFAULT false NOT NULL,
	`giftEmail` text(320),
	`giftMessage` text,
	`notes` text,
	`isUpgrade` integer DEFAULT false NOT NULL,
	`upgradeFromPackageId` integer,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`completedAt` text
);
--> statement-breakpoint
CREATE TABLE `packageCourses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`packageId` integer NOT NULL,
	`courseId` integer NOT NULL,
	`displayOrder` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_package_course` ON `packageCourses` (`packageId`,`courseId`);--> statement-breakpoint
CREATE TABLE `packageSubscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`packageId` integer NOT NULL,
	`orderId` integer,
	`isActive` integer DEFAULT true NOT NULL,
	`startDate` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`endDate` text,
	`renewalDueDate` text,
	`autoRenew` integer DEFAULT false NOT NULL,
	`upgradedFromPackageId` integer,
	`upgradedAt` text,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `packages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text(50) NOT NULL,
	`nameEn` text(255) NOT NULL,
	`nameAr` text(255) NOT NULL,
	`descriptionEn` text,
	`descriptionAr` text,
	`price` integer DEFAULT 0 NOT NULL,
	`currency` text(3) DEFAULT 'USD' NOT NULL,
	`renewalPrice` integer DEFAULT 0,
	`renewalPeriodDays` integer DEFAULT 0,
	`renewalDescription` text,
	`includesLexai` integer DEFAULT false NOT NULL,
	`includesRecommendations` integer DEFAULT false NOT NULL,
	`includesSupport` integer DEFAULT false NOT NULL,
	`includesPdf` integer DEFAULT false NOT NULL,
	`durationDays` integer DEFAULT 0,
	`isLifetime` integer DEFAULT true NOT NULL,
	`isPublished` integer DEFAULT false NOT NULL,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`thumbnailUrl` text,
	`upgradePrice` integer DEFAULT 0,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `packages_slug_unique` ON `packages` (`slug`);--> statement-breakpoint
CREATE TABLE `plan_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`fullName` text NOT NULL,
	`phone` text DEFAULT '',
	`progress` text DEFAULT '{}' NOT NULL,
	`answers` text DEFAULT '{}' NOT NULL,
	`currentPhase` integer DEFAULT 1 NOT NULL,
	`phaseApprovals` text DEFAULT '{}' NOT NULL,
	`adminNotes` text DEFAULT '',
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_progress_email_unique` ON `plan_progress` (`email`);--> statement-breakpoint
CREATE TABLE `points_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ruleKey` text NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`nameEn` text NOT NULL,
	`nameAr` text NOT NULL,
	`descriptionEn` text,
	`descriptionAr` text,
	`isActive` integer DEFAULT true NOT NULL,
	`maxPerDay` integer,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `points_rules_ruleKey_unique` ON `points_rules` (`ruleKey`);--> statement-breakpoint
CREATE TABLE `points_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`amount` integer NOT NULL,
	`type` text(20) DEFAULT 'earn' NOT NULL,
	`reason_en` text,
	`reason_ar` text,
	`reference_id` integer,
	`reference_type` text(30),
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
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
	`is_correct` integer DEFAULT false NOT NULL,
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
CREATE TABLE `recommendationMessages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`type` text(20) DEFAULT 'recommendation' NOT NULL,
	`content` text NOT NULL,
	`symbol` text(30),
	`side` text(10),
	`entryPrice` text(50),
	`stopLoss` text(50),
	`takeProfit1` text(50),
	`takeProfit2` text(50),
	`riskPercent` text(20),
	`parentId` integer,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recommendationReactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`messageId` integer NOT NULL,
	`userId` integer NOT NULL,
	`reaction` text(20) NOT NULL,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_message_reaction_by_user` ON `recommendationReactions` (`messageId`,`userId`);--> statement-breakpoint
CREATE TABLE `recommendationSubscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`registrationKeyId` integer,
	`isActive` integer DEFAULT true NOT NULL,
	`isPaused` integer DEFAULT false NOT NULL,
	`isPendingActivation` integer DEFAULT false NOT NULL,
	`studentActivatedAt` text,
	`maxActivationDate` text,
	`startDate` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`endDate` text NOT NULL,
	`paymentStatus` text(20) DEFAULT 'key' NOT NULL,
	`paymentAmount` integer DEFAULT 100 NOT NULL,
	`paymentCurrency` text(3) DEFAULT 'USD' NOT NULL,
	`pausedAt` text,
	`pausedReason` text,
	`pausedRemainingDays` integer,
	`frozenUntil` text,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`referrerId` integer NOT NULL,
	`refereeId` integer NOT NULL,
	`status` text(20) DEFAULT 'pending' NOT NULL,
	`referrerPoints` integer DEFAULT 0 NOT NULL,
	`refereePoints` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`activatedAt` text
);
--> statement-breakpoint
CREATE TABLE `registrationKeys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`keyCode` text(255) NOT NULL,
	`email` text(320),
	`courseId` integer NOT NULL,
	`packageId` integer,
	`isUpgrade` integer DEFAULT false,
	`isRenewal` integer DEFAULT false,
	`referredBy` text,
	`activatedAt` text,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`createdBy` integer NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`notes` text,
	`price` integer DEFAULT 0 NOT NULL,
	`currency` text(3) DEFAULT 'USD' NOT NULL,
	`entitlementDays` integer,
	`expiresAt` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `registrationKeys_keyCode_unique` ON `registrationKeys` (`keyCode`);--> statement-breakpoint
CREATE TABLE `staffActionLogs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`staffUserId` integer NOT NULL,
	`actionType` text NOT NULL,
	`resourceType` text,
	`resourceId` integer,
	`details` text,
	`ipAddress` text,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`staffUserId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `staff_notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`eventType` text NOT NULL,
	`titleEn` text NOT NULL,
	`titleAr` text NOT NULL,
	`contentEn` text,
	`contentAr` text,
	`actionUrl` text,
	`metadata` text,
	`isRead` integer DEFAULT false NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `staffSessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`staffUserId` integer NOT NULL,
	`loginAt` integer NOT NULL,
	`logoutAt` integer,
	`durationSeconds` integer,
	`ipAddress` text,
	`userAgent` text,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`staffUserId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `supportConversations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`status` text(20) DEFAULT 'open' NOT NULL,
	`needsHuman` integer DEFAULT false NOT NULL,
	`assignedTo` integer,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`closedAt` text
);
--> statement-breakpoint
CREATE TABLE `supportMessages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversationId` integer NOT NULL,
	`senderId` integer NOT NULL,
	`senderType` text(20) NOT NULL,
	`content` text NOT NULL,
	`isRead` integer DEFAULT false NOT NULL,
	`attachment_url` text,
	`attachment_name` text,
	`attachment_size` integer,
	`attachmentType` text,
	`attachmentDuration` integer,
	`editedAt` text,
	`deletedAt` text,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `testimonials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name_en` text NOT NULL,
	`name_ar` text NOT NULL,
	`title_en` text NOT NULL,
	`title_ar` text NOT NULL,
	`text_en` text NOT NULL,
	`text_ar` text NOT NULL,
	`avatar_url` text,
	`rating` integer DEFAULT 5 NOT NULL,
	`package_slug` text,
	`course_id` integer,
	`service_key` text(40),
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_published` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text(30) DEFAULT 'info' NOT NULL,
	`title_en` text NOT NULL,
	`title_ar` text NOT NULL,
	`content_en` text,
	`content_ar` text,
	`action_url` text,
	`is_read` integer DEFAULT false NOT NULL,
	`batch_id` text,
	`email_sent` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_quiz_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`quiz_id` integer NOT NULL,
	`is_unlocked` integer DEFAULT false NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	`best_score` integer DEFAULT 0,
	`best_percentage` text DEFAULT '0',
	`attempts_count` integer DEFAULT 0,
	`last_attempt_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_user_quiz` ON `user_quiz_progress` (`user_id`,`quiz_id`);--> statement-breakpoint
CREATE TABLE `userRoles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`role` text(30) NOT NULL,
	`assignedAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`assignedBy` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_user_role` ON `userRoles` (`userId`,`role`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text(320) NOT NULL,
	`passwordHash` text(255) NOT NULL,
	`loginSecurityMode` text(30) DEFAULT 'password_or_otp' NOT NULL,
	`name` text,
	`phone` text(20),
	`city` text(100),
	`country` text(100),
	`emailVerified` integer DEFAULT false NOT NULL,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`lastSignedIn` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`lastActiveAt` text,
	`notificationPrefs` text DEFAULT '{}',
	`telegram_user_id` text,
	`user_type` text(20) DEFAULT 'web',
	`points_balance` integer DEFAULT 0 NOT NULL,
	`referralCode` text,
	`isStaff` integer DEFAULT false NOT NULL,
	`brokerOnboardingComplete` integer DEFAULT false NOT NULL,
	`staffNotificationPrefs` text DEFAULT '{}'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_telegram_user_id_unique` ON `users` (`telegram_user_id`);