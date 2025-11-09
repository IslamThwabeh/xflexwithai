CREATE TABLE `lexaiMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subscriptionId` int NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`imageUrl` text,
	`analysisType` varchar(50),
	`confidence` int,
	`apiRequestId` varchar(255),
	`apiStatus` enum('pending','success','failed') DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lexaiMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lexaiSubscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`startDate` timestamp NOT NULL DEFAULT (now()),
	`endDate` timestamp NOT NULL,
	`autoRenew` boolean NOT NULL DEFAULT true,
	`paymentStatus` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
	`paymentAmount` int NOT NULL,
	`paymentCurrency` varchar(3) NOT NULL DEFAULT 'USD',
	`messagesUsed` int NOT NULL DEFAULT 0,
	`messagesLimit` int NOT NULL DEFAULT 100,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lexaiSubscriptions_id` PRIMARY KEY(`id`)
);
