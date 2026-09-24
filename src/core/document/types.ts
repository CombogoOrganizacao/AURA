// Formato canônico do documento AURA — ver docs/aura-decisoes-e-pendencias.md
// §1.4. É a fonte de verdade que o editor, a persistência e os exportadores
// compartilham; nenhum deles guarda sua própria cópia da estrutura.
//
// Invariantes (ver CLAUDE.md, "Formato e dados"):
// - a numeração de seção é DERIVADA de `ordem` e `nivel`, nunca um campo;
// - referências são objetos CSL-JSON, nunca texto já formatado numa norma;
// - elementos pré-textuais são campos de `Metadados`, não nós do editor.

import type { CSLDate, CSLName, Referencia } from "../references/types";

export type NivelSecao = 1 | 2 | 3;

// Lista fechada de marcas (docs/schema-tiptap.md §5) — cresce um membro de
// cada vez, só quando a marca ganha código próprio em
// src/core/editor/marks/. `negrito`/`italico` desde o passo 2.5, `citacao`
// desde o 4.8; `sugestao` (estado da IA) entra quando ganhar código.
export type TipoMarca = "negrito" | "italico" | "citacao";

// Citação no texto ligada a uma referência (NBR 10520, docs/schema-tiptap.md
// §5.2) — passo 4.8. O trecho marcado é o texto DO ALUNO: o excerto citado
// (direta) ou a paráfrase (indireta). A chamada "(Silva, 2019, p. 45)" nunca
// é digitada nem guardada: é sintetizada destes atributos mais os dados da
// referência (4.9), e por isso muda sozinha quando a referência é corrigida.
//
// **Guarda `refId`, nunca o texto formatado.** Com a chamada gravada, corrigir
// o ano da referência deixaria o texto dizendo o ano velho, e excluir a
// referência não teria como ser percebido.
//
// **Órfã é estado DERIVADO, não campo.** Uma citação é órfã quando o `refId`
// não está mais em `Documento.references` (`citacoesOrfas()`,
// src/core/references/citacoes.ts). Excluir uma referência não toca no texto
// nem na marca — o texto do aluno fica exatamente como estava, e o "Desfazer"
// do painel reata a ligação sem código nenhum, porque ela nunca foi desfeita.
export type ModoCitacao = "direta_curta" | "indireta";

// Citação de citação (10520 §7.3): o aluno leu Freire citado por Silva. Só a
// fonte CONSULTADA (Silva) entra na lista de referências — é ela o `refId`. A
// obra original não é uma `Referencia` e por isso não tem id: os dados que a
// chamada precisa ("autoria, data, página, apud...") ficam aqui, em campos,
// pelo mesmo motivo de a referência ser CSL-JSON e não string. Declarado no
// 4.8, antes da interface que o cria (4.10), para a marca não mudar de forma
// depois e exigir migração dos documentos já salvos.
export interface FonteOriginal {
  author: CSLName[];
  issued?: CSLDate;
  pagina: string | null;
}

export interface AtributosCitacao {
  refId: string;
  modo: ModoCitacao;
  // Na citação direta, a página entra "se houver" (10520:2023 §6.1.3 e
  // §6.1.4; o Exemplo 2 do §6.1.3 cita sem página uma fonte não paginada).
  // Este comentário dizia "obrigatória" até o passo 5.2.2, que releu o PDF.
  // A falta é aviso da conferência (`rules/checks/citacoes.ts`), não recusa do
  // tipo: citação em edição passa por "sem página ainda".
  pagina: string | null;
  apud: FonteOriginal | null;
}

export type Marca =
  { type: "negrito" } | { type: "italico" } | { type: "citacao"; attrs: AtributosCitacao };

// Texto inline dentro de um parágrafo.
export interface NoTexto {
  type: "text";
  text: string;
  marks?: Marca[];
}

// `paragraph` e não `parágrafo`: o nó ainda é o `Paragraph` de fábrica do
// TipTap (src/components/editor/Editor.tsx), sem nó customizado próprio no
// plano — o `type` aqui espelha o que o editor produz de verdade, não o
// nome em prosa de docs/schema-tiptap.md §4.2.
export interface NoParagrafo {
  type: "paragraph";
  content?: NoTexto[];
}

// Citação longa (NBR 10520, docs/schema-tiptap.md §4.3) — passo 3.4.1.
// `refId`/`pagina` espelham os atributos do nó `citacao_longa`
// (src/core/editor/nodes/longQuote.ts), mas sem UI que os preencha ainda:
// não existe lista de referências editável (`Documento.references` fica
// sempre `[]` na prática), então `refId: null`/`pagina: ""` é o estado real
// de todo bloco criado hoje — ligar de verdade é trabalho da Fase 4.
export interface NoCitacaoLonga {
  type: "citacao_longa";
  refId: string | null;
  pagina: string;
  content?: NoTexto[];
}

