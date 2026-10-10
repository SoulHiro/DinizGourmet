"use client";

import { cn } from "@/lib/utils";

import { useReservationDrawer } from "./reservation-drawer";

export const BotaoReservar = ({ className }: { className?: string }) => {
  const { open } = useReservationDrawer();

  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        "evento-sans evento-cta-glow rounded-lg bg-[var(--evento-amber)] px-6 py-3.5 text-sm font-bold tracking-wide text-[var(--evento-bg-deep)] uppercase transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]",
        className,
      )}
    >
      Reservar mesa
    </button>
  );
};
