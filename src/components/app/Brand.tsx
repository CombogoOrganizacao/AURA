import Image from "next/image";
import Link from "next/link";

export type TomMarca = "bordo" | "creme";

interface BrandProps {
  /** Lado do quadrado do ícone, em px. O texto acompanha em 0,66 desse valor. */
  size?: number;
  /** `creme` só sobre fundo bordô cheio (rodapé, painel de autenticação). */
  tone?: TomMarca;
  /** Destino do lockup. Padrão: a landing. */
  href?: string;
}

// Lockup da marca: ícone + palavra AURA. O `.png` já vem com o fundo bordô e
// o raio grande — não recolorir, não recortar, não usar sobre fotografia, e
// nunca usar sozinho como ícone de rail, botão ou lista (regra da skill
// `aura-design`, seção ICONOGRAPHY).
//
// `--font-brand` (Roboto 700) existe só aqui. Nenhum outro texto do sistema
// usa essa família.
export function Brand({ size = 34, tone = "bordo", href = "/" }: BrandProps) {
  return (
    <Link
      href={href}
      className="flex shrink-0 items-center gap-2.5 rounded-sm no-underline focus-visible:outline-none focus-visible:shadow-focus-ring"
    >
      <Image
        src="/logo-aura.png"
        alt=""
        width={size}
        height={size}
        priority
        // Raio de ~26% do lado: o ícone da marca é o único elemento do
        // sistema com raio grande (`--radius-squircle`).
        className="rounded-[28%]"
        style={{ width: size, height: size }}
      />
      <span
        className={`font-brand leading-none font-bold tracking-[0.01em] ${
          tone === "creme" ? "text-creme-300" : "text-bordo-700"
        }`}
        style={{ fontSize: size * 0.66 }}
      >
        AURA
      </span>
    </Link>
  );
}
