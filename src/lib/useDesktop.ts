"use client";

import { useSyncExternalStore } from "react";

// Tela de desktop ou de celular (passos 6.4.4 e 6.4.5, decisão §1.12
// "Recorte mobile"). O corte é o `md` do Tailwind (768 px), o mesmo das
// classes `md:` que já escondem o cadastro de referências e o "Citar".
//
// `useSyncExternalStore` sobre `matchMedia`: segue a janela redimensionada
// sem efeito nem estado próprio. No servidor não há janela; vale desktop,
// e o cliente corrige no primeiro render depois da hidratação.
const CONSULTA = "(min-width: 768px)";

function inscrever(notificar: () => void): () => void {
  const consulta = window.matchMedia(CONSULTA);
  consulta.addEventListener("change", notificar);
  return () => consulta.removeEventListener("change", notificar);
}

export function useDesktop(): boolean {
  return useSyncExternalStore(
    inscrever,
    () => window.matchMedia(CONSULTA).matches,
    () => true,
  );
}
