import { getLocales } from 'expo-localization';
import type { ProPlan } from '@/state/schema';
import { addTokens, grantStarter, setPro } from '@/state/store';

// Ürün kataloğu. Kimlikler App Store Connect / Play Console'da aynı adla açılacak.
// Gerçek fiyat mağazadan kullanıcının para birimiyle gelir; buradakiler mağaza
// yüklenemezse gösterilen yedek. Türkiye'ye yerel, daha düşük fiyat.

type Price = { usd: string; try: string };

export type TokenPack = { id: string; tokens: number; bonus?: number; price: Price; badge?: 'popular' | 'best' };
export type ProProduct = { id: string; plan: ProPlan; price: Price; badge?: 'popular' | 'best' };

export const TOKEN_PACKS: TokenPack[] = [
  { id: 'plumbline.tokens.5', tokens: 5, price: { usd: '$0.99', try: '₺24,99' } },
  { id: 'plumbline.tokens.15', tokens: 15, bonus: 20, price: { usd: '$2.49', try: '₺59,99' }, badge: 'popular' },
  { id: 'plumbline.tokens.40', tokens: 40, bonus: 35, price: { usd: '$5.99', try: '₺139,99' } },
  { id: 'plumbline.tokens.100', tokens: 100, bonus: 50, price: { usd: '$12.99', try: '₺299,99' }, badge: 'best' },
];

// tek seferlik: 30 jeton + bakır kat stili
export const STARTER = { id: 'plumbline.starter', price: { usd: '$1.99', try: '₺49,99' } };

export const PRO_PRODUCTS: ProProduct[] = [
  { id: 'plumbline.pro.weekly', plan: 'weekly', price: { usd: '$1.99', try: '₺49,99' } },
  { id: 'plumbline.pro.monthly', plan: 'monthly', price: { usd: '$4.99', try: '₺119,99' }, badge: 'popular' },
  { id: 'plumbline.pro.lifetime', plan: 'lifetime', price: { usd: '$14.99', try: '₺349,99' }, badge: 'best' },
];

const inTurkey = () => {
  const l = getLocales()[0];
  return l?.regionCode === 'TR' || l?.currencyCode === 'TRY';
};

export function priceOf(p: { price: Price }) {
  return inTurkey() ? p.price.try : p.price.usd;
}

export type PurchaseResult = { ok: true } | { ok: false; reason: 'cancelled' | 'unavailable' | 'failed' };

// Mağaza hesabı (RevenueCat) bağlanana kadar:
// - geliştirme sürümünde satın almalar taklit edilir ki akışlar denenebilsin
// - yayın sürümünde hiçbir şey verilmez, butonlar "şu an kullanılamıyor" der
// Gerçek bağlantıda jeton/Pro sadece mağaza makbuzu sunucu tarafında doğrulandıktan
// sonra verilir; istemci kendi kendine bakiye artırmaz.
const SIMULATE = __DEV__;

export const storeAvailable = () => SIMULATE;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function buyTokens(pack: TokenPack): Promise<PurchaseResult> {
  if (!SIMULATE) return { ok: false, reason: 'unavailable' };
  await wait(700);
  addTokens(pack.tokens);
  return { ok: true };
}

export async function buyStarter(): Promise<PurchaseResult> {
  if (!SIMULATE) return { ok: false, reason: 'unavailable' };
  await wait(700);
  grantStarter();
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
