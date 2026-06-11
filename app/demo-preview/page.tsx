'use client'

// Página temporária para QA visual do KanbanDemo — não commitar.
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { KanbanDemo } from '@/components/demo/KanbanDemo'

function Preview() {
  const params = useSearchParams()
  const step = parseInt(params.get('step') ?? '0', 10) || 0
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div style={{ width: 1000 }}>
        <KanbanDemo initialSlide={step} />
      </div>
    </div>
  )
}

export default function DemoPreviewPage() {
  return (
    <Suspense>
      <Preview />
    </Suspense>
  )
}
