import type { Metadados } from "../../document/types";
import type { Achado, Verificacao } from "../compliance";

// Resumo na língua vernácula e em língua estrangeira: presença — NBR
// 14724:2024 §4.2.1.7 e §4.2.1.8 ("Elemento obrigatório. Deve ser elaborado
// conforme a ABNT NBR 6028"), e as palavras-chave pela NBR 6028:2021 §4.1.7
// ("As palavras-chave devem figurar logo abaixo do resumo"). Lidos no PDF em
// 23/09/2026.
//
// O abstract era opcional na v1 até o passo 4B.1, por decisão tomada com fonte
// secundária. O §4.2.1.8 o torna obrigatório, e o `.docx` o omite quando
// vazio: é esta regra que aponta a falta, em vez de um título vazio.
//
// Um arquivo com as duas regras, porque são a mesma exigência para campos
// diferentes; cada uma tem id próprio.

type Par = {
  campoTexto: keyof Metadados;
  campoTermos: keyof Metadados;
  texto: (m: Metadados) => string;
  termos: (m: Metadados) => string[];
  nome: string;
  nomeTermos: string;
  item: string;
};

const VERNACULO: Par = {
  campoTexto: "resumo",
  campoTermos: "palavrasChave",
  texto: (m) => m.resumo,
  termos: (m) => m.palavrasChave,
  nome: "O resumo na língua vernácula",
  nomeTermos: "as palavras-chave",
  item: "NBR 14724:2024 §4.2.1.7",
};

const ESTRANGEIRO: Par = {
  campoTexto: "abstract",
  campoTermos: "keywords",
  texto: (m) => m.abstract,
  termos: (m) => m.keywords,
  nome: "O resumo em língua estrangeira (abstract)",
  nomeTermos: "as palavras-chave em língua estrangeira (keywords)",
  item: "NBR 14724:2024 §4.2.1.8",
};

function conferir(par: Par, metadados: Metadados): Omit<Achado, "regra">[] {
  const achados: Omit<Achado, "regra">[] = [];
  if (!par.texto(metadados).trim()) {
    achados.push({
      gravidade: "erro",
      item: par.item,
      mensagem: `${par.nome} é elemento obrigatório e está vazio.`,
      local: { tipo: "metadado", campo: par.campoTexto },
    });
  }
  if (!par.termos(metadados).some((termo) => termo.trim())) {
    achados.push({
      gravidade: "erro",
      item: "NBR 6028:2021 §4.1.7",
      mensagem: `Faltam ${par.nomeTermos}, que devem vir logo abaixo do resumo.`,
      local: { tipo: "metadado", campo: par.campoTermos },
    });
  }
  return achados;
}

export const resumoVernaculo: Verificacao = {
  regra: "resumo-vernaculo",
  verificar: ({ documento }) => conferir(VERNACULO, documento.metadados),
};

export const resumoEstrangeiro: Verificacao = {
  regra: "resumo-estrangeiro",
  verificar: ({ documento }) => conferir(ESTRANGEIRO, documento.metadados),
};

// Os dois resumos com o texto preenchido, para as regras de forma
// (`resumoForma.ts`) não repetirem os campos.
export function resumosPreenchidos(
  metadados: Metadados,
): { campo: "resumo" | "abstract"; nome: string; texto: string }[] {
  return [
    { campo: "resumo" as const, nome: "O resumo", texto: metadados.resumo },
    { campo: "abstract" as const, nome: "O abstract", texto: metadados.abstract },
  ].filter((resumo) => resumo.texto.trim());
}
