'use client'

import { useState } from 'react'
import { ChevronRight, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

const SLIDES = [
  { src: '/demo/kanban/tela1.png',  caption: 'Visão geral do dashboard — métricas, funil e conversão em tempo real' },
  { src: '/demo/kanban/tela2.png',  caption: 'Selecione a visualização Kanban no menu lateral' },
  { src: '/demo/kanban/tela3.png',  caption: 'Visualize todos os leads organizados por etapa da venda' },
  { src: '/demo/kanban/tela4.png',  caption: 'Clique e arraste o card para a etapa desejada' },
  { src: '/demo/kanban/tela5.png',  caption: 'Solte para mover o lead de etapa' },
  { src: '/demo/kanban/tela6.png',  caption: 'Lead movido — atualizado em tempo real para toda a equipe' },
  { src: '/demo/kanban/tela7.png',  caption: 'Clique aqui para cadastrar um novo lead' },
  { src: '/demo/kanban/tela8.png',  caption: 'Digite o nome da empresa' },
  { src: '/demo/kanban/tela9.png',  caption: 'Selecione o segmento de atuação' },
  { src: '/demo/kanban/tela10.png', caption: 'Clique em continuar' },
  { src: '/demo/kanban/tela11.png', caption: 'Digite o nome do contato' },
  { src: '/demo/kanban/tela12.png', caption: 'Digite o número de WhatsApp' },
  { src: '/demo/kanban/tela13.png', caption: 'Digite o e-mail' },
  { src: '/demo/kanban/tela14.png', caption: 'Selecione em qual etapa do funil esse lead se encontra' },
  { src: '/demo/kanban/tela15.png', caption: 'Indique o nível de atenção que esse lead exige: Baixa, Média ou Alta' },
  { src: '/demo/kanban/tela16.png', caption: 'Classifique o nível de interesse — Quente indica alta intenção de compra' },
  { src: '/demo/kanban/tela17.png', caption: 'Registre de onde esse lead veio — essencial para medir quais canais geram mais negócios' },
  { src: '/demo/kanban/tela18.png', caption: 'Informe o valor estimado do negócio para calcular o total do pipeline' },
  { src: '/demo/kanban/tela19.png', caption: 'Campo livre para registrar contexto, histórico ou próximos passos' },
  { src: '/demo/kanban/tela20.png', caption: 'Confira as informações e clique para avançar — o lead será salvo ao finalizar' },
  { src: '/demo/kanban/tela21.png', caption: 'Pronto! Seu lead foi cadastrado e já aparece no kanban' },
]

export function KanbanDemo() {
  const [slide, setSlide] = useState(0)
  const total = SLIDES.length
  const current = SLIDES[slide]
  const isLast = slide === total - 1

  return (
    <div className="w-full rounded-2xl border border-border shadow-xl overflow-hidden bg-background">
      <div
        className={cn('relative w-full select-none', !isLast && 'cursor-pointer group')}
        onClick={() => { if (!isLast) setSlide(s => s + 1) }}
      >
        <img
          src={current.src}
          alt={`Passo ${slide + 1} de ${total}`}
          className="w-full h-auto block"
          draggable={false}
        />
        {!isLast && (
          <div className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <ChevronRight className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      <div className="border-t border-border bg-muted/20 px-5 py-3 flex items-center gap-4">
        <div className="flex gap-1.5 flex-shrink-0">
          {SLIDES.map((_, i) => (
            <div key={i} className={cn(
              'rounded-full transition-all duration-300',
              i === slide   ? 'w-5 h-1.5 bg-primary' :
              i < slide     ? 'w-1.5 h-1.5 bg-primary/50' :
                              'w-1.5 h-1.5 bg-muted-foreground/20'
            )} />
          ))}
        </div>
        <p className="text-[12px] text-muted-foreground flex-1">{current.caption}</p>
        <span className="text-[11px] text-muted-foreground/50 flex-shrink-0 tabular-nums">{slide + 1}/{total}</span>
        {isLast && (
          <button
            onClick={() => setSlide(0)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reiniciar
          </button>
        )}
      </div>
    </div>
  )
}
