"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";

// Escolher o tamanho da tabela antes de criá-la (passo 8.5.1 da
// Fase 8, §8.5.1): uma grade de 8×8 que se acende com o mouse, e dois campos
// de colunas e linhas, que são o caminho do teclado e de quem quer mais que
// oito. A grade é só um atalho do mouse e fica fora da árvore de
// acessibilidade (`aria-hidden`): tudo o que ela faz, os campos fazem.

const GRADE = 8;
export const MAXIMO_COLUNAS = 10;
export const MAXIMO_LINHAS = 50;

interface SeletorTabelaProps {
  onInserir: (colunas: number, linhas: number) => void;
  onFechar: () => void;
}

function limitar(texto: string, maximo: number): number | null {
  const numero = Number.parseInt(texto, 10);
  if (!Number.isFinite(numero) || numero < 1) return null;
  return Math.min(numero, maximo);
}

export function SeletorTabela({ onInserir, onFechar }: SeletorTabelaProps) {
  const [colunas, setColunas] = useState("2");
  const [linhas, setLinhas] = useState("2");
  // A célula sob o mouse, da grade: acende o retângulo até ela.
  const [sobre, setSobre] = useState<{ coluna: number; linha: number } | null>(null);

  const nColunas = limitar(colunas, MAXIMO_COLUNAS);
  const nLinhas = limitar(linhas, MAXIMO_LINHAS);
  const valido = nColunas !== null && nLinhas !== null;

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (valido) onInserir(nColunas, nLinhas);
  }

  const aceso = sobre ?? (valido ? { coluna: nColunas, linha: nLinhas } : null);

  return (
    <Dialog
      open
      width={400}
      restaurarFoco={false}
      title="Inserir tabela"
      subtitle="Escolha quantas colunas e linhas. A primeira linha é o cabeçalho."
      onClose={onFechar}
      footer={
        <>
          <Button variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-tabela" disabled={!valido}>
            Inserir tabela
          </Button>
        </>
      }
    >
      {/* `noValidate`: os limites são recolhidos por `limitar()`, e a validação do
          navegador barrava "99" antes disso, com um balão que ninguém pediu. */}
      <form id="form-tabela" noValidate onSubmit={enviar} className="flex flex-col gap-4">
        <div
          aria-hidden="true"
          className="flex flex-col items-center gap-1"
          onMouseLeave={() => setSobre(null)}
        >
          <div
            className="grid gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${GRADE}, 1.5rem)` }}
          >
            {Array.from({ length: GRADE * GRADE }, (_, i) => {
              const coluna = (i % GRADE) + 1;
              const linha = Math.floor(i / GRADE) + 1;
              const ligada = aceso !== null && coluna <= aceso.coluna && linha <= aceso.linha;
              return (
                <div
                  key={i}
                  onMouseEnter={() => setSobre({ coluna, linha })}
                  onClick={() => onInserir(coluna, linha)}
                  className={[
                    "size-6 cursor-pointer rounded-xs border",
                    ligada
                      ? "border-bordo-700 bg-brand-soft"
                      : "border-[var(--border-default)] bg-card",
                  ].join(" ")}
                />
              );
            })}
          </div>
          <p className="text-xs text-muted">
            {aceso ? `${aceso.coluna} colunas × ${aceso.linha} linhas` : " "}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            data-foco-inicial
            label="Colunas"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAXIMO_COLUNAS}
            hint={`De 1 a ${MAXIMO_COLUNAS}`}
            value={colunas}
            onChange={(evento) => setColunas(evento.target.value)}
          />
          <Input
            label="Linhas"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAXIMO_LINHAS}
            hint={`De 1 a ${MAXIMO_LINHAS}, com o cabeçalho`}
            value={linhas}
            onChange={(evento) => setLinhas(evento.target.value)}
          />
        </div>
      </form>
    </Dialog>
  );
}
