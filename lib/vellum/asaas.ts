import { z } from "zod";

const idSchema = z.object({ id: z.string().min(1).max(100) }).passthrough();
export const pagamentoAsaasSchema = idSchema.extend({
  customer: z.string().min(1),
  subscription: z.string().nullish(),
  value: z.number().nonnegative(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.string(),
  invoiceUrl: z.string().nullish(),
  externalReference: z.string().nullish(),
});
export type PagamentoAsaas = z.infer<typeof pagamentoAsaasSchema>;

/** Sandbox fixo: nenhuma URL vinda do usuário e nenhuma chave no client bundle. */
export class AsaasSandbox {
  constructor(
    private readonly key: string,
    private readonly transport: typeof fetch = fetch,
  ) {
    if (!key.trim()) throw new Error("asaas_not_configured");
  }
  async request(
    path: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: unknown,
  ): Promise<unknown> {
    if (!/^\/[a-zA-Z0-9/?=&_.%-]+$/.test(path) || path.startsWith("//") || path.includes(".."))
      throw new Error("asaas_path");
    const response = await this.transport(`https://api-sandbox.asaas.com/v3${path}`, {
      method,
      headers: {
        access_token: this.key,
        "Content-Type": "application/json",
        "User-Agent": "VellumAI/1.0",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    // Nunca incluir body, chave, CPF ou resposta upstream na exceção/log.
    if (!response.ok) throw new Error(`asaas_http_${response.status}`);
    if (method === "DELETE") return null;
    return response.json();
  }
  async criarCliente(body: {
    name: string;
    cpfCnpj: string;
    email: string;
    externalReference: string;
  }) {
    return idSchema.parse(
      await this.request("/customers", "POST", { ...body, notificationDisabled: true }),
    );
  }
  async criarAssinatura(body: {
    customer: string;
    value: number;
    nextDueDate: string;
    externalReference: string;
    description: string;
  }) {
    return idSchema.parse(
      await this.request("/subscriptions", "POST", {
        ...body,
        billingType: "UNDEFINED",
        cycle: "MONTHLY",
      }),
    );
  }
  async criarImplantacao(body: {
    customer: string;
    value: number;
    dueDate: string;
    externalReference: string;
  }) {
    return pagamentoAsaasSchema.parse(
      await this.request("/payments", "POST", {
        ...body,
        billingType: "UNDEFINED",
        description: "Implantação inicial",
      }),
    );
  }
  async pagamentosDaAssinatura(id: string) {
    return z
      .object({ data: z.array(pagamentoAsaasSchema) })
      .parse(await this.request(`/subscriptions/${encodeURIComponent(id)}/payments?limit=100`))
      .data;
  }
  async pagamento(id: string) {
    return pagamentoAsaasSchema.parse(await this.request(`/payments/${encodeURIComponent(id)}`));
  }
}

export function asaasConfigurado(): boolean {
  return Boolean(
    process.env.ASAAS_SANDBOX_API_KEY?.trim() && process.env.ASAAS_WEBHOOK_TOKEN?.trim(),
  );
}
export function gatewayAsaas() {
  return new AsaasSandbox(process.env.ASAAS_SANDBOX_API_KEY ?? "");
}
