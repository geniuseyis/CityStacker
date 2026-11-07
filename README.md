# Plumbline

Vinçte sallanan katı doğru anda bırak, kuleni olabildiğince yükselt. iOS ve Android için React Native + Expo ile yazıldı.

## Oynanış

Fizik kurallarına göre işleyen bir kule oyunu:

- Kat vinçte gerçek bir sarkaç gibi sallanır (θ'' = −g/L·sin θ). Vinç katı her zaman kulenin hemen üstüne indirir, bu yüzden ilk katlarda ip uzun ve salınım yavaştır.
- Bırakılan kat salınım hızını korur ve parabol çizerek düşer. Doğru anı kollamak gerekir.
- Kat alttakinin üstüne düz oturur. Ağırlık merkezi alttaki katın kenarını aşarsa kenardan devrilir.
- Her yerleşimde üstteki bölümün ağırlık merkezi kontrol edilir. Desteği aşan bölüm kenar etrafında dönerek yıkılır.
- Kule esnek bir kiriş gibi davranır: kaçık iniş onu sallar, yükseldikçe rüzgâr etkisi artar. Tam oturan katlar sallantıyı azaltır.
- 3 hak var. Iska, devrilme ya da yıkılma bir hak götürür. Jetonla kaldığın yerden devam edebilirsin (oyun başına en fazla 2 kez).
- İstersen nişan yardımı katın ineceği yeri gösterir (Günün Kulesi'nde kapalı).

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
