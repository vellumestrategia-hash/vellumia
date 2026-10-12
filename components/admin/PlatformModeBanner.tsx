"use client";
import Link from "next/link";
import { Buildings } from "@/lib/ui/icons";
import { useT } from "@/hooks/i18n/useT";

/**
 * Sticky top banner that signals the user is operating in cross-tenant
 * Platform mode. Persistent visual cue to prevent accidental destructive
 * actions when the operator forgets which surface they're in.
 */
export function PlatformModeBanner() {
  const t = useT();
  return (
    <div
      role="region"
      aria-label={t("Modo Plataforma")}
      className="vellum-platform-mode sticky top-0 z-40 flex min-h-11 w-full items-center justify-between gap-3 px-4"
    >
      <div className="flex items-center gap-2 text-sm">
        <Buildings size={18} weight="fill" aria-hidden />
        <span className="font-semibold tracking-tight">{t("MODO PLATAFORMA")}</span>
        <span className="hidden text-xs opacity-80 sm:inline">
          {t("Administração de todas as empresas")}
        </span>
      </div>
      <Link
        href="/"
        className="inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-xs font-medium underline-offset-4 hover:underline"
      >
        {t("Ver site")}
      </Link>
    </div>
  );
}
