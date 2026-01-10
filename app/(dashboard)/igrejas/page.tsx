import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Church } from "lucide-react"

export default async function IgrejasPage() {
  const supabase = await createClient()

  const { data: igrejas } = await supabase
    .from("igrejas")
    .select("*")
    .order("nome")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Igrejas</h2>
        <p className="text-muted-foreground">
          Gerencie as igrejas e congregações
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {igrejas?.map((igreja) => (
          <Card key={igreja.id}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Church className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>{igreja.nome}</CardTitle>
                  <CardDescription className="capitalize">{igreja.tipo}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {igreja.telefone && (
                  <p className="text-muted-foreground">📞 {igreja.telefone}</p>
                )}
                {igreja.email && (
                  <p className="text-muted-foreground">📧 {igreja.email}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!igrejas || igrejas.length === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Church className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma igreja cadastrada</h3>
            <p className="text-sm text-muted-foreground">
              Adicione sua primeira igreja para começar
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
