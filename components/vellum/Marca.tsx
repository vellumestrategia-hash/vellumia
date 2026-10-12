"use client";
import { useT } from "@/lib/i18n/IdiomaProvider";

import Link from "next/link";

export function Marca() {
  const t = useT();

  return (
    <Link href="/" className="vellum-brand" aria-label={t("Véllum AI — início")}>
      {/* Asset original da marca, copiado do kit Véllum. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/vellum-selo.png" width={44} height={44} alt="" />
      <span>
        {t("Véllum ")}
        <small>{t("AI")}</small>
      </span>
    </Link>
  );
}
