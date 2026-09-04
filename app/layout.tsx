import type { Metadata } from "next";
import { IBM_Plex_Mono, Newsreader, Roboto, Work_Sans } from "next/font/google";
import { AvisoAmbienteInterno } from "@/components/AvisoAmbienteInterno";
import { PersistenciaProvider } from "@/lib/persistence-provider";
import "./globals.css";

// As quatro famílias do design system AURA (docs/design.md), auto-hospedadas
// pelo next/font — baixadas em build, sem requisição bloqueante a CDN em
// runtime. Papéis fixos, não intercambiáveis:
// - Work Sans → interface (rótulos, botões, tabelas) → Tailwind `font-sans`
// - Newsreader → títulos e texto do documento → Tailwind `font-serif`
// - IBM Plex Mono → números, percentuais, DOIs, chaves de citação → `font-mono`
// - Roboto 700 → exclusivamente o logotipo AURA → `font-brand`
const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const roboto = Roboto({
  variable: "--font-roboto-brand",
  subsets: ["latin"],
  weight: ["700"],
});

export const metadata: Metadata = {
  title: "AURA",
  description: "Formatação, revisão e organização de trabalhos acadêmicos em ABNT.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${workSans.variable} ${newsreader.variable} ${ibmPlexMono.variable} ${roboto.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AvisoAmbienteInterno />
        <PersistenciaProvider>{children}</PersistenciaProvider>
      </body>
    </html>
  );
}
