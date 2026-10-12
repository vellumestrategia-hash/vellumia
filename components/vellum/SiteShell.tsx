import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Marca } from "./Marca";

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="vellum-site">
      <a className="vellum-skip" href="#conteudo">
        Ir para o conteúdo
      </a>
      <header className="vellum-header">
        <Marca />
        <nav aria-label="Navegação principal">
          <Link href="/#operacao">A plataforma</Link>
          <Link href="/precos">Planos</Link>
          <Link href="/login" className="vellum-login-link">
            Entrar
          </Link>
          <Link href="/signup" className="vellum-button small">
            Criar conta <ArrowUpRight size={16} aria-hidden />
          </Link>
        </nav>
      </header>
      {children}
      <footer className="vellum-footer">
        <div>
          <Marca />
          <p>
            Atendimento com contexto.
            <br />
            Vendas com continuidade.
          </p>
        </div>
        <div className="vellum-footer-links">
          <Link href="/precos">Planos e preços</Link>
          <Link href="/login">Acessar plataforma</Link>
          <Link href="/legal/privacy">Privacidade</Link>
          <Link href="/legal/terms">Termos de uso</Link>
        </div>
        <small>Véllum AI · Por escrito.</small>
      </footer>
    </div>
  );
}
