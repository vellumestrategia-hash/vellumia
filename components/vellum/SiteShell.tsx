"use client";
import { useT } from "@/lib/i18n/IdiomaProvider";

import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Marca } from "./Marca";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <div className="vellum-site">
      <a className="vellum-skip" href="#conteudo">
        {t("Ir para o conteúdo")}
      </a>
      <header className="vellum-header">
        <Marca />
        <nav className="vellum-desktop-nav" aria-label={t("Navegação principal")}>
          <Link href="/#operacao">{t("A plataforma")}</Link>
          <Link href="/precos" aria-current={pathname === "/precos" ? "page" : undefined}>
            {t("Planos")}
          </Link>
          <Link href="/login" className="vellum-login-link">
            {t("Entrar")}
          </Link>
          <Link href="/signup" className="vellum-button small">
            {t("Criar conta ")}
            <ArrowUpRight size={16} aria-hidden />
          </Link>
        </nav>
        <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="vellum-menu-trigger"
              aria-label={t("Abrir menu de navegação")}
            >
              <Menu size={22} aria-hidden />
            </button>
          </SheetTrigger>
          <SheetContent className="vellum-site vellum-mobile-nav">
            <SheetTitle className="sr-only">{t("Menu de navegação")}</SheetTitle>
            <SheetDescription className="sr-only">
              {t("Conheça a plataforma, consulte os planos ou acesse sua conta.")}
            </SheetDescription>
            <Marca />
            <nav aria-label={t("Navegação principal")}>
              <Link href="/#operacao" onClick={() => setMenuAberto(false)}>
                {t("A plataforma")}
              </Link>
              <Link
                href="/precos"
                onClick={() => setMenuAberto(false)}
                aria-current={pathname === "/precos" ? "page" : undefined}
              >
                {t("Planos")}
              </Link>
              <Link href="/login" onClick={() => setMenuAberto(false)}>
                {t("Entrar")}
              </Link>
              <Link href="/signup" className="vellum-button" onClick={() => setMenuAberto(false)}>
                {t("Criar conta ")}
                <ArrowUpRight size={18} aria-hidden />
              </Link>
            </nav>
            <p>
              {t("Atendimento com contexto.")}
              <br />
              {t("Vendas com continuidade.")}
            </p>
          </SheetContent>
        </Sheet>
      </header>
      {children}
      <footer className="vellum-footer">
        <div>
          <Marca />
          <p>
            {t("Atendimento com contexto.")}
            <br />
            {t("Vendas com continuidade.")}
          </p>
        </div>
        <div className="vellum-footer-links">
          <Link href="/precos">{t("Planos e preços")}</Link>
          <Link href="/login">{t("Acessar plataforma")}</Link>
          <Link href="/admin">{t("Administração da plataforma")}</Link>
          <Link href="/legal/privacy">{t("Privacidade")}</Link>
          <Link href="/legal/terms">{t("Termos de uso")}</Link>
        </div>
        <small>{t("Véllum AI · Por escrito.")}</small>
      </footer>
    </div>
  );
}
