import { describe, expect, it } from "vitest";

import { palavrasRepetidas } from "./repeated";

// Passo 5.4.1 — "Vitest com texto conhecido; stopword não conta".

function trechos(texto: string, ocorrencias: { inicio: number; fim: number }[]): string[] {
  return ocorrencias.map(({ inicio, fim }) => texto.slice(inicio, fim));
}

describe("palavrasRepetidas", () => {
  it("acha a palavra repetida no parágrafo, sem diferenciar maiúscula, com a posição de cada uma", () => {
    const texto = "A pesquisa mostrou que a pesquisa anterior e a Pesquisa de campo falharam.";

    const [repeticao, ...resto] = palavrasRepetidas([texto]);

    expect(resto).toEqual([]);
    expect(repeticao).toMatchObject({ palavra: "pesquisa", paragrafo: 0 });
    expect(trechos(texto, repeticao.ocorrencias)).toEqual(["pesquisa", "pesquisa", "Pesquisa"]);
  });

  it("palavra funcional não conta, por mais que se repita", () => {
    const texto = "Para o método, para a análise, para tudo: sobre isso, sobre aquilo.";

    expect(palavrasRepetidas([texto])).toEqual([]);
  });

  it("palavra curta e número não contam", () => {
    const texto = "A lei de 2019 e a lei de 2019 dizem o mesmo em 3,5 e 3,5 metros.";

    expect(palavrasRepetidas([texto])).toEqual([]);
  });

  it("a mesma palavra em parágrafos diferentes não é repetição", () => {
    expect(palavrasRepetidas(["O método é bom.", "O método é ruim."])).toEqual([]);
  });

  it("indica o parágrafo onde está a repetição", () => {
    const paragrafos = ["Nada se repete aqui.", "O dado novo contradiz o dado antigo."];

    expect(palavrasRepetidas(paragrafos)).toEqual([
      {
        palavra: "dado",
        paragrafo: 1,
        ocorrencias: [
          { inicio: 2, fim: 6 },
          { inicio: 24, fim: 28 },
        ],
      },
    ]);
  });

  it("palavra com hífen é uma palavra só, e pontuação em volta não atrapalha", () => {
    const texto = "O perfil sócio-econômico (sócio-econômico, aliás) define o perfil.";

    expect(palavrasRepetidas([texto]).map((r) => r.palavra)).toEqual(["perfil", "sócio-econômico"]);
  });

  it("acento composto e decomposto são a mesma palavra", () => {
    const composto = "análise";
    const decomposto = "análise".normalize("NFD");
    const texto = `A ${composto} e a ${decomposto}.`;

    const [repeticao] = palavrasRepetidas([texto]);
    expect(repeticao.palavra).toBe("análise");
    expect(trechos(texto, repeticao.ocorrencias)).toEqual([composto, decomposto]);
  });

  it("no mesmo parágrafo, a mais repetida vem primeiro; no empate, a que aparece antes", () => {
    const texto = "Teoria e prática: a prática da teoria, a prática do campo.";

    expect(palavrasRepetidas([texto]).map((r) => [r.palavra, r.ocorrencias.length])).toEqual([
      ["prática", 3],
      ["teoria", 2],
    ]);
  });

  it("o mínimo de ocorrências é ajustável", () => {
    const texto = "O campo e o campo e o campo.";

    expect(palavrasRepetidas([texto], 4)).toEqual([]);
    expect(palavrasRepetidas([texto], 3)).toHaveLength(1);
  });
});
