import { describe, expect, it } from "vitest";

import type {
  ReferenciaArtigo,
  ReferenciaCapitulo,
  ReferenciaEvento,
  ReferenciaLivro,
  ReferenciaSite,
  ReferenciaTese,
} from "../types";
import { formatarReferencia, referenciaEmTexto } from "./abnt";

// Os casos por tipo são conferidos contra docs/auditoria-abnt.md, seção
// "Auditoria da NBR 6023:2025" — ordem dos elementos da §7, transcrição da §8.
// Onde o formatador segue convenção e não norma, o teste diz isso no nome, para
// ninguém ler um teste verde como "está conforme a 6023".

function texto(referencia: Parameters<typeof referenciaEmTexto>[0]): string {
  return referenciaEmTexto(referencia);
}

describe("livro — §7.1.1 monografia no todo", () => {
  const livro: ReferenciaLivro = {
    id: "r1",
    type: "book",
    author: [{ family: "Silva", given: "Maria Aparecida" }],
    title: "Globalização",
    subtitle: "as consequências humanas",
    edicao: { numero: 2, acrescimos: "rev. e aum.", idioma: "pt" },
    translator: [{ family: "Costa", given: "João" }],
    volume: "3",
    "publisher-place": "São Paulo",
    publisher: "Atlas",
    issued: { "date-parts": [[2023]] },
  };

  it("sai na ordem da norma, com sobrenome em caixa alta", () => {
    expect(texto(livro)).toBe(
      "SILVA, Maria Aparecida. Globalização: as consequências humanas. " +
        "Tradução de João Costa. 2. ed. rev. e aum. v. 3. São Paulo: Atlas, 2023.",
    );
  });

  it("destaca o título e para no dois-pontos (§6.7)", () => {
    const trechos = formatarReferencia(livro);
    const destacados = trechos.filter((trecho) => trecho.papel === "titulo");

    expect(destacados).toHaveLength(1);
    expect(destacados[0].texto).toBe("Globalização");
    // O subtítulo vem junto, sem destaque, depois dos dois-pontos.
    expect(trechos.some((t) => t.texto.startsWith(": as consequências") && !t.papel)).toBe(true);
  });

  it("sem local nem editora usa [S. l.: s. n.] (§8.5.6)", () => {
    const semImprenta: ReferenciaLivro = {
      id: "r2",
      type: "book",
      title: "Relatório interno",
      author: [{ family: "Rocha", given: "Ana" }],
      issued: { "date-parts": [[2023]] },
    };

    expect(texto(semImprenta)).toBe("ROCHA, Ana. Relatório interno. [S. l.: s. n.], 2023.");
  });

  it("falta só a editora: mantém o local e marca [s. n.] (§8.5.5)", () => {
    const semEditora: ReferenciaLivro = {
      id: "r3",
      type: "book",
      title: "Relatório interno",
      author: [{ family: "Rocha", given: "Ana" }],
      "publisher-place": "Recife",
      issued: { "date-parts": [[2023]] },
    };

    expect(texto(semEditora)).toBe("ROCHA, Ana. Relatório interno. Recife: [s. n.], 2023.");
  });
});

