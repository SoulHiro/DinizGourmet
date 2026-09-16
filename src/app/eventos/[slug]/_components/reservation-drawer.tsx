"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import { eventoSans, eventoScript, eventoSerif } from "../evento-fonts";
import { ReservationForm } from "./reservation-form";

interface ReservationDrawerContextValue {
  open: () => void;
}

const ReservationDrawerContext =
  createContext<ReservationDrawerContextValue | null>(null);

export const useReservationDrawer = () => {
  const ctx = useContext(ReservationDrawerContext);
  if (!ctx) {
    throw new Error(
      "useReservationDrawer must be used within ReservationDrawerProvider",
    );
  }
  return ctx;
};

interface ReservationDrawerProviderProps {
  eventId: string;
  children: ReactNode;
}

export const ReservationDrawerProvider = ({
  eventId,
  children,
}: ReservationDrawerProviderProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <ReservationDrawerContext.Provider value={{ open: () => setIsOpen(true) }}>
      {children}
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent
          className={`evento-panel evento-sans border-t border-[var(--evento-gold)]/30 bg-[var(--evento-bg-deep)] sm:inset-x-auto sm:left-1/2 sm:mb-8 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:rounded-lg sm:border ${eventoSerif.variable} ${eventoSans.variable} ${eventoScript.variable}`}
        >
          <DrawerHeader>
            <DrawerTitle className="evento-serif text-2xl text-[var(--evento-cream)]">
              Reservar mesa
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8">
            <ReservationForm eventId={eventId} />
          </div>
        </DrawerContent>
      </Drawer>
    </ReservationDrawerContext.Provider>
  );
};
