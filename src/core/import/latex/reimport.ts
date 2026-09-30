import { novoDocumento } from "../../document/factory";
import type {
  AtributosCitacao,
  Documento,
  ElementoOpcional,
  ElementoPosTextual,
  Marca,
  Metadados,
  NoConteudo,
  NoInline,
  Secao,
} from "../../document/types";
import { chamadaDaCitacao } from "../../references/citacoes";
import type { Aviso } from "./fonte";
import type { BlocoLido, MetadadosLidos, PosTextualLido, TexLido } from "./lerTex";

// Reimportação do `.tex` (passo 6.2.4, segundo commit): compara o que o
// arquivo diz (`lerTex()`) com o documento salvo e monta o documento novo e
// o relatório. **Não grava nada.** O relatório vai para a tela; só depois do
// "confirmar" quem chama grava, com o documento de agora guardado antes como
// versão (`substituirDocumento()` em persistence/versions.ts). Regras em
// docs/latex-abntex.md §1.5.
//
// **O que não mudou fica exatamente como estava.** A volta pelo LaTeX perde
// coisas que não são edição: dois espaços viram um (o LaTeX imprime um),
// parágrafo vazio some, figura e tabela voltam sem `id`. Uma seção cujo
// conteúdo, comparado sem essas diferenças, é o mesmo, continua com o
// conteúdo salvo, e não entra no relatório como alterada.

export interface ItemDoRelatorio {
  id: string;
  titulo: string;
}

export type Mudanca = "titulo" | "nivel" | "texto" | "posicao";

export interface ItemAlterado extends ItemDoRelatorio {
  mudancas: Mudanca[];
  // Título de antes, quando mudou.
  tituloAntes?: string;
}

export interface Comparacao {
  novas: ItemDoRelatorio[];
  removidas: ItemDoRelatorio[];
  alteradas: ItemAlterado[];
}

export type CampoReimportado = keyof MetadadosLidos;

export interface CampoAlterado {
  campo: CampoReimportado;
  antes: string;
  depois: string;
}

export interface Relatorio {
  // O `id` do arquivo não existe nesta máquina: a reimportação cria um
  // documento novo (§1.5).
  documentoNovo: boolean;
  secoes: Comparacao;
  apendices: Comparacao;
  anexos: Comparacao;
  metadados: CampoAlterado[];
  avisos: Aviso[];
  semMudancas: boolean;
}

export interface Reimportacao {
  documento: Documento;
  relatorio: Relatorio;
}

export function montarReimportacao(
  atual: Documento | null,
  lido: TexLido,
  gerarId: () => string = () => crypto.randomUUID(),
): Reimportacao {
  const base: Documento = atual ?? { ...novoDocumento(), id: lido.documentoId };
  const avisos: Aviso[] = [...lido.avisos];

  const metadados = lido.metadados
    ? aplicarMetadados(base.metadados, lido.metadados)
    : { metadados: base.metadados, alterados: [] };

  const secoes = compararLista(
    base.sections,
    lido.secoes,
    gerarId,
    avisos,
    (lida, id, content, antiga, indice): Secao => ({
      id,
      ordem: indice,
      nivel: lida.nivel,
      titulo: antiga && mesmoTexto(antiga.titulo, lida.titulo) ? antiga.titulo : lida.titulo,
      content,
    }),
  );
  const apendices = compararLista(
    base.apendices,
    lido.apendices,
    gerarId,
    avisos,
    elementoPosTextual,
  );
  const anexos = compararLista(base.anexos, lido.anexos, gerarId, avisos, elementoPosTextual);

  const documento: Documento = {
    ...base,
    metadados: metadados.metadados,
    sections: secoes.itens,
    apendices: apendices.itens,
    anexos: anexos.itens,
  };

  avisos.push(...chamadasEditadas(lido, documento));

  const relatorio: Relatorio = {
    documentoNovo: atual === null,
    secoes: secoes.comparacao,
    apendices: apendices.comparacao,
    anexos: anexos.comparacao,
    metadados: metadados.alterados,
    avisos,
    semMudancas: false,
  };
  relatorio.semMudancas =
    !relatorio.documentoNovo &&
    relatorio.metadados.length === 0 &&
    [relatorio.secoes, relatorio.apendices, relatorio.anexos].every(
      (comparacao) =>
        comparacao.novas.length + comparacao.removidas.length + comparacao.alteradas.length === 0,
    );
  return { documento, relatorio };
}

