"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Flame, Users, ArrowRight } from "lucide-react"
import Link from "next/link"

interface WelcomeCardProps {
  userName: string
  churchName: string
  totalMembers: number
}

export function WelcomeCard({ userName, churchName, totalMembers }: WelcomeCardProps) {
  return (
    <Card className="overflow-hidden border-0 shadow-lg">
      <div className="gradient-card text-white relative">
        <div className="absolute inset-0 bg-[url('/pattern.svg')] opacity-10" />
        <CardContent className="p-8 relative">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="h-5 w-5 text-accent animate-pulse" />
                <span className="text-sm font-medium text-white/90">
                  Igreja Pentecostal Vale da Bênção
                </span>
              </div>
              <h2 className="text-3xl font-bold mb-2">
                Bem-vindo de volta, {userName.split(' ')[0]}! 🙏
              </h2>
              <p className="text-white/80 mb-6">
                Sua igreja conta com <span className="font-bold">{totalMembers} membros ativos</span>.
                Continue fazendo a diferença!
              </p>
              <Link href="/membros/novo">
                <Button size="lg" variant="secondary" className="gap-2">
                  <Users className="h-4 w-4" />
                  Adicionar Novo Membro
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="hidden md:flex items-center justify-center w-32 h-32">
              <div className="relative">
                <div className="absolute inset-0 bg-white/20 rounded-full blur-xl" />
                <div className="relative bg-white/10 backdrop-blur-sm rounded-full p-6">
                  <Flame className="h-16 w-16 text-accent" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  )
}
