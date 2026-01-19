'use client';

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { motion } from 'framer-motion';

export interface Step {
  label: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isUpcoming = index > currentStep;

          return (
            <div key={index} className="flex items-center flex-1">
              {/* Step Circle */}
              <div className="flex flex-col items-center relative">
                <motion.div
                  initial={false}
                  animate={{
                    scale: isCurrent ? 1.1 : 1,
                  }}
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300',
                    isCompleted && 'bg-primary border-primary',
                    isCurrent && 'border-primary bg-primary/10',
                    isUpcoming && 'border-muted bg-background'
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5 text-primary-foreground" />
                  ) : (
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        isCurrent && 'text-primary',
                        isUpcoming && 'text-muted-foreground'
                      )}
                    >
                      {index + 1}
                    </span>
                  )}
                </motion.div>

                {/* Label */}
                <div className="mt-2 text-center max-w-[120px]">
                  <p
                    className={cn(
                      'text-xs md:text-sm font-medium',
                      isCurrent && 'text-foreground',
                      isCompleted && 'text-foreground',
                      isUpcoming && 'text-muted-foreground'
                    )}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Line Connector */}
              {index < steps.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 bg-muted relative overflow-hidden">
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: isCompleted ? '100%' : '0%' }}
                    transition={{ duration: 0.5 }}
                    className="h-full bg-primary"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
