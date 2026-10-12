"use client";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { KPICards } from "@/components/admin/dashboard/KPICards";
import { AlertsBanner } from "@/components/admin/dashboard/AlertsBanner";
import { useAdminDashboardKPIs } from "@/hooks/useAdminDashboardKPIs";
import { useAlertsRealtime } from "@/hooks/useAlertsRealtime";
import { useT } from "@/hooks/i18n/useT";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowClockwise, Buildings, ChartBar, ShieldCheck } from "@/lib/ui/icons";
import { useIdioma } from "@/lib/i18n/IdiomaProvider";

function KPISkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="space-y-3 pt-6">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AlertsSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

export function DashboardClient() {
  const t = useT();
  const idioma = useIdioma();
  const { data, isLoading, isError, isFetching, refetch, dataUpdatedAt } = useAdminDashboardKPIs();
  useAlertsRealtime();

  return (
    <div className="vellum-admin-dashboard space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wider text-primary uppercase">
            {t("ADMINISTRAÇÃO DA PLATAFORMA")}
          </p>
          <h1 className="vellum-panel-title">{t("Visão geral")}</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t("Acompanhe as empresas, o atendimento e os pontos que precisam da sua atenção.")}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="min-h-11"
        >
          <ArrowClockwise size={16} className={isFetching ? "animate-spin" : ""} aria-hidden />
          {isFetching ? t("Atualizando…") : t("Atualizar")}
        </Button>
      </div>
      {isError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          <p className="font-medium">{t("Não foi possível atualizar a visão geral.")}</p>
          <p className="mt-1 text-muted-foreground">
            {data
              ? t("Os últimos dados disponíveis continuam abaixo. Tente atualizar novamente.")
              : t("Verifique sua conexão e tente atualizar novamente.")}
          </p>
        </div>
      )}
      {isLoading ? (
        <div role="status" aria-label={t("Carregando visão geral")} className="space-y-4">
          <span className="sr-only">{t("Carregando visão geral")}</span>
          <KPISkeleton />
          <AlertsSkeleton />
        </div>
      ) : data ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <h2 className="font-medium text-foreground">{t("Panorama da operação")}</h2>
            <span>
              {t("Última atualização: ")}
              {new Intl.DateTimeFormat(idioma, { hour: "2-digit", minute: "2-digit" }).format(
                dataUpdatedAt,
              )}
              {t(" · Atualização automática a cada 30 s")}
            </span>
          </div>
          <KPICards kpis={data} />
          {data.tenants_active === 0 && (
            <div className="vellum-admin-welcome">
              <span className="vellum-admin-welcome-icon">
                <Buildings size={26} aria-hidden />
              </span>
              <div>
                <h2>{t("Sua plataforma começa pelas empresas.")}</h2>
                <p>
                  {t(
                    "Nenhuma empresa ativa no momento. Cadastre uma empresa cliente ou revise os cadastros existentes para começar a operação.",
                  )}
                </p>
              </div>
              <Button asChild className="min-h-11">
                <Link href="/admin/tenants">
                  {t("Gerenciar empresas")}
                  <ArrowRight size={16} aria-hidden />
                </Link>
              </Button>
            </div>
          )}
          <h2 className="text-sm font-semibold">{t("Pontos de atenção")}</h2>
          <AlertsBanner alerts={data.alerts} />
        </>
      ) : null}
      <section aria-labelledby="admin-atalhos">
        <h2 id="admin-atalhos" className="mb-3 text-sm font-semibold">
          {t("Acessos rápidos")}
        </h2>
        <div className="vellum-admin-shortcuts">
          {[
            {
              href: "/admin/tenants",
              icon: Buildings,
              title: t("Empresas"),
              copy: t("Cadastros, acesso e acompanhamento das empresas clientes."),
            },
            {
              href: "/admin/billing",
              icon: ChartBar,
              title: t("Planos e assinaturas"),
              copy: t("Catálogo de planos e condições comerciais da plataforma."),
            },
            {
              href: "/admin/audit",
              icon: ShieldCheck,
              title: t("Auditoria"),
              copy: t("Histórico de ações para acompanhar a operação com contexto."),
            },
          ].map(({ href, icon: Icon, title, copy }) => (
            <Link key={href} href={href}>
              <Icon size={22} aria-hidden />
              <h3>{title}</h3>
              <p>{copy}</p>
              <ArrowRight size={18} aria-hidden />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
