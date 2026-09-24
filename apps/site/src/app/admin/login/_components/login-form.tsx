"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { login } from "../actions";

const loginFormSchema = z.object({
  password: z.string().min(1, "Informe a senha"),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export const LoginForm = () => {
  const [isPending, startTransition] = useTransition();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { password: "" },
  });

  const onSubmit = (data: LoginFormValues) => {
    startTransition(async () => {
      try {
        await login(data.password);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Não foi possível entrar.",
        );
      }
    });
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Painel interno</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2Icon className="animate-spin" />}
              Entrar
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
