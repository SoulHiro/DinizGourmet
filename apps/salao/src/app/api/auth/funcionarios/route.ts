import { rota } from "@/lib/api";
import { listarFuncionariosLogin } from "@/lib/dominio/login";

export const GET = rota(async () =>
  Response.json(await listarFuncionariosLogin()),
);
