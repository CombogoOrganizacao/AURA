import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import type { Documento } from "../../document/types";
import {
  documentoCompleto,
  imagensDoZip,
  PNG_1X1,
} from "../../export/latex/__fixtures__/documento";
import { gerarZipTex } from "../../export/latex/zip";
import {
  comReferenciasEscolhidas,
  LIMITES_ZIP,
  lerProjetoZip,
  montarReimportacaoDoProjeto,
  type ProjetoZip,
} from "./reimportZip";

// Reimportação do `.zip` do projeto (passo 6.2.4): o pacote que
// `gerarZipTex()` escreve, de volta, e os limites de segurança
// (docs/latex-abntex.md §1.5).

async function projetoDe(bytes: Uint8Array): Promise<ProjetoZip> {
  const resultado = await lerProjetoZip(bytes);
  if (!resultado.ok) throw new Error(resultado.erro.mensagem);
  return resultado.valor;
}

// O `.zip` exportado, aberto para edição (como o aluno faria no Overleaf).
async function zipEditavel(documento: Documento) {
  const bytes = await gerarZipTex(documento, imagensDoZip(documento.id));
  return JSZip.loadAsync(bytes);
}

async function bytesDe(zip: JSZip) {
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

let contador = 0;
const gerarId = () => `gerado-${++contador}`;

function reimportar(atual: Documento | null, projeto: ProjetoZip) {
  const resultado = montarReimportacaoDoProjeto({
    atual,
    projeto,
    imagensSalvas: atual ? imagensDoZip(atual.id) : new Map(),
    gerarId,
  });
  if (!resultado.ok) throw new Error(resultado.erro.mensagem);
  return resultado.valor;
}

// Troca o tamanho descompactado declarado de toda entrada do diretório
// central, para simular um `.zip` que mente no cabeçalho.
function declararTamanho(bytes: Uint8Array, tamanho: number): Uint8Array {
  const copia = bytes.slice();
  const dados = new DataView(copia.buffer);
  for (let i = 0; i + 46 <= copia.length; i++) {
    if (dados.getUint32(i, true) === 0x02014b50) dados.setUint32(i + 24, tamanho, true);
  }
  return copia;
}

describe("lerProjetoZip e montarReimportacaoDoProjeto", () => {
  const original = documentoCompleto();

  it("o .zip exportado volta sem mudança nenhuma", async () => {
    const projeto = await projetoDe(await gerarZipTex(original, imagensDoZip(original.id)));
    expect([...projeto.arquivos.keys()]).toHaveLength(2);
    expect(projeto.bib).toContain("@book{freire,");
    expect([...projeto.figuras.keys()]).toEqual(["img1"]);

    const { documento, relatorio, imagens } = reimportar(original, projeto);
    expect(relatorio.semMudancas).toBe(true);
    expect(relatorio.avisos).toEqual([]);
    expect(relatorio.ignorados).toEqual([]);
    expect(relatorio.referencias).toEqual({ novas: [], conflitos: [] });
    expect(imagens).toEqual([]);
    expect(documento).toEqual(original);
  });

  it("a edição num capítulo de sections/ volta na seção certa", async () => {
    const zip = await zipEditavel(original);
    const capitulo = Object.keys(zip.files).find((nome) => nome.startsWith("sections/02-"))!;
    const texto = await zip.file(capitulo)!.async("string");
    zip.file(capitulo, texto.replace("\\caption{Fluxo do processo}", "\\caption{Fluxo revisado}"));
    const { documento, relatorio } = reimportar(original, await projetoDe(await bytesDe(zip)));
    expect(relatorio.secoes.alteradas).toEqual([
      { id: "s-dev", titulo: "Desenvolvimento", mudancas: ["texto"] },
    ]);
    expect(documento.sections[2].content[0]).toMatchObject({ id: "f1", legenda: "Fluxo revisado" });
  });

  it("arquivos que o AURA não lê ficam de fora e entram no relatório", async () => {
    const zip = await zipEditavel(original);
    zip.file("main.pdf", "%PDF");
    zip.file("notas/lembretes.txt", "oi");
    zip.file("figuras/sobrando.png", PNG_1X1);
    const { relatorio } = reimportar(original, await projetoDe(await bytesDe(zip)));
    expect(relatorio.ignorados.sort()).toEqual([
      "figuras/sobrando.png",
      "main.pdf",
      "notas/lembretes.txt",
    ]);
    expect(relatorio.semMudancas).toBe(true);
  });

  it("projeto compactado dentro de uma pasta é lido pela pasta", async () => {
    const zip = await zipEditavel(original);
    const dentro = new JSZip();
    for (const [nome, objeto] of Object.entries(zip.files)) {
      if (!objeto.dir) dentro.file(`meu-tcc/${nome}`, await objeto.async("uint8array"));
    }
    const { relatorio } = reimportar(original, await projetoDe(await bytesDe(dentro)));
    expect(relatorio.semMudancas).toBe(true);
  });

  describe("referências do .bib", () => {
    it("entrada editada é conflito, e vale a do AURA até o aluno escolher a do arquivo", async () => {
      const zip = await zipEditavel(original);
      const bib = await zip.file("referencias.bib")!.async("string");
      zip.file("referencias.bib", bib.replace("Pedagogia do oprimido", "Pedagogia da autonomia"));
      const { documento, relatorio } = reimportar(original, await projetoDe(await bytesDe(zip)));

      expect(relatorio.referencias.conflitos).toHaveLength(1);
      expect(relatorio.referencias.conflitos[0]).toMatchObject({
        id: "freire",
        noAura: { title: "Pedagogia do oprimido" },
        noArquivo: { id: "freire", title: "Pedagogia da autonomia" },
      });
      expect(relatorio.semMudancas).toBe(false);
      expect(documento.references[0].title).toBe("Pedagogia do oprimido");

      const escolhido = comReferenciasEscolhidas(
        documento,
        relatorio.referencias.conflitos,
        new Set(["freire"]),
      );
      expect(escolhido.references[0].title).toBe("Pedagogia da autonomia");
    });

    it("chave nova entra como referência, e o \\cite dela vira citação ligada", async () => {
      const zip = await zipEditavel(original);
      const bib = await zip.file("referencias.bib")!.async("string");
      zip.file(
        "referencias.bib",
        `${bib}\n@book{saviani,\n  author = {Saviani, Dermeval},\n  title = {Escola e democracia},\n  publisher = {Autores Associados},\n  address = {Campinas},\n  year = {2008}\n}\n`,
      );
      const main = await zip.file("main.tex")!.async("string");
      zip.file(
        "main.tex",
        main.replace("Perguntas aplicadas.", "A escola é política \\cite{saviani}."),
      );
      const { documento, relatorio } = reimportar(original, await projetoDe(await bytesDe(zip)));

      expect(relatorio.referencias.novas.map((referencia) => referencia.id)).toEqual(["saviani"]);
      expect(documento.references.map((referencia) => referencia.id)).toEqual([
        "freire",
        "saviani",
      ]);
      expect(documento.apendices[0].content).toEqual([
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "A escola é política",
              marks: [
                {
                  type: "citacao",
                  attrs: { refId: "saviani", modo: "indireta", pagina: null, apud: null },
                },
              ],
            },
            { type: "text", text: "." },
          ],
        },
      ]);
    });

    it("chave que sumiu do .bib não tira a referência do AURA", async () => {
      const zip = await zipEditavel(original);
      zip.file("referencias.bib", "% vazio\n");
      const { documento, relatorio } = reimportar(original, await projetoDe(await bytesDe(zip)));
      expect(documento.references).toEqual(original.references);
      expect(relatorio.semMudancas).toBe(true);
    });
  });

  describe("figuras", () => {
    it("imagem trocada vira imagem nova, com id novo, e a antiga fica", async () => {
      const zip = await zipEditavel(original);
      zip.file("figuras/img1.png", Uint8Array.from([...PNG_1X1, 0]));
      const { documento, relatorio, imagens } = reimportar(
        original,
        await projetoDe(await bytesDe(zip)),
      );

      expect(imagens).toHaveLength(1);
      const [nova] = imagens;
      expect(nova).toMatchObject({
        documentoId: original.id,
        formato: "png",
        largura: 1,
        altura: 1,
      });
      expect(nova.id).not.toBe("img1");
      expect(documento.sections[2].content[0]).toMatchObject({ id: "f1", imagem: nova.id });
      expect(relatorio.imagens).toEqual({
        atualizadas: [{ legenda: "Fluxo do processo", imagem: nova.id }],
        novas: 0,
      });
      expect(relatorio.semMudancas).toBe(false);
    });

    it("imagem ausente do .zip: a figura fica com a que já tinha", async () => {
      const zip = await zipEditavel(original);
      zip.remove("figuras/img1.png");
      const { documento, imagens } = reimportar(original, await projetoDe(await bytesDe(zip)));
      expect(imagens).toEqual([]);
      expect(documento.sections[2].content[0]).toMatchObject({ imagem: "img1" });
    });

    it("trabalho novo: as imagens entram com id novo, nunca o do arquivo", async () => {
      const projeto = await projetoDe(await gerarZipTex(original, imagensDoZip(original.id)));
      const { documento, relatorio, imagens } = reimportar(null, projeto);
      expect(imagens).toHaveLength(1);
      expect(imagens[0].id).not.toBe("img1");
      expect(documento.sections[2].content[0]).toMatchObject({ imagem: imagens[0].id });
      expect(relatorio.imagens.novas).toBe(1);
      // O .bib traz as referências do trabalho.
      expect(documento.references.map((referencia) => referencia.id)).toEqual(["freire"]);
    });

    it("arquivo em figuras/ que não é PNG nem JPEG não é lido, com aviso", async () => {
      const zip = await zipEditavel(original);
      zip.file("figuras/img1.png", "não sou imagem");
      const projeto = await projetoDe(await bytesDe(zip));
      expect(projeto.figuras.size).toBe(0);
      expect(projeto.avisos.map((aviso) => aviso.mensagem)).toEqual([
        "A imagem não é um PNG ou JPEG legível e não foi lida.",
      ]);
    });
  });

  describe("limites de segurança", () => {
    it("recusa caminho com .., absoluto ou com barra invertida (zip slip)", async () => {
      for (const nome of ["../fora.tex", "/etc/passwd", "sections\\01.tex", "C:/x.tex"]) {
        const zip = await zipEditavel(original);
        zip.file(nome, "x");
        const resultado = await lerProjetoZip(await bytesDe(zip));
        expect(resultado).toMatchObject({ ok: false, erro: { codigo: "zip-caminho-inseguro" } });
      }
    });

    it("recusa tamanho descompactado declarado acima de 100 MB, antes de descompactar", async () => {
      const bytes = declararTamanho(await gerarZipTex(original), 60 * 1024 * 1024);
      expect(await lerProjetoZip(bytes)).toMatchObject({
        ok: false,
        erro: { codigo: "zip-grande-demais" },
      });
    });

    it("recusa arquivo que descompacta mais do que declara", async () => {
      const bytes = declararTamanho(await gerarZipTex(original), 10);
      expect(await lerProjetoZip(bytes)).toMatchObject({
        ok: false,
        erro: {
          codigo: "zip-invalido",
          mensagem: expect.stringMatching(/ocupa mais do que o \.zip declara/),
        },
      });
    });

    it(`recusa mais de ${LIMITES_ZIP.arquivos} arquivos`, async () => {
      const zip = await zipEditavel(original);
      for (let i = 0; i < LIMITES_ZIP.arquivos; i++) zip.file(`extra/${i}.txt`, "x");
      expect(await lerProjetoZip(await bytesDe(zip))).toMatchObject({
        ok: false,
        erro: { codigo: "zip-muitos-arquivos" },
      });
    });

    it("recusa o que não é .zip, .zip sem main.tex e texto que não é UTF-8", async () => {
      expect(await lerProjetoZip(new TextEncoder().encode("não é zip"))).toMatchObject({
        ok: false,
        erro: { codigo: "zip-invalido" },
      });

      const semMain = await zipEditavel(original);
      semMain.remove("main.tex");
      expect(await lerProjetoZip(await bytesDe(semMain))).toMatchObject({
        ok: false,
        erro: { codigo: "zip-sem-main" },
      });

      const latin1 = await zipEditavel(original);
      latin1.file("main.tex", Uint8Array.from([0x25, 0xe9, 0x0a]));
      expect(await lerProjetoZip(await bytesDe(latin1))).toMatchObject({
        ok: false,
        erro: { codigo: "nao-utf8" },
      });
    });
  });
});