function elementoPosTextual(
  lido: PosTextualLido,
  id: string,
  content: NoConteudo[],
  antigo: ElementoPosTextual | undefined,
): ElementoPosTextual {
  return {
    id,
    titulo: antigo && mesmoTexto(antigo.titulo, lido.titulo) ? antigo.titulo : lido.titulo,
    content,
  };
}

// --- Metadados ---------------------------------------------------------------

const OPCIONAIS = ["dedicatoria", "agradecimentos", "epigrafe"] as const;

// O que o `.tex` escreveu para o campo: o elemento opcional desligado sai
// vazio (`gerarDedicatoria()` & cia.), com o texto guardado.
function textoDoOpcional(elemento: ElementoOpcional | undefined): string {
  return elemento?.ativo ? elemento.texto : "";
}

// Parágrafos como o `.tex` os separa: um por linha, sem linha vazia.
function paragrafosDoOpcional(texto: string): string {
  return texto
    .split(/\n/)
    .map((linha) => linha.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function mesmoTexto(a: string | undefined, b: string | undefined): boolean {
  const normal = (texto: string | undefined) => (texto ?? "").replace(/\s+/g, " ").trim();
  return normal(a) === normal(b);
}

function aplicarMetadados(atual: Metadados, lidos: MetadadosLidos) {
  const metadados: Metadados = { ...atual };
  const alterados: CampoAlterado[] = [];

  for (const campo of Object.keys(lidos) as CampoReimportado[]) {
    if (campo === "dedicatoria" || campo === "agradecimentos" || campo === "epigrafe") {
      const antes = textoDoOpcional(atual[campo]);
      const depois = lidos[campo] ?? "";
      if (paragrafosDoOpcional(antes) === paragrafosDoOpcional(depois)) continue;
      // Vazio desliga, sem apagar o texto guardado: religar no painel o
      // devolve, como no liga/desliga do AURA.
      metadados[campo] = depois
        ? { ativo: true, texto: depois }
        : { ativo: false, texto: atual[campo]?.texto ?? "" };
      alterados.push({ campo, antes, depois });
      continue;
    }
    if (campo === "autores" || campo === "palavrasChave" || campo === "keywords") {
      const antes = atual[campo].map((item) => item.trim()).filter(Boolean);
      const depois = lidos[campo] ?? [];
      if (JSON.stringify(antes) === JSON.stringify(depois)) continue;
      metadados[campo] = depois;
      alterados.push({ campo, antes: antes.join("; "), depois: depois.join("; ") });
      continue;
    }
    if (campo === "ano") {
      const depois = lidos.ano;
      if (depois === undefined || depois === atual.ano) continue;
      metadados.ano = depois;
      alterados.push({ campo, antes: String(atual.ano), depois: String(depois) });
      continue;
    }
    const antes = atual[campo] ?? "";
    const depois = lidos[campo] ?? "";
    if (mesmoTexto(antes, depois)) continue;
    metadados[campo] = depois;
    alterados.push({ campo, antes, depois });
  }
  // Na ordem do bloco, que é a ordem dos campos na tela.
  alterados.sort((a, b) => ORDEM_DOS_CAMPOS.indexOf(a.campo) - ORDEM_DOS_CAMPOS.indexOf(b.campo));
  return { metadados, alterados };
}

const ORDEM_DOS_CAMPOS: readonly CampoReimportado[] = [
  "titulo",
  "subtitulo",
  "autores",
  "instituicao",
  "orientador",
  "local",
  "ano",
  "naturezaTrabalho",
  "resumo",
  "palavrasChave",
  "abstract",
  "keywords",
  ...OPCIONAIS,
];

// --- Seções, apêndices e anexos ----------------------------------------------

interface Lido {
  id: string | null;
  titulo: string;
  content: BlocoLido[];
  linha: number;
  arquivo: string;
}

interface Salvo {
  id: string;
  titulo: string;
  content: NoConteudo[];
}

function compararLista<L extends Lido, S extends Salvo>(
  salvos: readonly S[],
  lidos: readonly L[],
  gerarId: () => string,
  avisos: Aviso[],
  montar: (lido: L, id: string, content: NoConteudo[], salvo: S | undefined, indice: number) => S,
): { itens: S[]; comparacao: Comparacao } {
  const porId = new Map(salvos.map((salvo) => [salvo.id, salvo]));
  const usados = new Set<string>();
  const comparacao: Comparacao = { novas: [], removidas: [], alteradas: [] };

  const itens = lidos.map((lido, indice) => {
    const id = lido.id && !usados.has(lido.id) ? lido.id : gerarId();
    usados.add(id);
    const salvo = porId.get(id);
    const content = conteudoFinal(salvo?.content, lido, gerarId, avisos);
    const item = montar(lido, id, content, salvo, indice);
    if (!salvo) comparacao.novas.push({ id, titulo: item.titulo });
    return item;
  });

  // Ordem relativa dos que existiam antes e continuam.
  const comuns = new Set(itens.map((item) => item.id).filter((id) => porId.has(id)));
  const ordemAntes = salvos.filter((salvo) => comuns.has(salvo.id)).map((salvo) => salvo.id);
  const ordemDepois = itens.filter((item) => comuns.has(item.id)).map((item) => item.id);

  for (const item of itens) {
    const salvo = porId.get(item.id);
    if (!salvo) continue;
    const mudancas: Mudanca[] = [];
    if (item.titulo !== salvo.titulo) mudancas.push("titulo");
    if ("nivel" in item && "nivel" in salvo && item.nivel !== salvo.nivel) mudancas.push("nivel");
    if (item.content !== salvo.content) mudancas.push("texto");
    if (ordemAntes.indexOf(item.id) !== ordemDepois.indexOf(item.id)) mudancas.push("posicao");
    if (mudancas.length > 0) {
      comparacao.alteradas.push({
        id: item.id,
        titulo: item.titulo,
        mudancas,
        ...(mudancas.includes("titulo") ? { tituloAntes: salvo.titulo } : {}),
      });
    }
  }
  for (const salvo of salvos) {
    if (!usados.has(salvo.id)) comparacao.removidas.push({ id: salvo.id, titulo: salvo.titulo });
  }
  return { itens, comparacao };
}

// O conteúdo que fica: o salvo, se nada mudou de fato; senão o lido, com os
// `id`s de figura e tabela aproveitados do salvo, na ordem, e as figuras e
// tabelas de apêndice que o `.tex` não exporta repostas.
function conteudoFinal(
  salvo: readonly NoConteudo[] | undefined,
  lido: Lido,
  gerarId: () => string,
  avisos: Aviso[],
): NoConteudo[] {
  const figuras = (salvo ?? []).filter((no) => no.type === "figura");
  const tabelas = (salvo ?? []).filter((no) => no.type === "tabela");
  let figura = 0;
  let tabela = 0;
  const content: NoConteudo[] = [];
  for (const bloco of lido.content) {
    if (bloco.type === "nao_exportado") {
      const original = bloco.tipo === "figura" ? figuras[figura++] : tabelas[tabela++];
      if (original) content.push(original);
      else {
        avisos.push({
          arquivo: lido.arquivo,
          linha: lido.linha,
          mensagem: `Aviso de ${bloco.tipo} não exportada em “${lido.titulo}” sem ${bloco.tipo} correspondente no AURA: ignorado.`,
        });
      }
      continue;
    }
    if (bloco.type === "figura") {
      content.push({ ...bloco, id: figuras[figura++]?.id ?? gerarId() });
      continue;
    }
    if (bloco.type === "tabela") {
      content.push({ ...bloco, id: tabelas[tabela++]?.id ?? gerarId() });
      continue;
    }
    content.push(bloco);
  }

  if (salvo && JSON.stringify(normalizar(salvo)) === JSON.stringify(normalizar(content))) {
    return salvo as NoConteudo[];
  }
  // Seção sem nenhum bloco ganha um parágrafo vazio, como `novaSecao()`:
  // sem ele o cursor não tem onde entrar.
  return content.length > 0 ? content : [{ type: "paragraph" }];
}

// --- Comparação sem o que a volta pelo LaTeX perde ---------------------------

function atributos(attrs: AtributosCitacao) {
  return {
    refId: attrs.refId,
    modo: attrs.modo,
    pagina: attrs.pagina ?? null,
    apud: attrs.apud ?? null,
  };
}

function marcas(lista: readonly Marca[] | undefined) {
  return [...(lista ?? [])]
    .map((marca) =>
      marca.type === "citacao" ? { type: marca.type, attrs: atributos(marca.attrs) } : marca,
    )
    .sort((a, b) => a.type.localeCompare(b.type));
}

function inline(content: readonly NoInline[] | undefined) {
  const nos: ({ texto: string; marcas: string } | { nota: string })[] = [];
  for (const no of content ?? []) {
    if (no.type === "nota_rodape") {
      nos.push({ nota: no.texto.replace(/\s+/g, " ").trim() });
      continue;
    }
    const chave = JSON.stringify(marcas(no.marks));
    const anterior = nos.at(-1);
    if (anterior && "texto" in anterior && anterior.marcas === chave) anterior.texto += no.text;
    else nos.push({ texto: no.text, marcas: chave });
  }
  for (const no of nos) if ("texto" in no) no.texto = no.texto.replace(/\s+/g, " ");
  const primeiro = nos[0];
  if (primeiro && "texto" in primeiro) primeiro.texto = primeiro.texto.trimStart();
  const ultimo = nos.at(-1);
  if (ultimo && "texto" in ultimo) ultimo.texto = ultimo.texto.trimEnd();
  return nos.filter((no) => !("texto" in no) || no.texto.length > 0);
}

function normalizar(content: readonly NoConteudo[]): unknown[] {
  return content.flatMap((no): unknown[] => {
    switch (no.type) {
      case "paragraph": {
        const nos = inline(no.content);
        return nos.length > 0 ? [{ p: nos }] : [];
      }
      case "citacao_longa":
        return [{ longa: inline(no.content), refId: no.refId || null, pagina: no.pagina ?? "" }];
      case "formula":
        return [{ formula: no.texto.replace(/\s+/g, " ").trim() }];
      case "figura":
        return [{ figura: [no.legenda.trim(), no.fonte.trim(), no.imagem] }];
      case "tabela":
        return [
          {
            tabela: [no.legenda.trim(), no.fonte.trim()],
            linhas: no.linhas.map((linha) => {
              const celulas = linha.celulas.map((celula) => {
                const texto = inline(celula.content);
                return { cabecalho: texto.length > 0 && celula.cabecalho, texto };
              });
              // O `.tex` completa a linha curta com células vazias.
              while (celulas.length > 0 && celulas.at(-1)!.texto.length === 0) celulas.pop();
              return celulas;
            }),
          },
        ];
    }
  });
}

// --- Chamadas ----------------------------------------------------------------

// Chamada editada à mão no arquivo não tem efeito (princípio 3): o AURA a
// recalcula da referência. O aviso diz isso, para a edição não parecer
// perdida sem motivo.
function chamadasEditadas(lido: TexLido, documento: Documento): Aviso[] {
  const avisos: Aviso[] = [];
  for (const chamada of lido.chamadas) {
    const calculada = chamadaDaCitacao(chamada.citacao, documento.references).texto;
    if (mesmoTexto(calculada, chamada.texto)) continue;
    avisos.push({
      arquivo: chamada.arquivo,
      linha: chamada.linha,
      mensagem:
        `A chamada “${chamada.texto}” no arquivo não é a que o AURA calcula (“${calculada}”). ` +
        "A chamada vem da referência: editá-la no arquivo não tem efeito.",
    });
  }
  return avisos;
}
