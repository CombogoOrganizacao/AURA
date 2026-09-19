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
