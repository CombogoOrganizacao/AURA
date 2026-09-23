import { NORMAS } from "../standards/standards";
import type { IdNorma } from "../standards/types";
import { baseDoCampo, type BaseDoCampo } from "./forca";
import {
  CAMPOS_SOBRESCREVIVEIS,
  type ConfigEdital,
  type ConflitoRegra,
  type OrigemCamada,
  type PresetInstituicao,
  type RegrasResolvidas,
  type ResultadoResolucao,
  type SobrescritaRegras,
} from "./types";

// Resolução de regras em quatro camadas — passos 5.1.1 e 5.1.2. Norma base →
// preset de instituição → edital → override do usuário; cada camada
// sobrescreve só os campos que traz, em qualquer profundidade.
//
// Mesma assinatura posicional de `legacy/js/engine/rulesEngine.js`
// (`resolveRules(standardId, noticeConfig, userOverrides)`), com o preset
// entrando como segundo argumento, na ordem das camadas. Na v1 `edital` é
// sempre `null` e não há tela de preset nem de override: o resultado é a
// norma auditada. O exportador continua lendo as constantes de
// `export/docx/constants.ts`; ligá-lo às regras resolvidas fica para quando
// houver por onde sobrescrever (registrado no passo).
//
// Os conflitos (5.1.2) saem no mesmo resultado: um por campo cujo valor final
// difere do da norma, com a camada que o decidiu e a força da regra divergida
// (`forca.ts`). O legado só registrava três campos do edital, e o override
// entrava por `Object.assign` sem registro nenhum.
export function resolveRules(
  norma: IdNorma,
  preset: PresetInstituicao | null,
  edital: ConfigEdital | null,
  overrides: SobrescritaRegras = {},
): ResultadoResolucao {
  // `structuredClone`: a tabela `NORMAS` é compartilhada pelo app inteiro, e
  // uma sobrescrita que a alterasse mudaria a norma de todos os documentos.
  const base = structuredClone(NORMAS[norma]);

  const camadas: Camada[] = [
    { origem: "preset", nome: preset?.nome || "Preset da instituição", regras: preset?.regras },
    { origem: "edital", nome: edital?.titulo || "Edital", regras: edital?.regras },
    { origem: "override", nome: "Ajuste feito no documento", regras: overrides },
  ];

  // O estado depois de cada camada: é o que permite dizer QUAL camada decidiu
  // um campo e qual era o valor antes dela.
  const estados: RegrasResolvidas[] = [base];
  for (const camada of camadas) {
    const anterior = estados[estados.length - 1];
    estados.push(
      camada.regras ? mesclar(anterior, soCamposSobrescreviveis(camada.regras)) : anterior,
    );
  }

  return {
    regras: estados[estados.length - 1],
    conflitos: registrarConflitos(norma, camadas, estados),
  };
}

interface Camada {
  origem: OrigemCamada;
  nome: string;
  regras: SobrescritaRegras | undefined;
}

// --- Conflitos (5.1.2) -------------------------------------------------------

function registrarConflitos(
  norma: IdNorma,
  camadas: readonly Camada[],
  estados: readonly RegrasResolvidas[],
): ConflitoRegra[] {
  const folhasPorEstado = estados.map((estado) => folhas(estado));
  const daNorma = folhasPorEstado[0];
  const final = folhasPorEstado[folhasPorEstado.length - 1];

  const conflitos = new Map<string, ConflitoRegra>();
  for (const [campo, valorEscolhido] of final) {
    const valorNorma = daNorma.get(campo);
    // Um campo que uma camada mudou e outra devolveu ao valor da norma não é
    // conflito: o documento segue a norma.
    if (iguais(valorNorma, valorEscolhido)) continue;

    const indice = camadaQueDecidiu(folhasPorEstado, [campo]);
    const camada = camadas[indice];
    const baseCampo = baseDoCampo(norma, campo);
    conflitos.set(campo, {
      campo,
      rotulo: baseCampo.rotulo,
      origem: camada.origem,
      nomeOrigem: camada.nome,
      valorNorma,
      valorAnterior: folhasPorEstado[indice].get(campo),
      valorEscolhido,
      forca: baseCampo.forca,
      item: baseCampo.item,
      justificativa: justificar(camada.nome, baseCampo, valorNorma, valorEscolhido),
    });
  }

  // O de tamanho menor substitui o registro campo a campo, se houver: o
  // número 10 é convenção, mas deixar de ser menor contraria a norma.
  if (norma === "abnt") {
    for (const conflito of conflitosDeTamanhoMenor(camadas, folhasPorEstado)) {
      conflitos.set(conflito.campo, conflito);
    }
  }

  return [...conflitos.values()];
}

