import { Badge } from "@/components/ui/Badge";
import { Radio } from "@/components/ui/Radio";

// Aba IA do inspetor — passo 6.5.4. Espaço reservado para o seletor de chave
// e o contador de tokens (§1.10 das decisões), inativo: a IA está fora da
// v1, e a rota `/api/ai` responde `501` (docs/contrato-api-ai.md).
//
// **Não sugere o que não existe.** Até este passo, a aba mostrava exemplos
// esmaecidos sob um véu ("Resuma esta seção", "Sugira uma transição",
// "Pergunte algo sobre o documento…"). Eram justamente o que o contrato
// exclui: instrução livre e geração de texto. Além disso, apresentavam o AURA
// como "assistente de escrita", o contrário do limite do produto. Saíram
// todos. O que fica é só a moldura do que vai existir: os dois caminhos de
// chave (§1.9) e o contador.
//
// **Nenhum número inventado.** O contador mostra "—", e não "0": a contagem
// é a que o Gemini devolve depois da chamada (§1.9), e chamada nenhuma
// aconteceu. Nenhum radio vem marcado, pelo mesmo motivo: não há chave em
// uso.
//
// A posição definitiva do contador segue em aberto (§1.9: "canto inferior ou
// junto de Conta/Perfil"). Este é o lugar reservado até lá.
export function EspacoIA() {
  return (
    <section aria-labelledby="espaco-ia-titulo" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 id="espaco-ia-titulo" className="font-sans text-sm font-semibold text-title">
            Revisão com IA
          </h3>
          <Badge>Indisponível</Badge>
        </div>
        <p className="font-sans text-xs leading-relaxed text-body">
          A revisão com IA não faz parte desta versão do AURA. Nenhum trecho do trabalho é enviado a
          serviço de IA.
        </p>
      </div>

      <fieldset disabled className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0">
        <legend className="mb-2.5 p-0 font-sans text-2xs font-semibold tracking-wide text-muted uppercase">
          Chave de API
        </legend>
        <Radio name="espaco-ia-chave" label="Chave do AURA" checked={false} readOnly disabled />
        <Radio
          name="espaco-ia-chave"
          label="Sua chave do Gemini"
          checked={false}
          readOnly
          disabled
        />
      </fieldset>

      <dl className="m-0 flex flex-col gap-1">
        <dt className="font-sans text-2xs font-semibold tracking-wide text-muted uppercase">
          Tokens nesta sessão
        </dt>
        <dd className="m-0 font-mono text-sm text-subtle">
          <span aria-hidden="true">—</span>
          <span className="sr-only">Nenhuma contagem</span>
        </dd>
      </dl>
    </section>
  );
}
