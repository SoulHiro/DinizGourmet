CREATE TYPE "public"."origem_rodada" AS ENUM('garcom', 'totem');--> statement-breakpoint
CREATE TYPE "public"."papel_funcionario" AS ENUM('garcom', 'gerente', 'caixa');--> statement-breakpoint
CREATE TYPE "public"."setor_impressora" AS ENUM('chapa', 'fritura', 'bar', 'caixa');--> statement-breakpoint
CREATE TYPE "public"."status_comanda" AS ENUM('aberta', 'fechada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."status_item" AS ENUM('ativo', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."status_trabalho_impressao" AS ENUM('pendente', 'imprimindo', 'impresso', 'falhou', 'descartado');--> statement-breakpoint
CREATE TYPE "public"."tipo_modificador" AS ENUM('remocao', 'adicional');--> statement-breakpoint
CREATE TYPE "public"."tipo_trabalho_impressao" AS ENUM('pedido', 'cancelamento', 'reimpressao');--> statement-breakpoint
CREATE TABLE "categoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurante_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"impressora_id" uuid,
	"ativa" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comanda_mesa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comanda_id" uuid NOT NULL,
	"mesa_id" uuid NOT NULL,
	"entrou_em" timestamp with time zone DEFAULT now() NOT NULL,
	"saiu_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "comanda" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurante_id" uuid NOT NULL,
	"mesa_principal_id" uuid NOT NULL,
	"garcom_titular_id" uuid NOT NULL,
	"status" "status_comanda" DEFAULT 'aberta' NOT NULL,
	"aberta_em" timestamp with time zone DEFAULT now() NOT NULL,
	"fechada_em" timestamp with time zone,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funcionario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurante_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"papel" "papel_funcionario" DEFAULT 'garcom' NOT NULL,
	"pin_hash" text NOT NULL,
	"tentativas_falhas" integer DEFAULT 0 NOT NULL,
	"bloqueado_ate" timestamp with time zone,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "impressora" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurante_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"nome_driver" text NOT NULL,
	"setor" "setor_impressora" NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_pedido_modificador" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_pedido_id" uuid NOT NULL,
	"modificador_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"tipo" "tipo_modificador" NOT NULL,
	"preco_centavos" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_pedido" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rodada_id" uuid NOT NULL,
	"comanda_id" uuid NOT NULL,
	"produto_id" uuid NOT NULL,
	"mesa_origem_id" uuid NOT NULL,
	"quantidade" integer NOT NULL,
	"nome_produto" text NOT NULL,
	"preco_unitario_centavos" integer NOT NULL,
	"total_centavos" integer NOT NULL,
	"impressora_id" uuid,
	"observacao" text,
	"status" "status_item" DEFAULT 'ativo' NOT NULL,
	"cancelado_por" uuid,
	"cancelado_em" timestamp with time zone,
	"motivo_cancelamento" text,
	"preparo_iniciado" boolean,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_pedido_quantidade_positiva" CHECK ("item_pedido"."quantidade" > 0)
);
--> statement-breakpoint
CREATE TABLE "mesa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurante_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modificador" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurante_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"tipo" "tipo_modificador" DEFAULT 'remocao' NOT NULL,
	"preco_centavos" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "produto_modificador" (
	"produto_id" uuid NOT NULL,
	"modificador_id" uuid NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "produto_modificador_produto_id_modificador_id_pk" PRIMARY KEY("produto_id","modificador_id")
);
--> statement-breakpoint
CREATE TABLE "produto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurante_id" uuid NOT NULL,
	"categoria_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"busca_normalizada" text NOT NULL,
	"preco_centavos" integer NOT NULL,
	"disponivel" boolean DEFAULT true NOT NULL,
	"controla_estoque" boolean DEFAULT false NOT NULL,
	"estoque" integer,
	"ordem" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "produto_estoque_nao_negativo" CHECK ("produto"."estoque" >= 0)
);
--> statement-breakpoint
CREATE TABLE "restaurante" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rodada" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurante_id" uuid NOT NULL,
	"comanda_id" uuid NOT NULL,
	"funcionario_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"origem" "origem_rodada" DEFAULT 'garcom' NOT NULL,
	"lancada_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"funcionario_id" uuid NOT NULL,
	"dispositivo" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"revogada_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "trabalho_impressao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurante_id" uuid NOT NULL,
	"impressora_id" uuid NOT NULL,
	"tipo" "tipo_trabalho_impressao" NOT NULL,
	"rodada_id" uuid,
	"comanda_id" uuid,
	"payload" jsonb NOT NULL,
	"status" "status_trabalho_impressao" DEFAULT 'pendente' NOT NULL,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"proxima_tentativa_em" timestamp with time zone DEFAULT now() NOT NULL,
	"job_spooler" integer,
	"ultimo_erro" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"impresso_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "categoria" ADD CONSTRAINT "categoria_restaurante_id_restaurante_id_fk" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurante"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categoria" ADD CONSTRAINT "categoria_impressora_id_impressora_id_fk" FOREIGN KEY ("impressora_id") REFERENCES "public"."impressora"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comanda_mesa" ADD CONSTRAINT "comanda_mesa_comanda_id_comanda_id_fk" FOREIGN KEY ("comanda_id") REFERENCES "public"."comanda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comanda_mesa" ADD CONSTRAINT "comanda_mesa_mesa_id_mesa_id_fk" FOREIGN KEY ("mesa_id") REFERENCES "public"."mesa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comanda" ADD CONSTRAINT "comanda_restaurante_id_restaurante_id_fk" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurante"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comanda" ADD CONSTRAINT "comanda_mesa_principal_id_mesa_id_fk" FOREIGN KEY ("mesa_principal_id") REFERENCES "public"."mesa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comanda" ADD CONSTRAINT "comanda_garcom_titular_id_funcionario_id_fk" FOREIGN KEY ("garcom_titular_id") REFERENCES "public"."funcionario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funcionario" ADD CONSTRAINT "funcionario_restaurante_id_restaurante_id_fk" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurante"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impressora" ADD CONSTRAINT "impressora_restaurante_id_restaurante_id_fk" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurante"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_pedido_modificador" ADD CONSTRAINT "item_pedido_modificador_item_pedido_id_item_pedido_id_fk" FOREIGN KEY ("item_pedido_id") REFERENCES "public"."item_pedido"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_pedido_modificador" ADD CONSTRAINT "item_pedido_modificador_modificador_id_modificador_id_fk" FOREIGN KEY ("modificador_id") REFERENCES "public"."modificador"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_pedido" ADD CONSTRAINT "item_pedido_rodada_id_rodada_id_fk" FOREIGN KEY ("rodada_id") REFERENCES "public"."rodada"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_pedido" ADD CONSTRAINT "item_pedido_comanda_id_comanda_id_fk" FOREIGN KEY ("comanda_id") REFERENCES "public"."comanda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_pedido" ADD CONSTRAINT "item_pedido_produto_id_produto_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produto"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_pedido" ADD CONSTRAINT "item_pedido_mesa_origem_id_mesa_id_fk" FOREIGN KEY ("mesa_origem_id") REFERENCES "public"."mesa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_pedido" ADD CONSTRAINT "item_pedido_impressora_id_impressora_id_fk" FOREIGN KEY ("impressora_id") REFERENCES "public"."impressora"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_pedido" ADD CONSTRAINT "item_pedido_cancelado_por_funcionario_id_fk" FOREIGN KEY ("cancelado_por") REFERENCES "public"."funcionario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mesa" ADD CONSTRAINT "mesa_restaurante_id_restaurante_id_fk" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurante"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modificador" ADD CONSTRAINT "modificador_restaurante_id_restaurante_id_fk" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurante"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produto_modificador" ADD CONSTRAINT "produto_modificador_produto_id_produto_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produto"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produto_modificador" ADD CONSTRAINT "produto_modificador_modificador_id_modificador_id_fk" FOREIGN KEY ("modificador_id") REFERENCES "public"."modificador"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produto" ADD CONSTRAINT "produto_restaurante_id_restaurante_id_fk" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurante"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produto" ADD CONSTRAINT "produto_categoria_id_categoria_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categoria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rodada" ADD CONSTRAINT "rodada_restaurante_id_restaurante_id_fk" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurante"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rodada" ADD CONSTRAINT "rodada_comanda_id_comanda_id_fk" FOREIGN KEY ("comanda_id") REFERENCES "public"."comanda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rodada" ADD CONSTRAINT "rodada_funcionario_id_funcionario_id_fk" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_funcionario_id_funcionario_id_fk" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trabalho_impressao" ADD CONSTRAINT "trabalho_impressao_restaurante_id_restaurante_id_fk" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurante"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trabalho_impressao" ADD CONSTRAINT "trabalho_impressao_impressora_id_impressora_id_fk" FOREIGN KEY ("impressora_id") REFERENCES "public"."impressora"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trabalho_impressao" ADD CONSTRAINT "trabalho_impressao_rodada_id_rodada_id_fk" FOREIGN KEY ("rodada_id") REFERENCES "public"."rodada"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trabalho_impressao" ADD CONSTRAINT "trabalho_impressao_comanda_id_comanda_id_fk" FOREIGN KEY ("comanda_id") REFERENCES "public"."comanda"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categoria_restaurante_idx" ON "categoria" USING btree ("restaurante_id");--> statement-breakpoint
