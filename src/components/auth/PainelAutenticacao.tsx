import { Brand } from "@/components/app/Brand";
import { Icon } from "@/components/ui/Icon";

const DESTAQUES = [
  "Formatação automática conforme a NBR 14724",
  "Conferência de citações e referências",
  "Exportação em .docx com a formatação preservada",
] as const;

// Painel bordô à esquerda, constante em /entrar e /cadastrar — mesma
// composição do `AuthAside` de referência: marca, promessa central,
// três destaques com `check`. Fundo bordô cheio é um dos poucos lugares
// do sistema em que o creme carrega o texto (readme da skill, "Cor").
export function PainelAutenticacao() {
  return (
    <div className="flex flex-col justify-between bg-bordo-700 p-14 text-creme-100">
      <Brand tone="creme" size={40} />

      <div className="max-w-[420px]">
        <h2 className="text-3xl leading-tight font-semibold text-creme-200">
          Seu trabalho nas normas, sem retrabalho.
        </h2>
        <p className="mt-3.5 text-sm leading-relaxed opacity-80">
          Formatação ABNT, verificação de citações e revisão de texto no mesmo lugar — do sumário às
          referências.
        </p>
      </div>

      <ul className="flex flex-col gap-2.5 p-0 text-xs opacity-85">
        {DESTAQUES.map((destaque) => (
          <li key={destaque} className="flex items-center gap-2.5">
            <span className="flex text-creme-300">
              <Icon name="check" size={15} />
            </span>
            {destaque}
          </li>
        ))}
      </ul>
    </div>
  );
}
