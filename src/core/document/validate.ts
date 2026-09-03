import type { Documento, NivelSecao } from "./types";

export interface ErroValidacao {
  campo: string;
  mensagem: string;
}

const NIVEIS_VALIDOS: readonly number[] = [1, 2, 3] satisfies NivelSecao[];

// Validação estrutural do formato canônico — não confunde com as regras da
// ABNT (Fase 3), que dependem de conteúdo. Aqui só o que torna `sections`
// ambíguo ou impossível de renderizar: nível fora do domínio, `id` repetido,
// `ordem` repetida e salto de nível sem passar pelo intermediário (mesma
// regra que o schema do TipTap documenta para a seção-mãe, aplicada aqui à
// lista plana — ver docs/schema-tiptap.md §4.1).
export function validarDocumento(documento: Documento): ErroValidacao[] {
  const erros: ErroValidacao[] = [];

  const idsVistos = new Set<string>();
  const ordensVistas = new Set<number>();
  let nivelAnterior: number | null = null;

  documento.sections.forEach((secao, indice) => {
    const campo = `sections[${indice}]`;

    if (idsVistos.has(secao.id)) {
      erros.push({ campo: `${campo}.id`, mensagem: `id de seção repetido: "${secao.id}"` });
    } else {
      idsVistos.add(secao.id);
    }

    if (ordensVistas.has(secao.ordem)) {
      erros.push({
        campo: `${campo}.ordem`,
        mensagem: `ordem repetida: ${secao.ordem} (seção "${secao.titulo}")`,
      });
    } else {
      ordensVistas.add(secao.ordem);
    }

    if (!NIVEIS_VALIDOS.includes(secao.nivel)) {
      erros.push({
        campo: `${campo}.nivel`,
        mensagem: `nível ${secao.nivel} fora do intervalo 1–3 (seção "${secao.titulo}")`,
      });
      return; // nível inválido não é base confiável para checar salto
    }

    if (nivelAnterior === null && secao.nivel !== 1) {
      erros.push({
        campo: `${campo}.nivel`,
        mensagem: `a primeira seção precisa ser de nível 1 (veio nível ${secao.nivel})`,
      });
    } else if (nivelAnterior !== null && secao.nivel > nivelAnterior + 1) {
      erros.push({
        campo: `${campo}.nivel`,
        mensagem: `nível ${secao.nivel} pula do nível ${nivelAnterior} sem passar por ${nivelAnterior + 1} (seção "${secao.titulo}")`,
      });
    }

    nivelAnterior = secao.nivel;
  });

  return erros;
}
