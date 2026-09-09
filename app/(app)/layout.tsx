import type { ReactNode } from "react";

import { AppTopBar } from "@/components/app/AppTopBar";

// Casca das telas internas — "Meus documentos" (2B.8) e "Central de
// editais" (2B.9), as duas próximas a entrar neste grupo de rotas. A
// landing (`/`) e as telas de autenticação (`/entrar`, `/cadastrar`) vivem
// fora do grupo porque montam a barra em outro modo (`guest`); o editor
// (`/documento/[id]`) também fica fora porque usa o modo `editor`, com
// título e ações próprias que só a página do documento tem.
//
// `LayoutProps<"/(app)">` não existe: um grupo de rotas não tem URL
// própria, e o typegen do Next só sabe tipar layout contra uma rota real —
// que ainda não existe aqui (nasce em 2B.8/2B.9). `ReactNode` simples,
// sem genérico, é o que sobra pra um layout sem nenhuma página própria
// ainda.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppTopBar mode="app" />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