// Figura (docs/schema-tiptap.md §4.6) — passo 3.6.3. Atômico: não há texto
// editável dentro do nó, só atributos.
//
// **Sem campo de número.** "Figura 3" é DERIVADO da posição do nó no
// documento (`numerarFiguras()`, src/core/document/numbering.ts), pelo mesmo
// motivo que `Secao` não guarda "2.1": um número gravado fica errado no
// instante em que alguém insere uma figura antes dele (docs/schema-tiptap.md
// §2, e CLAUDE.md "Formato e dados").
export interface NoFigura {
  type: "figura";
  // Existe para a numeração derivada ter por onde indexar a figura, e para
  // a lista de ilustrações (passo 3.6.4) apontar de volta pra ela — mesmo
  // papel de `Secao.id`.
  id: string;
  legenda: string;
  fonte: string;
  // Id da imagem guardada na persistência (`salvarImagem`, passo 6.1.2), ou
  // `null` sem imagem. Os bytes não moram no documento: cada autosave e cada
  // versão do histórico os copiaria (ver `ImagemArmazenada`).
  imagem: string | null;
}

// Célula de tabela (docs/schema-tiptap.md §4.7). `cabecalho` é atributo da
// célula, não da linha, porque é assim que o nó `celula_tabela` do editor o
// declara — e é o que permite uma linha de cabeçalho repetida quando a
// tabela quebra página (padrão do exportador da PoC).
export interface CelulaTabela {
  cabecalho: boolean;
  // Mesma forma inline de `NoParagrafo`: texto com `negrito`/`italico`.
  content?: NoTexto[];
}

export interface LinhaTabela {
  celulas: CelulaTabela[];
}

// Tabela (docs/schema-tiptap.md §4.7) — passo 3.6.3. Sem campo de número,
// pelo mesmo motivo de `NoFigura`.
export interface NoTabela {
  type: "tabela";
  id: string;
  legenda: string;
  fonte: string;
  linhas: LinhaTabela[];
}

// O que figura e tabela têm em comum: uma legenda cujo número vem da ordem
// de aparição, não de um campo. É o que `numerarFiguras()`/`numerarTabelas()`
// consomem e o que a lista de ilustrações (3.6.4) vai percorrer.
export type NoNumeravel = NoFigura | NoTabela;

// Fórmula (docs/schema-tiptap.md §4.8) — passo 3.6.5. Atômico: um campo só.
//
// **`texto` é a fonte em LaTeX, nunca a renderização.** O que fica gravado é
// `E = mc^2`; o desenho na tela vem do KaTeX no node view
// (`src/components/editor/nodes/FormulaView.tsx`), refeito a cada render e
// jogado fora. É o mesmo princípio de `Secao` não guardar "2.1": guarda-se o
// dado do qual tudo o mais deriva. Converter para OMML no `.docx` (passo
// 6.1.4) é reler `texto`, não desfazer HTML gravado.
//
// **Sem `id` e sem número**, ao contrário de `NoFigura`/`NoTabela`: a
// fórmula não é numerada (a NBR 14724 numera equação só "se necessário", e a
// v1 não numera nenhuma) nem entra em lista automática — não há quem indexe
// um id nem quem leia um número. Ver o cabeçalho de
// `src/core/editor/nodes/formula.ts`.
export interface NoFormula {
  type: "formula";
  texto: string;
}

// Lista fechada de conteúdo de `Secao`/`ElementoPosTextual`. Cresce um membro
// de cada vez, só quando o nó correspondente ganha código em
// src/core/editor/nodes/ (ver docs/schema-tiptap.md §7) — por ora cobre
// parágrafo, citação longa, figura, tabela e fórmula. `lista` entra quando
// for implementada.
export type NoConteudo = NoParagrafo | NoCitacaoLonga | NoFigura | NoTabela | NoFormula;

export interface Secao {
  id: string;
  ordem: number;
  nivel: NivelSecao;
  titulo: string;
  content: NoConteudo[];
}

// Apêndice ou anexo (NBR 14724) — passo 3.7.1. Mesma forma de conteúdo de uma
// seção, mas identificado por letra, não por nível/ordem numérica.
//
// **Sem campo de letra**, pelo mesmo motivo que `Secao` não guarda "2.1" e
// `NoFigura` não guarda "Figura 3" (docs/schema-tiptap.md §2, e CLAUDE.md
// "Formato e dados"): "APÊNDICE B" é DERIVADO da posição na lista
// (`letrarPorOrdem()`, ./numbering.ts). Uma letra gravada fica errada no
// instante em que alguém insere um apêndice antes dele — e um apêndice
// trocado de letra é uma referência cruzada quebrada no meio do texto.
//
// **Sem campo `ordem`**, ao contrário de `Secao`: a ordem é a posição no
// array, e um segundo campo só existiria para poder divergir dela (ver o
// cabeçalho da seção de apêndices em ./numbering.ts).
export interface ElementoPosTextual {
  id: string;
  titulo: string;
  content: NoConteudo[];
}