describe("projeto de fora do AURA, com quaisquer nomes (§1.6)", () => {
  async function projetoDeFora(extras: (zip: JSZip) => void = () => {}) {
    const zip = new JSZip();
    zip.file(
      "tcc.tex",
      [
        "\\documentclass{abntex2}",
        "\\graphicspath{{imagens/}}",
        "\\titulo{Meu TCC}",
        "\\begin{document}",
        "\\textual",
        "\\include{capitulos/introducao}",
        "\\input{capitulos/metodo.tex}",
        "\\postextual",
        "\\bibliography{bib/refs}",
        "\\end{document}",
      ].join("\n"),
    );
    zip.file(
      "capitulos/introducao.tex",
      "\\chapter{Introdução}\nA escola dialoga \\cite{freire}.\n\n\\begin{figure}\\caption{Fluxo}\\includegraphics{fluxo}\\end{figure}",
    );
    zip.file(
      "capitulos/metodo.tex",
      "\\chapter{Método}\n\\begin{figure}\\caption{Logo}\\includegraphics{logo}\\end{figure}",
    );
    zip.file("capitulos/rascunho.tex", "\\chapter{Rascunho}\nNão incluído.");
    zip.file(
      "bib/refs.bib",
      "@book{freire,\n  author = {Freire, Paulo},\n  title = {Pedagogia do oprimido},\n  publisher = {Paz e Terra},\n  address = {Rio de Janeiro},\n  year = {1987}\n}\n",
    );
    zip.file("imagens/fluxo.png", PNG_1X1);
    zip.file("imagens/logo.pdf", "%PDF-1.4");
    zip.file("abntex2.cls", "% classe");
    extras(zip);
    return projetoDe(await bytesDe(zip));
  }

  it("acha o principal pelo \\documentclass e segue os \\include de outra pasta", async () => {
    const projeto = await projetoDeFora();
    expect(projeto.caminhoDoMain).toBe("tcc.tex");
    const { documento, relatorio } = reimportar(null, projeto);
    expect(documento.metadados.titulo).toBe("Meu TCC");
    expect(documento.sections.map((secao) => secao.titulo)).toEqual(["Introdução", "Método"]);
    expect(relatorio.ignorados.sort()).toEqual([
      "abntex2.cls",
      "capitulos/rascunho.tex",
      "imagens/logo.pdf",
    ]);
  });

  it("as referências vêm do .bib de qualquer nome, e o \\cite liga nelas", async () => {
    const { documento, relatorio } = reimportar(null, await projetoDeFora());
    expect(relatorio.referencias.novas.map((referencia) => referencia.id)).toEqual(["freire"]);
    expect(documento.sections[0].content[0]).toMatchObject({
      content: [
        {
          text: "A escola dialoga",
          marks: [{ type: "citacao", attrs: { refId: "freire", modo: "indireta" } }],
        },
        { text: "." },
      ],
    });
  });

  it("a imagem vem pelo \\graphicspath e pela extensão deduzida; PDF fica de fora com o motivo", async () => {
    const { documento, relatorio, imagens } = reimportar(null, await projetoDeFora());
    expect(imagens).toHaveLength(1);
    expect(documento.sections[0].content[1]).toMatchObject({
      type: "figura",
      legenda: "Fluxo",
      imagem: imagens[0].id,
    });
    expect(documento.sections[1].content[0]).toMatchObject({ legenda: "Logo", imagem: null });
    expect(relatorio.avisos.map((aviso) => aviso.mensagem)).toContain(
      "A figura “Logo” entrou sem imagem: imagens/logo.pdf está em PDF, e o AURA só aceita PNG e JPEG. Converta a imagem e inclua na figura.",
    );
    expect(relatorio.imagens.novas).toBe(1);
  });

  it("dois arquivos principais sem main.tex: recusa, dizendo quais", async () => {
    const zip = new JSZip();
    zip.file("a.tex", "\\documentclass{article}\\begin{document}A\\end{document}");
    zip.file("b.tex", "\\documentclass{article}\\begin{document}B\\end{document}");
    expect(await lerProjetoZip(await bytesDe(zip))).toMatchObject({
      ok: false,
      erro: {
        codigo: "zip-sem-main",
        mensagem: expect.stringMatching(/mais de um arquivo principal \(a\.tex, b\.tex\)/),
      },
    });
  });

  it(".bib que não é UTF-8 não impede o resto, e avisa", async () => {
    const projeto = await projetoDeFora((zip) =>
      zip.file("bib/latin1.bib", Uint8Array.from([0x40, 0x62, 0xe9])),
    );
    expect(projeto.avisos.map((aviso) => aviso.mensagem)).toContain(
      "O .bib não está em UTF-8 e não foi lido: as referências dele não vêm.",
    );
    expect(projeto.bib).toContain("@book{freire");
  });
});
