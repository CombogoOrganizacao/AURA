// Apoio dos testes do exportador `.docx` (não faz parte do produto).
//
// Desde o passo 8.2.2 o sumário e as listas de figuras e de tabelas levam
// dentro do campo as entradas já escritas ("1 Introdução", "Figura 1 — ...").
// Um teste que procura o PRIMEIRO "Introdução" do `document.xml` para saber
// onde começa o corpo passaria a achar a entrada do sumário. Os testes do
// corpo leem o XML sem esses campos; os do próprio campo leem o XML inteiro.
export function semCamposDeIndice(xml: string): string {
  return xml.replace(/<w:sdt>[\s\S]*?<\/w:sdt>/g, "");
}