// --- Referências -------------------------------------------------------------
// Os tipos moraram aqui até o passo 4.1, quando a Fase 4 lhes deu módulo
// próprio (`src/core/references/types.ts`): seis formas de documento, cada uma
// com os seus campos, é assunto grande demais para viver de carona no formato
// do documento. O reexport mantém `Documento.references` legível de um lugar
// só — e continua valendo a invariante: campos separados, nunca string já
// formatada numa norma (CLAUDE.md, "Formato e dados").

export type {
  CSLDate,
  CSLName,
  CSLType,
  Referencia,
  ReferenciaArtigo,
  ReferenciaCapitulo,
  ReferenciaEvento,
  ReferenciaLivro,
  ReferenciaSite,
  ReferenciaTese,
} from "../references/types";

// --- Metadados ---------------------------------------------------------------
// Elementos pré-textuais (capa, folha de rosto, resumo/abstract) vêm daqui,
// nunca de nós do editor — é o que os mantém fora do corpo editável e do
// sumário (NBR 6027).

// Elemento pré-textual opcional e sem norma de conteúdo: dedicatória,
// agradecimentos e epígrafe (NBR 14724 §4.2.1, passo 3.5.3). `ativo` é
// separado de `texto` de propósito — desligar o elemento no painel de
// composição **não** apaga o que a pessoa escreveu, então religar devolve o
// texto intacto. É o que justifica o liga/desliga existir, em vez de "campo
// vazio = desligado" (que é como o abstract funciona, em 3.5.2).
export interface ElementoOpcional {
  ativo: boolean;
  texto: string;
}

// Abreviatura ou sigla usada no texto (NBR 14724) — passo 3.6.4. É campo de
// `Metadados`, e não nó do editor, pela invariante do CLAUDE.md: elemento
// pré-textual é metadado. O que a pessoa cadastra é o PAR (sigla e o que ela
// significa); a lista em si — quem entra, em que ordem — é derivada.
export interface Abreviatura {
  // Chave estável da linha no painel: `sigla` não serve, porque muda
  // enquanto se digita.
  id: string;
  sigla: string;
  significado: string;
}

export interface Metadados {
  // A v1 atende só TCC em ABNT; os campos existem para não ter que migrar o
  // formato quando outra norma ou tipo de trabalho entrar.
  tipo: "tcc";
  norma: "abnt";

  titulo: string;
  subtitulo?: string;
  autores: string[];
  instituicao: string;
  curso: string;
  orientador: string;
  local: string;
  ano: number;
  naturezaTrabalho: string;

  resumo: string;
  palavrasChave: string[];
  abstract: string;
  keywords: string[];

  // Opcionais (NBR 14724 §4.2.1) — passo 3.5.3. **Opcionais no tipo, não só
  // na norma**: documento gravado antes deste passo não tem estes campos no
  // IndexedDB, e o `?` é o que diz a verdade sobre o que pode vir de lá. É
  // por isso que não existe migração nem valor padrão em `novoDocumento()`:
  // ausente e `ativo: false` significam a mesma coisa — desligado —, então
  // não há estado a corrigir, só `?.` na leitura.
  dedicatoria?: ElementoOpcional;
  agradecimentos?: ElementoOpcional;
  epigrafe?: ElementoOpcional;

  // Lista de abreviaturas e siglas (passo 3.6.4) — opcional no tipo pelo
  // mesmo motivo dos três acima: documento gravado antes deste passo não tem
  // o campo no IndexedDB, e ausente significa "nenhuma cadastrada". Sem
  // migração nem valor padrão em `novoDocumento()`, só `?? []` na leitura.
  abreviaturas?: Abreviatura[];

  // Banca examinadora da folha de aprovação (NBR 14724:2024 §4.2.1.3) —
  // passo 4B.3. Opcional no tipo pelo mesmo motivo dos campos acima:
  // documento gravado antes do passo não tem o campo, e ausente significa
  // "nenhum membro cadastrado". Sem migração, só `?? []` na leitura.
  //
  // Sem data de aprovação e sem assinatura: a norma manda que as duas
  // "sejam colocadas após a aprovação do trabalho", então a folha sai com as
  // duas em branco, e o AURA não guarda nenhuma delas.
  bancaExaminadora?: MembroBanca[];
}

// Um membro da banca: "nome, titulação e assinatura dos componentes da banca
// examinadora e instituições a que pertencem" (§4.2.1.3). A assinatura é à
// mão, depois da defesa. `id` para a lista da tela editar e remover sem
// depender da posição.
export interface MembroBanca {
  id: string;
  nome: string;
  titulacao: string;
  instituicao: string;
}

export interface Documento {
  id: string;
  metadados: Metadados;
  sections: Secao[];
  references: Referencia[];
  apendices: ElementoPosTextual[];
  anexos: ElementoPosTextual[];
}
