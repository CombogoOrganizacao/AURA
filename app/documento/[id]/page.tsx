import { DocumentoEditor } from "@/components/documento/DocumentoEditor";

// Tela de edição (passo 1.3.5). Servidor só resolve o `id` da rota; quem faz
// qualquer coisa com ele é client component. `DocumentoEditor` (passo 1.3.7)
// é o dono único do `Documento` aqui — carrega uma vez, salva com debounce
// (1.3.6) e passa `metadados`/`sections` controlados pro formulário e pro
// editor. Antes eram dois donos independentes (FormMetadados e Editor),
// cada um com sua cópia do `Documento`; o autosave de um apagava em
// silêncio a mudança mais recente do outro.
//
// A partir do passo 2B.10, esta página é só a fronteira Server → Client: o
// "← Meus trabalhos" e o "Exportar .docx" que viviam aqui, soltos, agora
// são o `AppTopBar` no modo `editor` e o slot `acoes` dentro do próprio
// `DocumentoEditor` — a página não precisa mais deles.
export default async function DocumentoPage(props: PageProps<"/documento/[id]">) {
  const { id } = await props.params;

  return <DocumentoEditor documentoId={id} />;
}
