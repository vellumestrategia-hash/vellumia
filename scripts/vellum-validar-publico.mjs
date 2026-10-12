// Validação de leitura: não cria contas nem escreve no Supabase remoto.
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.VELLUM_TEST_URL || "http://localhost:3010";
const url = new URL(base);
if (!["localhost", "127.0.0.1"].includes(url.hostname))
  throw new Error("Esta verificação pública aceita somente localhost.");
const out = "docs/vellum/evidencias";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const resultados = [];
try {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 375, height: 812 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
  ]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    const erros = [];
    page.on("pageerror", (e) => erros.push(e.message));
    await page.goto(base, { waitUntil: "networkidle", timeout: 120000 });
    await page.getByRole("heading", { level: 1 }).waitFor();
    assert.match(await page.title(), /Véllum AI/);
    assert.match(await page.getByRole("heading", { level: 1 }).innerText(), /A conversa começa/);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      "Landing sem overflow horizontal",
    );
    await page.screenshot({ path: `${out}/landing-${viewport.width}.png`, fullPage: true });
    await page.getByRole("button", { name: /Qualificar/ }).click();
    assert.equal(
      await page.getByRole("button", { name: /Qualificar/ }).getAttribute("aria-pressed"),
      "true",
    );
    await page.getByText("Desafio: acompanhamento dos contatos", { exact: true }).waitFor();
    await page.getByRole("button", { name: /Passar ao time/ }).click();
    await page.getByText("Conversa com o especialista", { exact: true }).waitFor();
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      axe.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        targets: v.nodes.map((n) => n.target),
      })),
      [],
      "Acessibilidade da landing",
    );
    if (viewport.width <= 880) {
      const abrirMenu = page.getByRole("button", { name: "Abrir menu de navegação" });
      await abrirMenu.click();
      await page.getByRole("dialog", { name: "Menu de navegação" }).waitFor();
      const axeMenu = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      assert.deepEqual(
        axeMenu.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
        [],
        "Acessibilidade do menu móvel",
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await abrirMenu.evaluate((el) => el === document.activeElement),
        true,
        "Escape devolve o foco ao menu",
      );
      await abrirMenu.click();
    }
    await page.getByRole("link", { name: "Planos", exact: true }).click();
    await page.waitForURL("**/precos", { timeout: 120000 });
    await page.getByRole("heading", { level: 1 }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/precos");
    await page.getByRole("heading", { name: "GROWTH", exact: true }).waitFor();
    assert.equal(await page.locator(".vellum-plan").count(), 4);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      "Preços sem overflow horizontal",
    );
    await page.getByText("O que conta como uma conversa?", { exact: true }).click();
    assert.equal(await page.locator("details").first().getAttribute("open"), "");
    await page.screenshot({ path: `${out}/precos-${viewport.width}.png`, fullPage: true });
    const axePrecos = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      axePrecos.violations.map((v) => v.id),
      [],
      "Acessibilidade de preços",
    );
    await page.getByRole("link", { name: "Entrar", exact: true }).click();
    await page.waitForURL("**/login", { timeout: 120000 });
    await page.getByLabel("Senha", { exact: true }).waitFor({ timeout: 120000 });
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    // Apenas validação de campos vazios: nenhum login externo é enviado.
    await page.locator("input[aria-invalid='true']").first().waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      "Login sem overflow horizontal",
    );
    await page.screenshot({ path: `${out}/login-${viewport.width}.png`, fullPage: true });
    const axeLogin = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      axeLogin.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
      [],
      "Acessibilidade do login com campos inválidos",
    );
    await page.getByRole("link", { name: "Criar conta", exact: true }).click();
    await page.waitForURL("**/signup", { timeout: 120000 });
    await page
      .getByRole("button", { name: "Criar conta", exact: true })
      .waitFor({ timeout: 120000 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      "Cadastro sem overflow horizontal",
    );
    await page.screenshot({ path: `${out}/cadastro-${viewport.width}.png`, fullPage: true });
    const axeCadastro = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      axeCadastro.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
      [],
      "Acessibilidade do cadastro",
    );
    await page.goto(`${base}/app`, { waitUntil: "networkidle" });
    assert.equal(new URL(page.url()).pathname, "/login", "Painel continua exigindo autenticação");
    assert.deepEqual(erros, [], "Nenhum erro de JavaScript ou hidratação");
    resultados.push({
      viewport,
      rotas: ["/", "/precos", "/login", "/signup", "/app → /login"],
      overflow: false,
      erros: 0,
      axe_landing: 0,
      axe_precos: 0,
      axe_login: 0,
      axe_cadastro: 0,
      demonstracao: "3 etapas acessíveis",
      menu_mobile: viewport.width <= 880 ? "Escape, foco e navegação aprovados" : "não aplicável",
    });
    await context.close();
  }
  await writeFile(
    `${out}/validacao-publica.json`,
    JSON.stringify({ data: new Date().toISOString(), base, resultados }, null, 2),
  );
  process.stdout.write(JSON.stringify(resultados, null, 2) + "\n");
} finally {
  await browser.close();
}
