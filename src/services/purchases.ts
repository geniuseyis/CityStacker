import type { ProPlan } from '@/state/schema';
import { addTokens, setPro } from '@/state/store';

// Ürün kataloğu. Kimlikler App Store Connect / Play Console'da aynı adla açılacak.
// Fiyatlar mağazadan yerel para birimiyle gelir; fallback sadece mağaza yüklenemezse.

export type TokenPack = {
  id: string;
  tokens: number;
  bonus?: number; // yüzde, rozet için
  fallbackPrice: string;
  badge?: 'popular' | 'best';
};

export type ProProduct = {
  id: string;
  plan: ProPlan;
  fallbackPrice: string;
  badge?: 'popular' | 'best';
};

export const TOKEN_PACKS: TokenPack[] = [
  { id: 'plumbline.tokens.5', tokens: 5, fallbackPrice: '$0.99' },
  { id: 'plumbline.tokens.15', tokens: 15, bonus: 20, fallbackPrice: '$2.49', badge: 'popular' },
  { id: 'plumbline.tokens.40', tokens: 40, bonus: 35, fallbackPrice: '$5.99' },
  { id: 'plumbline.tokens.100', tokens: 100, bonus: 50, fallbackPrice: '$12.99', badge: 'best' },
];

export const PRO_PRODUCTS: ProProduct[] = [
  { id: 'plumbline.pro.weekly', plan: 'weekly', fallbackPrice: '$1.99' },
  { id: 'plumbline.pro.monthly', plan: 'monthly', fallbackPrice: '$4.99', badge: 'popular' },
  { id: 'plumbline.pro.lifetime', plan: 'lifetime', fallbackPrice: '$14.99', badge: 'best' },
];

export type PurchaseResult = { ok: true } | { ok: false; reason: 'cancelled' | 'unavailable' | 'failed' };

// Mağaza hesabı (RevenueCat) bağlanana kadar:
// - geliştirme sürümünde satın almalar taklit edilir ki akışlar denenebilsin
// - yayın sürümünde hiçbir şey verilmez, butonlar "şu an kullanılamıyor" der
// Gerçek bağlantıda jeton/Pro sadece mağaza makbuzu sunucu tarafında doğrulandıktan
// sonra verilir; istemci kendi kendine bakiye artırmaz.
const SIMULATE = __DEV__;

export const storeAvailable = () => SIMULATE;

export function priceOf(p: { fallbackPrice: string }) {
  return p.fallbackPrice;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function buyTokens(pack: TokenPack): Promise<PurchaseResult> {
  if (!SIMULATE) return { ok: false, reason: 'unavailable' };
  await wait(700);
  addTokens(pack.tokens);
  return { ok: true };
}

export async function buyPro(product: ProProduct): Promise<PurchaseResult> {
  if (!SIMULATE) return { ok: false, reason: 'unavailable' };
  await wait(900);
  setPro(product.plan);
  return { ok: true };
}

export async function restorePurchases(): Promise<{ ok: boolean; restored: boolean }> {
  if (!SIMULATE) return { ok: false, restored: false };
  await wait(600);
  return { ok: true, restored: false };
}
