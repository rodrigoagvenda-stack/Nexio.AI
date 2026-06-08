'use client';

// CSS group-hover animations — reagem ao hover do item pai (não do ícone de 16px).
// Todos os nav items do sidebar têm className="group", então group-hover: funciona.

import {
  TrendingUp, MessageCircle, Bot, Settings, Sparkles,
  Brain, Zap, MessageSquare, Send, RefreshCw, Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type P = { className?: string };

export function AnimTrendingUp({ className }: P) {
  return <TrendingUp className={cn(className, 'transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5')} />;
}

export function AnimMessageCircle({ className }: P) {
  return <MessageCircle className={cn(className, 'transition-transform duration-200 group-hover:scale-110')} />;
}

export function AnimBot({ className }: P) {
  return <Bot className={cn(className, 'transition-transform duration-200 group-hover:-translate-y-px group-hover:scale-110')} />;
}

export function AnimSettings({ className }: P) {
  return <Settings className={cn(className, 'transition-transform duration-300 group-hover:rotate-90')} />;
}

export function AnimSparkles({ className }: P) {
  return <Sparkles className={cn(className, 'transition-transform duration-200 group-hover:scale-125 group-hover:rotate-12')} />;
}

export function AnimBrain({ className }: P) {
  return <Brain className={cn(className, 'transition-transform duration-200 group-hover:scale-110')} />;
}

export function AnimZap({ className }: P) {
  return <Zap className={cn(className, 'transition-transform duration-150 group-hover:scale-125 group-hover:-translate-y-px')} />;
}

export function AnimMessageSquare({ className }: P) {
  return <MessageSquare className={cn(className, 'transition-transform duration-200 group-hover:scale-110')} />;
}

export function AnimSend({ className }: P) {
  return <Send className={cn(className, 'transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5')} />;
}

export function AnimRefreshCW({ className }: P) {
  return <RefreshCw className={cn(className, 'transition-transform duration-300 group-hover:rotate-180')} />;
}

export function AnimActivity({ className }: P) {
  return <Activity className={cn(className, 'transition-transform duration-200 group-hover:scale-110')} />;
}
