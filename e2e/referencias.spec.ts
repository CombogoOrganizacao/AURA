import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Passo 4.2 — o critério é comportamental: "trocar o tipo troca os campos e
// preserva os compartilhados". O Vitest prova a metade pura
// (`src/core/references/campos.test.ts`, 20 casos sobre `trocarTipo()` e a
// tabela); o que só se prova aqui é que o formulário desenha o que a tabela
// manda e que o dado digitado sobrevive à troca na tela.
//
// A página é `/design`: `FormReferencia` é controlado e ainda não tem dono —
// quem vai segurá-lo é o painel do passo 4.5. Ver `FormReferenciaDemo.tsx`.

async function abrirFormulario(page: Page) {
  await page.goto("/design");
  await page.getByLabel("Tipo de referência").scrollIntoViewIfNeeded();
}

function guardado(page: Page) {
  return page.getByLabel("Referência em CSL-JSON");
}

test.describe("formulário de referência — campos por tipo (passo 4.2)", () => {
  test("abre como livro, com os campos do §7.1.1 na ordem da norma", async ({ page }) => {
    await abrirFormulario(page);

    await expect(page.getByLabel("Tipo de referência")).toHaveValue("book");

    // Pelos CONTROLES, não pelo texto do rótulo: é o controle que guarda o
    // dado, e o rótulo de um grupo (`<legend>`) não nomeia campo nenhum.
    for (const campo of [
      "Título",
      "Subtítulo",
      "Local",
      "Editora",
      "Volume",
      "Número da edição",
      "Ano de publicação — ano",
    ]) {
      await expect(page.getByLabel(campo, { exact: true })).toBeVisible();
    }

    // Campos de outros tipos não aparecem num livro — é o que "campos certos
    // por tipo" quer dizer.
    await expect(page.getByLabel("Nome do evento", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Tipo do trabalho", { exact: true })).toHaveCount(0);
  });

  test("trocar o tipo troca os campos", async ({ page }) => {
    await abrirFormulario(page);

    await page.getByLabel("Tipo de referência").selectOption("thesis");

    await expect(page.getByLabel("Tipo do trabalho", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Vinculação acadêmica", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Ano de depósito — ano", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Data da defesa — ano", { exact: true })).toBeVisible();

    // "Editora" e "Volume" são do livro, e saem de cena.
    await expect(page.getByLabel("Editora", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Volume", { exact: true })).toHaveCount(0);
  });

  test("trocar o tipo preserva os campos compartilhados", async ({ page }) => {
    await abrirFormulario(page);

    await page.getByLabel("Título", { exact: true }).fill("Globalização");
    await page.getByLabel("Subtítulo", { exact: true }).fill("as consequências humanas");
    await page.getByLabel("Local", { exact: true }).fill("São Paulo");
    await page.getByLabel("Editora", { exact: true }).fill("Atlas");
    await page.getByLabel("Ano de publicação — ano").fill("2023");

    await page.getByLabel("Tipo de referência").selectOption("chapter");

    // Comuns ao §7.1.1 e ao §7.3: título, subtítulo, imprenta e data ficam.
    await expect(page.getByLabel("Título do capítulo", { exact: true })).toHaveValue(
      "Globalização",
    );
    await expect(page.getByLabel("Subtítulo do capítulo", { exact: true })).toHaveValue(
      "as consequências humanas",
    );
    await expect(page.getByLabel("Local", { exact: true })).toHaveValue("São Paulo");
    await expect(page.getByLabel("Editora", { exact: true })).toHaveValue("Atlas");
    await expect(page.getByLabel("Ano de publicação — ano")).toHaveValue("2023");
  });

  // Perder dado em silêncio é o desfecho que este projeto recusa em todo lugar
  // — na grade da tabela, na figura sem imagem, na sigla não citada.
  test("avisa, nomeando, o que a troca descartou", async ({ page }) => {
    await abrirFormulario(page);

    await page.getByLabel("Volume", { exact: true }).fill("3");
    await page.getByLabel("Tipo de referência").selectOption("webpage");

    await expect(page.getByText("Campos descartados na troca")).toBeVisible();
    await expect(page.getByText(/Volume — o tipo novo não tem esses campos/)).toBeVisible();
  });

  test("não avisa quando não havia nada preenchido para perder", async ({ page }) => {
    await abrirFormulario(page);

    await page.getByLabel("Tipo de referência").selectOption("webpage");

    await expect(page.getByText("Campos descartados na troca")).toHaveCount(0);
  });
});

test.describe("formulário de referência — nada guarda texto já formatado", () => {
  test("autoria vai para campos separados, invertíveis pelo formatador", async ({ page }) => {
    await abrirFormulario(page);

    await page.getByRole("button", { name: "+ Adicionar autoria" }).click();
    await page.getByLabel("Autoria 1 — sobrenome").fill("Silva");
    await page.getByLabel("Autoria 1 — prenome").fill("Maria Aparecida");

    await page.getByText("O que fica guardado (CSL-JSON)").click();

    const json = JSON.parse((await guardado(page).textContent()) ?? "{}");
    expect(json.author).toEqual([{ family: "Silva", given: "Maria Aparecida" }]);
  });

  // §8.1.2: autoria corporativa não se inverte, e por isso `literal` é campo
  // separado em `CSLName` desde o 4.1 — não um `family` sem `given`.
  test("entidade vai para `literal`, não para sobrenome", async ({ page }) => {
    await abrirFormulario(page);

    await page.getByRole("button", { name: "+ Adicionar autoria" }).click();
    // Clica no rótulo, e não no `<input>`: `Checkbox` esconde o controle real
    // com `sr-only` e desenha uma réplica — o `htmlFor` do `<label>` faz o
    // clique chegar ao lugar certo.
    await page.getByText("É uma entidade, não uma pessoa").click();
    await page
      .getByLabel("Autoria 1 — nome da entidade")
      .fill("Associação Brasileira de Normas Técnicas");

    await page.getByText("O que fica guardado (CSL-JSON)").click();

    const json = JSON.parse((await guardado(page).textContent()) ?? "{}");
    expect(json.author).toEqual([{ literal: "Associação Brasileira de Normas Técnicas" }]);
    expect(json.author[0].family).toBeUndefined();
  });

  // §8.3: "2. ed." contra "5th ed." — o idioma decide a grafia, então ele é
  // dado, não é decoração. Um `number` obrigaria o formatador a adivinhar.
  test("edição guarda número, acréscimos e idioma separados", async ({ page }) => {
    await abrirFormulario(page);

    await page.getByLabel("Número da edição").fill("3");
    await page.getByLabel("Acréscimos à edição").fill("rev. e aum.");
    await page.getByLabel("Idioma do documento").selectOption("pt");

    await page.getByText("O que fica guardado (CSL-JSON)").click();

    const json = JSON.parse((await guardado(page).textContent()) ?? "{}");
    expect(json.edicao).toEqual({ numero: 3, acrescimos: "rev. e aum.", idioma: "pt" });
  });

  // §8.6.1.3: "[ca. 1960]" não cabe em `date-parts`, e forçá-lo lá inventaria
  // precisão que a fonte não tem. Os dois caminhos se excluem à vista.
  test("data incerta e data em números se excluem", async ({ page }) => {
    await abrirFormulario(page);

    const ano = page.getByLabel("Ano de publicação — ano");
    const incerta = page.getByLabel("Ano de publicação — data incerta");

    await incerta.fill("[ca. 1960]");
    await expect(ano).toBeDisabled();

    await incerta.fill("");
    await ano.fill("1960");
    await expect(incerta).toBeDisabled();

    await page.getByText("O que fica guardado (CSL-JSON)").click();

    const json = JSON.parse((await guardado(page).textContent()) ?? "{}");
    expect(json.issued).toEqual({ "date-parts": [[1960]] });
  });
});

// --- Painel de gerenciamento (passo 4.5) ------------------------------------
// Aqui a tela é o editor de verdade, não `/design`: o critério do passo é
// "cria, edita e exclui", e isso só existe com o painel ligado ao documento e
// ao autosave. É também o passo em que o `FormReferencia` ganha dono.

// O documento tem um campo "Título" e a referência tem outro, os dois na mesma
// coluna. Não é ambiguidade de acessibilidade: cada formulário é um grupo com
// nome próprio (`aria-label`), e é por ele que se diz de qual "Título" se
// fala — como `getByLabel("Metadados do trabalho")` já faz do outro lado.
function formulario(page: Page) {
  return page.getByLabel("Dados da referência");
}

async function novoDocumento(page: Page) {
  await page.goto("/documentos");
  await page.getByRole("button", { name: "Novo documento" }).click();
  await page.waitForURL(/\/documento\//);
  await page.getByText("Referências", { exact: true }).click();
}

test.describe("painel de referências — listar, criar, editar, excluir (passo 4.5)", () => {
  test("começa vazio, e o vazio explica o que entra ali", async ({ page }) => {
    await novoDocumento(page);

    await expect(page.getByText("Nenhuma referência cadastrada")).toBeVisible();
  });

  test("cria uma referência e a prévia mostra como ela vai sair impressa", async ({ page }) => {
    await novoDocumento(page);
    await page.getByRole("button", { name: "Nova referência" }).click();

    // Recém-criada não tem o que formatar — dizer "Livro sem título" é melhor
    // que mostrar a imprenta ausente, que pareceria defeito.
    await expect(page.getByText("Livro sem título")).toBeVisible();

    await formulario(page).getByLabel("Título", { exact: true }).fill("Globalização");
    await page.getByRole("button", { name: "+ Adicionar autoria" }).click();
    await formulario(page).getByLabel("Autoria 1 — sobrenome").fill("Bauman");
    await formulario(page).getByLabel("Autoria 1 — prenome").fill("Zygmunt");
    await formulario(page).getByLabel("Local", { exact: true }).fill("Rio de Janeiro");
    await formulario(page).getByLabel("Editora", { exact: true }).fill("Zahar");
    await formulario(page).getByLabel("Ano de publicação — ano").fill("1999");

    // A prévia é o formatador do 4.3 na tela: sobrenome em caixa alta,
    // imprenta pontuada, ponto final.
    await expect(
      page.getByText("BAUMAN, Zygmunt. Globalização. Rio de Janeiro: Zahar, 1999."),
    ).toBeVisible();
  });

  test("a referência sobrevive ao recarregar a página", async ({ page }) => {
    await novoDocumento(page);
    await page.getByRole("button", { name: "Nova referência" }).click();
    await formulario(page).getByLabel("Título", { exact: true }).fill("Vigiar e punir");

    await expect(page.locator('span[role="status"]')).toHaveText("Salvo", { timeout: 15_000 });
    await page.reload();
    await page.getByText("Referências", { exact: true }).click();

    await expect(page.getByText("Vigiar e punir")).toBeVisible();
  });

  test("editar abre uma por vez", async ({ page }) => {
    await novoDocumento(page);

    await page.getByRole("button", { name: "Nova referência" }).click();
    await formulario(page).getByLabel("Título", { exact: true }).fill("Primeira obra");
    await page.getByRole("button", { name: "Fechar Primeira obra" }).click();

    await page.getByRole("button", { name: "Nova referência" }).click();
    await formulario(page).getByLabel("Título", { exact: true }).fill("Segunda obra");

    // A segunda está aberta; a primeira, fechada — o botão dela voltou a
    // "Editar".
    await expect(page.getByRole("button", { name: "Editar Primeira obra" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Fechar Segunda obra" })).toBeVisible();
  });

  test("excluir avisa e dá para desfazer", async ({ page }) => {
    await novoDocumento(page);
    await page.getByRole("button", { name: "Nova referência" }).click();
    await formulario(page).getByLabel("Título", { exact: true }).fill("Obra que será excluída");

    await page.getByRole("button", { name: "Excluir Obra que será excluída" }).click();

    await expect(page.getByText("Nenhuma referência cadastrada")).toBeVisible();
    await expect(page.getByText("Referência excluída")).toBeVisible();

    // Uma dúzia de campos digitados à mão não pode sumir por um clique errado.
    await page.getByRole("button", { name: "Desfazer exclusão da referência" }).click();

    await expect(page.getByText("Obra que será excluída")).toBeVisible();
    await expect(page.getByText("Nenhuma referência cadastrada")).toHaveCount(0);
  });

  test("excluir de vez: dispensado o aviso, a referência não volta", async ({ page }) => {
    await novoDocumento(page);
    await page.getByRole("button", { name: "Nova referência" }).click();
    await formulario(page).getByLabel("Título", { exact: true }).fill("Obra descartada");
    await page.getByRole("button", { name: "Excluir Obra descartada" }).click();

    await expect(page.locator('span[role="status"]')).toHaveText("Salvo", { timeout: 15_000 });
    await page.reload();
    await page.getByText("Referências", { exact: true }).click();

    await expect(page.getByText("Obra descartada")).toHaveCount(0);
  });

  // Critério do passo: "restrito ao desktop". Mesmo `hidden md:` da tabela e
  // da fórmula (3.6.3/3.6.5) — o que o breakpoint tira é o CADASTRO.
  test("o cadastro é restrito ao desktop", async ({ page }) => {
    await novoDocumento(page);
    await page.getByRole("button", { name: "Nova referência" }).click();
    await formulario(page).getByLabel("Título", { exact: true }).fill("Obra do desktop");
    await expect(page.locator('span[role="status"]')).toHaveText("Salvo", { timeout: 15_000 });

    await page.setViewportSize({ width: 375, height: 800 });

    await expect(page.getByRole("button", { name: "Nova referência" })).toHaveCount(0);

    // A referência já cadastrada continua no documento — some o cadastro, não
    // o dado.
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByText("Obra do desktop")).toBeVisible();
  });
});

// --- Importação de .bib com prévia (passo 4.7) ------------------------------
// O Vitest do 4.6 prova o mapeamento; aqui o que se prova é o critério do
// passo: "importar 20 entradas mostra as 20 e permite descartar algumas", e
// que nada entra no documento antes do "Importar".

function bibComObras(quantidade: number, extra = ""): Buffer {
  const entradas = Array.from(
    { length: quantidade },
    (_, i) => `@book{obra${i + 1},
  author    = {Silva, Ana},
  title     = {Obra ${i + 1}},
  publisher = {Atlas},
  address   = {S{\\~a}o Paulo},
  year      = {${2000 + i}}
}`,
  );
  return Buffer.from([...entradas, extra].join("\n\n"), "utf-8");
}

async function escolherBib(page: Page, conteudo: Buffer) {
  await page
    .getByLabel("Arquivo .bib")
    .setInputFiles({ name: "tcc.bib", mimeType: "text/plain", buffer: conteudo });
  return page.getByRole("dialog", { name: "Importar referências" });
}

function botoesEditar(page: Page) {
  return page.getByRole("button", { name: /^Editar / });
}

test.describe("importação de .bib com prévia (passo 4.7)", () => {
  test("importar 20 entradas mostra as 20 e permite descartar algumas", async ({ page }) => {
    await novoDocumento(page);
    const dialogo = await escolherBib(page, bibComObras(20));

    await expect(dialogo.getByRole("checkbox")).toHaveCount(20);
    // Todas começam marcadas, e cada uma já aparece na forma da norma — com o
    // acento que no arquivo era `S{\~a}o`.
    for (const caixa of await dialogo.getByRole("checkbox").all()) {
      await expect(caixa).toBeChecked();
    }
    await expect(dialogo.getByText("SILVA, Ana. Obra 1. São Paulo: Atlas, 2000.")).toBeVisible();

    // Nada entrou no documento ainda: a prévia é só prévia.
    await expect(botoesEditar(page)).toHaveCount(0);

    // Pelo teclado: o `<input>` do `Checkbox` é `sr-only` e o `<label>` recebe
    // o clique do mouse — Espaço na caixa focada é o caminho de quem navega
    // por teclado ou leitor de tela, e prova os dois de uma vez.
    for (const titulo of ["Obra 3", "Obra 7", "Obra 20"]) {
      const caixa = dialogo.getByRole("checkbox", { name: `Importar ${titulo}`, exact: true });
      await caixa.press("Space");
      await expect(caixa).not.toBeChecked();
    }
    await dialogo.getByRole("button", { name: "Importar 17 referências" }).click();

    await expect(dialogo).toHaveCount(0);
    await expect(botoesEditar(page)).toHaveCount(17);
    await expect(page.getByRole("button", { name: "Editar Obra 3", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Editar Obra 4", exact: true })).toHaveCount(1);

    // E vão para o documento de verdade, pelo autosave.
    await expect(page.locator('span[role="status"]')).toHaveText("Salvo", { timeout: 15_000 });
    await page.reload();
    await page.getByText("Referências", { exact: true }).click();
    await expect(botoesEditar(page)).toHaveCount(17);
  });

  test("mostra o que não entra, com o motivo, e o trecho com erro, com a linha", async ({
    page,
  }) => {
    await novoDocumento(page);
    const dialogo = await escolherBib(
      page,
      bibComObras(
        2,
        [
          "@techreport{relatorio, title = {Relatório}}",
          "@inproceedings{evento, title = {Artigo}, booktitle = {Congresso X}, year = 2020}",
          "@book{quebrada, title = {Sem fechar,",
        ].join("\n\n"),
      ),
    );

    await expect(dialogo.getByRole("checkbox")).toHaveCount(3);
    // O aviso do 4.6 aparece junto da referência a que se refere.
    await expect(dialogo.getByText(/nome do evento veio de booktitle/)).toBeVisible();

    const naoEntram = dialogo.getByRole("region", { name: "Entradas que não serão importadas" });
    await expect(naoEntram.getByText(/relatorio/)).toBeVisible();
    await expect(naoEntram.getByText(/@techreport/)).toBeVisible();

    const comErro = dialogo.getByRole("region", { name: "Trechos com erro no arquivo" });
    // Diz QUAL entrada quebrou, pela chave — não só um número de linha.
    await expect(comErro.getByRole("listitem")).toHaveCount(1);
    await expect(comErro.getByRole("listitem")).toContainText(/quebrada \(linha \d+\): /);
  });

  test("cancelar não traz nada; desmarcar todas impede confirmar", async ({ page }) => {
    await novoDocumento(page);
    let dialogo = await escolherBib(page, bibComObras(3));

    await dialogo.getByRole("button", { name: "Desmarcar todas" }).click();
    await expect(dialogo.getByRole("button", { name: "Nenhuma selecionada" })).toBeDisabled();

    await dialogo.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialogo).toHaveCount(0);
    await expect(botoesEditar(page)).toHaveCount(0);

    // O mesmo arquivo pode ser escolhido de novo — o campo é zerado a cada
    // escolha, senão o navegador não dispara `change`.
    dialogo = await escolherBib(page, bibComObras(3));
    await expect(dialogo.getByRole("checkbox")).toHaveCount(3);
  });

  test("arquivo sem referência nenhuma avisa, sem abrir a prévia", async ({ page }) => {
    await novoDocumento(page);
    await escolherBib(page, Buffer.from("% só um comentário\n", "utf-8"));

    await expect(page.getByText("Nenhuma referência encontrada em tcc.bib.")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
