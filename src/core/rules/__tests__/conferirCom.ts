import type { Documento } from "../../document/types";
import { documentoConforme } from "./documentoConforme";
import { conferirDocumento, type Verificacao } from "../compliance";
import { resolveRules } from "../resolve";

// Roda UMA regra sobre o documento conforme depois de uma alteração. É o
// "um caso de teste por regra, com o achado esperado e o caso conforme" do
// passo 5.2.2: sem alteração, a regra não acusa nada.
export function conferirCom(
  verificacao: Verificacao,
  alterar: (documento: Documento) => void = () => {},
) {
  const documento = documentoConforme();
  alterar(documento);
  return conferirDocumento(documento, resolveRules("abnt", null, null).regras, [verificacao]);
}
