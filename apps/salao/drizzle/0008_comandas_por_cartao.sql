CREATE TABLE "cartao_comanda" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurante_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"token_qr" text DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "chamado_mesa_aberto_idx";--> statement-breakpoint
DROP INDEX "comanda_mesa_ativa_idx";--> statement-breakpoint
ALTER TABLE "comanda" ADD COLUMN "cartao_id" uuid;--> statement-breakpoint
ALTER TABLE "comanda" ADD COLUMN "numero" integer;--> statement-breakpoint
ALTER TABLE "cartao_comanda" ADD CONSTRAINT "cartao_comanda_restaurante_id_restaurante_id_fk" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurante"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cartao_numero_idx" ON "cartao_comanda" USING btree ("restaurante_id","numero");--> statement-breakpoint
CREATE UNIQUE INDEX "cartao_token_qr_idx" ON "cartao_comanda" USING btree ("token_qr");--> statement-breakpoint
ALTER TABLE "comanda" ADD CONSTRAINT "comanda_cartao_id_cartao_comanda_id_fk" FOREIGN KEY ("cartao_id") REFERENCES "public"."cartao_comanda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Dados: mesas juntadas ainda abertas ficam só na principal (a comanda
-- passa a estar em uma mesa por vez; os itens guardam a mesa de origem).
UPDATE "comanda_mesa" cm SET "saiu_em" = now()
  FROM "comanda" c
 WHERE c."id" = cm."comanda_id" AND cm."saiu_em" IS NULL
   AND cm."mesa_id" <> c."mesa_principal_id";--> statement-breakpoint
-- Dados: pedido de conta aberto passa a apontar para a comanda da mesa.
UPDATE "chamado" ch SET "comanda_id" = cm."comanda_id"
  FROM "comanda_mesa" cm JOIN "comanda" c ON c."id" = cm."comanda_id"
 WHERE ch."tipo" = 'conta' AND ch."encerrado_em" IS NULL AND ch."comanda_id" IS NULL
   AND cm."mesa_id" = ch."mesa_id" AND cm."saiu_em" IS NULL AND c."status" = 'aberta';--> statement-breakpoint
-- Dados: 50 cartões para cada restaurante (dá para criar mais em /gerente).
INSERT INTO "cartao_comanda" ("restaurante_id", "numero")
SELECT r."id", g FROM "restaurante" r, generate_series(1, 50) g
ON CONFLICT DO NOTHING;--> statement-breakpoint
CREATE UNIQUE INDEX "chamado_garcom_aberto_idx" ON "chamado" USING btree ("mesa_id") WHERE "chamado"."encerrado_em" is null and "chamado"."tipo" = 'garcom';--> statement-breakpoint
CREATE UNIQUE INDEX "chamado_conta_aberto_idx" ON "chamado" USING btree ("comanda_id") WHERE "chamado"."encerrado_em" is null and "chamado"."tipo" = 'conta';--> statement-breakpoint
CREATE UNIQUE INDEX "comanda_mesa_local_idx" ON "comanda_mesa" USING btree ("comanda_id") WHERE "comanda_mesa"."saiu_em" is null;--> statement-breakpoint
CREATE INDEX "comanda_mesa_mesa_idx" ON "comanda_mesa" USING btree ("mesa_id");--> statement-breakpoint
CREATE UNIQUE INDEX "comanda_cartao_aberta_idx" ON "comanda" USING btree ("cartao_id") WHERE "comanda"."status" = 'aberta';