describe("capítulo — §7.3 parte de monografia", () => {
  const capitulo: ReferenciaCapitulo = {
    id: "r4",
    type: "chapter",
    author: [{ family: "Souza", given: "Ana" }],
    title: "Métodos mistos",
    "container-title": "Manual de pesquisa",
    responsabilidade: {
      nomes: [{ family: "Lima", given: "Pedro" }],
      tipo: "organizador",
    },
    "publisher-place": "Rio de Janeiro",
    publisher: "Vozes",
    issued: { "date-parts": [[2020]] },
    page: "45-67",
  };

  it("leva In:, a abreviação do tipo de participação e a paginação da parte", () => {
    expect(texto(capitulo)).toBe(
      "SOUZA, Ana. Métodos mistos. In: LIMA, Pedro (org.). Manual de pesquisa. " +
        "Rio de Janeiro: Vozes, 2020. p. 45-67.",
    );
  });

  // CONVENÇÃO, não norma: a §6.7 não diz qual título leva o destaque quando há
  // parte e todo. Ver o cabeçalho de abnt.ts.
  it("destaca o título do livro, não o do capítulo (convenção)", () => {
    const destacados = formatarReferencia(capitulo).filter((t) => t.papel === "titulo");

    expect(destacados).toHaveLength(1);
    expect(destacados[0].texto).toBe("Manual de pesquisa");
  });

  it("sem organizador, o In: gruda no título do livro", () => {
    const semOrganizador: ReferenciaCapitulo = { ...capitulo, responsabilidade: undefined };

    expect(texto(semOrganizador)).toContain("Métodos mistos. In: MANUAL de pesquisa.");
  });
});

describe("artigo de periódico — §7.7.5", () => {
  const artigo: ReferenciaArtigo = {
    id: "r5",
    type: "article-journal",
    author: [{ family: "Moura", given: "Carla" }],
    title: "Ensino remoto",
    "container-title": "Revista Brasileira de Educação",
    "publisher-place": "São Paulo",
    volume: "28",
    issue: "2",
    page: "45-67",
    issued: { "date-parts": [[2023, 5]] },
  };

  it("separa o periódico em diante por vírgula, e não abrevia maio (Anexo A)", () => {
    expect(texto(artigo)).toBe(
      "MOURA, Carla. Ensino remoto. Revista Brasileira de Educação, São Paulo, " +
        "v. 28, n. 2, p. 45-67, maio 2023.",
    );
  });

  it("destaca o título do periódico (convenção)", () => {
    const destacados = formatarReferencia(artigo).filter((t) => t.papel === "titulo");

    expect(destacados).toHaveLength(1);
    expect(destacados[0].texto).toBe("Revista Brasileira de Educação");
  });

  it("abrevia os demais meses com ponto (Anexo A)", () => {
    const janeiro: ReferenciaArtigo = { ...artigo, issued: { "date-parts": [[2023, 1]] } };

    expect(texto(janeiro)).toContain("jan. 2023");
  });
});

describe("trabalho acadêmico — §7.1.2 e §8.12", () => {
  const tese: ReferenciaTese = {
    id: "r6",
    type: "thesis",
    author: [{ family: "Aguiar", given: "André Andrade de" }],
    title: "Avaliação da microbiota bucal",
    issued: { "date-parts": [[2009]] },
    extensao: { quantidade: 112, unidade: "folha" },
    tipoTrabalho: "Tese",
    grau: "Doutorado",
    curso: "Odontologia",
    publisher: "Faculdade de Odontologia, Universidade de São Paulo",
    "publisher-place": "São Paulo",
    defesa: { "date-parts": [[2009]] },
  };

  it("separa ano de depósito, extensão, grau e curso, e data de defesa", () => {
    expect(texto(tese)).toBe(
      "AGUIAR, André Andrade de. Avaliação da microbiota bucal. 2009. 112 f. " +
        "Tese (Doutorado em Odontologia) – Faculdade de Odontologia, " +
        "Universidade de São Paulo, São Paulo, 2009.",
    );
  });

  it("conta folhas, não páginas (§8.7.2.1)", () => {
    const emPaginas: ReferenciaTese = { ...tese, extensao: { quantidade: 112, unidade: "pagina" } };

    expect(texto(emPaginas)).toContain("112 p.");
  });

  it("a orientação entra depois do título (§8.1.1.6), em ordem direta", () => {
    const comOrientacao: ReferenciaTese = {
      ...tese,
      orientador: [{ family: "Nunes", given: "Beatriz" }],
    };

    expect(texto(comOrientacao)).toContain(
      "Avaliação da microbiota bucal. Orientação: Beatriz Nunes. 2009.",
    );
  });
});

