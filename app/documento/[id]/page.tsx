import Link from "next/link";

import { Editor } from "@/components/editor/Editor";
import { FormMetadados } from "@/components/documento/FormMetadados";

// Tela de edição (passo 1.3.5). Servidor só resolve o `id` da rota; quem faz
// qualquer coisa com ele é client component (FormMetadados já é dono da
// própria persistência — passo 1.3.4). O editor ainda não carrega nem salva
// o corpo do documento: isso é o passo 1.3.6 (autosave), que também traz o
// indicador de "salvo" para o corpo — hoje só os metadados têm um.
export default async function DocumentoPage(props: PageProps<"/documento/[id]">) {
  const { id } = await props.params;

  return (
    <div className="flex flex-1 flex-col gap-8 p-10 font-sans">
      <Link href="/" className="text-sm text-bordo-700 underline hover:text-bordo-900">
        ← Meus trabalhos
      </Link>

      <FormMetadados documentoId={id} />

      <Editor />
    </div>
  );
}
