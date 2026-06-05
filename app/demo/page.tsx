import { ProductDemo } from '@/components/demo/ProductDemo'

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 gap-6">
      <div className="text-center space-y-1">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Demonstração interativa</p>
        <h1 className="text-xl font-semibold">Conecte o WhatsApp e ative o SDR</h1>
        <p className="text-sm text-muted-foreground">Clique onde o sistema indicar</p>
      </div>
      <ProductDemo className="w-full max-w-4xl" />
    </div>
  )
}
