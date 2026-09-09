"use client";

// Mesmo motivo do DialogDemo/ToastDemo: `onClick` e `onRemove` são funções, e
// função não atravessa a fronteira de Server Component como prop — precisa
// nascer dentro de uma árvore já client. E o estado "selecionado" da Tag só
// se demonstra alternando de verdade, não com um valor fixo.
import { useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";

const FILTROS = ["Normas", "Citações", "Referências", "Coesão"] as const;

export function TagDemo() {
  const [ligados, setLigados] = useState<string[]>(["Normas", "Citações"]);
  const [palavras, setPalavras] = useState(["metodologia", "revisão por pares"]);

  function alternar(filtro: string) {
    setLigados((atuais) =>
      atuais.includes(filtro) ? atuais.filter((f) => f !== filtro) : [...atuais, filtro],
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTROS.map((filtro) => (
          <Tag key={filtro} selected={ligados.includes(filtro)} onClick={() => alternar(filtro)}>
            {filtro}
          </Tag>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {palavras.map((palavra) => (
          <Tag
            key={palavra}
            icon={<Icon name="quote" size={13} />}
            onRemove={() => setPalavras((atuais) => atuais.filter((p) => p !== palavra))}
          >
            {palavra}
          </Tag>
        ))}
        <Tag>não clicável</Tag>
      </div>
    </div>
  );
}
