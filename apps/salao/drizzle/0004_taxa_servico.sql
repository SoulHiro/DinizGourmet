CREATE TYPE "public"."tipo_repasse" AS ENUM('gorjeta', 'taxa');--> statement-breakpoint
ALTER TABLE "gorjeta_divisao" ADD COLUMN "tipo" "tipo_repasse" DEFAULT 'gorjeta' NOT NULL;--> statement-breakpoint
ALTER TABLE "gorjeta_divisao" DROP CONSTRAINT "gorjeta_divisao_comanda_id_funcionario_id_pk";--> statement-breakpoint
ALTER TABLE "gorjeta_divisao" ADD CONSTRAINT "gorjeta_divisao_comanda_id_funcionario_id_tipo_pk" PRIMARY KEY("comanda_id","funcionario_id","tipo");--> statement-breakpoint
ALTER TABLE "chamado" ADD COLUMN "taxa_servico" boolean;--> statement-breakpoint
ALTER TABLE "chamado" ADD COLUMN "gorjeta_centavos" integer;--> statement-breakpoint
ALTER TABLE "comanda" ADD COLUMN "taxa_servico_centavos" integer;--> statement-breakpoint
ALTER TABLE "restaurante" ADD COLUMN "taxa_servico_pct" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurante" ADD COLUMN "taxa_servico_pct_reduzida" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurante" ADD COLUMN "taxa_servico_limite_centavos" integer DEFAULT 30000 NOT NULL;