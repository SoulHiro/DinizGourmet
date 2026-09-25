import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL não está definida"),
  PORT: z.coerce.number().default(3000),
  // "::" escuta IPv4 e IPv6 (localhost no navegador pode resolver para ::1).
  HOST: z.string().default("::"),
  // Com HTTPS na LAN (mkcert ou domínio próprio) o cookie pode ser Secure.
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  // "arquivo" grava os tickets em disco (dev e testes sem impressora);
  // "windows" imprime RAW via Winspool.
  IMPRESSAO_DRIVER: z.enum(["arquivo", "windows"]).default("arquivo"),
  IMPRESSAO_DIR: z.string().default("./.tickets"),
  IMPRESSAO_LARGURA: z.coerce.number().default(48),
  // Elgin i9 costuma vir em PC850; confirmar acentos no spike de impressão.
  IMPRESSAO_CODEPAGE: z
    .enum(["PC850_MULTILINGUAL", "PC860_PORTUGUESE", "WPC1252"])
    .default("PC850_MULTILINGUAL"),
  // Quanto esperar o job sair da fila do Windows antes de considerar falha.
  IMPRESSAO_TIMEOUT_JOB_MS: z.coerce.number().default(20_000),
  HTTPS_KEY: z.string().optional(),
  HTTPS_CERT: z.string().optional(),
  // Escritas por minuto por IP (cada celular é um IP). Aumentar só no teste de carga.
  RATE_LIMIT_ESCRITA_POR_MIN: z.coerce.number().default(240),
  // Pedido de ajuda sem resposta por este tempo vira alerta para o gerente.
  AJUDA_ESCALAR_APOS_SEGUNDOS: z.coerce.number().default(120),
  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cache: Env | undefined;

export const env = (): Env => {
  cache ??= envSchema.parse(process.env);
  return cache;
};
