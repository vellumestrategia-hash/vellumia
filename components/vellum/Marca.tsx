import Link from "next/link";

export function Marca() {
  return (
    <Link href="/" className="vellum-brand" aria-label="Véllum AI — início">
      {/* Asset original da marca, copiado do kit Véllum. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/vellum-selo.png" width={44} height={44} alt="" />
      <span>
        Véllum <small>AI</small>
      </span>
    </Link>
  );
}
