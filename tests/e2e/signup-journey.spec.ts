/**
 * E2E — jornada completa de criação de conta (usuário real, browser real):
 *
 * 1. /login → clica "Criar conta"
 * 2. preenche o formulário de signup e envia
 * 3. abre o e-mail de confirmação (Mailpit) e clica no link
 * 4. cai autenticado no onboarding (tenant provisionado)
 * 5. sai e entra de novo com as credenciais criadas
 *
 * Pré-requisitos: Supabase local com Mailpit + app `next start` (ver README
 * da suíte / playwright.config.ts).
 */
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";

import { waitForEmail, extractAuthConfirmLink, uniqueEmail } from "./helpers/auth";

test("criar conta: confirmação → configuração → CRM → perfil → sair → re-login", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const evidence = ".superpowers/evidence/vellum-acesso";
  mkdirSync(evidence, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const email = uniqueEmail("signup");
  const password = "SenhaForte!123";

  // 1. Login → botão "Criar conta"
  await page.goto("/login");
  await page.getByRole("link", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/signup$/);

  // 2. Formulário de signup
  await page.getByLabel("Nome da empresa").fill("Loja E2E Signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByLabel("Confirmar senha").fill(password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Confirme seu e-mail")).toBeVisible();

  // 3. Abre o e-mail real no Mailpit e segue o link
  const html = await waitForEmail(email, "Confirme seu e-mail");
  const link = extractAuthConfirmLink(html, baseURL!);
  await page.goto(link);

  // 4. Autenticado no onboarding — tenant provisionado
  await expect(page).toHaveURL(/\/onboarding\/welcome/);
  await expect(page.getByText("Boas-vindas ao Véllum AI")).toBeVisible();
  await expect(page.getByText("Loja E2E Signup")).toBeVisible();
  await page.screenshot({ path: `${evidence}/01-boas-vindas.png`, fullPage: true });

  // Configuração real pela interface, sem Pular tudo (DEV) nem update direto.
  // Integrações externas ainda não contratadas podem ser configuradas depois.
  await page.getByLabel("O que vocês fazem?").fill("Clínica odontológica de teste");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.waitForURL("**/onboarding/connect-whatsapp");
  await page.getByRole("button", { name: /pular por enquanto/i }).click();
  await page.waitForURL("**/onboarding/setup-ai");
  await page.getByRole("button", { name: "Pular", exact: true }).click();
  await page.waitForURL("**/onboarding/funil");
  await page.getByRole("button", { name: /modelo pronto/i }).click();
  await page.getByRole("button", { name: /clínica, consultório ou salão/i }).click();
  await page.getByRole("button", { name: /usar este quadro/i }).click();
  await page.waitForURL("**/onboarding/testar");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.waitForURL("**/onboarding/invite-team");
  await page.getByRole("button", { name: /pular por enquanto/i }).click();
  await page.waitForURL("**/onboarding/done");
  await page.getByRole("button", { name: "Começar a usar", exact: true }).click();
  await page.waitForURL("**/app/inbox");
  await expect(page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link").first()).toBeVisible();
  await expect(page.getByText("Sem conversas por aqui", { exact: true })).toBeVisible();
  await page.screenshot({ path: `${evidence}/02-crm.png`, fullPage: true });

  // Perfil tem entrada no menu da conta, feedback ao salvar e caminho de volta.
  await page.getByRole("button", { name: "Menu do usuário", exact: true }).click();
  await page.getByRole("menuitem", { name: "Meu perfil", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Perfil", exact: true })).toBeVisible();
  await page.getByLabel("Nome completo").fill("Usuário de teste Véllum");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Perfil atualizado.");
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${evidence}/03-perfil-mobile.png`, fullPage: true });
  await page.getByRole("link", { name: "Voltar ao início", exact: true }).click();
  await page.waitForURL("**/app/inbox");

  // Saída real: além de limpar cookie, comprova a ação e a navegação do menu.
  await page.getByRole("button", { name: "Menu do usuário", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sair", exact: true }).click();
  await page.waitForURL("**/login");
  await expect(page.getByRole("heading", { name: "Entrar", exact: true })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/app/inbox", { timeout: 30_000 });
  // Mudar a URL não comprova que a API autenticada carregou. A primeira prova
  // capturou skeletons e um erro antigo de sessão depois do novo login.
  await expect(page.getByText("Sem conversas por aqui", { exact: true })).toBeVisible();
  await expect(page.getByText("Authentication required", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Sessão expirada. Faça login novamente.", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${evidence}/04-retorno-mobile.png`, fullPage: true });
});
