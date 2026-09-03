// Debounce genérico — atrasa a chamada de `fn` até se passarem `atrasoMs`
// sem nenhuma chamada nova. Cada chamada reinicia a contagem, então uma
// rajada de chamadas produz uma só, com os argumentos da última — é o
// mecanismo por trás do autosave (src/lib/useAutosave.ts): dez teclas
// digitadas em um segundo geram uma escrita só.
//
// Só `setTimeout`/`clearTimeout`, sem `window` — existem em Node também,
// por isso este arquivo pode ficar em `src/core` (ver CLAUDE.md).
export interface Debounced<Args extends unknown[]> {
  (...args: Args): void;
  // Descarta uma chamada pendente sem executar `fn`. Necessário pra quem usa
  // isto num componente React não disparar `fn` depois de desmontado.
  cancelar(): void;
}

export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  atrasoMs: number,
): Debounced<Args> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;

  const chamada = ((...args: Args) => {
    if (temporizador !== undefined) {
      clearTimeout(temporizador);
    }
    temporizador = setTimeout(() => {
      temporizador = undefined;
      fn(...args);
    }, atrasoMs);
  }) as Debounced<Args>;

  chamada.cancelar = () => {
    if (temporizador !== undefined) {
      clearTimeout(temporizador);
      temporizador = undefined;
    }
  };

  return chamada;
}
