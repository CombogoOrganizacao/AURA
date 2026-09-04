// Aviso permanente: a v1 é para testes internos, não para uso em produção
// por usuários finais. Fica em todas as telas, no topo do layout raiz —
// não é dispensável (ver AvisoPaginacao/AvisoDadosLocais, esses sim opcionais).
export function AvisoAmbienteInterno() {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-bordo-700 px-4 py-2 text-center text-xs font-medium text-on-bordo"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8 7v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="8" cy="4.9" r="0.8" fill="currentColor" />
      </svg>
      <span>
        Ambiente interno de testes — esta versão do AURA ainda não é final e pode mudar sem aviso.
      </span>
    </div>
  );
}
