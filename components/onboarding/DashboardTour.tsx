'use client';

import { GuidedTour } from './GuidedTour';
import { DASHBOARD_TOUR_STEPS } from '@/lib/onboarding/tour-steps';

export function DashboardTour() {
  return <GuidedTour steps={DASHBOARD_TOUR_STEPS} />;
}
