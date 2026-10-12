"use client";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateProfile } from "@/app/actions/settings/updateProfile";
import { useT } from "@/hooks/i18n/useT";
import {
  profileSchema,
  SEM_PREFERENCIA_DE_IDIOMA,
  type Locale,
} from "@/lib/schemas/settings";

const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Belem",
  "America/Recife",
  "America/Fortaleza",
  "UTC",
];

interface Props {
  email: string;
  initialFullName: string | null;
  initialAvatarUrl: string | null;
  initialLocale: Locale | typeof SEM_PREFERENCIA_DE_IDIOMA;
  initialTimezone: string;
}

export function ProfileForm({
  email,
  initialFullName,
  initialAvatarUrl,
  initialLocale,
  initialTimezone,
}: Props) {
  const t = useT();
  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [locale, setLocale] = useState<Locale | typeof SEM_PREFERENCIA_DE_IDIOMA>(initialLocale);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? "");
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFeedback(null);
    const parsed = profileSchema.safeParse({
      full_name: fullName.trim() || null,
      locale,
      timezone,
      avatar_url: avatarUrl || null,
    });
    if (!parsed.success) {
      const messages: Record<string, string> = {
        full_name: t("Use até 120 caracteres para seu nome."),
        avatar_url: t("Informe uma URL válida para a foto ou deixe o campo em branco."),
      };
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]);
        nextErrors[field] = messages[field] ?? t("Confira o valor deste campo.");
      }
      setFieldErrors(nextErrors);
      document.getElementById(String(parsed.error.issues[0]?.path[0]))?.focus();
      return;
    }
    startTransition(async () => {
      try {
        const r = await updateProfile(parsed.data);
        setFeedback(r.ok
          ? { ok: true, message: t("Perfil atualizado.") }
          : { ok: false, message: t(r.error === "unauthenticated"
            ? "Sua sessão expirou. Entre novamente para salvar."
            : "Não foi possível salvar seu perfil. Tente novamente.") });
      } catch {
        setFeedback({ ok: false, message: t("Não foi possível salvar seu perfil. Tente novamente.") });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="w-full" noValidate aria-busy={isPending}>
      <Card className="space-y-4 p-6">
        <div className="space-y-2">
          <Label htmlFor="email">{t("Email")}</Label>
          <Input id="email" value={email} readOnly aria-describedby="email-help" />
          <p id="email-help" className="text-xs text-muted-foreground">
            {t("Este é o e-mail usado para entrar na sua conta.")}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="full_name">{t("Nome completo")}</Label>
          <Input
            id="full_name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={120}
            autoComplete="name"
            aria-invalid={Boolean(fieldErrors.full_name)}
            aria-describedby={fieldErrors.full_name ? "name-error" : undefined}
          />
          {fieldErrors.full_name && <p id="name-error" role="alert" className="text-sm text-destructive">{fieldErrors.full_name}</p>}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="locale">{t("Idioma")}</Label>
            <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
              <SelectTrigger id="locale">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_PREFERENCIA_DE_IDIOMA}>
                  {t("Seguir o idioma da empresa")}
                </SelectItem>
                <SelectItem value="pt-BR">Português (BR)</SelectItem>
                {/* Espanhol entrou quando passou a MUDAR alguma coisa. Enquanto
                    o campo era guardado e ninguém o lia, oferecer um idioma a
                    mais era prometer o que a tela não cumpre — e o operador
                    conclui que o sistema está quebrado.
                    `en-US` saiu pela mesma razão: nunca teve tradução. */}
                <SelectItem value="es">Español</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">{t("Fuso horário")}</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="avatar_url">{t("Link da foto (opcional)")}</Label>
          <Input
            id="avatar_url"
            type="url"
            placeholder="https://…"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            aria-invalid={Boolean(fieldErrors.avatar_url)}
            aria-describedby={`avatar-help${fieldErrors.avatar_url ? " avatar-error" : ""}`}
          />
          <p id="avatar-help" className="text-xs text-muted-foreground">
            {t("Cole o link direto de uma imagem. Deixe em branco para usar suas iniciais. O endereço do site da empresa não é uma foto.")}
          </p>
          {fieldErrors.avatar_url && <p id="avatar-error" role="alert" className="text-sm text-destructive">{fieldErrors.avatar_url}</p>}
        </div>
        {feedback && (
          <p role={feedback.ok ? "status" : "alert"} className={`rounded-md border p-3 text-sm ${feedback.ok ? "bg-muted/40" : "border-destructive/30 text-destructive"}`}>
            {feedback.message}
          </p>
        )}
        <div className="flex sm:justify-end">
          <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
            {isPending ? t("Salvando…") : t("Salvar")}
          </Button>
        </div>
      </Card>
    </form>
  );
}
