"use client";

// Mesmo motivo do DialogDemo.tsx: `onDismiss` é uma função, e uma função
// inline não atravessa a fronteira de Server Component pra Client Component
// como prop — precisa nascer dentro de uma árvore já client.
import { Toast } from "@/components/ui/Toast";

export function ToastDemo() {
  return (
    <div className="flex flex-col gap-3">
      <Toast tone="neutral" message="Documento salvo" detail="Última alteração há 2 minutos." />
      <Toast
        tone="success"
        message="Formatação ABNT aplicada"
        detail="12 parágrafos ajustados"
        onDismiss={() => {}}
      />
      <Toast tone="danger" message="Falha ao exportar .docx" onDismiss={() => {}} />
    </div>
  );
}
