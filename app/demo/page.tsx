import { WhatsAppConnectionDemo } from '@/components/demo/WhatsAppConnectionDemo'

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-8">
        <div className="text-center space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Product Preview</p>
          <h1 className="text-xl font-semibold">WhatsApp Connection Demo</h1>
        </div>
        <WhatsAppConnectionDemo />
      </div>
    </div>
  )
}
