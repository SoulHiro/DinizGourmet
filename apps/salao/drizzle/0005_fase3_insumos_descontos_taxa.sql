CREATE TYPE "public"."motivo_sem_taxa" AS ENUM('cliente_recusou', 'erro_atendimento', 'demora_preparo', 'cortesia', 'outro');--> statement-breakpoint
CREATE TYPE "public"."tipo_desconto" AS ENUM('percentual', 'valor');--> statement-breakpoint
CREATE TABLE "desconto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurante_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"tipo" "tipo_desconto" NOT NULL,
	"valor" integer NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insumo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurante_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"unidade" text DEFAULT 'un' NOT NULL,
	"estoque" integer,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "insumo_estoque_nao_negativo" CHECK ("insumo"."estoque" >= 0)
);
--> statement-breakpoint
CREATE TABLE "produto_insumo" (
	"produto_id" uuid NOT NULL,
	"insumo_id" uuid NOT NULL,
	"quantidade" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "produto_insumo_produto_id_insumo_id_pk" PRIMARY KEY("produto_id","insumo_id"),
	CONSTRAINT "produto_insumo_quantidade_positiva" CHECK ("produto_insumo"."quantidade" > 0)
);
--> statement-breakpoint
ALTER TABLE "comanda" ADD COLUMN "sem_taxa_motivo" "motivo_sem_taxa";--> statement-breakpoint
ALTER TABLE "comanda" ADD COLUMN "sem_taxa_observacao" text;--> statement-breakpoint
ALTER TABLE "comanda" ADD COLUMN "desconto_centavos" integer;--> statement-breakpoint
ALTER TABLE "comanda" ADD COLUMN "desconto_nome" text;--> statement-breakpoint
ALTER TABLE "comanda" ADD COLUMN "desconto_id" uuid;--> statement-breakpoint
ALTER TABLE "comanda" ADD COLUMN "fechada_por" uuid;--> statement-breakpoint
ALTER TABLE "modificador" ADD COLUMN "insumo_id" uuid;--> statement-breakpoint
ALTER TABLE "desconto" ADD CONSTRAINT "desconto_restaurante_id_restaurante_id_fk" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurante"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insumo" ADD CONSTRAINT "insumo_restaurante_id_restaurante_id_fk" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurante"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produto_insumo" ADD CONSTRAINT "produto_insumo_produto_id_produto_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produto"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produto_insumo" ADD CONSTRAINT "produto_insumo_insumo_id_insumo_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "desconto_restaurante_idx" ON "desconto" USING btree ("restaurante_id");--> statement-breakpoint
CREATE UNIQUE INDEX "insumo_restaurante_nome_idx" ON "insumo" USING btree ("restaurante_id","nome");--> statement-breakpoint
CREATE INDEX "produto_insumo_insumo_idx" ON "produto_insumo" USING btree ("insumo_id");--> statement-breakpoint
ALTER TABLE "comanda" ADD CONSTRAINT "comanda_desconto_id_desconto_id_fk" FOREIGN KEY ("desconto_id") REFERENCES "public"."desconto"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comanda" ADD CONSTRAINT "comanda_fechada_por_funcionario_id_fk" FOREIGN KEY ("fechada_por") REFERENCES "public"."funcionario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modificador" ADD CONSTRAINT "modificador_insumo_id_insumo_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumo"("id") ON DELETE set null ON UPDATE no action;