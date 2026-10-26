import { LIMITES_ZIP, lerDiretorioCentral } from "../latex/reimportZip";

// O `.docx` antes do mammoth (passo 8.7.1). O `.docx` é um `.zip`, e o
// mammoth o descompacta inteiro na memória da aba: os limites do `.zip` de
// projeto LaTeX (`LIMITES_ZIP`, decisão da usuária em 30/09/2026) valem
// aqui, conferidos no diretório central, antes de descompactar qualquer
// parte. Um `.zip` que mente no diretório não passa do JSZip, que confere o
// tamanho de cada parte ao ler.

// A parte que todo `.docx` tem (ECMA-376, parte 1, §11.3.10). Um `.zip` de
// projeto LaTeX não a tem; é por ela que o botão sabe o que recebeu.
const DOCUMENTO_PRINCIPAL = "word/document.xml";

export function eDocx(bytes: Uint8Array): boolean {
  const entradas = lerDiretorioCentral(bytes);
  return (
    Array.isArray(entradas) && entradas.some((entrada) => entrada.nome === DOCUMENTO_PRINCIPAL)
  );
}

// O `.doc` do Word 97–2003 não é `.zip`: é um arquivo OLE, que começa
// sempre por estes 8 bytes. O mammoth não o lê.
const ASSINATURA_OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export function eDocAntigo(bytes: Uint8Array): boolean {
  return ASSINATURA_OLE.every((byte, i) => bytes[i] === byte);
}

export const MENSAGEM_DOC_ANTIGO =
  "O arquivo é um .doc, o formato antigo do Word, que o AURA não lê. No Word, use Arquivo → Salvar como → Documento do Word (.docx), e importe o .docx.";

// `null` se o arquivo pode ir ao mammoth; senão, a mensagem para o aluno.
export function recusaDoDocx(bytes: Uint8Array): string | null {
  const entradas = lerDiretorioCentral(bytes);
  if (
    entradas === null ||
    (Array.isArray(entradas) && !entradas.some((e) => e.nome === DOCUMENTO_PRINCIPAL))
  ) {
    return "O arquivo não é um .docx legível. No Word, use Arquivo → Salvar como → Documento do Word (.docx).";
  }
  if (entradas === "zip64") return "O .docx é grande demais para ser um TCC.";
  if (entradas.length > LIMITES_ZIP.arquivos) {
    return `O .docx tem ${entradas.length} partes, e o limite é ${LIMITES_ZIP.arquivos}.`;
  }
  const total = entradas.reduce((soma, entrada) => soma + entrada.tamanho, 0);
  if (total > LIMITES_ZIP.bytesDescompactados) {
    return "Descompactado, o .docx passa de 100 MB. Reduza as imagens no Word e tente de novo.";
  }
  return null;
}
