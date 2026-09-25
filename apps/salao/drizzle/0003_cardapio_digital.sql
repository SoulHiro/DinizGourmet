ALTER TABLE "produto" ADD COLUMN "foto_url" text;--> statement-breakpoint
ALTER TABLE "produto" ADD COLUMN "video_url" text;--> statement-breakpoint
ALTER TABLE "produto" ADD COLUMN "ingredientes" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "produto" ADD COLUMN "destaque" boolean DEFAULT false NOT NULL;