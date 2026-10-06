ALTER TABLE "comanda" ADD COLUMN "reaberta_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "comanda" ADD COLUMN "reaberta_por" uuid;--> statement-breakpoint
ALTER TABLE "comanda" ADD COLUMN "reaberta_motivo" text;--> statement-breakpoint
ALTER TABLE "pagamento" ADD COLUMN "metodo_original" "metodo_pagamento";--> statement-breakpoint
ALTER TABLE "pagamento" ADD COLUMN "corrigido_por" uuid;--> statement-breakpoint
ALTER TABLE "pagamento" ADD COLUMN "corrigido_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "comanda" ADD CONSTRAINT "comanda_reaberta_por_funcionario_id_fk" FOREIGN KEY ("reaberta_por") REFERENCES "public"."funcionario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagamento" ADD CONSTRAINT "pagamento_corrigido_por_funcionario_id_fk" FOREIGN KEY ("corrigido_por") REFERENCES "public"."funcionario"("id") ON DELETE no action ON UPDATE no action;