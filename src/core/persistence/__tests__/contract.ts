import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { novoDocumento } from "../../document/factory";
import type { Documento } from "../../document/types";
import type { PresetInstituicao } from "../../rules/types";
import type { AdaptadorPersistencia, ImagemArmazenada } from "../types";

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

    // Histórico de versões — passo 5.3.1. A retenção é de `versions.ts`,
    // testada lá; aqui, o que todo adaptador tem de cumprir.
    describe("versões", () => {
      // Só o relógio é falso: cada versão ganha um instante distinto, e a
      // ordem do histórico fica verificável. `setTimeout` segue real, porque
      // o `fake-indexeddb` depende dele.
      beforeEach(() => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-09-24T10:00:00Z"));
      });
      afterEach(() => {
        vi.useRealTimers();
      });

      function avancarMinutos(minutos: number) {
        vi.setSystemTime(new Date(Date.now() + minutos * 60_000));
      }

      it("salvarVersao devolve o resumo da versão que listarVersoes mostra", async () => {
        const documento = documentoComTitulo("Com versão");

        const salva = await adaptador.salvarVersao(documento, "Primeira");

        expect(salva).toEqual({
          id: expect.any(String),
          criadoEm: new Date("2026-09-24T10:00:00Z"),
          nome: "Primeira",
          automatica: false,
        });
        expect(await adaptador.listarVersoes(documento.id)).toEqual([salva]);
      });

      it("listarVersoes vem da mais recente para a mais antiga", async () => {
        const documento = documentoComTitulo("Três versões");
        const primeira = await adaptador.salvarVersao(documento);
        avancarMinutos(10);
        const segunda = await adaptador.salvarVersao(documento, "Antes da banca");
        avancarMinutos(10);
        const terceira = await adaptador.salvarVersao(documento);

        const ids = (await adaptador.listarVersoes(documento.id)).map((versao) => versao.id);
        expect(ids).toEqual([terceira.id, segunda.id, primeira.id]);
      });

      it("restaurar: carregarVersao devolve o documento como estava ao salvar", async () => {
        const documento = documentoComTitulo("Título antigo");
        const versao = await adaptador.salvarVersao(documento);

        // O documento segue sendo editado depois da versão.
        documento.metadados.titulo = "Título novo";
        await adaptador.salvarDocumento(documento);

        expect(await adaptador.carregarVersao(documento.id, versao.id)).toEqual({
          ...documento,
          metadados: { ...documento.metadados, titulo: "Título antigo" },
        });
      });

      it("carregarVersao devolve null para versão inexistente ou de outro documento", async () => {
        const dono = documentoComTitulo("Dono");
        const outro = documentoComTitulo("Outro");
        const versao = await adaptador.salvarVersao(dono);

        expect(await adaptador.carregarVersao(dono.id, "inexistente")).toBeNull();
        expect(await adaptador.carregarVersao(outro.id, versao.id)).toBeNull();
      });

      it("as versões de um documento não aparecem no histórico de outro", async () => {
        const a = documentoComTitulo("A");
        const b = documentoComTitulo("B");
        await adaptador.salvarVersao(a);
        const deB = await adaptador.salvarVersao(b);

        expect(await adaptador.listarVersoes(b.id)).toEqual([deB]);
      });

      it("excluirVersao tira só a versão pedida", async () => {
        const documento = documentoComTitulo("Duas versões");
        const fica = await adaptador.salvarVersao(documento, "Fica");
        avancarMinutos(1);
        const sai = await adaptador.salvarVersao(documento);

        await adaptador.excluirVersao(documento.id, sai.id);

        expect(await adaptador.listarVersoes(documento.id)).toEqual([fica]);
        expect(await adaptador.carregarVersao(documento.id, sai.id)).toBeNull();
      });

      it("excluirVersao não apaga versão pelo id de outro documento", async () => {
        const dono = documentoComTitulo("Dono");
        const outro = documentoComTitulo("Outro");
        const versao = await adaptador.salvarVersao(dono);

        await adaptador.excluirVersao(outro.id, versao.id);

        expect(await adaptador.listarVersoes(dono.id)).toEqual([versao]);
      });

      it("excluirVersao de versão inexistente não lança erro", async () => {
        await expect(adaptador.excluirVersao("doc", "nunca-existiu")).resolves.not.toThrow();
      });

      it("excluirDocumento apaga também as versões", async () => {
        const documento = documentoComTitulo("Some com o histórico");
        await adaptador.salvarDocumento(documento);
        const versao = await adaptador.salvarVersao(documento);

        await adaptador.excluirDocumento(documento.id);

        expect(await adaptador.listarVersoes(documento.id)).toEqual([]);
        expect(await adaptador.carregarVersao(documento.id, versao.id)).toBeNull();
      });
    });

    // Imagens das figuras — passo 6.1.2.
    describe("imagens", () => {
      function imagem(documentoId: string, id = "img-1"): ImagemArmazenada {
        return {
          id,
          documentoId,
          formato: "png",
          largura: 2,
          altura: 1,
          bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]),
        };
      }

      it("salva e carrega uma imagem com os bytes intactos", async () => {
        const salva = imagem("doc-1");
        await adaptador.salvarImagem(salva);

        const carregada = await adaptador.carregarImagem("doc-1", "img-1");
        expect(carregada).toEqual(salva);
        expect(Array.from(carregada!.bytes)).toEqual(Array.from(salva.bytes));
      });

      it("carregarImagem devolve null para imagem inexistente ou de outro documento", async () => {
        await adaptador.salvarImagem(imagem("doc-1"));

        expect(await adaptador.carregarImagem("doc-1", "inexistente")).toBeNull();
        expect(await adaptador.carregarImagem("doc-2", "img-1")).toBeNull();
      });

      it("mexer nos bytes depois de salvar não muda a imagem guardada", async () => {
        const salva = imagem("doc-1");
        await adaptador.salvarImagem(salva);
        salva.bytes[0] = 0;

        expect((await adaptador.carregarImagem("doc-1", "img-1"))!.bytes[0]).toBe(0x89);
      });

      it("excluirDocumento apaga as imagens dele, e só as dele", async () => {
        const documento = documentoComTitulo("Com figura");
        await adaptador.salvarDocumento(documento);
        await adaptador.salvarImagem(imagem(documento.id, "minha"));
        await adaptador.salvarImagem(imagem("outro-doc", "alheia"));

        await adaptador.excluirDocumento(documento.id);

        expect(await adaptador.carregarImagem(documento.id, "minha")).toBeNull();
        expect(await adaptador.carregarImagem("outro-doc", "alheia")).not.toBeNull();
      });
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
