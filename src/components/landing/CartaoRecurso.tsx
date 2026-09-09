import { Card } from "@/components/ui/Card";
import { Icon, type NomeIcone } from "@/components/ui/Icon";

interface CartaoRecursoProps {
  icone: NomeIcone;
  titulo: string;
  descricao: string;
}

// Um cartão da grade de recursos da landing — ícone num quadrado
// `--radius-md` com fundo `--bordo-50`, a única exceção documentada à
// regra de ícone sempre monocromático sem círculo colorido (readme da
// skill, ICONOGRAPHY).
export function CartaoRecurso({ icone, titulo, descricao }: CartaoRecursoProps) {
  return (
    <Card>
      <span className="flex size-10 items-center justify-center rounded-md bg-brand-soft text-bordo-700">
        <Icon name={icone} size={20} />
      </span>
      <h3 className="mt-4 text-lg">{titulo}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{descricao}</p>
    </Card>
  );
}
