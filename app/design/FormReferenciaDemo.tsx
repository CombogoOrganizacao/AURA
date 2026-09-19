"use client";

import { useState } from "react";

import { FormReferencia } from "@/components/referencias/FormReferencia";
import { novaReferencia } from "@/core/references/campos";
import type { Referencia } from "@/core/references/types";

// `FormReferencia` (passo 4.2) é controlado — recebe a referência e devolve a
// próxima, sem ser dono da persistência, como `FormMetadados` e
// `PainelAbreviaturas`. Quem o segura no produto é `PainelReferencias` (4.5);
// aqui o estado local é o que o faz existir na tela, mesma razão de
// `CheckboxDemo` e `TagDemo`.
//
// **A amostra não é enfeite: é onde este passo se confere.** O critério de
// aceite do 4.2 — "trocar o tipo troca os campos e preserva os
// compartilhados" — está provado em Vitest sobre `trocarTipo()`
// (`src/core/references/campos.test.ts`), mas o Vitest deste projeto só roda
// sobre `src/core/`, então a metade visual precisa de uma página. O Playwright
// de `e2e/referencias.spec.ts` dirige esta.
//
// Id fixo em vez de `crypto.randomUUID()`: a amostra é sempre a mesma
// referência, e um id novo a cada render deixaria o Playwright instável.
export function FormReferenciaDemo() {
  const [referencia, setReferencia] = useState<Referencia>(() =>
    novaReferencia("book", "demo-referencia"),
  );

  return (
    <div className="max-w-xl">
      <FormReferencia
        referencia={referencia}
        onChange={(atualizador) => setReferencia(atualizador)}
      />

      {/*
        O JSON à vista é o argumento inteiro da Fase 4 numa caixa: o que a
        pessoa digita vira CAMPO SEPARADO, nunca "SILVA, Maria. Título. São
        Paulo: Atlas, 2023." guardado como string. Quem monta aquela frase é o
        formatador da NBR 6023 (passo 4.3), na hora de exibir ou exportar.
      */}
      <details className="mt-4">
        <summary className="cursor-pointer font-sans text-2xs text-muted select-none">
          O que fica guardado (CSL-JSON)
        </summary>
        <pre
          aria-label="Referência em CSL-JSON"
          className="mt-2 overflow-x-auto rounded-sm bg-sunken p-3 font-mono text-2xs text-body"
        >
          {JSON.stringify(referencia, null, 2)}
        </pre>
      </details>
    </div>
  );
}