describe("trabalho em evento — §7.8.4.1", () => {
  const trabalho: ReferenciaEvento = {
    id: "r7",
    type: "paper-conference",
    author: [{ family: "Brayner", given: "Aline" }],
    title: "Recuperação de informação",
    "event-title": "Simpósio Brasileiro de Banco de Dados",
    "event-number": "12",
    "event-date": { "date-parts": [[1994]] },
    "event-place": "São Paulo",
    "container-title": "Anais [...]",
    "publisher-place": "São Paulo",
    publisher: "USP",
    issued: { "date-parts": [[1994]] },
    page: "16-29",
  };

  it("põe o nome do evento em maiúsculas e o número em arábico com ponto (§8.1.3)", () => {
    expect(texto(trabalho)).toBe(
      "BRAYNER, Aline. Recuperação de informação. In: SIMPÓSIO BRASILEIRO DE BANCO DE DADOS, " +
        "12., 1994, São Paulo. Anais [...]. São Paulo: USP, 1994. p. 16-29.",
    );
  });

  it("não duplica o ponto de quem já digitou o número com ele", () => {
    const comPonto: ReferenciaEvento = { ...trabalho, "event-number": "12." };

    expect(texto(comPonto)).toContain("DADOS, 12., 1994");
  });
});

describe("documento em meio eletrônico — §7.20 e §6.6", () => {
  const site: ReferenciaSite = {
    id: "r8",
    type: "webpage",
    author: [{ literal: "Associação Brasileira de Normas Técnicas" }],
    title: "Sobre a ABNT",
    "container-title": "ABNT",
    issued: { "date-parts": [[2026]] },
    URL: "https://www.abnt.org.br",
    accessed: { "date-parts": [[2026, 9, 18]] },
  };

  it("fecha com Disponível em e Acesso em, nessa ordem (§8.13)", () => {
    expect(texto(site)).toBe(
      "ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. Sobre a ABNT. ABNT, 2026. " +
        "Disponível em: https://www.abnt.org.br. Acesso em: 18 set. 2026.",
    );
  });

  it("a autoria corporativa não se inverte (§8.1.2)", () => {
    expect(texto(site).startsWith("ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS.")).toBe(true);
    expect(texto(site)).not.toContain("TÉCNICAS, Associação");
  });

  // §6.6 põe o par na BASE de todos os tipos, não só no site — foi decisão do
  // 4.1 e é aqui que ela se paga.
  it("vale para qualquer documento consultado online, não só para site", () => {
    const livroOnline: ReferenciaLivro = {
      id: "r9",
      type: "book",
      title: "Manual",
      author: [{ family: "Dias", given: "Rui" }],
      "publisher-place": "Curitiba",
      publisher: "UFPR",
      issued: { "date-parts": [[2021]] },
      URL: "https://exemplo.org/manual.pdf",
      accessed: { "date-parts": [[2026, 5, 2]] },
    };

    expect(texto(livroOnline)).toBe(
      "DIAS, Rui. Manual. Curitiba: UFPR, 2021. Disponível em: https://exemplo.org/manual.pdf. " +
        "Acesso em: 2 maio 2026.",
    );
  });
});

