import { describe, expect, it } from "vitest";

import { novoDocumento } from "../../document/factory";
import { preambulo } from "./preambulo";

// Fonte escolhida pelo aluno no `.tex` — a mesma família do `.docx`.

describe("preâmbulo do .tex, fonte do trabalho", () => {
  it("sem escolha: Times (newtxtext), como antes da caixa existir", () => {
    const tex = preambulo(novoDocumento().metadados);
    expect(tex).toContain("\\usepackage{newtxtext,newtxmath}");
    expect(tex).not.toContain("helvet");
  });

  it("Arial: Helvetica como fonte padrão do texto, sem escala", () => {
    const metadados = { ...novoDocumento().metadados, fonte: "arial" as const };
    const tex = preambulo(metadados);
    expect(tex).toContain("\\usepackage{helvet}");
    expect(tex).toContain("\\renewcommand{\\familydefault}{\\sfdefault}");
    // A Helvetica vem depois da newtxtext, que fica só para a matemática.
    expect(tex.indexOf("\\usepackage{helvet}")).toBeGreaterThan(
      tex.indexOf("\\usepackage{newtxtext,newtxmath}"),
    );
  });

  it("títulos e sumário seguem a fonte do texto (\\normalfont), nunca \\rmfamily", () => {
    const linhasDeComando = preambulo(novoDocumento().metadados)
      .split("\n")
      .filter((linha) => !linha.trimStart().startsWith("%"));
    expect(linhasDeComando.filter((linha) => linha.includes("\\rmfamily"))).toEqual([]);
    expect(linhasDeComando).toContain("\\renewcommand{\\ABNTEXchapterfont}{\\normalfont\\bfseries}");
  });
});
