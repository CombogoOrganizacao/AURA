import type { Verificacao } from "../compliance";
import {
  citacaoDiretaSemPagina,
  citacaoLongaSemReferencia,
  citacaoOrfa,
  referenciaNaoCitada,
} from "./citacoes";
import { corpoPresente, referenciasPresentes } from "./corpoEReferencias";
import { dadosDeIdentificacao } from "./dadosDeIdentificacao";
import { folhaDeAprovacao } from "./folhaDeAprovacao";
import { ilustracaoCitada, ilustracaoComFonte, ilustracaoComTitulo } from "./ilustracoes";
import { posTextualComTitulo } from "./posTextualComTitulo";
import { palavrasChaveMinusculas, resumoExtensao, resumoParagrafoUnico } from "./resumoForma";
import { resumoEstrangeiro, resumoVernaculo } from "./resumos";
import { siglaPrimeiraMencao } from "./siglaPrimeiraMencao";

// Registro das regras de verificação — passo 5.2.2. A ordem é a do documento
// impresso: pré-textuais, corpo, citações, pós-textuais. O painel (5.2.3)
// agrupa por gravidade e mantém esta ordem dentro de cada grupo.
//
// Cada regra cita o item da norma no cabeçalho do arquivo, com o trecho lido
// no PDF. Arquivos com mais de uma regra reúnem as que vêm do mesmo item
// (resumo vernáculo e estrangeiro, §4.2.1.7 e §4.2.1.8) ou do mesmo assunto
// (citações, ilustrações); cada regra tem id próprio.
export const VERIFICACOES: readonly Verificacao[] = [
  dadosDeIdentificacao,
  folhaDeAprovacao,
  resumoVernaculo,
  resumoEstrangeiro,
  resumoParagrafoUnico,
  resumoExtensao,
  palavrasChaveMinusculas,
  corpoPresente,
  siglaPrimeiraMencao,
  ilustracaoCitada,
  ilustracaoComFonte,
  ilustracaoComTitulo,
  citacaoOrfa,
  citacaoLongaSemReferencia,
  citacaoDiretaSemPagina,
  referenciasPresentes,
  referenciaNaoCitada,
  posTextualComTitulo,
];
