import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import "./globals.css";

// Inter para interface, Lora para títulos — auto-hospedadas pelo next/font
// (baixadas em build, sem requisição bloqueante a CDN em runtime).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AURA",
  description: "Formatação, revisão e organização de trabalhos acadêmicos em ABNT.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${lora.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
