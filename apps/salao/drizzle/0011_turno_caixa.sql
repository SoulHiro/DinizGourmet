CREATE TYPE "public"."tipo_movimento_caixa" AS ENUM('sangria', 'suprimento');--> statement-breakpoint
CREATE TABLE "movimento_caixa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"turno_id" uuid NOT NULL,
	"tipo" "tipo_movimento_caixa" NOT NULL,
	"valor_centavos" integer NOT NULL,
	"motivo" text NOT NULL,
	"funcionario_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movimento_caixa_valor_positivo" CHECK ("movimento_caixa"."valor_centavos" > 0)
);
--> statement-breakpoint
CREATE TABLE "turno_caixa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurante_id" uuid NOT NULL,
	"aberto_por" uuid NOT NULL,
	"aberto_em" timestamp with time zone DEFAULT now() NOT NULL,
	"fundo_centavos" integer NOT NULL,
	"fechado_por" uuid,
	"fechado_em" timestamp with time zone,
	"esperado_centavos" integer,
	"contado_centavos" integer,
	"observacao" text,
	CONSTRAINT "turno_caixa_fundo_positivo" CHECK ("turno_caixa"."fundo_centavos" >= 0)
);
--> statement-breakpoint
ALTER TABLE "movimento_caixa" ADD CONSTRAINT "movimento_caixa_turno_id_turno_caixa_id_fk" FOREIGN KEY ("turno_id") REFERENCES "public"."turno_caixa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimento_caixa" ADD CONSTRAINT "movimento_caixa_funcionario_id_funcionario_id_fk" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turno_caixa" ADD CONSTRAINT "turno_caixa_restaurante_id_restaurante_id_fk" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurante"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turno_caixa" ADD CONSTRAINT "turno_caixa_aberto_por_funcionario_id_fk" FOREIGN KEY ("aberto_por") REFERENCES "public"."funcionario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turno_caixa" ADD CONSTRAINT "turno_caixa_fechado_por_funcionario_id_fk" FOREIGN KEY ("fechado_por") REFERENCES "public"."funcionario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movimento_caixa_turno_idx" ON "movimento_caixa" USING btree ("turno_id");--> statement-breakpoint
CREATE UNIQUE INDEX "turno_caixa_aberto_idx" ON "turno_caixa" USING btree ("restaurante_id") WHERE "turno_caixa"."fechado_em" is null;--> statement-breakpoint
CREATE INDEX "turno_caixa_restaurante_idx" ON "turno_caixa" USING btree ("restaurante_id","aberto_em");