"use client";
import { useT } from "@/lib/i18n/IdiomaProvider";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Marca } from "./Marca";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const t = useT();

  return (
    <div className="vellum-site">
      <a className="vellum-skip" href="#conteudo">
        {t("Ir para o conteúdo")}
      </a>
      <header className="vellum-header">
        <Marca />
        <nav aria-label={t("Navegação principal")}>
          <Link href="/#operacao">{t("A plataforma")}</Link>
          <Link href="/precos">{t("Planos")}</Link>
          <Link href="/login" className="vellum-login-link">
            {t("Entrar")}
          </Link>
          <Link href="/signup" className="vellum-button small">
            {t("Criar conta ")}
            <ArrowUpRight size={16} aria-hidden />
          </Link>
        </nav>
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
          <Link href="/legal/privacy">{t("Privacidade")}</Link>
          <Link href="/legal/terms">{t("Termos de uso")}</Link>
        </div>
        <small>{t("Véllum AI · Por escrito.")}</small>
      </footer>
    </div>
  );
}
