// Onde termina a "primeira palavra" de um título — uma regra só para as duas
// normas que a usam:
// - NBR 6023:2025 §6.7: sem autoria, a entrada da LISTA é o título com "a
//   primeira palavra em maiúsculas, incluindo artigo e monossílabo
//   iniciais" (`NOS CANAVIAIS, mutilações...`);
// - NBR 10520:2023 §6.1.1.4: a CHAMADA sem autoria usa a única palavra (a),
//   a primeira seguida de `[...]` (b), o artigo com a palavra seguinte (c) ou
//   o monossílabo com a palavra seguinte (d) — `(Nos canaviais [...], 1995)`.
// Duas implementações discordariam sobre "Nos canaviais" e a chamada deixaria
// de bater com a entrada da lista, que é o que a correlação da §6 exige.

// Artigos definidos e indefinidos. "Uma"/"umas" têm duas sílabas, mas são
// artigo, e a alínea c) vale para artigo qualquer que seja o tamanho.
const ARTIGOS = new Set(["o", "a", "os", "as", "um", "uma", "uns", "umas"]);

// Quantas palavras do início formam a "primeira palavra": 2 quando o título
// abre com artigo ou monossílabo e continua; 1 nos demais casos.
export function palavrasIniciais(palavras: readonly string[]): number {
  if (palavras.length < 2) return palavras.length;
  const primeira = palavras[0].toLocaleLowerCase("pt-BR");
  return ARTIGOS.has(primeira) || ehMonossilabo(primeira) ? 2 : 1;
}

// --- Monossílabo -------------------------------------------------------------
// Conta os núcleos vocálicos da palavra pelas regras do português: vogais
// vizinhas formam um núcleo só (ditongo) ou dois (hiato).
//
// LIMITAÇÃO, declarada: é heurística de ortografia, não dicionário. Acerta
// os casos que decidem título real — "Nos", "Paz", "Mãe", "Pão", "Mais",
// "Deus", "Quem" são monossílabos; "Rio", "Dia", "Lua", "País", "Saúde",
// "Guerra" não são. Erra onde a grafia não mostra o hiato ("ruim", "Luiz"
// sem acento), e nesses a primeira palavra sai curta de uma palavra.

const VOGAIS = "aeiouáéíóúâêôãõàüy";
const FORTES = "aeoáéóâêôãõà";
const FRACAS_ACENTUADAS = "íú";

function ehMonossilabo(palavra: string): boolean {
  const letras = palavra
    .normalize("NFC")
    .replace(/[^a-zà-ÿ]/g, "")
    // "qu"/"gu" antes de vogal: o "u" é parte da consoante ("que", "quem",
    // "guerra") ou semivogal ("qual") — nunca um núcleo próprio.
    .replace(/([qg])u(?=[aeioáéíóâêô])/g, "$1");
  return letras !== "" && nucleos(letras) === 1;
}

function nucleos(letras: string): number {
  let total = 0;
  let anterior: string | null = null;

  for (const letra of letras) {
    if (!VOGAIS.includes(letra)) {
      anterior = null;
      continue;
    }
    if (anterior === null || hiato(anterior, letra)) total++;
    anterior = letra;
  }
  return total;
}

// Duas vogais vizinhas em sílabas diferentes.
function hiato(primeira: string, segunda: string): boolean {
  // "país", "saúde": fraca acentuada nunca é semivogal.
  if (FRACAS_ACENTUADAS.includes(segunda)) return true;
  const primeiraForte = FORTES.includes(primeira);
  const segundaForte = FORTES.includes(segunda);
  // "rio", "dia", "lua": fraca seguida de forte é hiato em português.
  if (!primeiraForte && segundaForte) return true;
  if (primeiraForte && segundaForte) {
    // Ditongos nasais ("mãe", "pão", "põe") e o "ao" da contração ("ao",
    // "aos") são um núcleo só; as demais fortes vizinhas ("voo", "área")
    // são hiato.
    return !(
      (primeira === "ã" && (segunda === "e" || segunda === "o")) ||
      (primeira === "õ" && segunda === "e") ||
      (primeira === "a" && segunda === "o")
    );
  }
  // Forte + fraca ("mais", "deus") ou fraca + fraca ("fui", "viu"): ditongo.
  return false;
}
