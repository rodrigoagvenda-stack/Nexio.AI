import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
});

export const PLANS = {
  starter: {
    name: 'Starter',
    priceId: process.env.STRIPE_PRICE_STARTER!,
    price: 397,
    instances: 1,
    tokensLimit: 5_000_000,
  },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRICE_PRO!,
    price: 597,
    instances: 3,
    tokensLimit: 15_000_000,
  },
  scale: {
    name: 'Scale',
    priceId: process.env.STRIPE_PRICE_SCALE!,
    price: 997,
    instances: 10,
    tokensLimit: 50_000_000,
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function getPlanByPriceId(priceId: string): PlanKey | null {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.priceId === priceId) return key as PlanKey;
  }
  return null;
}
