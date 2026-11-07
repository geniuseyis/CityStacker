# Gelir modeli

## Kurallar

- Oyunda bedava ek hak yok. Kat düştüğünde, kenardan devrildiğinde ya da kule yıkıldığında oyun durur.
- Devam etmek için jetonla hak alınır. Fiyat her seferinde bir artar: 1, 2, 3, 4, 5 jeton (oyun başına en fazla 5 hak).
- Ödüllü reklam izleyerek oyun başına bir kez ücretsiz devam edilebilir.
- Günün Kulesi'nde hak alınamaz (herkes eşit şartlarda).
- Yeni oyuncu 5 jetonla başlar.
- Pro olmayanlara her 3 oyunda bir, oyun sonunda geçiş reklamı (AdMob bağlanınca).

## Bedava jeton kaynakları

| Kaynak | Miktar |
| --- | --- |
| Giriş serisi (7 gün) | 2, 3, 4, 5, 6, 8, 12 (bir gün kaçarsa başa döner); reklam izlenirse 2 katı |
| Günlük görevler (3 adet) | görev başına 2–4 |
| Reklam izle | +3, günde en fazla 5 kez |
| Pro haftalık hediye | 10, her 7 günde |

Saat geri alınarak ödül toplanmasın diye son alımın zamanı da saklanır.

## Jeton harcama yerleri

- Hak satın alma (yukarıda)
- Kat stilleri: Cam kule 40, Tuğla 40, Ahşap 50, Neon 60 jeton. Bakır başlangıç paketine, Altın Pro'ya özel.
- Vinç renkleri: Kırmızı / Turkuaz / Beyaz 15, Grafit 20 jeton.

## Ürünler ve fiyatlar

App Store Connect ve Google Play Console'da bu kimliklerle açılacak (`src/services/purchases.ts`).

Türkiye fiyatları, ABD fiyatının ~%50–55'i olacak şekilde önerildi (Türkiye'de yerel fiyatlandırma yaygın;
örneğin bir AI aboneliği ABD'de $20, Türkiye'de ₺499,99 ≈ $11). Mağaza panelinde en yakın fiyat basamağı seçilmeli.

### Jeton paketleri (tüketilebilir)

| Kimlik | Jeton | ABD | Türkiye |
| --- | --- | --- | --- |
| `plumbline.tokens.5` | 5 | $0.99 | ₺24,99 |
| `plumbline.tokens.15` | 15 | $2.49 | ₺59,99 |
| `plumbline.tokens.40` | 40 | $5.99 | ₺139,99 |
| `plumbline.tokens.100` | 100 | $12.99 | ₺299,99 |

### Başlangıç paketi (tüketilemez, tek seferlik)

| Kimlik | İçerik | ABD | Türkiye |
| --- | --- | --- | --- |
| `plumbline.starter` | 30 jeton + Bakır kat stili | $1.99 | ₺49,99 |

Geri yüklemede sadece Bakır stili geri gelir, jetonlar tekrar verilmez.

### Plumbline Pro

| Kimlik | Tür | ABD | Türkiye |
| --- | --- | --- | --- |
| `plumbline.pro.weekly` | otomatik yenilenen abonelik, 1 hafta | $1.99 | ₺49,99 |
| `plumbline.pro.monthly` | otomatik yenilenen abonelik, 1 ay | $4.99 | ₺119,99 |
| `plumbline.pro.lifetime` | tüketilemez (tek seferlik) | $14.99 | ₺349,99 |

Aboneliklerin ikisi aynı abonelik grubunda olmalı ("Plumbline Pro"), kullanıcı haftalıktan aylığa geçebilsin.
RevenueCat'te tek bir `pro` entitlement'ı üç ürüne de bağlanır.

Pro ayrıcalıkları: reklam yok, her oyunda 1 ücretsiz hak, her hafta 10 jeton, tüm gökyüzleri açık, Altın kat stili.

## Bağlarken yapılacaklar

1. RevenueCat projesi, iOS + Android uygulamaları, yukarıdaki ürünler ve `pro` entitlement'ı
2. `react-native-purchases` kur, `src/services/purchases.ts` içindeki taklit kodu gerçek çağrılarla değiştir
3. Jeton bakiyesi sadece başarılı ve doğrulanmış satın almadan sonra artmalı (RevenueCat sunucu doğrulaması)
4. AdMob: uygulama kimlikleri, ödüllü + geçiş reklam birimleri, UMP onay formu (AB/KVKK), iOS'ta ATT izni; `src/services/ads.ts`
5. Gizlilik politikasını reklam ve satın alma bilgisiyle güncelle, App Privacy ve Data safety formlarını yeniden doldur
6. Mağaza sayfasında "Uygulama içi satın alım içerir" ve "Reklam içerir" işaretlenir
