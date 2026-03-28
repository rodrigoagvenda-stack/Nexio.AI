"use client"

import { formatDate, formatPhone } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Edit, Eye, Trash } from "lucide-react"
import Link from "next/link"

interface MembrosTableProps {
  membros: any[]
}

export function MembrosTable({ membros }: MembrosTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "ativo":
        return "bg-[#C1BC7A]"
      case "inativo":
        return "bg-red-500"
      case "visitante":
        return "bg-blue-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <div className="rounded-md border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="p-4 text-left font-medium">Nome</th>
            <th className="p-4 text-left font-medium">Telefone</th>
            <th className="p-4 text-left font-medium">Igreja</th>
            <th className="p-4 text-left font-medium">Status</th>
            <th className="p-4 text-left font-medium">Data Entrada</th>
            <th className="p-4 text-right font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {membros.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-8 text-center text-muted-foreground">
                Nenhum membro encontrado
              </td>
            </tr>
          ) : (
            membros.map((membro) => (
              <tr key={membro.id} className="border-b hover:bg-muted/50">
                <td className="p-4 font-medium">{membro.nome}</td>
                <td className="p-4">{membro.telefone ? formatPhone(membro.telefone) : "-"}</td>
                <td className="p-4">{membro.igrejas?.nome || "-"}</td>
                <td className="p-4">
                  <Badge className={getStatusColor(membro.status)}>
                    {membro.status}
                  </Badge>
                </td>
                <td className="p-4">{formatDate(membro.data_entrada)}</td>
                <td className="p-4">
                  <div className="flex justify-end gap-2">
                    <Link href={`/membros/${membro.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href={`/membros/${membro.id}/editar`}>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
