CREATE TYPE "public"."modelo_impressao" AS ENUM('pedido', 'conta');--> statement-breakpoint
CREATE TABLE "layout_impressao" (
	"restaurante_id" uuid NOT NULL,
	"modelo" "modelo_impressao" NOT NULL,
	"config" jsonb NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "layout_impressao_restaurante_id_modelo_pk" PRIMARY KEY("restaurante_id","modelo")
);
--> statement-breakpoint
ALTER TABLE "layout_impressao" ADD CONSTRAINT "layout_impressao_restaurante_id_restaurante_id_fk" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurante"("id") ON DELETE no action ON UPDATE no action;