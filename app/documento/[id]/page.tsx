import Link from "next/link";

import { BotaoExportar } from "@/components/editor/BotaoExportar";
import { DocumentoEditor } from "@/components/documento/DocumentoEditor";

// Tela de edição (passo 1.3.5). Servidor só resolve o `id` da rota; quem faz
// qualquer coisa com ele é client component. `DocumentoEditor` (passo 1.3.7)
// é o dono único do `Documento` aqui — carrega uma vez, salva com debounce
// (1.3.6) e passa `metadados`/`sections` controlados pro formulário e pro
// editor. Antes eram dois donos independentes (FormMetadados e Editor),
// cada um com sua cópia do `Documento`; o autosave de um apagava em
// silêncio a mudança mais recente do outro.
export default async function DocumentoPage(props: PageProps<"/documento/[id]">) {
  const { id } = await props.params;

  return (
    <div className="flex flex-1 flex-col gap-8 p-10 font-sans">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-bordo-700 underline hover:text-bordo-800">
          ← Meus trabalhos
        </Link>
        <BotaoExportar documentoId={id} />
      </div>

      <DocumentoEditor documentoId={id} />
    </div>
  );
}
