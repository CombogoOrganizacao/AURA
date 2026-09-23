import { NORMAS } from "../standards/standards";
import type { IdNorma } from "../standards/types";
import {
  CAMPOS_SOBRESCREVIVEIS,
  type ConfigEdital,
  type PresetInstituicao,
  type ResultadoResolucao,
  type SobrescritaRegras,
} from "./types";

// Resolução de regras em quatro camadas — passo 5.1.1. Norma base → preset
// de instituição → edital → override do usuário; cada camada sobrescreve só
// os campos que traz, em qualquer profundidade.
//
// Mesma assinatura posicional de `legacy/js/engine/rulesEngine.js`
// (`resolveRules(standardId, noticeConfig, userOverrides)`), com o preset
// entrando como segundo argumento, na ordem das camadas. Na v1 `edital` é
// sempre `null` e não há tela de preset nem de override: o resultado é a
// norma auditada. O exportador continua lendo as constantes de
// `export/docx/constants.ts`; ligá-lo às regras resolvidas fica para quando
// houver por onde sobrescrever (registrado no passo).
//
// O registro de conflitos com justificativa é o 5.1.2 e entra no mesmo
// resultado, ao lado de `regras`.
export function resolveRules(
  norma: IdNorma,
  preset: PresetInstituicao | null,
  edital: ConfigEdital | null,
  overrides: SobrescritaRegras = {},
): ResultadoResolucao {
  // `structuredClone`: a tabela `NORMAS` é compartilhada pelo app inteiro, e
  // uma sobrescrita que a alterasse mudaria a norma de todos os documentos.
  let regras = structuredClone(NORMAS[norma]);

  for (const camada of [preset?.regras, edital?.regras, overrides]) {
    if (camada) regras = mesclar(regras, soCamposSobrescreviveis(camada));
  }

  return { regras };
}

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
