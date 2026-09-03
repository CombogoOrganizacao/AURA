import Link from "next/link";

import { BotaoExportar } from "@/components/editor/BotaoExportar";
import { Editor } from "@/components/editor/Editor";
import { FormMetadados } from "@/components/documento/FormMetadados";

// Tela de edição (passo 1.3.5). Servidor só resolve o `id` da rota; quem faz
// qualquer coisa com ele é client component (FormMetadados já é dono da
// própria persistência — passo 1.3.4). O editor ainda não carrega nem salva
// o corpo do documento: isso é o passo 1.3.6 (autosave), que também traz o
// indicador de "salvo" para o corpo — hoje só os metadados têm um. Por isso
// o botão de exportar (passo 1.4.4) baixa o que já está salvo, não o que
// está sendo digitado agora.
export default async function DocumentoPage(props: PageProps<"/documento/[id]">) {
  const { id } = await props.params;

  return (
    <div className="flex flex-1 flex-col gap-8 p-10 font-sans">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-bordo-700 underline hover:text-bordo-900">
          ← Meus trabalhos
        </Link>
        <BotaoExportar documentoId={id} />
      </div>

      <FormMetadados documentoId={id} />

      <Editor />
    </div>
  );
}
