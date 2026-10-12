"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gauge,
  ChatsCircle,
  Buildings,
  ClipboardText,
  Scales,
  Warning,
  ChartBar,
  Users,
  ShieldCheck,
  CalendarBlank,
  Palette,
  ArrowRight,
} from "@/lib/ui/icons";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useMarcaDaInstalacao } from "@/lib/branding/contexto";
import { useT } from "@/hooks/i18n/useT";

interface NavItem {
  href: string;
  label: string;
  icon: PhosphorIcon;
}

// Navegação da plataforma; o registry do /app descreve somente as empresas.
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Operação",
    items: [
      { href: "/admin/dashboard", label: "Visão geral", icon: Gauge },
      { href: "/admin/tenants", label: "Empresas", icon: Buildings },
      { href: "/admin/inbox", label: "Conversas", icon: ChatsCircle },
      { href: "/admin/billing", label: "Planos e assinaturas", icon: ChartBar },
      { href: "/admin/usage", label: "Consumo de IA", icon: ChartBar },
    ],
  },
  {
    label: "Governança",
    items: [
      { href: "/admin/users", label: "Usuários", icon: Users },
      { href: "/admin/platform-admins", label: "Administradores", icon: ShieldCheck },
      { href: "/admin/audit", label: "Auditoria", icon: ClipboardText },
      { href: "/admin/lgpd", label: "LGPD", icon: Scales },
      { href: "/admin/incidents", label: "Incidentes", icon: Warning },
    ],
  },
  {
    label: "Configuração",
    items: [
      { href: "/admin/marca", label: "Marca", icon: Palette },
      { href: "/admin/google", label: "Google Agenda", icon: CalendarBlank },
    ],
  },
];

interface AdminSidebarProps {
  userEmail: string;
  hasCompanyWorkspace?: boolean;
  /** "mobile" = conteúdo desta MESMA navegação dentro do drawer que `AdminShell`
   * abre abaixo de `lg` — mesmo padrão de `components/shell/Sidebar.tsx`. */
  variant?: "desktop" | "mobile";
}

export function AdminSidebar({
  userEmail,
  hasCompanyWorkspace = false,
  variant = "desktop",
}: AdminSidebarProps) {
  const t = useT();
  const isMobile = variant === "mobile";
  const pathname = usePathname();
  // Por PROP do servidor, e nunca `branding()`: aquela função lê fontes
  // diferentes nos dois lados da fronteira (`window.__PUBLIC_ENV__` no
  // navegador, `process.env` no servidor), e desde que o layout raiz passou a
  // injetar a marca do BANCO as duas divergem — o nome renderizado no SSR não
  // batia com o hidratado, que é hydration mismatch. Ver `lib/branding/contexto.tsx`.
  const marca = useMarcaDaInstalacao();

  return (
    <aside
      className={cn(
        "vellum-admin-sidebar flex flex-col border-r bg-card",
        isMobile
          ? "h-full w-full"
          : "sticky top-11 hidden h-[calc(100dvh-2.75rem)] w-60 shrink-0 lg:flex",
      )}
    >
      <div className="flex min-h-16 shrink-0 items-center gap-3 border-b px-5">
        {marca.logoUrl ? (
          // URL de marca resolvida em runtime, incluindo instalações com logo próprio.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={marca.logoUrl} alt="" className="size-9 shrink-0 object-contain" />
        ) : (
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-lg font-semibold text-primary-foreground"
            aria-hidden
          >
            {marca.initial}
          </span>
        )}
        <div className="flex flex-col">
          <span className="text-base font-semibold tracking-tight">{marca.name}</span>
          <span className="text-xs text-muted-foreground">{t("Administração")}</span>
        </div>
      </div>
      <nav
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4"
        aria-label={t("Navegação plataforma")}
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {t(group.label)}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    <Icon size={18} weight={isActive ? "fill" : "regular"} aria-hidden />
                    <span className="truncate">{t(item.label)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="shrink-0 space-y-2 border-t p-3">
        {hasCompanyWorkspace && (
          <Link
            href="/app"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          >
            <ArrowRight size={14} aria-hidden />
            <span>{t("Área da minha empresa")}</span>
          </Link>
        )}
        <p className="truncate px-2 text-xs text-muted-foreground" title={userEmail}>
          {userEmail}
        </p>
      </div>
    </aside>
  );
}
