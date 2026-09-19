import { describe, expect, it } from "vitest";

import {
  CAMPOS_POR_TIPO,
  camposCompartilhados,
  camposDe,
  novaReferencia,
  trocarTipo,
  type NomeCampo,
} from "./campos";
import { ROTULO_TIPO, type CSLType, type Referencia, type ReferenciaLivro } from "./types";

const TIPOS = Object.keys(CAMPOS_POR_TIPO) as CSLType[];

// Livro preenchido até o último campo complementar. Serve de origem para as
// trocas: quanto mais cheio, mais visível o que sobrevive e o que cai.
function livroCompleto(): ReferenciaLivro {
  return {
    id: "r1",
    type: "book",
    author: [{ family: "Silva", given: "Maria" }],
    title: "Globalização",
    subtitle: "as consequências humanas",
    edicao: { numero: 2, acrescimos: "rev. e aum.", idioma: "pt" },
    "publisher-place": "São Paulo",
    publisher: "Atlas",
    issued: { "date-parts": [[2023]] },
    translator: [{ family: "Costa", given: "João" }],
    volume: "3",
    URL: "https://exemplo.org/livro",
    accessed: { "date-parts": [[2026, 9, 18]] },
  };
}

function nomesDe(tipo: CSLType): NomeCampo[] {
  return camposDe(tipo).map((campo) => campo.nome);
}

describe("CAMPOS_POR_TIPO — a tabela que o formulário desenha (passo 4.2)", () => {
  it("cobre os seis tipos, e nenhum abre vazio", () => {
    expect(TIPOS).toHaveLength(6);
    expect(TIPOS.sort()).toEqual(Object.keys(ROTULO_TIPO).sort());

    for (const tipo of TIPOS) {
      expect(camposDe(tipo).length).toBeGreaterThan(0);
    }
  });

  it("não repete campo dentro de um tipo — dois controles para o mesmo dado brigariam", () => {
    for (const tipo of TIPOS) {
      const nomes = nomesDe(tipo);
      expect(new Set(nomes).size).toBe(nomes.length);
    }
  });

  // Todo tipo pergunta o título, e todo tipo permite registrar o endereço:
  // a §6.6 pede "Disponível em:" para QUALQUER documento consultado online,
  // não só para site — foi a decisão do 4.1 de pôr `URL` na base.
  it("título e endereço existem em todos os tipos", () => {
    for (const tipo of TIPOS) {
      expect(nomesDe(tipo)).toContain("title");
      expect(nomesDe(tipo)).toContain("URL");
      expect(nomesDe(tipo)).toContain("accessed");
    }
  });

  // A ordem é a do modelo da norma, não a que fica bonita na tela: quem copia
  // de uma folha de rosto desce o formulário na ordem em que a referência sai
  // impressa.
  it("o livro segue a ordem do §7.1.1: autor, título, subtítulo, edição, local, editora, data", () => {
    expect(nomesDe("book").slice(0, 7)).toEqual([
      "author",
      "title",
      "subtitle",
      "edicao",
      "publisher-place",
      "publisher",
      "issued",
    ]);
  });

  // §7.1.2: o ano de DEPÓSITO vem logo depois do título, e a data de DEFESA
  // fecha a referência. São campos distintos, e o formulário pergunta os dois
  // em lugares distintos — se aparecessem juntos, a pessoa preencheria um só.
  it("a tese separa ano de depósito (issued) de data de defesa, nessa ordem", () => {
    const nomes = nomesDe("thesis");

    expect(nomes.indexOf("issued")).toBeLessThan(nomes.indexOf("defesa"));
    expect(nomes.indexOf("title")).toBeLessThan(nomes.indexOf("issued"));
  });

  // Mesmo campo, rótulo diferente conforme o documento. O DADO continua no
  // mesmo lugar — é isso que permite preservá-lo ao trocar de tipo.
  it("issued e publisher mudam de rótulo entre livro e tese, sem mudar de campo", () => {
    const rotuloDe = (tipo: CSLType, nome: NomeCampo) =>
      camposDe(tipo).find((campo) => campo.nome === nome)?.rotulo;

    expect(rotuloDe("book", "issued")).toBe("Ano de publicação");
    expect(rotuloDe("thesis", "issued")).toBe("Ano de depósito");
    expect(rotuloDe("book", "publisher")).toBe("Editora");
    expect(rotuloDe("thesis", "publisher")).toBe("Vinculação acadêmica");
  });

  it("os obrigatórios de cada tipo são os que a união exige em types.ts", () => {
    const obrigatoriosDe = (tipo: CSLType) =>
      camposDe(tipo)
        .filter((campo) => campo.obrigatorio)
        .map((campo) => campo.nome);

    expect(obrigatoriosDe("book")).toEqual(["title", "issued"]);
    expect(obrigatoriosDe("chapter")).toContain("container-title");
    expect(obrigatoriosDe("webpage")).toContain("URL");
    expect(obrigatoriosDe("thesis")).toContain("tipoTrabalho");
    expect(obrigatoriosDe("paper-conference")).toContain("event-title");
  });
});

