CREATE TABLE "event_reservation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"customer_name" text NOT NULL,
	"whatsapp" text NOT NULL,
	"party_size" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"attraction" text,
	"event_date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time,
	"location" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "order" ALTER COLUMN "delivery_fee" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "event_reservation" ADD CONSTRAINT "event_reservation_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" DROP COLUMN "grand_total";--> statement-breakpoint
ALTER TABLE "order" DROP COLUMN "delivery_cep";