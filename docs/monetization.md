# Gelir modeli

## Kurallar

- Oyunda bedava ek hak yok. Kat düştüğünde, kenardan devrildiğinde ya da kule yıkıldığında oyun durur.
- Devam etmek için jetonla hak alınır. Fiyat her seferinde bir artar: 1, 2, 3, 4, 5 jeton (oyun başına en fazla 5 hak).
- Günün Kulesi'nde hak alınamaz (herkes eşit şartlarda).
- Yeni oyuncu 5 jetonla başlar.
- Pro olmayanlara her 3 oyunda bir, oyun sonunda geçiş reklamı (AdMob bağlanınca).

## Ürünler

App Store Connect ve Google Play Console'da bu kimliklerle açılacak (`src/services/purchases.ts`).

### Jeton paketleri (tüketilebilir)

| Kimlik | Jeton | Önerilen fiyat |
| --- | --- | --- |
| `plumbline.tokens.5` | 5 | $0.99 |
| `plumbline.tokens.15` | 15 | $2.49 (popüler) |
| `plumbline.tokens.40` | 40 | $5.99 |
| `plumbline.tokens.100` | 100 | $12.99 (en avantajlı) |

### Plumbline Pro

| Kimlik | Tür | Önerilen fiyat |
| --- | --- | --- |
| `plumbline.pro.weekly` | otomatik yenilenen abonelik, 1 hafta | $1.99 |
| `plumbline.pro.monthly` | otomatik yenilenen abonelik, 1 ay | $4.99 (popüler) |
| `plumbline.pro.lifetime` | tüketilemez (tek seferlik) | $14.99 |

Aboneliklerin ikisi aynı abonelik grubunda olmalı ("Plumbline Pro"), kullanıcı haftalıktan aylığa geçebilsin.
RevenueCat'te tek bir `pro` entitlement'ı üç ürüne de bağlanır.

Pro ayrıcalıkları: reklam yok, her oyunda 1 ücretsiz hak, tüm gökyüzleri açık.

## Bağlarken yapılacaklar

1. RevenueCat projesi, iOS + Android uygulamaları, yukarıdaki ürünler ve `pro` entitlement'ı
2. `react-native-purchases` kur, `src/services/purchases.ts` içindeki taklit kodu gerçek çağrılarla değiştir
3. Jeton bakiyesi sadece başarılı ve doğrulanmış satın almadan sonra artmalı (RevenueCat sunucu doğrulaması)
4. AdMob uygulama kimlikleri, UMP onay formu (AB/KVKK), iOS'ta ATT izni; `src/services/ads.ts`
5. Gizlilik politikasını reklam ve satın alma bilgisiyle güncelle, App Privacy ve Data safety formlarını yeniden doldur
6. Mağaza sayfasında "Uygulama içi satın alım içerir" ve "Reklam içerir" işaretlenir