describe("novaReferencia — o esqueleto mínimo de cada tipo", () => {
  it("devolve um objeto do tipo pedido, com o id recebido", () => {
    for (const tipo of TIPOS) {
      const referencia = novaReferencia(tipo, "novo");

      expect(referencia.type).toBe(tipo);
      expect(referencia.id).toBe("novo");
      expect(referencia.title).toBe("");
    }
  });

  // `crypto.randomUUID()` é do navegador, e `src/core/` não fala com ele —
  // por isso o `id` entra por parâmetro em vez de ser gerado aqui.
  it("não inventa id — quem gera é quem chama", () => {
    expect(novaReferencia("book", "abc").id).toBe("abc");
    expect(novaReferencia("book", "def").id).toBe("def");
  });
});

describe("trocarTipo — troca os campos e preserva os compartilhados (critério do 4.2)", () => {
  it("mantém id, tipo novo, e tudo que os dois tipos têm em comum", () => {
    const livro = livroCompleto();
    const capitulo = trocarTipo(livro, "chapter");

    expect(capitulo.type).toBe("chapter");
    expect(capitulo.id).toBe("r1");

    // Comuns aos dois modelos (§7.1.1 e §7.3): autoria, título, subtítulo,
    // edição, imprenta, data e o par endereço/acesso.
    expect(capitulo.author).toEqual(livro.author);
    expect(capitulo.title).toBe("Globalização");
    expect(capitulo.subtitle).toBe("as consequências humanas");
    expect(capitulo.issued).toEqual({ "date-parts": [[2023]] });
    expect(capitulo.URL).toBe("https://exemplo.org/livro");
    expect(capitulo.accessed).toEqual({ "date-parts": [[2026, 9, 18]] });

    if (capitulo.type === "chapter") {
      expect(capitulo.edicao).toEqual({ numero: 2, acrescimos: "rev. e aum.", idioma: "pt" });
      expect(capitulo.publisher).toBe("Atlas");
      expect(capitulo["publisher-place"]).toBe("São Paulo");
    }
  });

  // Cair é a decisão, não o acidente: guardar `translator` escondido dentro de
  // um capítulo seria manter dado que nenhum formatador lê e que reaparece se
  // a pessoa voltar atrás, dando a impressão de que nada se perdeu.
  it("descarta o que não existe no destino, em vez de escondê-lo", () => {
    const capitulo = trocarTipo(livroCompleto(), "chapter");

    expect(Object.keys(capitulo)).not.toContain("translator");
    expect(Object.keys(capitulo)).not.toContain("volume");
  });

  it("preenche os obrigatórios do destino que a origem não tinha", () => {
    const capitulo = trocarTipo(livroCompleto(), "chapter");
    const tese = trocarTipo(livroCompleto(), "thesis");
    const evento = trocarTipo(livroCompleto(), "paper-conference");

    if (capitulo.type === "chapter") expect(capitulo["container-title"]).toBe("");
    if (tese.type === "thesis") expect(tese.tipoTrabalho).toBe("");
    if (evento.type === "paper-conference") expect(evento["event-title"]).toBe("");
  });

  it("trocar para o mesmo tipo devolve a mesma referência, sem copiar nada", () => {
    const livro = livroCompleto();

    expect(trocarTipo(livro, "book")).toBe(livro);
  });

  it("não modifica a referência de origem", () => {
    const livro = livroCompleto();
    trocarTipo(livro, "thesis");

    expect(livro.type).toBe("book");
    expect(livro.volume).toBe("3");
  });

  // As trinta transições possíveis entre os seis tipos. É o que sustenta a
  // única asserção de tipo do módulo: se alguma delas produzisse um objeto sem
  // os obrigatórios do destino, seria aqui que apareceria.
  it("as trinta transições produzem um objeto válido do tipo de destino", () => {
    for (const origem of TIPOS) {
      for (const destino of TIPOS) {
        if (origem === destino) continue;

        const referencia = trocarTipo(novaReferencia(origem, "r"), destino);

        expect(referencia.type).toBe(destino);
        expect(referencia.id).toBe("r");
        expect(typeof referencia.title).toBe("string");

        // Nenhuma chave além das que o destino declara (mais `id` e `type`).
        const permitidas = new Set<string>([...nomesDe(destino), "id", "type"]);
        for (const chave of Object.keys(referencia)) {
          expect(permitidas.has(chave)).toBe(true);
        }
      }
    }
  });

  // Ida e volta por um tipo mais pobre perde o que o intermediário não tem —
  // e é isso mesmo. O teste existe para que ninguém "conserte" a perda depois
  // guardando campo órfão escondido.
  it("ida e volta não ressuscita o que caiu no caminho", () => {
    const livro = livroCompleto();
    const volta = trocarTipo(trocarTipo(livro, "webpage"), "book");

    expect(volta.title).toBe("Globalização");
    if (volta.type === "book") {
      expect(volta.publisher).toBeUndefined();
      expect(volta.volume).toBeUndefined();
    }
  });

  // Campo vazio não é campo preenchido: um `undefined` copiado criaria a chave
  // no destino e faria `Object.keys()` mentir sobre o que a referência tem.
  it("não copia campo ausente como chave indefinida", () => {
    const soTitulo: Referencia = { id: "r2", type: "book", title: "Sem mais nada" };

    expect(Object.keys(trocarTipo(soTitulo, "article-journal")).sort()).toEqual([
      "container-title",
      "id",
      "title",
      "type",
    ]);
  });
});

describe("camposCompartilhados — o que sobrevive, antes de a troca acontecer", () => {
  it("livro e capítulo compartilham a imprenta e a edição", () => {
    const comuns = camposCompartilhados("book", "chapter");

    expect(comuns).toEqual(
      expect.arrayContaining(["author", "title", "subtitle", "edicao", "publisher", "issued"]),
    );
    expect(comuns).not.toContain("translator");
    expect(comuns).not.toContain("page");
  });

  it("site e livro compartilham pouco — é o que justifica avisar antes de trocar", () => {
    expect(camposCompartilhados("book", "webpage")).not.toContain("publisher");
    expect(camposCompartilhados("book", "webpage")).toContain("title");
  });

  it("é simétrico: o que sobrevive de A para B é o mesmo conjunto de B para A", () => {
    for (const origem of TIPOS) {
      for (const destino of TIPOS) {
        expect(new Set(camposCompartilhados(origem, destino))).toEqual(
          new Set(camposCompartilhados(destino, origem)),
        );
      }
    }
  });
});
