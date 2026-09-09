"use client";

// Checkbox indeterminado, grupo de Radio e Switch precisam de estado de
// verdade pra demonstrar transição — mesmo motivo de TagDemo.tsx.
import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Checkbox } from "@/components/ui/Checkbox";
import { Radio } from "@/components/ui/Radio";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";

export function CheckboxDemo() {
  const [marcado, setMarcado] = useState(true);
  return (
    <div className="flex flex-col gap-3">
      <Checkbox
        checked={marcado}
        onChange={(e) => setMarcado(e.target.checked)}
        label="Verificar citações"
        description="Compara chamadas no texto com as referências."
      />
      <Checkbox indeterminate label="Verificar tudo (parcial)" />
      <Checkbox label="Sem controle (alterna sozinho)" />
      <Checkbox disabled checked label="Desabilitado, marcado" />
    </div>
  );
}

const NIVEIS = [
  {
    valor: "completa",
    titulo: "Revisão completa",
    descricao: "Ortografia, coesão, normas e referências.",
  },
  {
    valor: "normas",
    titulo: "Só normas ABNT",
    descricao: "Margens, entrelinha, numeração e sumário.",
  },
] as const;

export function RadioDemo() {
  const [nivel, setNivel] = useState<string>("completa");
  return (
    <div className="flex flex-col gap-3">
      {NIVEIS.map((n) => (
        <Radio
          key={n.valor}
          name="nivel-demo"
          value={n.valor}
          checked={nivel === n.valor}
          onChange={() => setNivel(n.valor)}
          label={n.titulo}
          description={n.descricao}
        />
      ))}
      <Radio name="nivel-demo" value="indisponivel" disabled label="Desabilitado" />
    </div>
  );
}

export function SwitchDemo() {
  const [ligado, setLigado] = useState(true);
  return (
    <div className="flex max-w-sm flex-col gap-3">
      <Switch
        checked={ligado}
        onChange={(e) => setLigado(e.target.checked)}
        label="Verificar enquanto escrevo"
        description="Recalcula a conformidade a cada pausa na digitação."
      />
      <Switch disabled label="Desabilitado" />
    </div>
  );
}

export function TextareaDemo() {
  return (
    <div className="flex max-w-md flex-col gap-4">
      <Textarea
        label="Resumo"
        rows={4}
        maxLength={1500}
        counter
        hint="Entre 150 e 250 palavras."
        defaultValue="A pesquisa investiga o impacto da automação de revisão em trabalhos acadêmicos."
      />
      <Textarea label="Com erro" error="Campo obrigatório." rows={2} />
      <Textarea label="Desabilitado" disabled rows={2} defaultValue="Texto travado." />
    </div>
  );
}

export function AlertDismissDemo() {
  const [aberto, setAberto] = useState(true);
  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="font-sans text-xs text-link underline"
      >
        Mostrar aviso de novo
      </button>
    );
  }
  return (
    <Alert tone="info" title="Aviso dispensável" onDismiss={() => setAberto(false)}>
      Clique no “x” para fechar — o estado é de verdade, não decorativo.
    </Alert>
  );
}
