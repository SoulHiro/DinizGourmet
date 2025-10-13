ALTER TABLE "branch" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "branch" CASCADE;--> statement-breakpoint
ALTER TABLE "combo" DROP CONSTRAINT "combo_branch_id_branch_id_fk";
--> statement-breakpoint
ALTER TABLE "delivery_zone" DROP CONSTRAINT "delivery_zone_branch_id_branch_id_fk";
--> statement-breakpoint
ALTER TABLE "menu_category" DROP CONSTRAINT "menu_category_branch_id_branch_id_fk";
--> statement-breakpoint
ALTER TABLE "order" DROP CONSTRAINT "order_branch_id_branch_id_fk";
--> statement-breakpoint
ALTER TABLE "product" DROP CONSTRAINT "product_branch_id_branch_id_fk";
--> statement-breakpoint
ALTER TABLE "promotion" DROP CONSTRAINT "promotion_branch_id_branch_id_fk";
--> statement-breakpoint
ALTER TABLE "combo" DROP COLUMN "branch_id";--> statement-breakpoint
ALTER TABLE "delivery_zone" DROP COLUMN "branch_id";--> statement-breakpoint
ALTER TABLE "menu_category" DROP COLUMN "branch_id";--> statement-breakpoint
ALTER TABLE "order" DROP COLUMN "branch_id";--> statement-breakpoint
ALTER TABLE "product" DROP COLUMN "branch_id";--> statement-breakpoint
ALTER TABLE "promotion" DROP COLUMN "branch_id";