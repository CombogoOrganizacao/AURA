"use client";

import { useState } from "react";

import { ModalExportar } from "@/components/editor/ModalExportar";
import { Button } from "@/components/ui/Button";
import type { Documento } from "@/core/document/types";
import type { CampoExigido } from "@/core/rules/checks/dadosDeIdentificacao";
import { usePersistencia } from "@/lib/persistence-provider";

interface BotaoExportarProps {
  // O documento como está na tela, e não o salvo.
  documento: Documento;
  // Grava já, sem esperar o autosave.
  salvarAgora: () => Promise<void>;
  // Leva ao campo que falta, nos dados do trabalho (6.2.12).
  onPreencherDados?: (campo: CampoExigido) => void;
}

// Botão "Exportar" (barra superior e rodapé do inspetor): abre a janela com
// os três formatos (`ModalExportar`, passo 6.3.2).
//
// **Exporta o que está na tela** (correção feita junto do 6.1.2). Até ali
// exportava o documento salvo, e o autosave espera 4 s depois da última
// tecla: quem exportava logo após editar recebia o arquivo sem as últimas
// mudanças, e o aluno pode descobrir isso só depois de entregar. Agora o
// documento vem de quem está com ele (`DocumentoEditor`), e a janela grava
// na hora (`salvarAgora`), para o exportado estar também salvo.
//
// Desabilitar o botão até o autosave terminar foi considerado e descartado:
// quem digita sem parar veria o botão sempre desabilitado, e uma falha de
// gravação o prenderia assim, justo quando exportar é o jeito de não
// perder o trabalho. Se a gravação falhar, a exportação segue com o que está
// na tela, e o status do autosave mostra o erro.
export function BotaoExportar({ documento, salvarAgora, onPreencherDados }: BotaoExportarProps) {
  const persistencia = usePersistencia();
  const [aberto, setAberto] = useState(false);

  return (
    <>
      {/* `Button` do sistema, do mesmo tamanho do "Importar LaTeX" ao lado:
          um `<button>` com padding próprio saía mais alto que ele. */}
      <Button onClick={() => setAberto(true)} disabled={!persistencia}>
        Exportar
      </Button>

      {aberto && (
        <ModalExportar
          documento={documento}
          salvarAgora={salvarAgora}
          onFechar={() => setAberto(false)}
          onPreencherDados={onPreencherDados}
        />
      )}
    </>
  );
}