// A camada (índice em `camadas`) que por último mudou algum destes campos.
// `folhasPorEstado[i + 1]` é o estado depois da camada `i`.
function camadaQueDecidiu(
  folhasPorEstado: readonly Map<string, unknown>[],
  campos: readonly string[],
): number {
  for (let i = folhasPorEstado.length - 2; i >= 0; i--) {
    const antes = folhasPorEstado[i];
    const depois = folhasPorEstado[i + 1];
    if (campos.some((campo) => !iguais(antes.get(campo), depois.get(campo)))) return i;
  }
  return 0;
}

// NBR 14724:2024 §5.1: citações longas, notas de rodapé, paginação, legendas
// e fontes "devem ser em tamanho menor e uniforme". O número (10 pt) é
// convenção, mas ser MENOR que o texto e IGUAL entre si é obrigação. Um preset
// que baixa o texto para 10 pt sem tocar nas citações não muda nenhum dos
// campos pequenos e mesmo assim tira o documento da norma: por isso a relação
// é conferida à parte, e não campo a campo.
const TAMANHOS_MENORES = [
  "fonte.tamanhoCitacao",
  "fonte.tamanhoNotaRodape",
  "citacaoLonga.tamanhoFonte",
] as const;

function conflitosDeTamanhoMenor(
  camadas: readonly Camada[],
  folhasPorEstado: readonly Map<string, unknown>[],
): ConflitoRegra[] {
  const daNorma = folhasPorEstado[0];
  const final = folhasPorEstado[folhasPorEstado.length - 1];
  const tamanhoTexto = final.get("fonte.tamanho");
  if (typeof tamanhoTexto !== "number") return [];

  const presentes = TAMANHOS_MENORES.filter((campo) => typeof final.get(campo) === "number");
  const uniformes = new Set(presentes.map((campo) => final.get(campo))).size <= 1;

  const conflitos: ConflitoRegra[] = [];
  for (const campo of presentes) {
    const valor = final.get(campo) as number;
    const naoMenor = valor >= tamanhoTexto;
    // Sem uniformidade, o culpado é o campo que saiu do valor da norma.
    const quebrouUniformidade = !uniformes && !iguais(valor, daNorma.get(campo));
    if (!naoMenor && !quebrouUniformidade) continue;

    const indice = camadaQueDecidiu(folhasPorEstado, [campo, "fonte.tamanho"]);
    const camada = camadas[indice];
    const baseCampo = baseDoCampo("abnt", campo);
    const motivo = naoMenor
      ? `o texto está em ${formatar(tamanhoTexto, "pt")}, e a NBR 14724:2024 §5.1 manda que este elemento seja "em tamanho menor"`
      : `os elementos em letra menor ficaram com tamanhos diferentes, e a NBR 14724:2024 §5.1 manda que sejam "em tamanho menor e uniforme"`;

    conflitos.push({
      campo,
      rotulo: baseCampo.rotulo,
      origem: camada.origem,
      nomeOrigem: camada.nome,
      valorNorma: daNorma.get(campo),
      valorAnterior: folhasPorEstado[indice].get(campo),
      valorEscolhido: valor,
      forca: "norma",
      item: "NBR 14724:2024 §5.1",
      justificativa: `${camada.nome}: "${baseCampo.rotulo}" em ${formatar(valor, "pt")}, mas ${motivo}. Com este valor o documento deixa de estar conforme.`,
    });
  }
  return conflitos;
}

