CREATE TABLE `charter` (
	`id` text PRIMARY KEY NOT NULL,
	`journey_id` text NOT NULL,
	`version` integer NOT NULL,
	`goal` text NOT NULL,
	`why` text NOT NULL,
	`done_looks_like` text NOT NULL,
	`deadline` text,
	`constraints` text,
	`starting_point` text,
	`note` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `log_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`journey_id` text NOT NULL,
	`raw_text` text NOT NULL,
	`minutes` integer,
	`energy` text,
	`mood` text,
	`kind` text NOT NULL,
	`occurred_on` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `journey` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`domain` text NOT NULL,
	`hue` integer NOT NULL,
	`start_date` text NOT NULL,
	`status` text NOT NULL,
	`last_seen_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `skill` (
	`id` text PRIMARY KEY NOT NULL,
	`journey_id` text NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`description` text,
	`level` integer NOT NULL,
	`prereq_ids_json` text NOT NULL,
	`archived` integer NOT NULL,
	`user_edited_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
