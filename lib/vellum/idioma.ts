import { createClient } from "@/lib/supabase/server";
import { normalizarIdioma } from "@/lib/i18n/idiomas";
import { traduzir } from "@/lib/i18n/dicionario";

/** Mantém o idioma do perfil nas páginas públicas; visitantes usam pt-BR. */
export async function traducaoPublica() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  const locale = normalizarIdioma(user?.user_metadata?.locale as string | undefined);
  return { locale, t: (texto: string) => traduzir(texto, locale) };
}