function justificar(
  nomeOrigem: string,
  base: BaseDoCampo,
  valorNorma: unknown,
  valorEscolhido: unknown,
): string {
  const escolhido = formatar(valorEscolhido, base.unidade);
  const daNorma = formatar(valorNorma, base.unidade);
  const inicio = `${nomeOrigem}: "${base.rotulo}" em ${escolhido}, no lugar de ${daNorma}.`;

  switch (base.forca) {
    case "norma":
      return `${inicio} A ${base.item} exige ${daNorma}: com este valor o documento deixa de estar conforme.`;
    case "recomendacao":
      return `${inicio} A ${base.item} recomenda ${daNorma}, sem obrigar: o documento continua conforme.`;
    case "convencao":
      return `${inicio} ${daNorma} é convenção adotada pelo AURA, sem item na norma: o documento continua conforme.`;
    case "nao-auditada":
      return `${inicio} O valor da norma não foi conferido contra o texto oficial.`;
  }
}

const ALINHAMENTOS: Record<string, string> = { justify: "justificado", left: "à esquerda" };

function formatar(valor: unknown, unidade?: string): string {
  if (typeof valor === "number") {
    const numero = valor.toLocaleString("pt-BR");
    return unidade ? `${numero} ${unidade}` : numero;
  }
  if (typeof valor === "string") return ALINHAMENTOS[valor] ?? `"${valor}"`;
  if (valor === undefined) return "(sem valor)";
  return JSON.stringify(valor);
}

// Caminho → valor de cada folha (tudo que não é objeto simples).
function folhas(
  valor: unknown,
  prefixo = "",
  saida = new Map<string, unknown>(),
): Map<string, unknown> {
  if (!objetoSimples(valor)) {
    if (prefixo) saida.set(prefixo, valor);
    return saida;
  }
  for (const [chave, filho] of Object.entries(valor)) {
    folhas(filho, prefixo ? `${prefixo}.${chave}` : chave, saida);
  }
  return saida;
}

// Folhas são primitivos ou arrays (`elementos.*`, que nenhuma camada toca).
function iguais(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

// --- Mescla ------------------------------------------------------------------

// O tipo já restringe, mas preset e override vêm da persistência (5.1.3), e
// um objeto gravado com `id` ou `estiloCitacao` passaria pelo `mesclar()`.
// Campo fora da lista é ignorado, não aplicado.
function soCamposSobrescreviveis(camada: SobrescritaRegras): SobrescritaRegras {
  const permitidos = new Set<string>(CAMPOS_SOBRESCREVIVEIS);
  return Object.fromEntries(
    Object.entries(camada).filter(([chave]) => permitidos.has(chave)),
  ) as SobrescritaRegras;
}

const CHAVES_PERIGOSAS = new Set(["__proto__", "constructor", "prototype"]);

function objetoSimples(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

// Mescla profunda: objeto entra campo a campo, qualquer outro valor substitui.
// `undefined` não apaga nada: é "esta camada não fala deste campo".
function mesclar<T>(base: T, sobrescrita: unknown): T {
  if (!objetoSimples(base) || !objetoSimples(sobrescrita)) {
    return (sobrescrita === undefined ? base : sobrescrita) as T;
  }

  const resultado: Record<string, unknown> = { ...base };
  for (const [chave, valor] of Object.entries(sobrescrita)) {
    // `JSON.parse` devolve `__proto__` como chave própria, e atribuí-la
    // trocaria o protótipo do resultado.
    if (valor === undefined || CHAVES_PERIGOSAS.has(chave)) continue;
    resultado[chave] = mesclar(resultado[chave], valor);
  }
  return resultado as T;
}
