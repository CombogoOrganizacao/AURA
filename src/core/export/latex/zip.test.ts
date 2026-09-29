import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { documentoCompleto, imagensDoZip, PNG_1X1 } from "./__fixtures__/documento";
import { gerarTex } from "./document";
import { gerarZipTex } from "./zip";

// Passo 6.2.3 — o `.zip` do projeto LaTeX. A compilação dele descompactado
// está em `compila.test.ts`.

async function abrir() {
  const documento = documentoCompleto();
  const zip = await JSZip.loadAsync(await gerarZipTex(documento, imagensDoZip(documento.id)));
  const texto = (caminho: string) => zip.file(caminho)!.async("string");
  return { documento, zip, texto };
}

describe("gerarZipTex", () => {
  it("abre com main.tex, sections/, referencias.bib e figuras/, e nada mais", async () => {
    const { zip } = await abrir();
    const arquivos = Object.values(zip.files)
      .filter((arquivo) => !arquivo.dir)
      .map((arquivo) => arquivo.name)
      .sort();
    expect(arquivos).toEqual([
      "figuras/img1.png",
      "main.tex",
      "referencias.bib",
      "sections/01-introducao.tex",
      "sections/02-desenvolvimento.tex",
    ]);
  });

  it("um arquivo por capítulo, com as subseções e os marcadores dentro", async () => {
    const { texto } = await abrir();
    const introducao = await texto("sections/01-introducao.tex");
    expect(introducao).toContain("% AURA-SECTION: s-intro");
    expect(introducao).toContain("% AURA-SECTION: s-obj");
    expect(introducao).not.toContain("s-dev");
    expect(await texto("sections/02-desenvolvimento.tex")).toContain("% AURA-SECTION: s-dev");
  });

  it("o main.tex inclui os capítulos na ordem, e o resto é o .tex avulso", async () => {
    const { documento, texto } = await abrir();
    const main = await texto("main.tex");
    expect(main).toContain(
      "\\textual\n\n\\input{sections/01-introducao}\n\\input{sections/02-desenvolvimento}",
    );
    expect(main).not.toContain("% AURA-SECTION");
    expect(main.split("\n")[0]).toBe(gerarTex(documento).split("\n")[0]);
    expect(main).toContain("% AURA-METADADOS: início");
  });

  it("referencias.bib com a chave igual ao refId do \\auracite; figura com os mesmos bytes", async () => {
    const { zip, texto } = await abrir();
    expect(await texto("referencias.bib")).toContain("@book{freire,");
    expect(await texto("sections/01-introducao.tex")).toContain("\\auracite[modo={direta_curta}, pagina={35}]{freire}");
    expect(await zip.file("figuras/img1.png")!.async("uint8array")).toEqual(PNG_1X1);
  });
});
