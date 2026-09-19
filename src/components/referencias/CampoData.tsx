"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { CSLDate } from "@/core/references/types";

interface CampoDataProps {
  rotulo: string;
  dica?: string;
  obrigatorio?: boolean;
  valor: CSLDate | undefined;
  onChange: (data: CSLDate | undefined) => void;
}

// Nomes por extenso para o seletor. **Não são as abreviaturas da referência**
// — essas estão no Anexo A (normativo) da NBR 6023, mudam com o idioma do
// documento e são assunto do formatador (passo 4.3). Aqui a pessoa escolhe um
// mês; quem decide se ele sai "jan." ou "maio" é quem formata.
const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
].map((nome, indice) => ({ value: String(indice + 1), label: nome }));

// Data de uma referência (passo 4.2) — publicação, acesso, defesa, evento.
//
// **Ano, mês e dia separados, não um campo de texto.** É o `date-parts` do
// CSL-JSON, e é o que permite ao formatador (4.3) escrever "2023", "jan. 2023"
// ou "18 jan. 2023" conforme o tipo de documento pedir, sem tentar interpretar
// uma string. A maioria das referências usa só o ano.
//
// **A data incerta é o outro caminho, e exclui o primeiro.** A §8.6.1.3 prevê
// "[1969?]", "[entre 1906 e 1912]", "[ca. 1960]", "[197-]" — datas que **não
// cabem em números**, e que forçadas em `date-parts` inventariam uma precisão
// que a fonte não tem. É o `raw` de `CSLDate`, criado no 4.1 para isto. Os dois
// não podem estar preenchidos ao mesmo tempo: o formatador teria que escolher
// um por conta própria, e é o tipo de escolha silenciosa que este projeto
// recusa — por isso preencher um desabilita o outro, à vista.
export function CampoData({ rotulo, dica, obrigatorio, valor, onChange }: CampoDataProps) {
  const [ano, mes, dia] = valor?.["date-parts"]?.[0] ?? [];
  const incerta = valor?.raw ?? "";
  const temNumeros = ano !== undefined;

  // `date-parts` é posicional: dia sem mês não existe no formato. Descartar as
  // partes vazias do fim é o que mantém `[[2023]]` em vez de `[[2023, NaN]]`.
  function atualizarPartes(proximas: Array<number | undefined>) {
    const partes: number[] = [];
    for (const parte of proximas) {
      if (parte === undefined || Number.isNaN(parte)) break;
      partes.push(parte);
    }

    if (partes.length === 0) return onChange(undefined);
    onChange({ "date-parts": [partes as [number, number?, number?]] });
  }

  function numero(texto: string): number | undefined {
    return texto.trim() === "" ? undefined : Number(texto);
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded-sm border border-[var(--border-subtle)] p-3">
      <legend className="px-1 font-sans text-xs font-medium tracking-wide text-body">
        {rotulo}
        {obrigatorio && <span className="text-danger"> *</span>}
      </legend>

      <div className="flex items-end gap-2">
        <Input
          aria-label={`${rotulo} — ano`}
          type="number"
          inputMode="numeric"
          disabled={incerta !== ""}
          value={ano ?? ""}
          onChange={(evento) => atualizarPartes([numero(evento.target.value), mes, dia])}
          placeholder="2023"
        />
        <Select
          aria-label={`${rotulo} — mês`}
          disabled={incerta !== "" || !temNumeros}
          value={mes === undefined ? "" : String(mes)}
          onChange={(evento) => atualizarPartes([ano, numero(evento.target.value), dia])}
        >
          <option value="">Mês (opcional)</option>
          {MESES.map((opcao) => (
            <option key={opcao.value} value={opcao.value}>
              {opcao.label}
            </option>
          ))}
        </Select>
        <Input
          aria-label={`${rotulo} — dia`}
          type="number"
          inputMode="numeric"
          disabled={incerta !== "" || mes === undefined}
          value={dia ?? ""}
          onChange={(evento) => atualizarPartes([ano, mes, numero(evento.target.value)])}
          placeholder="Dia"
        />
      </div>

      <Input
        aria-label={`${rotulo} — data incerta`}
        label="ou data incerta"
        hint="Quando a fonte não traz a data exata: [1969?], [entre 1906 e 1912], [ca. 1960], [197-]."
        disabled={temNumeros}
        value={incerta}
        onChange={(evento) =>
          onChange(evento.target.value ? { raw: evento.target.value } : undefined)
        }
        placeholder="[ca. 1960]"
      />

      {dica && <p className="font-sans text-2xs text-subtle">{dica}</p>}
    </fieldset>
  );
}
