import { Icon } from "@/components/ui/Icon";

// Central de editais — passo 2B.9. Fora da v1 (docs/aura-decisoes-e-
// pendencias.md §1.15, §1.2): "só o link de navegação entra" no CLAUDE.md.
// Tela mínima só com o aviso — sem campo de "avise-me", que precisaria de
// um lugar real pra guardar o e-mail e ninguém decidiu isso ainda. É
// responsabilidade de outra pessoa, em paralelo.
export default function EditaisPage() {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="flex size-14 items-center justify-center rounded-lg bg-sunken text-subtle">
        <Icon name="book-marked" size={26} />
      </span>
      <h1 className="text-2xl">Central de editais</h1>
      <p className="font-sans text-sm leading-relaxed text-muted">
        Em breve. Aqui a AURA vai ajudar a conferir o seu trabalho contra as regras de um edital
        específico — prazos, limites e formatação exigidos pela instituição.
      </p>
    </div>
  );
}
