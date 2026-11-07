# Plumbline

Vinçte sallanan katı doğru anda bırak, kuleni olabildiğince yükselt. iOS ve Android için React Native + Expo ile yazıldı.

## Oynanış

- Tek dokunuşla bırak. Alttaki kata ne kadar hizalıysa o kadar puan: **Mükemmel / İyi / normal**
- Üst üste hizalı bırakışlar kombo yapar, kombo arttıkça vinç hızlanır
- Kaçık katlar kuleyi yamultur, kayma sınırı aşılırsa kule yıkılır
- 3 hak var, ıskalanan her kat bir hak götürür
- Jetonla kaldığın yerden devam edebilirsin (oyun başına en fazla 2 kez)

### Modlar

- **Sonsuz:** kolay / normal / zor
- **Günün Kulesi:** her gün herkes için aynı kule (aynı seed)

## Teknik

| | |
| --- | --- |
| Uygulama | Expo SDK 58, React Native 0.88, TypeScript (strict), expo-router |
| Çizim | @shopify/react-native-skia — her kare tek bir `SkPicture`, bloklar ve arka plan önbellekli |
| Motor | `src/engine` — saf TS, React'ten bağımsız, 1/120 sn sabit adım |
| Depolama | react-native-mmkv (AES-256), anahtar Keychain / Keystore'da |
| Test | vitest (`npm test`) |

### Motor

Fizik ekran boyutundan bağımsız, 390×844'lük sanal bir alanda çalışıyor. Renderer bunu cihaza ölçekliyor, yani tablet ve telefonda oyun aynı.

Oyun deterministik: aynı seed ve aynı girdiler (bırakma anları) her zaman aynı skoru verir. `Math.sin` motorlar arasında son basamakta farklı sonuç verebildiği için kendi `dsin` fonksiyonumuzu kullanıyoruz. Bu sayede bir oyun kaydı (`RunRecord`) başka bir cihazda ya da sunucuda baştan oynatılıp skor doğrulanabiliyor (`verify`).

### Güvenlik

- Ağ izni gerektiren bir özellik yok, kişisel veri toplanmıyor
- Kayıtlar şifreli; diskten gelen veri tip ve sınır kontrolünden geçiyor (`src/state/schema.ts`)
- Android yedekleme kapalı (`allowBackup: false`), kayıt dosyası adb ile çekilemiyor
- Bağımlılıklarda `npm audit` temiz

## Çalıştırma

Native modüller (MMKV, Skia) olduğu için Expo Go yerine development build gerekiyor.

```bash
npm install
npx expo run:android      # ya da run:ios (macOS)
npm test
npm run typecheck
```

Mağaza derlemesi:

```bash
npx eas build --platform all --profile production
```
