import type { ReactNode } from "react";

import { Icon } from "./Icon";

// Estados de painel/tela inteira (passo 2.3) — o que substitui o conteúdo
// enquanto ele ainda não chegou, não existe, ou falhou ao carregar. Não é o
// mesmo papel de um aviso que convive com o conteúdo (isso seria um
// componente à parte, ainda não pedido pelo to-do) — os três aqui tomam o
// lugar inteiro do que substituem.

interface EstadoCarregandoProps {
  /** Texto abaixo do spinner. */
  texto?: ReactNode;
  className?: string;
}

// Mesmo spinner do `Button` (`loading`), maior e centralizado, ocupando um
// painel ou tela inteira em vez de um botão.
export function EstadoCarregando({ texto = "Carregando…", className = "" }: EstadoCarregandoProps) {
  return (
    <div role="status" className={`flex flex-col items-center gap-3 py-14 text-muted ${className}`}>
      <span
        aria-hidden="true"
        className="size-6 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
      />
      {texto && <span className="font-sans text-sm">{texto}</span>}
    </div>
  );
}

interface EstadoVazioProps {
  /** Ícone acima da mensagem — default o ícone de documento. */
  icon?: ReactNode;
  /** Mensagem principal — diz o que está vazio, não um genérico "Nada aqui". */
  titulo: ReactNode;
  descricao?: ReactNode;
  /** Ação de saída — ex.: `<Button>Criar novo documento</Button>`. */
  action?: ReactNode;
  className?: string;
}

// Mesma moldura do estado vazio de `DocumentsScreen` na skill `aura-design`
// (`ui_kits/app/DocumentsScreen.jsx`): ícone ink-300, mensagem muted,
// centralizado, respiro generoso — nunca uma tabela/lista vazia.
export function EstadoVazio({
  icon = <Icon name="file-text" size={30} />,
  titulo,
  descricao,
  action,
  className = "",
}: EstadoVazioProps) {
  return (
    <div className={`flex flex-col items-center gap-2 py-14 text-center ${className}`}>
      <span className="text-ink-300">{icon}</span>
      <p className="font-sans text-sm text-muted">{titulo}</p>
      {descricao && <p className="max-w-prose font-sans text-xs text-subtle">{descricao}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

interface EstadoErroProps {
  /** O que deu errado — nunca genérico ("Ocorreu um erro"). */
  titulo: ReactNode;
  descricao?: ReactNode;
  /** Ação de saída — ex.: `<Button onClick={tentarDeNovo}>Tentar de novo</Button>`. */
  action?: ReactNode;
  className?: string;
}

// Diz o que deu errado e oferece a saída (regra de copy do readme.md da
// skill, "Mensagens de erro e aviso"). `role="alert"` — diferente de
// `EstadoCarregando`/`EstadoVazio`, anuncia imediatamente pra leitor de tela.
export function EstadoErro({ titulo, descricao, action, className = "" }: EstadoErroProps) {
  return (
    <div role="alert" className={`flex flex-col items-center gap-2 py-14 text-center ${className}`}>
      <span className="text-danger">
        <Icon name="circle-alert" size={30} />
      </span>
      <p className="font-sans text-sm font-medium text-body">{titulo}</p>
      {descricao && <p className="max-w-prose font-sans text-xs text-subtle">{descricao}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
