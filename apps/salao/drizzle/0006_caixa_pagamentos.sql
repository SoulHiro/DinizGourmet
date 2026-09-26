CREATE TYPE "public"."metodo_pagamento" AS ENUM('dinheiro', 'credito', 'debito', 'pix', 'vale_refeicao');--> statement-breakpoint
ALTER TYPE "public"."tipo_trabalho_impressao" ADD VALUE 'conta';--> statement-breakpoint
CREATE TABLE "pagamento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurante_id" uuid NOT NULL,
	"comanda_id" uuid NOT NULL,
	"metodo" "metodo_pagamento" NOT NULL,
	"valor_centavos" integer NOT NULL,
	"recebido_centavos" integer,
	"troco_centavos" integer DEFAULT 0 NOT NULL,
	"funcionario_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pagamento_valor_positivo" CHECK ("pagamento"."valor_centavos" > 0)
);
--> statement-breakpoint
ALTER TABLE "pagamento" ADD CONSTRAINT "pagamento_restaurante_id_restaurante_id_fk" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurante"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagamento" ADD CONSTRAINT "pagamento_comanda_id_comanda_id_fk" FOREIGN KEY ("comanda_id") REFERENCES "public"."comanda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagamento" ADD CONSTRAINT "pagamento_funcionario_id_funcionario_id_fk" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pagamento_comanda_idx" ON "pagamento" USING btree ("comanda_id");--> statement-breakpoint
CREATE INDEX "pagamento_restaurante_data_idx" ON "pagamento" USING btree ("restaurante_id","criado_em");--> statement-breakpoint
CREATE INDEX "comanda_restaurante_fechada_idx" ON "comanda" USING btree ("restaurante_id","fechada_em");