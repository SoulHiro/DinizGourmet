ALTER TYPE "public"."tipo_modificador" ADD VALUE 'preparo';--> statement-breakpoint
ALTER TYPE "public"."tipo_trabalho_impressao" ADD VALUE 'alteracao';--> statement-breakpoint
CREATE TABLE "pedido_ajuda" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurante_id" uuid NOT NULL,
	"mesa_id" uuid NOT NULL,
	"comanda_id" uuid,
	"solicitante_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"aceito_por" uuid,
	"aceito_em" timestamp with time zone,
	"escalado_em" timestamp with time zone,
	"encerrado_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "categoria" ADD COLUMN "codigo_inicio" integer;--> statement-breakpoint
ALTER TABLE "categoria" ADD COLUMN "codigo_fim" integer;--> statement-breakpoint
ALTER TABLE "item_pedido" ADD COLUMN "substitui_item_id" uuid;--> statement-breakpoint
ALTER TABLE "produto" ADD COLUMN "codigo" integer;--> statement-breakpoint
ALTER TABLE "pedido_ajuda" ADD CONSTRAINT "pedido_ajuda_restaurante_id_restaurante_id_fk" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurante"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_ajuda" ADD CONSTRAINT "pedido_ajuda_mesa_id_mesa_id_fk" FOREIGN KEY ("mesa_id") REFERENCES "public"."mesa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_ajuda" ADD CONSTRAINT "pedido_ajuda_comanda_id_comanda_id_fk" FOREIGN KEY ("comanda_id") REFERENCES "public"."comanda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_ajuda" ADD CONSTRAINT "pedido_ajuda_solicitante_id_funcionario_id_fk" FOREIGN KEY ("solicitante_id") REFERENCES "public"."funcionario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_ajuda" ADD CONSTRAINT "pedido_ajuda_aceito_por_funcionario_id_fk" FOREIGN KEY ("aceito_por") REFERENCES "public"."funcionario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pedido_ajuda_restaurante_idx" ON "pedido_ajuda" USING btree ("restaurante_id","encerrado_em");--> statement-breakpoint
CREATE UNIQUE INDEX "pedido_ajuda_mesa_aberto_idx" ON "pedido_ajuda" USING btree ("mesa_id") WHERE "pedido_ajuda"."encerrado_em" is null and "pedido_ajuda"."aceito_por" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "produto_codigo_idx" ON "produto" USING btree ("restaurante_id","codigo");