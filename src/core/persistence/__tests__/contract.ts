import { beforeEach, describe, expect, it } from "vitest";

import { novoDocumento } from "../../document/factory";
import type { Documento } from "../../document/types";
import type { PresetInstituicao } from "../../rules/types";
import type { AdaptadorPersistencia } from "../types";

// Suíte de contrato: qualquer adaptador de `AdaptadorPersistencia` roda os
// mesmos testes. Não é `*.test.ts` — não é descoberta sozinha pelo Vitest —,
// é chamada de dentro de um arquivo de teste por adaptador (ver
// memory.test.ts), e o mesmo arquivo volta a ser chamado pelo adaptador
// IndexedDB no passo 1.2.3, com `fake-indexeddb`.
export function executarSuiteDeContrato(
  nome: string,
  criarAdaptador: () => AdaptadorPersistencia | Promise<AdaptadorPersistencia>,
) {
  describe(`contrato de persistência — ${nome}`, () => {
    let adaptador: AdaptadorPersistencia;

    beforeEach(async () => {
      adaptador = await criarAdaptador();
    });

    function documentoComTitulo(titulo: string): Documento {
      const documento = novoDocumento();
      documento.metadados.titulo = titulo;
      return documento;
    }

    it("carregarDocumento devolve null para um id que não existe", async () => {
      expect(await adaptador.carregarDocumento("inexistente")).toBeNull();
    });

    it("salva e recarrega um documento com igualdade estrutural", async () => {
      const documento = documentoComTitulo("Meu TCC");

      await adaptador.salvarDocumento(documento);

      expect(await adaptador.carregarDocumento(documento.id)).toEqual(documento);
    });

    it("salvar de novo com o mesmo id sobrescreve, não duplica", async () => {
      const documento = documentoComTitulo("Rascunho");
      await adaptador.salvarDocumento(documento);

      const atualizado: Documento = {
        ...documento,
        metadados: { ...documento.metadados, titulo: "Versão final" },
      };
      await adaptador.salvarDocumento(atualizado);

      expect(await adaptador.carregarDocumento(documento.id)).toEqual(atualizado);
      const resumos = await adaptador.listarDocumentos();
      expect(resumos.filter((r) => r.id === documento.id)).toHaveLength(1);
    });

    it("listarDocumentos reflete o que foi salvo e some após excluir", async () => {
      const documento = documentoComTitulo("Trabalho de Conclusão");
      await adaptador.salvarDocumento(documento);

      const resumos = await adaptador.listarDocumentos();
      expect(resumos).toContainEqual(
        expect.objectContaining({ id: documento.id, titulo: "Trabalho de Conclusão" }),
      );

      await adaptador.excluirDocumento(documento.id);

      expect(await adaptador.carregarDocumento(documento.id)).toBeNull();
      expect(await adaptador.listarDocumentos()).not.toContainEqual(
        expect.objectContaining({ id: documento.id }),
      );
    });

    it("excluirDocumento em id inexistente não lança erro", async () => {
      await expect(adaptador.excluirDocumento("nunca-existiu")).resolves.not.toThrow();
    });

    it("listarVersoes devolve vazio para um documento sem versões salvas", async () => {
      const documento = documentoComTitulo("Sem histórico ainda");
      await adaptador.salvarDocumento(documento);

      expect(await adaptador.listarVersoes(documento.id)).toEqual([]);
    });

    it("salvarVersao sem nome registra uma versão automática", async () => {
      const documento = documentoComTitulo("Com autosave de versão");

      await adaptador.salvarVersao(documento);

      const versoes = await adaptador.listarVersoes(documento.id);
      expect(versoes).toContainEqual(
        expect.objectContaining({ automatica: true, nome: undefined }),
      );
    });

    it("salvarVersao com nome registra uma versão nomeada", async () => {
      const documento = documentoComTitulo("Com snapshot manual");

      await adaptador.salvarVersao(documento, "Antes da entrega");

      const versoes = await adaptador.listarVersoes(documento.id);
      expect(versoes).toContainEqual(
        expect.objectContaining({ automatica: false, nome: "Antes da entrega" }),
      );
    });

    // Presets de instituição — passo 5.1.3.
    const PRESET: PresetInstituicao = {
      id: "preset-1",
      nome: "Universidade X",
      regras: { citacaoLonga: { recuo: 3 }, fonte: { familia: "Arial" } },
    };

    it("listarPresets devolve vazio quando nada foi salvo (nenhum preset de fábrica)", async () => {
      expect(await adaptador.listarPresets()).toEqual([]);
    });

    it("salva e lista um preset com igualdade estrutural", async () => {
      await adaptador.salvarPreset(PRESET);
      expect(await adaptador.listarPresets()).toEqual([PRESET]);
    });

    it("salvar preset com o mesmo id substitui, não duplica", async () => {
      await adaptador.salvarPreset(PRESET);
      const editado: PresetInstituicao = { ...PRESET, regras: { citacaoLonga: { recuo: 2 } } };
      await adaptador.salvarPreset(editado);

      expect(await adaptador.listarPresets()).toEqual([editado]);
    });

    it("excluirPreset tira só o preset pedido", async () => {
      const outro: PresetInstituicao = { id: "preset-2", nome: "Faculdade Y", regras: {} };
      await adaptador.salvarPreset(PRESET);
      await adaptador.salvarPreset(outro);

      await adaptador.excluirPreset(PRESET.id);

      expect(await adaptador.listarPresets()).toEqual([outro]);
    });

    it("excluirPreset em id inexistente não lança erro", async () => {
      await expect(adaptador.excluirPreset("nunca-existiu")).resolves.not.toThrow();
    });

    it("presets e documentos são independentes: excluir documento não apaga preset", async () => {
      const documento = documentoComTitulo("Com preset");
      await adaptador.salvarDocumento(documento);
      await adaptador.salvarPreset(PRESET);

      await adaptador.excluirDocumento(documento.id);

      expect(await adaptador.listarPresets()).toEqual([PRESET]);
    });
  });
}
