import type { ReactNode } from "react";

// Segunda linha explicativa que `Checkbox`, `Radio` e `Switch` compartilham
// — mesmo raciocínio de `CampoShell`: a referência da skill repetia este
// bloco em cada arquivo, aqui existe uma vez só.
export function RotuloComDescricao({
  label,
  description,
}: {
  label?: ReactNode;
  description?: ReactNode;
}) {
  if (!label && !description) return null;
  return (
    <span className="flex flex-col gap-0.5">
      {label && <span className="font-sans text-sm text-body">{label}</span>}
      {description && <span className="font-sans text-2xs text-muted">{description}</span>}
    </span>
  );
}
