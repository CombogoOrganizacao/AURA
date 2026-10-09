// Contrato da rota `/api/ai` — docs/contrato-api-ai.md (passo 6.5.2), em
// código (passo 6.5.3). Tipos, validação da requisição e a resposta da rota
// enquanto a IA está desativada, que é toda a v1 (§1.2 das decisões).
//
// **Nenhuma credencial entra aqui.** `atenderComIADesativada()` recebe só o
// `Content-Type` e o texto do corpo: `Authorization` e `X-Gemini-Key` nem
// chegam a esta camada, então não há como lê-los por engano (critério do
// 6.5.3). Com a IA desativada, a resposta sai antes da sessão e da chave
// (contrato §5.1, linha 5).

export const VERSAO_CONTRATO = 1;

// Lista fechada (contrato §1). Só `revisar`, por decisão da usuária
// (09/10/2026). Não existe campo de instrução livre: é o que impede pedir à
// IA que redija o trabalho.
export const OPERACOES = ["revisar"] as const;
export type Operacao = (typeof OPERACOES)[number];

// Em unidades UTF-16 (`String.length`), a mesma medida das posições.
export const LIMITE_TRECHO = 4000;

// Um corpo maior que isto nem passa pelo `JSON.parse`. Com o trecho no
// limite, os escapes do JSON e as faixas protegidas, a requisição legítima
// fica bem abaixo.
export const LIMITE_CORPO = 64 * 1024;

export interface Faixa {
  inicio: number;
  fim: number;
}

export interface RequisicaoIA {
  versao: typeof VERSAO_CONTRATO;
  operacao: Operacao;
  trecho: { texto: string; protegidos: Faixa[] };
}

export type CodigoErro =
  | "tipo_invalido"
  | "requisicao_invalida"
  | "trecho_longo"
  | "ia_desativada"
  | "sem_sessao"
  | "limite_excedido"
  | "cota_esgotada"
  | "chave_recusada"
  | "falha_provedor"
  | "tempo_esgotado"
  | "erro_interno";

// Contrato §5.1. O 405 não está aqui: quem responde é o Next, por não haver
// handler de outro método em app/api/ai/route.ts.
export const STATUS_DO_ERRO: Record<CodigoErro, number> = {
  tipo_invalido: 415,
  requisicao_invalida: 400,
  trecho_longo: 413,
  ia_desativada: 501,
  sem_sessao: 401,
  limite_excedido: 429,
  cota_esgotada: 429,
  chave_recusada: 403,
  falha_provedor: 502,
  tempo_esgotado: 504,
  erro_interno: 500,
};

export interface CorpoErro {
  erro: { codigo: CodigoErro; mensagem: string; campo?: string };
}

export interface RespostaJson {
  status: number;
  corpo: CorpoErro;
}

// Mensagens exibidas como texto (contrato §5.1). Nenhuma repete o que veio
// na requisição: nem chave, nem token, nem o trecho.
const MENSAGENS: Record<CodigoErro, string> = {
  tipo_invalido: "A requisição precisa ser enviada como JSON.",
  requisicao_invalida: "A requisição não está no formato esperado.",
  trecho_longo: `O trecho tem mais de ${LIMITE_TRECHO.toLocaleString("pt-BR")} caracteres. Selecione uma parte menor.`,
  ia_desativada: "A revisão com IA ainda não está disponível no AURA.",
  sem_sessao: "Entre na sua conta para usar a revisão com IA.",
  limite_excedido: "Muitas revisões seguidas. Aguarde um pouco e tente de novo.",
  cota_esgotada:
    "A cota de revisões com a chave do AURA acabou por agora. Você pode usar a sua própria chave.",
  chave_recusada: "O Gemini recusou a sua chave. Confira se ela está correta e ativa.",
  falha_provedor: "O serviço de IA falhou ao responder. Tente de novo em instantes.",
  tempo_esgotado: "O serviço de IA demorou demais para responder. Tente de novo.",
  erro_interno: "Algo deu errado no AURA. Tente de novo.",
};

export function mensagemDoErro(codigo: CodigoErro): string {
  return MENSAGENS[codigo];
}

