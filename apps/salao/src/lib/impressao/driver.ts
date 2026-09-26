import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "@/lib/env";

export type EstadoImpressora =
  | "pronta"
  | "ocupada"
  | "offline"
  | "erro"
  | "desconhecido";

export type EstadoJob = "na_fila" | "concluido" | "erro";

export type DriverImpressao = {
  estado(nomeDriver: string): Promise<EstadoImpressora>;
  enviar(
    nomeDriver: string,
    dados: { escPos: Buffer; texto: string; nomeJob: string },
  ): Promise<{ job: number | null }>;
  estadoJob(nomeDriver: string, job: number): Promise<EstadoJob>;
  cancelarJob(nomeDriver: string, job: number): Promise<void>;
  listar(): Promise<{ nome: string; estado: string }[]>;
};

// Dev e testes: grava cada ticket como .txt legível (e o .bin ESC/POS).
// Criar o arquivo "<pasta>/<nomeDriver>.offline" simula a impressora desligada.
export const criarDriverArquivo = (pasta: string): DriverImpressao => {
  let contador = 0;
  const seguro = (nome: string) => nome.replace(/[^\w.-]+/g, "_");

  return {
    async estado(nomeDriver) {
      return existsSync(path.join(pasta, `${seguro(nomeDriver)}.offline`))
        ? "offline"
        : "pronta";
    },
    async enviar(nomeDriver, dados) {
      if (existsSync(path.join(pasta, `${seguro(nomeDriver)}.offline`))) {
        throw new Error("impressora offline (simulada)");
      }
      const destino = path.join(pasta, seguro(nomeDriver));
      await mkdir(destino, { recursive: true });
      const base = `${new Date().toISOString().replace(/[:.]/g, "-")}-${++contador}-${seguro(dados.nomeJob)}`;
      await writeFile(path.join(destino, `${base}.txt`), dados.texto, "utf8");
      await writeFile(path.join(destino, `${base}.bin`), dados.escPos);
      return { job: null };
    },
    async estadoJob() {
      return "concluido";
    },
    async cancelarJob() {},
    async listar() {
      return [];
    },
  };
};

type NodePrinter = typeof import("@ssxv/node-printer").default;

// Produção: bytes ESC/POS direto no driver do Windows (Winspool), sem popup.
// Import dinâmico: o addon nativo só existe no Windows.
export const criarDriverWindows = (): DriverImpressao => {
  let modulo: Promise<NodePrinter> | undefined;
  const lib = () => {
    modulo ??= import("@ssxv/node-printer").then((m) => m.default);
    return modulo;
  };

  return {
    async estado(nomeDriver) {
      try {
        const printer = await (await lib()).printers.get(nomeDriver);
        switch (printer.state) {
          case "idle":
            return "pronta";
          case "printing":
            return "ocupada";
          case "stopped":
          case "offline":
            return "offline";
          case "error":
            return "erro";
          default:
            return "desconhecido";
        }
      } catch {
        return "offline";
      }
    },
    async enviar(nomeDriver, dados) {
      const resultado = await (await lib()).jobs.printRaw({
        printer: nomeDriver,
        data: dados.escPos,
        format: "RAW",
        options: { jobName: dados.nomeJob },
      });
      return { job: resultado.id };
    },
    async estadoJob(nomeDriver, job) {
      try {
        const info = await (await lib()).jobs.get(nomeDriver, job);
        if (info.state === "completed") return "concluido";
        if (info.state === "error" || info.state === "canceled") return "erro";
        if (info.state === "paused") return "erro";
        return "na_fila";
      } catch (error) {
        // O Windows tira o job da fila quando termina de imprimir.
        if ((error as { code?: string }).code === "JOB_NOT_FOUND") {
          return "concluido";
        }
        throw error;
      }
    },
    async cancelarJob(nomeDriver, job) {
      try {
        await (await lib()).jobs.cancel(nomeDriver, job);
      } catch {}
    },
    async listar() {
      const lista = await (await lib()).printers.list();
      return lista.map((p) => ({ nome: p.name, estado: p.state }));
    },
  };
};

export const criarDriverPadrao = (): DriverImpressao => {
  const config = env();
  return config.IMPRESSAO_DRIVER === "windows"
    ? criarDriverWindows()
    : criarDriverArquivo(path.resolve(config.IMPRESSAO_DIR));
};
