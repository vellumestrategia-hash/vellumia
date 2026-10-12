"use client";
import { useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PlatformModeBanner } from "./PlatformModeBanner";
import { AdminSidebar } from "./AdminSidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { List } from "@/lib/ui/icons";
import { useT } from "@/hooks/i18n/useT";
import { AdminAccountMenu } from "./AdminAccountMenu";

interface AdminShellProps {
  userEmail: string;
  hasCompanyWorkspace?: boolean;
  children: ReactNode;
}

/**
 * Shell for /admin/*. Renders the cross-tenant banner (sticky top), platform
 * sidebar, and main content area. Client component (não mais Server) desde
 * que ganhou o drawer de navegação mobile — precisa do estado de
 * aberto/fechado, no mesmo padrão de `app/app/_components/AppShell.tsx`;
 * `children` continua chegando como Server Component normalmente (React
 * permite RSC como `children` de um Client Component sem forçar o subtree
 * inteiro pro cliente).
 *
 * O `TooltipProvider` mora aqui, e não em cada componente, porque o Radix exige
 * um Provider ANCESTRAL de todo `Tooltip`: sem ele o componente lança
 * "`Tooltip` must be used within `TooltipProvider`" no cliente, e o React
 * derruba a árvore inteira — a tela vira a página de erro do Next, não um
 * tooltip quebrado. O dono não recebe pista nenhuma: vê "Algo deu errado" e um
 * ID opaco (`app/error.tsx`), e no servidor não há rastro, porque o erro é do
 * cliente.
 *
 * QUEM É ATINGIDO, medido em vez de suposto: o único consumidor do Tooltip do
 * Radix sem Provider próprio é o `TenantBadge`. Ele é montado em 4 telas —
 * /admin/inbox, /admin/inbox/[conversationId], /admin/lgpd e
 * /admin/lgpd/requests/[id]. Os outros três importadores de
 * `components/ui/tooltip` (CredentialCard, MessageBubble, PlatformAdminsTable)
 * embrulham o seu, por isso nunca quebraram.
 *
 * O que este Provider NÃO conserta, apesar de parecer: /admin/usage e
 * /app/ai/usage. Os gráficos de lá (`UsageCharts`, `UsageChart`) importam um
 * `Tooltip` de nome igual e origem diferente — o do **recharts**, que não usa
 * Provider nenhum. Verificado abrindo /admin/usage com o defeito presente: a
 * tela carrega normalmente. Fica escrito porque o nome colide e o próximo
 * leitor vai procurar um Provider faltando ali e não vai encontrar.
 *
 * A quebra é CONDICIONAL A DADO: os mounts de `TenantBadge` estão atrás de
 * guarda de organização resolvida, então uma instalação sem conversas (ou sem
 * solicitação LGPD) abre as 4 telas normalmente mesmo com o defeito. Quem for
 * reproduzir precisa de pelo menos uma linha com tenant; ver a tela abrir num
 * banco vazio não significa que o defeito não existe.
 *
 * Um Provider na casca cobre as quatro telas de uma vez e faz tela nova nascer
 * funcionando, em vez de repetir o erro a cada tela adicionada — é o padrão
 * recomendado pelo Radix (Provider perto da raiz, compartilhando o delay).
 */
export function AdminShell({ userEmail, hasCompanyWorkspace = false, children }: AdminShellProps) {
  const t = useT();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileNavTrigger = useRef<HTMLButtonElement>(null);
  // Mesmo padrão de `app/app/_components/AppShell.tsx`: ajuste de estado
  // durante o render, não em `useEffect` (ver comentário lá).
  const pathname = usePathname();
  const [ultimoPathname, setUltimoPathname] = useState(pathname);
  if (pathname !== ultimoPathname) {
    setUltimoPathname(pathname);
    setMobileNavOpen(false);
  }

  return (
    <TooltipProvider>
      <div className="vellum-admin-shell flex min-h-screen w-full flex-col bg-background">
        <a href="#admin-conteudo" className="vellum-panel-skip">
          {t("Ir para o conteúdo")}
        </a>
        <PlatformModeBanner />
        <div className="flex flex-1">
          <AdminSidebar userEmail={userEmail} hasCompanyWorkspace={hasCompanyWorkspace} />
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetContent
              side="left"
              className="vellum-admin-menu w-72 max-w-[85vw] gap-0 p-0 lg:hidden"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                mobileNavTrigger.current?.focus();
              }}
            >
              <SheetTitle className="sr-only">{t("Menu de navegação")}</SheetTitle>
              <AdminSidebar
                userEmail={userEmail}
                hasCompanyWorkspace={hasCompanyWorkspace}
                variant="mobile"
              />
            </SheetContent>
          </Sheet>
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Conta de plataforma e menu móvel independem de empresa ativa. */}
            <header className="flex min-h-16 items-center justify-between gap-2 border-b bg-card px-3 sm:px-6">
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  ref={mobileNavTrigger}
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0 lg:hidden"
                  onClick={() => setMobileNavOpen(true)}
                  aria-label={t("Abrir menu de navegação")}
                >
                  <List size={20} aria-hidden />
                </Button>
                <span className="truncate text-sm font-medium text-muted-foreground">
                  {t("Admin Plataforma")}
                </span>
              </div>
              <AdminAccountMenu userEmail={userEmail} />
            </header>
            {/* `overflow-x-hidden` como rede de segurança — mesmo motivo do
                `AppShell` (ver comentário lá): se algo estourar a largura, a
                PÁGINA não rola de lado; quem precisa de scroll horizontal é
                o componente específico, contido nele mesmo. */}
            <main
              id="admin-conteudo"
              tabIndex={-1}
              className="vellum-admin-main flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8"
            >
              {children}
            </main>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
