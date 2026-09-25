CREATE TYPE "public"."papel_na_comanda" AS ENUM('titular', 'auxiliar');--> statement-breakpoint
CREATE TYPE "public"."tipo_chamado" AS ENUM('garcom', 'conta');--> statement-breakpoint
CREATE TABLE "chamado" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurante_id" uuid NOT NULL,
	"mesa_id" uuid NOT NULL,
	"comanda_id" uuid,
	"tipo" "tipo_chamado" NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"aceito_por" uuid,
	"aceito_em" timestamp with time zone,
	"escalado_em" timestamp with time zone,
	"encerrado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "comanda_garcom" (
	"comanda_id" uuid NOT NULL,
	"funcionario_id" uuid NOT NULL,
	"papel" "papel_na_comanda" NOT NULL,
	"entrou_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comanda_garcom_comanda_id_funcionario_id_pk" PRIMARY KEY("comanda_id","funcionario_id")
);
--> statement-breakpoint
CREATE TABLE "gorjeta_divisao" (
	"comanda_id" uuid NOT NULL,
	"funcionario_id" uuid NOT NULL,
	"base_centavos" integer NOT NULL,
	"valor_centavos" integer NOT NULL,
	CONSTRAINT "gorjeta_divisao_comanda_id_funcionario_id_pk" PRIMARY KEY("comanda_id","funcionario_id")
);
--> statement-breakpoint
ALTER TABLE "comanda" ADD COLUMN "gorjeta_centavos" integer;--> statement-breakpoint
ALTER TABLE "mesa" ADD COLUMN "token_qr" text DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL;--> statement-breakpoint
ALTER TABLE "pedido_ajuda" ADD COLUMN "espontaneo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "chamado" ADD CONSTRAINT "chamado_restaurante_id_restaurante_id_fk" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurante"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamado" ADD CONSTRAINT "chamado_mesa_id_mesa_id_fk" FOREIGN KEY ("mesa_id") REFERENCES "public"."mesa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamado" ADD CONSTRAINT "chamado_comanda_id_comanda_id_fk" FOREIGN KEY ("comanda_id") REFERENCES "public"."comanda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamado" ADD CONSTRAINT "chamado_aceito_por_funcionario_id_fk" FOREIGN KEY ("aceito_por") REFERENCES "public"."funcionario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comanda_garcom" ADD CONSTRAINT "comanda_garcom_comanda_id_comanda_id_fk" FOREIGN KEY ("comanda_id") REFERENCES "public"."comanda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comanda_garcom" ADD CONSTRAINT "comanda_garcom_funcionario_id_funcionario_id_fk" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gorjeta_divisao" ADD CONSTRAINT "gorjeta_divisao_comanda_id_comanda_id_fk" FOREIGN KEY ("comanda_id") REFERENCES "public"."comanda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gorjeta_divisao" ADD CONSTRAINT "gorjeta_divisao_funcionario_id_funcionario_id_fk" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chamado_restaurante_idx" ON "chamado" USING btree ("restaurante_id","encerrado_em");--> statement-breakpoint
CREATE UNIQUE INDEX "chamado_mesa_aberto_idx" ON "chamado" USING btree ("mesa_id","tipo") WHERE "chamado"."encerrado_em" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "mesa_token_qr_idx" ON "mesa" USING btree ("token_qr");--> statement-breakpoint
-- Comandas que já existiam: o titular entra como garçom da comanda.
INSERT INTO "comanda_garcom" ("comanda_id", "funcionario_id", "papel", "entrou_em") SELECT "id", "garcom_titular_id", 'titular', "aberta_em" FROM "comanda" ON CONFLICT DO NOTHING;
