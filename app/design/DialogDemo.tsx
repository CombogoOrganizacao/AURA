"use client";

// Client boundary só pra este pedaço da página de amostra (passo 2.2): o
// `Dialog` precisa de um `open` controlado por clique, e `app/design/page.tsx`
// é Server Component — não pode ter `useState` direto. Fica num arquivo à
// parte por isso, não porque o componente em si precise de arquivo próprio.
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

export function DialogDemo() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setAberto(true)}>
        Abrir modal de amostra
      </Button>
      <Dialog
        open={aberto}
        title="Exportar documento"
        subtitle="A formatação ABNT será aplicada na exportação."
        onClose={() => setAberto(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setAberto(false)}>Exportar</Button>
          </>
        }
      >
        Conteúdo de amostra do corpo do modal — Esc ou clique fora fecham, Tab não escapa.
      </Dialog>
    </>
  );
}
