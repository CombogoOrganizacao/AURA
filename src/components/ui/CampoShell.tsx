import type { ReactNode } from "react";

interface CampoShellProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  htmlFor: string;
  children: ReactNode;
}

// Moldura comum a `Input` e `Select` (passo 2.2) — rótulo, dica/erro e o
// asterisco de obrigatório. A referência da skill duplicava isso em cada
// arquivo (`Input.jsx`/`Select.jsx` traziam o mesmo `FieldShell`); aqui
// aparece uma vez só, os dois campos consomem.
export function CampoShell({ label, hint, error, required, htmlFor, children }: CampoShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {/*
        O asterisco fica FORA do `<label>`, não dentro dele com `aria-hidden`.
        O nome acessível do campo tem que ser "Título", não "Título *": quem lê
        por leitor de tela já ouve "obrigatório" do `required` do próprio
        controle, e um asterisco no nome também impede localizar o campo pelo
        rótulo — foi como isto apareceu, escrevendo o Playwright do passo 4.2.
        Tirar do `<label>` resolve os dois de uma vez e não depende de o
        cálculo de nome acessível respeitar `aria-hidden`.
      */}
      {label && (
        <span className="flex items-baseline gap-0.5 font-sans text-xs tracking-wide">
          <label htmlFor={htmlFor} className="font-medium text-body">
            {label}
          </label>
          {required && (
            <span aria-hidden="true" className="text-danger">
              *
            </span>
          )}
        </span>
      )}
      {children}
      {(error || hint) && (
        <span className={`font-sans text-2xs ${error ? "text-danger" : "text-subtle"}`}>
          {error || hint}
        </span>
      )}
    </div>
  );
}
