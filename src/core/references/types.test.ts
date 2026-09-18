import { describe, expect, it } from "vitest";

import { ROTULO_TIPO } from "./types";
import type {
  CSLType,
  Referencia,
  ReferenciaArtigo,
  ReferenciaCapitulo,
  ReferenciaEvento,
  ReferenciaLivro,
} from "./types";

// O critério de aceite do passo 4.1 é sobre TIPOS: "`typecheck` rejeita campo
// inexistente; nenhum campo guarda texto formatado". Tipo não tem
// comportamento em tempo de execução, então o que este arquivo faz é prender
// as duas afirmações com `@ts-expect-error`.
//
// **`@ts-expect-error` falha quando o erro DESAPARECE.** É o que torna o
// critério executável: se alguém trocar a união por uma interface larga com
// tudo opcional, ou acrescentar um campo onde ele não pertence, o `npm run
// typecheck` quebra aqui — e a quebra aponta para a linha e diz o porquê. Sem
// isto, "o typecheck rejeita" seria uma frase no plano que ninguém verifica.

describe("a união recusa campo que não pertence ao tipo", () => {
  it("livro não tem local de evento nem tipo de trabalho acadêmico", () => {
    const livro: ReferenciaLivro = {
      id: "r1",
      type: "book",
      title: "A formatação de trabalhos acadêmicos",
      subtitle: "um manual",
      author: [{ family: "Silva", given: "Maria" }],
      edicao: { numero: 2, acrescimos: "rev. e aum.", idioma: "pt" },
      publisher: "Editora Exemplo",
      "publisher-place": "Recife",
      issued: { "date-parts": [[2023]] },
    };

    const comEvento: ReferenciaLivro = {
      ...livro,
      // @ts-expect-error — `event-place` é de trabalho em evento, não de livro
      "event-place": "Recife",
    };

    const comGenero: ReferenciaLivro = {
      ...livro,
      // @ts-expect-error — `genre` ("Dissertação (Mestrado...)") é de tese
      genre: "Dissertação (Mestrado em X)",
    };

    expect(livro.edicao?.numero).toBe(2);
    expect(comEvento.title).toBe(livro.title);
    expect(comGenero.title).toBe(livro.title);
  });

  it("artigo de periódico não tem editora de livro nem edição", () => {
    const artigo: ReferenciaArtigo = {
      id: "r2",
      type: "article-journal",
      title: "Um estudo sobre X",
      "container-title": "Revista Brasileira de Y",
      volume: "12",
      issue: "2A",
      page: "45-67",
      issued: { "date-parts": [[2023, 3]] },
    };

    const comEdicao: ReferenciaArtigo = {
      ...artigo,
      // @ts-expect-error — edição é de livro/capítulo, não de artigo
      edicao: { numero: 2 },
    };

    expect(comEdicao.volume).toBe("12");
  });

  it("estreitar por `type` devolve os campos daquela forma de documento", () => {
    const tese: Referencia = {
      id: "r3",
      type: "thesis",
      title: "Sobre a formatação",
      tipoTrabalho: "Dissertação",
      grau: "Mestrado",
      curso: "Ciência da Computação",
      publisher: "Universidade Católica de Pernambuco",
      "publisher-place": "Recife",
      extensao: { quantidade: 120, unidade: "folha" },
      // Ano de DEPÓSITO (§7.1.2), que vem logo depois do título.
      issued: { "date-parts": [[2024]] },
      // Data de DEFESA, que fecha a referência. Aqui divergem de propósito:
      // são elementos distintos na norma, e o teste prova que o tipo os
      // mantém distintos.
      defesa: { "date-parts": [[2025, 3]] },
    };

    // Sem estreitar, `genre` não existe na união — só o tipo `thesis` o tem.
    // Vai por uma função porque o TypeScript ESTREITA um `const` anotado com
    // união a partir do literal que o inicializa: dentro deste teste, `tese`
    // já nasceria estreitada, e o erro que se quer provar não apareceria.
    function grauDe(referencia: Referencia): unknown {
      // @ts-expect-error — campo de um membro só da união, antes de estreitar
      return referencia.grau;
    }

    expect(grauDe(tese)).toBe("Mestrado");

    if (tese.type === "thesis") {
      expect(tese.tipoTrabalho).toBe("Dissertação");
      expect(tese.extensao).toEqual({ quantidade: 120, unidade: "folha" });
      // Depósito e defesa são campos diferentes, e não coincidem aqui.
      expect(tese.issued?.["date-parts"]?.[0][0]).toBe(2024);
      expect(tese.defesa?.["date-parts"]?.[0][0]).toBe(2025);
    }
  });

  it("evento distingue o nome do evento do título da publicação", () => {
    const trabalho: ReferenciaEvento = {
      id: "r4",
      type: "paper-conference",
      title: "Formatação automática em TCC",
      // Os dois existem e são coisas diferentes: o evento e os anais dele.
      "event-title": "CONGRESSO BRASILEIRO DE COMPUTAÇÃO",
      "event-number": "12",
      "event-place": "Recife",
      "container-title": "Anais do 12. Congresso Brasileiro de Computação",
      page: "100-110",
      issued: { "date-parts": [[2023]] },
    };

    expect(trabalho["event-title"]).not.toBe(trabalho["container-title"]);
  });
});

