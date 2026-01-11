import { EventoForm } from "@/components/eventos/evento-form"

export default function EventoNovoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Novo Evento</h2>
        <p className="text-muted-foreground">
          Criar um novo evento para a igreja
        </p>
      </div>

      <EventoForm />
    </div>
  )
}
