// Datas e textos de evento, sem banco: pode ser usado em componente de
// cliente (o calendário). A consulta fica em lib/eventos.ts.
import type { events } from "@/db/schema";

export type Evento = typeof events.$inferSelect;

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const DIAS_SEMANA = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

// "Hoje" no fuso da casa, em AAAA-MM-DD. Na Vercel o servidor roda em UTC:
// sem o fuso, depois das 21h o evento da noite já contaria como passado.
export const hojeISO = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

// A coluna é date (AAAA-MM-DD, sem fuso): desmonta na mão para não deixar o
// Date converter para UTC e voltar um dia.
export const partesData = (iso: string) => {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const semana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
  return {
    ano,
    mes,
    dia,
    diaSemana: DIAS_SEMANA[semana],
    nomeMes: MESES[mes - 1],
    mesCurto: MESES[mes - 1].slice(0, 3),
  };
};

// "Sábado, 3 de outubro"
export const dataPorExtenso = (iso: string) => {
  const p = partesData(iso);
  return `${p.diaSemana}, ${p.dia} de ${p.nomeMes}`;
};

export const nomeDoMes = (mes: number) => MESES[mes - 1];

export const horaCurta = (hora: string) => hora.slice(0, 5).replace(":00", "h");

export const horarioEvento = (evento: Evento) =>
  evento.endTime
    ? `${horaCurta(evento.startTime)} às ${horaCurta(evento.endTime)}`
    : `A partir das ${horaCurta(evento.startTime)}`;

export const tituloEvento = (evento: Evento) =>
  evento.attraction || evento.name;
