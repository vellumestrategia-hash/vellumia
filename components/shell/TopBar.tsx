"use client";
import { AlertsBell } from "./AlertsBell";
import { MobileSidebar } from "./MobileSidebar";
import { TenantSwitcher } from "./TenantSwitcher";
import { UserMenu } from "./UserMenu";
import { SearchTrigger } from "./SearchTrigger";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { useT } from "@/hooks/i18n/useT";
import { Storefront } from "@/lib/ui/icons";

export function TopBar() {
  const { user, activeOrg } = useAuth();
  const t = useT();
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b bg-background/95 px-3 backdrop-blur md:gap-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <MobileSidebar />
        <TenantSwitcher />
        {user.organizations.length <= 1 && !user.is_platform_admin && activeOrg && (
          <div className="hidden min-w-0 items-center gap-2 md:flex">
            <Storefront size={18} className="shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
              <span className="block text-[10px] text-muted-foreground">
                {t("Espaço da empresa")}
              </span>
              <span className="block max-w-44 truncate text-xs font-medium">{activeOrg.name}</span>
            </div>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 justify-center md:max-w-md">
        <SearchTrigger />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <AlertsBell />
        <UserMenu />
      </div>
    </header>
  );
}
