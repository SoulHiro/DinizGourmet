"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ITENS = [
  { href: "/admin/eventos", label: "Eventos" },
  { href: "/admin/links", label: "Links da bio" },
  { href: "/admin/cardapio", label: "Cardápio" },
];

export const AdminNav = () => {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {ITENS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
            pathname.startsWith(item.href)
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
};
