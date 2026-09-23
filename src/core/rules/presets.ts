import { soCamposSobrescreviveis } from "./resolve";
import type { PresetInstituicao, SobrescritaRegras } from "./types";

// Presets de instituição — passo 5.1.3. O preset é a segunda camada de
// `resolveRules()`: o manual de TCC de uma instituição que pede, por exemplo,
// recuo de 3 cm na citação longa. Quem guarda é a interface de persistência
// (`salvarPreset`, `listarPresets`, `excluirPreset` em
// `persistence/types.ts`), nunca `localStorage` direto, como o legado fazia
// (`aura_presets`). Adaptador IndexedDB agora, Firestore depois, sem tocar
// aqui.
//
// **Nenhum preset vem de fábrica.** O legado trazia `getDefaultPresets()`
// com valores de instituições sem fonte nenhuma. Um preset só existe se
// alguém o criar a partir do manual da própria instituição. Na v1 não há tela
// para isso: a estrutura fica pronta, como decidido para edital e override.

export class PresetInvalido extends Error {}

// Cria um preset com id novo. O nome é o que o painel de conflitos mostra
// como origem ("Universidade X: recuo da citação longa em 3 cm..."), então
// não pode ser vazio. Campos que nenhuma camada pode sobrescrever saem já
// aqui, para o que for gravado ser o que vai valer.
export function novoPreset(nome: string, regras: SobrescritaRegras): PresetInstituicao {
  const nomeLimpo = nome.trim();
  if (!nomeLimpo) throw new PresetInvalido("O preset precisa de um nome.");
  return { id: crypto.randomUUID(), nome: nomeLimpo, regras: soCamposSobrescreviveis(regras) };
}
