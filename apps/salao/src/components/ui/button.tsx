import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

// Alvos de toque de no mínimo 48px (Design System, seção 4).
const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-[transform,background-color,opacity] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        acao: "bg-acao text-acao-foreground hover:bg-acao/90",
        marca: "bg-marca text-marca-foreground hover:bg-marca/90",
        outline: "border border-borda bg-surface text-texto hover:bg-borda/40",
        ghost: "text-texto hover:bg-borda/50",
        destrutivo: "bg-destructive text-white hover:bg-destructive/90",
      },
      size: {
        md: "h-12 px-4 text-base",
        lg: "h-14 px-6 text-lg",
        icon: "size-12",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
