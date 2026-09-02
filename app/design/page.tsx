const bordoSteps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
const cremeSteps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

function Escala({ nome, steps }: { nome: string; steps: readonly number[] }) {
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">{nome}</h2>
      <div className="flex flex-wrap gap-2">
        {steps.map((step) => (
          <div key={step} className="flex flex-col items-center gap-1">
            <div
              className="h-16 w-16 rounded border border-black/10"
              style={{ backgroundColor: `var(--${nome}-${step})` }}
            />
            <span className="text-xs">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DesignPage() {
  return (
    <div className="flex flex-1 flex-col gap-10 p-10">
      <div>
        <h1 className="font-serif text-2xl font-bold">Design tokens — AURA</h1>
        <p className="mt-1 text-sm text-bordo-700">
          Referência interna dos tokens visuais definidos até aqui. Não é tela da v1.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Tipografia</h2>
        <p className="font-serif text-3xl">Lora — títulos (font-serif)</p>
        <p className="font-sans text-base">Inter — interface e corpo de texto (font-sans)</p>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Cor</h2>
        <p className="mb-4 text-sm text-bordo-700">
          Bordô <code>rgb(112 0 27)</code> e creme <code>rgb(254 212 136)</code> são os
          valores de marca; o resto da escala é derivado deles.
        </p>
        <div className="flex flex-col gap-6">
          <Escala nome="bordo" steps={bordoSteps} />
          <Escala nome="creme" steps={cremeSteps} />
        </div>
      </div>
    </div>
  );
}