// Os três casos abaixo são a correção feita depois de a NBR 6023:2025 ser lida
// na íntegra (docs/auditoria-abnt.md, "Correções exigidas no passo 4.1"). Cada
// um prende um campo que, na primeira versão do 4.1, guardava string pronta.
describe("os campos corrigidos pela leitura da norma (§8.3, §8.1.1.4, §7.1.2)", () => {
  // §8.3: "ambas no idioma do documento" — "2. ed." mas "5th ed.". Um `number`
  // obrigaria o formatador a adivinhar o idioma.
  it("edição carrega idioma e acréscimos, não só o ordinal", () => {
    const emIngles: ReferenciaLivro = {
      id: "r10",
      type: "book",
      title: "Schaum outline of theory and problems",
      edicao: { numero: 5, idioma: "en" },
    };
    const comAcrescimos: ReferenciaLivro = {
      id: "r11",
      type: "book",
      title: "Manual para normalização",
      edicao: { numero: 3, acrescimos: "rev. e aum." },
    };

    expect(emIngles.edicao?.idioma).toBe("en");
    expect(comAcrescimos.edicao?.acrescimos).toBe("rev. e aum.");
  });

  // §8.1.1.4: a abreviação do tipo de participação vai entre parênteses depois
  // do último nome. Sem o papel guardado, não há o que escrever lá.
  it("o organizador do livro guarda o papel junto dos nomes", () => {
    const capitulo: ReferenciaCapitulo = {
      id: "r12",
      type: "chapter",
      title: "Imagens da juventude na era moderna",
      "container-title": "História dos jovens 2",
      "container-subtitle": "a época contemporânea",
      responsabilidade: {
        nomes: [
          { family: "Levi", given: "G." },
          { family: "Schmidt", given: "J." },
        ],
        tipo: "organizador",
      },
      page: "7-16",
    };

    expect(capitulo.responsabilidade?.tipo).toBe("organizador");
    expect(capitulo.responsabilidade?.nomes).toHaveLength(2);
  });

  it("o tipo de participação é lista fechada, não texto livre", () => {
    const capitulo: ReferenciaCapitulo = {
      id: "r13",
      type: "chapter",
      title: "T",
      "container-title": "C",
      responsabilidade: {
        nomes: [{ family: "Ferreira" }],
        // @ts-expect-error — "autor" não é tipo de participação da §8.1.1.4
        tipo: "autor",
      },
    };

    expect(capitulo.responsabilidade?.nomes).toHaveLength(1);
  });
});

describe("nenhum campo guarda texto já formatado", () => {
  // O ponto da fase inteira: de "SILVA, Maria" não se extrai de volta, com
  // segurança, o que é sobrenome e o que é nome próprio. Autor é objeto.
  it("autor é objeto com sobrenome e nome separados, nunca a string pronta", () => {
    const autor = { family: "Silva", given: "Maria" };

    const livro: ReferenciaLivro = { id: "r5", type: "book", title: "T", author: [autor] };

    const comAutorEmTexto: ReferenciaLivro = {
      ...livro,
      // @ts-expect-error — "SILVA, Maria" é saída do formatador (4.3), não dado
      author: ["SILVA, Maria"],
    };

    expect(livro.author?.[0].family).toBe("Silva");
    expect(comAutorEmTexto.title).toBe("T");
  });

  // Autoria corporativa não se inverte ("ASSOCIAÇÃO BRASILEIRA...", nunca
  // "TÉCNICAS, Associação Brasileira de Normas"). `literal` é o que permite ao
  // formatador saber disso sem heurística.
  it("autor corporativo tem campo próprio, separado do sobrenome", () => {
    const norma: ReferenciaLivro = {
      id: "r6",
      type: "book",
      title: "NBR 14724",
      author: [{ literal: "ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS" }],
    };

    expect(norma.author?.[0].literal).toBeDefined();
    expect(norma.author?.[0].family).toBeUndefined();
  });

  // Título e subtítulo separados porque a 6023 os destaca de forma diferente.
  // Juntá-los em "Título: subtítulo" obrigaria o formatador a procurar um
  // dois-pontos — e a errar em todo título que já tem um.
  it("título e subtítulo são campos distintos", () => {
    const livro: ReferenciaLivro = {
      id: "r7",
      type: "book",
      title: "Metodologia científica",
      subtitle: "teoria e prática",
    };

    expect(livro.title).not.toContain(":");
  });

  // Data é estrutura, não "mar. 2023": o formatador é que escolhe a abreviação
  // do mês em pt-BR, e a ordenação (4.4) precisa do ano como número.
  it("data é date-parts, com escape declarado para data imprecisa", () => {
    const comAno: ReferenciaLivro = {
      id: "r8",
      type: "book",
      title: "T",
      issued: { "date-parts": [[2023, 3]] },
    };
    const semPrecisao: ReferenciaLivro = {
      id: "r9",
      type: "book",
      title: "T",
      // A 6023 prevê data provável/aproximada; forçá-la em `date-parts`
      // inventaria uma precisão que a fonte não tem.
      issued: { raw: "[entre 1990 e 1995]" },
    };

    expect(comAno.issued?.["date-parts"]?.[0][0]).toBe(2023);
    expect(semPrecisao.issued?.["date-parts"]).toBeUndefined();
  });
});

describe("ROTULO_TIPO", () => {
  it("nomeia em pt-BR os seis tipos da v1, sem sobrar nem faltar", () => {
    const tipos: CSLType[] = [
      "book",
      "chapter",
      "article-journal",
      "webpage",
      "thesis",
      "paper-conference",
    ];

    expect(Object.keys(ROTULO_TIPO).sort()).toEqual([...tipos].sort());
    for (const tipo of tipos) expect(ROTULO_TIPO[tipo]).not.toBe("");
  });
});
