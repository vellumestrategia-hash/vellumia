"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "@/lib/ui/icons";
import { TenantsFilters } from "@/components/admin/tenants/TenantsFilters";
import { TenantsTable, TenantsTableSkeleton } from "@/components/admin/tenants/TenantsTable";
import { useAdminTenants, type AdminTenantsFilters } from "@/hooks/useAdminTenants";
import { useT } from "@/hooks/i18n/useT";

export function TenantsClient() {
  const t = useT();
  const [filters, setFilters] = useState<AdminTenantsFilters>({});

  const {
    data,
    isLoading,
    isError,
    isFetching,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useAdminTenants(filters);

  const rows = data?.pages.flatMap((p) => p.data ?? []) ?? [];
  const total = rows.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{t("Empresas")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isError && !data ? (
              t("Cadastros indisponíveis")
            ) : isLoading ? (
              t("Carregando...")
            ) : (
              <>
                {total}
                {hasNextPage ? "+" : ""}{" "}
                {total === 1 ? t("empresa cadastrada") : t("empresas cadastradas")}
              </>
            )}
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link href="/admin/tenants/new">
            <Plus size={16} aria-hidden />
            {t("Nova empresa")}
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <TenantsFilters filters={filters} onChange={setFilters} />

      {isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          <div>
            <p className="font-medium">{t("Não foi possível carregar as empresas.")}</p>
            <p className="mt-1 text-muted-foreground">
              {t("Verifique sua conexão e tente atualizar novamente.")}
            </p>
          </div>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching ? t("Atualizando…") : t("Tentar novamente")}
          </Button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <TenantsTableSkeleton />
      ) : isError && !data ? null : (
        <TenantsTable
          data={rows}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={() => void fetchNextPage()}
        />
      )}
    </div>
  );
}
