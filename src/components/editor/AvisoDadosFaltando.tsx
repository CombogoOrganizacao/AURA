"use client";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { dadosFaltando } from "@/core/rules/checks/dadosDeIdentificacao";

interface AvisoDadosFaltandoProps {
  faltando: ReturnType<typeof dadosFaltando>;
  onExportarAssimMesmo: () => void;
  onFechar: () => void;
  // O caminho para completar: no editor, abre o campo; na lista, abre o
  // trabalho.
  preencher?: { rotulo: string; onClick: () => void };
}

// **Dado de capa faltando avisa antes, sem impedir** (passo 6.2.12). Um TCC
// importado de fora do AURA chega sem título, autor nem orientador, e o
// `.docx` sairia com a capa só com o ano e "Orientador:" sem nome. O diálogo
// lista o que falta (a mesma regra da conferência, `dadosFaltando()`) e
// oferece completar ou exportar assim mesmo: exportar um rascunho é
// legítimo, e bloquear tiraria do aluno o jeito de salvar o trabalho fora.
export function AvisoDadosFaltando({
  faltando,
  onExportarAssimMesmo,
  onFechar,
  preencher,
}: AvisoDadosFaltandoProps) {
  return (
    <Dialog
      open
      width={480}
      title="Faltam dados da capa"
      subtitle="A capa e a folha de rosto vão sair incompletas"
      onClose={onFechar}
      footer={
        <>
          <Button variant="ghost" onClick={onExportarAssimMesmo}>
            Exportar assim mesmo
          </Button>
          {preencher && <Button onClick={preencher.onClick}>{preencher.rotulo}</Button>}
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm text-body">
        <Alert tone="warning" title="Elementos obrigatórios (NBR 14724) ainda vazios">
          <ul className="list-disc pl-5">
            {faltando.map((item) => (
              <li key={item.campo}>{item.nome}</li>
            ))}
          </ul>
        </Alert>
        <p className="text-xs text-muted">
          Dá para exportar agora e completar depois: o arquivo sai com esses lugares vazios.
        </p>
      </div>
    </Dialog>
  );
}