describe("autoria (§8.1)", () => {
  function livroCom(author: ReferenciaLivro["author"]): ReferenciaLivro {
    return {
      id: "r10",
      type: "book",
      author,
      title: "Pesquisa social",
      "publisher-place": "São Paulo",
      publisher: "Cortez",
      issued: { "date-parts": [[2019]] },
    };
  }

  it("separa autores por ponto e vírgula", () => {
    const dois = livroCom([
      { family: "Silva", given: "Maria" },
      { family: "Souza", given: "João" },
    ]);

    expect(texto(dois).startsWith("SILVA, Maria; SOUZA, João.")).toBe(true);
  });

  // §8.1.1.2: "convém indicar todos". O et al. é PERMISSÃO, não obrigação —
  // cortar sozinho seria decidir pela pessoa o que a norma deixa em aberto.
  it("com quatro autores indica todos, e nunca escreve et al. por conta própria", () => {
    const quatro = livroCom([
      { family: "Silva", given: "Maria" },
      { family: "Souza", given: "João" },
      { family: "Lima", given: "Ana" },
      { family: "Costa", given: "Rui" },
    ]);

    expect(texto(quatro)).toContain("SILVA, Maria; SOUZA, João; LIMA, Ana; COSTA, Rui.");
    expect(texto(quatro)).not.toContain("et al.");
  });

  it("sobrenome sem prenome sai sozinho, sem vírgula solta", () => {
    expect(texto(livroCom([{ family: "Platão" }])).startsWith("PLATÃO. Pesquisa social.")).toBe(
      true,
    );
  });
});

describe("obra sem autoria — entrada pelo título (§8.1.4 e §6.7)", () => {
  const semAutor: ReferenciaLivro = {
    id: "r11",
    type: "book",
    title: "Diagnóstico do setor editorial brasileiro",
    "publisher-place": "São Paulo",
    publisher: "Câmara Brasileira do Livro",
    issued: { "date-parts": [[1993]] },
  };

  it("entra pelo título, com a primeira palavra em maiúsculas e sem destaque", () => {
    expect(texto(semAutor)).toBe(
      "DIAGNÓSTICO do setor editorial brasileiro. São Paulo: Câmara Brasileira do Livro, 1993.",
    );
    expect(formatarReferencia(semAutor).some((t) => t.papel === "titulo")).toBe(false);
  });

  it("a caixa alta cobre o artigo inicial e a palavra seguinte", () => {
    const comArtigo: ReferenciaLivro = { ...semAutor, title: "As 500 maiores empresas" };

    expect(texto(comArtigo).startsWith("AS 500 maiores empresas.")).toBe(true);
  });

  it("nunca escreve Anônimo nem Autor desconhecido", () => {
    expect(texto(semAutor)).not.toMatch(/anônimo|autor desconhecido/i);
  });
});

describe("edição (§8.3)", () => {
  function livroComEdicao(edicao: ReferenciaLivro["edicao"]): ReferenciaLivro {
    return {
      id: "r12",
      type: "book",
      author: [{ family: "Gil", given: "Antonio Carlos" }],
      title: "Como elaborar projetos",
      edicao,
      "publisher-place": "São Paulo",
      publisher: "Atlas",
      issued: { "date-parts": [[2017]] },
    };
  }

  it("em português usa o ordinal seguido de ponto e de ed.", () => {
    expect(texto(livroComEdicao({ numero: 6 }))).toContain("6. ed. São Paulo");
  });

  it("no idioma do documento, e não no do trabalho", () => {
    expect(texto(livroComEdicao({ numero: 5, idioma: "en" }))).toContain("5th ed.");
    expect(texto(livroComEdicao({ numero: 1, idioma: "en" }))).toContain("1st ed.");
    expect(texto(livroComEdicao({ numero: 2, idioma: "en" }))).toContain("2nd ed.");
    expect(texto(livroComEdicao({ numero: 3, idioma: "en" }))).toContain("3rd ed.");
    expect(texto(livroComEdicao({ numero: 11, idioma: "en" }))).toContain("11th ed.");
  });

  it("edição ausente não vira primeira edição", () => {
    expect(texto(livroComEdicao(undefined))).toBe(
      "GIL, Antonio Carlos. Como elaborar projetos. São Paulo: Atlas, 2017.",
    );
  });
});

