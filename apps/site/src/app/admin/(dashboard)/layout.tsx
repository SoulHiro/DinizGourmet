import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import { logout } from "../login/actions";
import { AdminNav } from "./_components/admin-nav";

export const dynamic = "force-dynamic";

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-4 sm:justify-start">
          <Link href="/admin/eventos" className="font-semibold">
            Xis Diniz — Admin
          </Link>
          <div className="flex items-center gap-2 sm:hidden">
            <Button asChild variant="ghost" size="sm">
              <Link href="/" target="_blank">
                Ver site
              </Link>
            </Button>
            <form action={logout}>
              <Button type="submit" variant="outline" size="sm">
                Sair
              </Button>
            </form>
          </div>
        </div>
        <AdminNav />
        <div className="hidden items-center gap-2 sm:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href="/" target="_blank">
              Ver site
              <ExternalLinkIcon />
            </Link>
          </Button>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Sair
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-5">{children}</main>
    </div>
  );
};

export default AdminLayout;
