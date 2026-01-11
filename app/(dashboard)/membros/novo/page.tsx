import { MembroForm } from "@/components/membros/membro-form"

export default function MembrosNovoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Novo Membro</h2>
        <p className="text-muted-foreground">
          Adicionar um novo membro à igreja
        </p>
      </div>

      <MembroForm />
    </div>
  )
}
