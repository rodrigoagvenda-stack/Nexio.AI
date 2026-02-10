import { Loader2 } from 'lucide-react';

export default function CRMLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando CRM...</p>
      </div>
    </div>
  );
}
