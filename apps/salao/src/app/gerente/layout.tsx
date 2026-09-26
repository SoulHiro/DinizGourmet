import { redirect } from "next/navigation";

import { AreaAutenticada } from "@/components/providers/sessao";
import { sessaoAtual } from "@/lib/auth/atual";

export const dynamic = "force-dynamic";

export default async function GerenteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/garcom/login");
  if (sessao.funcionario.papel !== "gerente") redirect("/garcom");
  return (
    <AreaAutenticada funcionario={sessao.funcionario}>
      {children}
    </AreaAutenticada>
  );
}