CREATE UNIQUE INDEX "comanda_mesa_ativa_idx" ON "comanda_mesa" USING btree ("mesa_id") WHERE "comanda_mesa"."saiu_em" is null;--> statement-breakpoint
CREATE INDEX "comanda_mesa_comanda_idx" ON "comanda_mesa" USING btree ("comanda_id");--> statement-breakpoint
CREATE INDEX "comanda_restaurante_status_idx" ON "comanda" USING btree ("restaurante_id","status");--> statement-breakpoint
CREATE INDEX "comanda_mesa_principal_idx" ON "comanda" USING btree ("mesa_principal_id");--> statement-breakpoint
CREATE INDEX "funcionario_restaurante_idx" ON "funcionario" USING btree ("restaurante_id");--> statement-breakpoint
CREATE INDEX "impressora_restaurante_idx" ON "impressora" USING btree ("restaurante_id");--> statement-breakpoint
CREATE INDEX "item_pedido_modificador_item_idx" ON "item_pedido_modificador" USING btree ("item_pedido_id");--> statement-breakpoint
CREATE INDEX "item_pedido_comanda_idx" ON "item_pedido" USING btree ("comanda_id");--> statement-breakpoint
CREATE INDEX "item_pedido_rodada_idx" ON "item_pedido" USING btree ("rodada_id");--> statement-breakpoint
CREATE INDEX "item_pedido_produto_idx" ON "item_pedido" USING btree ("produto_id");--> statement-breakpoint
CREATE INDEX "item_pedido_status_idx" ON "item_pedido" USING btree ("status");--> statement-breakpoint
CREATE INDEX "item_pedido_mesa_origem_idx" ON "item_pedido" USING btree ("mesa_origem_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mesa_numero_idx" ON "mesa" USING btree ("restaurante_id","numero");--> statement-breakpoint
CREATE INDEX "modificador_restaurante_idx" ON "modificador" USING btree ("restaurante_id");--> statement-breakpoint
CREATE INDEX "produto_restaurante_idx" ON "produto" USING btree ("restaurante_id");--> statement-breakpoint
CREATE INDEX "produto_categoria_idx" ON "produto" USING btree ("categoria_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rodada_idempotency_idx" ON "rodada" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "rodada_comanda_numero_idx" ON "rodada" USING btree ("comanda_id","numero");--> statement-breakpoint
CREATE UNIQUE INDEX "sessao_token_hash_idx" ON "sessao" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessao_funcionario_idx" ON "sessao" USING btree ("funcionario_id");--> statement-breakpoint
CREATE INDEX "trabalho_impressao_fila_idx" ON "trabalho_impressao" USING btree ("impressora_id","status","proxima_tentativa_em");--> statement-breakpoint
CREATE INDEX "trabalho_impressao_rodada_idx" ON "trabalho_impressao" USING btree ("rodada_id");--> statement-breakpoint
CREATE INDEX "trabalho_impressao_status_idx" ON "trabalho_impressao" USING btree ("restaurante_id","status");