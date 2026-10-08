import { Alert } from "@/components/ui/Alert";
import { Icon } from "@/components/ui/Icon";
import { Tooltip } from "@/components/ui/Tooltip";

// Aviso de dados locais (passo 6.4.2, decisão §1.11): sem login, o trabalho
// vive no IndexedDB deste navegador. Limpar os dados do site, usar aba
// anônima ou trocar de computador o apaga, e não há cópia em lugar nenhum.
//
// **Fixo, sem X** (decisão da usuária, 08/10/2026): um aviso dispensado uma
// vez sumiria para sempre, e o risco continua o mesmo enquanto não houver
// login. Por isso discreto: uma faixa na lista e um selo no editor. Sai
// junto com o adaptador Firestore, quando o trabalho passar a ter cópia na
// nuvem.

// Na lista "Meus documentos", acima da tabela. Só aparece com trabalhos na
// lista: o estado vazio mostra apenas a ação de criar (6.4.1).
export function AvisoDadosLocais() {
  return (
    <Alert tone="warning" title="Seus trabalhos ficam salvos só neste navegador">
      Limpar os dados do site, usar uma aba anônima ou trocar de computador apaga os trabalhos, e
      não há cópia em outro lugar. Exporte uma cópia (.docx ou projeto LaTeX) com frequência: as
      ações ficam em cada linha.
    </Alert>
  );
}

// No editor, ao lado do status do autosave, com o "Exportar" logo à direita.
// O selo recebe foco para a dica abrir também pelo teclado.
export function SeloDadosLocais() {
  return (
    <Tooltip content="Limpar os dados do site, usar uma aba anônima ou trocar de computador apaga o trabalho. Exporte uma cópia com frequência">
      <span
        tabIndex={0}
        className="flex shrink-0 items-center gap-1 rounded-xs font-sans text-2xs text-warning focus-visible:outline-none focus-visible:shadow-focus-ring"
      >
        <Icon name="triangle-alert" size={13} />
        {/* No celular só o ícone (6.4.4); o texto continua para o leitor de
            tela, e a dica abre do mesmo jeito. */}
        <span className="sr-only sm:not-sr-only">Só neste navegador</span>
      </span>
    </Tooltip>
  );
}
