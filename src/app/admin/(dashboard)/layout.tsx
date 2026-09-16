import Link from "next/link";

import { Button } from "@/components/ui/button";

import { logout } from "../login/actions";

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b p-4">
        <Link href="/admin/eventos" className="font-semibold">
          Diniz Gourmet — Admin
        </Link>
        <form action={logout}>
          <Button type="submit" variant="outline" size="sm">
            Sair
          </Button>
        </form>
      </header>
      <main className="flex-1 p-5">{children}</main>
    </div>
  );
};

export default AdminLayout;
