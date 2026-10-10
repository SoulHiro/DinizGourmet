ALTER TABLE "desconto" ADD COLUMN "somente_gerente" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "desconto" ADD COLUMN "limite_por_noite" integer;