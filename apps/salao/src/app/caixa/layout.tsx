import { redirect } from "next/navigation";

import { AreaAutenticada } from "@/components/providers/sessao";
import { sessaoAtual } from "@/lib/auth/atual";

export const dynamic = "force-dynamic";

// Painel do caixa (computador da frente): caixa e gerente.
export default async function CaixaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/garcom/login");
  if (!["caixa", "gerente"].includes(sessao.funcionario.papel)) {
    redirect("/garcom");
  }
  return (
    <AreaAutenticada funcionario={sessao.funcionario}>
      {children}
    </AreaAutenticada>
  );
}
