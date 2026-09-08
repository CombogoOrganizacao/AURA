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
      {label && (
        <label htmlFor={htmlFor} className="font-sans text-xs font-medium tracking-wide text-body">
          {label}
          {required && <span className="text-danger"> *</span>}
        </label>
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