describe("data (§8.6)", () => {
  function livroComData(issued: ReferenciaLivro["issued"]): ReferenciaLivro {
    return {
      id: "r13",
      type: "book",
      author: [{ family: "Reis", given: "Ana" }],
      title: "Memórias",
      "publisher-place": "Belém",
      publisher: "Pará",
      issued,
    };
  }

  it("data incerta sai como foi digitada (§8.6.1.3)", () => {
    expect(texto(livroComData({ raw: "[ca. 1960]" }))).toContain("Belém: Pará, [ca. 1960].");
  });

  it("sem data, a imprenta não fica com vírgula pendurada", () => {
    expect(texto(livroComData(undefined))).toBe("REIS, Ana. Memórias. Belém: Pará.");
  });
});

describe("pontuação uniforme (§6.4)", () => {
  it("nunca duplica o ponto de um elemento que já termina em abreviação", () => {
    const livro: ReferenciaLivro = {
      id: "r14",
      type: "book",
      author: [{ family: "Gil", given: "Antonio Carlos" }],
      title: "Como elaborar projetos",
      edicao: { numero: 6 },
      "publisher-place": "São Paulo",
      publisher: "Atlas",
      issued: { "date-parts": [[2017]] },
    };

    expect(texto(livro)).not.toContain("..");
  });

  it("fecha toda referência com um ponto", () => {
    const site: ReferenciaSite = {
      id: "r15",
      type: "webpage",
      title: "Página",
      URL: "https://exemplo.org/",
      accessed: { "date-parts": [[2026, 9, 18]] },
    };

    expect(texto(site).endsWith(".")).toBe(true);
    expect(texto(site)).toBe(
      "PÁGINA. Disponível em: https://exemplo.org/. Acesso em: 18 set. 2026.",
    );
  });

  // Regressão: o separador de elementos era somado ao trecho anterior, e
  // quando o elemento terminava no título ele entrava DENTRO do destaque —
  // um ponto em negrito depois do título, no `.docx`.
  it("o separador de elementos nunca entra no trecho destacado (§6.7)", () => {
    // Com organizador, para o título do livro ser de fato o trecho destacado:
    // sem ele a obra entra pelo título e a §6.7 troca o destaque por caixa
    // alta, que é outro ramo.
    const comTituloNoMeio: ReferenciaCapitulo = {
      id: "r18",
      type: "chapter",
      author: [{ family: "Souza", given: "Ana" }],
      title: "Parte",
      "container-title": "Todo",
      responsabilidade: { nomes: [{ family: "Lima", given: "Pedro" }], tipo: "organizador" },
      "publisher-place": "São Paulo",
      publisher: "Atlas",
      issued: { "date-parts": [[2020]] },
    };

    for (const referencia of [comTituloNoMeio, { ...comTituloNoMeio, page: "31-40" }]) {
      const destacado = formatarReferencia(referencia).find((t) => t.papel === "titulo");

      expect(destacado?.texto).toBe("Todo");
      expect(destacado?.texto.trimEnd()).toBe(destacado?.texto);
    }
  });

  it("o texto corrido não carrega marca de destaque nenhuma", () => {
    const livro: ReferenciaLivro = {
      id: "r16",
      type: "book",
      author: [{ family: "Silva", given: "Maria" }],
      title: "Título",
      "publisher-place": "São Paulo",
      publisher: "Atlas",
      issued: { "date-parts": [[2023]] },
    };

    expect(texto(livro)).not.toMatch(/[*_<>]/);
  });
});

describe("páginas (§8.7.2.4)", () => {
  it("prefixa p. no intervalo, e não duplica quando já veio com ele", () => {
    const base: ReferenciaCapitulo = {
      id: "r17",
      type: "chapter",
      author: [{ family: "Souza", given: "Ana" }],
      title: "Parte",
      "container-title": "Todo",
      "publisher-place": "São Paulo",
      publisher: "Atlas",
      issued: { "date-parts": [[2020]] },
      page: "31-40",
    };

    expect(texto(base)).toContain("p. 31-40.");
    expect(texto({ ...base, page: "p. 31-40" })).toContain("p. 31-40.");
    expect(texto({ ...base, page: "p. 31-40" })).not.toContain("p. p.");
  });
});
