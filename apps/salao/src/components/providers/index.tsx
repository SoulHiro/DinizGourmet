"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";

import { Toaster } from "@/components/ui/sonner";

export const Providers = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Rede de segurança além do socket: re-busca ao voltar para o app.
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            staleTime: 5_000,
            retry: 2,
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster position="top-center" richColors />
      </QueryClientProvider>
    </ThemeProvider>
  );
};
