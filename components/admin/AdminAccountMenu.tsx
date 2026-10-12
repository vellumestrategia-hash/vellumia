"use client";

import { useTransition } from "react";
import { signOut } from "@/app/actions/auth/signOut";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SeletorDeIdioma } from "@/components/shell/SeletorDeIdioma";
import { ShieldCheck, SignOut } from "@/lib/ui/icons";
import { useT } from "@/hooks/i18n/useT";

/** A conta de plataforma não depende de AuthProvider nem de organização ativa. */
export function AdminAccountMenu({ userEmail }: { userEmail: string }) {
  const t = useT();
  const [saindo, startTransition] = useTransition();
  return (
    <div className="flex shrink-0 items-center gap-1">
      <SeletorDeIdioma />
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label={t("Menu do administrador")}
          >
            <span className="flex size-8 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
              <ShieldCheck size={18} aria-hidden />
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>
            <span className="block">{t("Administrador da plataforma")}</span>
            <span className="mt-1 block text-xs font-normal break-all text-muted-foreground">
              {userEmail}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={saindo}
            onClick={() =>
              startTransition(async () => {
                await signOut();
              })
            }
          >
            <SignOut size={16} className="mr-2" aria-hidden />
            {saindo ? t("Saindo…") : t("Sair")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