export function respostaDeErro(codigo: CodigoErro, campo?: string): RespostaJson {
  return {
    status: STATUS_DO_ERRO[codigo],
    corpo: {
      erro: { codigo, mensagem: MENSAGENS[codigo], ...(campo !== undefined ? { campo } : {}) },
    },
  };
}

// --- Validação ---------------------------------------------------------------
// Contrato §2.2. Devolve a requisição já normalizada (`protegidos` ausente
// vira `[]`, campos desconhecidos ficam de fora: §7 permite acrescentar campo
// opcional sem mudar a versão) ou o primeiro erro, com `campo` apontando onde.

export type ResultadoValidacao =
  | { ok: true; requisicao: RequisicaoIA }
  | { ok: false; resposta: RespostaJson };

export function validarRequisicao(valor: unknown): ResultadoValidacao {
  const invalida = (campo: string): ResultadoValidacao => ({
    ok: false,
    resposta: respostaDeErro("requisicao_invalida", campo),
  });

  if (!ehObjeto(valor)) return invalida("corpo");
  if (valor.versao !== VERSAO_CONTRATO) return invalida("versao");
  if (typeof valor.operacao !== "string" || !(OPERACOES as readonly string[]).includes(valor.operacao)) {
    return invalida("operacao");
  }

  const { trecho } = valor;
  if (!ehObjeto(trecho)) return invalida("trecho");
  const { texto, protegidos } = trecho;
  if (typeof texto !== "string" || texto.trim() === "") return invalida("trecho.texto");

  const faixas: Faixa[] = [];
  if (protegidos !== undefined) {
    if (!Array.isArray(protegidos)) return invalida("trecho.protegidos");
    for (const [indice, faixa] of protegidos.entries()) {
      const lida = lerFaixa(faixa, texto.length);
      if (!lida) return invalida(`trecho.protegidos[${indice}]`);
      faixas.push(lida);
    }
  }

  // Depois da forma, como na ordem do contrato (400 antes de 413).
  if (texto.length > LIMITE_TRECHO) {
    return { ok: false, resposta: respostaDeErro("trecho_longo") };
  }

  return {
    ok: true,
    requisicao: {
      versao: VERSAO_CONTRATO,
      operacao: valor.operacao as Operacao,
      trecho: { texto, protegidos: faixas },
    },
  };
}

// Faixa semiaberta `[inicio, fim)` dentro do texto e não vazia: uma faixa
// vazia não protege nada, e aceitá-la esconderia um erro do cliente.
function lerFaixa(valor: unknown, tamanho: number): Faixa | null {
  if (!ehObjeto(valor)) return null;
  const { inicio, fim } = valor;
  if (!Number.isInteger(inicio) || !Number.isInteger(fim)) return null;
  const de = inicio as number;
  const ate = fim as number;
  if (de < 0 || de >= ate || ate > tamanho) return null;
  return { inicio: de, fim: ate };
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

// --- A rota, com a IA desativada ----------------------------------------------
// Conferências 2 a 5 do contrato §5.1, nesta ordem. A 1 (método) é do Next.
// Toda requisição válida termina em `501 ia_desativada`: o stub não chama
// nada, então não há o que transmitir em stream ainda (ver `eventos.ts`).

export interface EntradaRota {
  contentType: string | null;
  corpo: string;
}

export function atenderComIADesativada({ contentType, corpo }: EntradaRota): RespostaJson {
  if (!ehJson(contentType)) return respostaDeErro("tipo_invalido");
  if (corpo.length > LIMITE_CORPO) return respostaDeErro("trecho_longo");

  let valor: unknown;
  try {
    valor = JSON.parse(corpo);
  } catch {
    return respostaDeErro("requisicao_invalida", "corpo");
  }

  const resultado = validarRequisicao(valor);
  if (!resultado.ok) return resultado.resposta;

  return respostaDeErro("ia_desativada");
}

// `application/json`, com ou sem parâmetros (`; charset=utf-8`). É também a
// defesa contra CSRF (contrato §2.1): um formulário de outro site não envia
// este tipo sem o preflight, e o preflight não libera outra origem.
function ehJson(contentType: string | null): boolean {
  if (!contentType) return false;
  return contentType.split(";")[0].trim().toLowerCase() === "application/json";
}
