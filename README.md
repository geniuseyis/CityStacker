# 🏗️ City Stacker

React Native + Expo ile geliştirilmiş retro kule istifleme oyunu. Vinçte sallanan bloğu doğru anda bırak, kuleni olabildiğince yükselt!

## 🎮 Oynanış

- Vinç halatında sarkaç gibi salınan bloğu **tek dokunuşla** bırak.
- Alttaki bloğa ne kadar hizalı bırakırsan o kadar çok puan: **MÜKEMMEL / İYİ / normal**.
- Üst üste hizalı bırakışlar **kombo** oluşturur — kombo arttıkça halat hızlanır, puan çarpanı büyür.
- Kaçık bırakılan bloklar kuleyi yamultur; taban ile tepe arasındaki kayma sınırı aşarsa **kule devrilir**.
- **3 blok hakkın** var: ıskalanan her blok bir can götürür.
- Kule yükseldikçe sallanır, kamera tepeyi takip eder.

## ✨ Özellikler

- 🎨 4 tema: Gündüz, Gece, Gün Batımı, Neon
- 🏆 Cihaz içi lider tablosu (ilk 25 skor) ve rekor takibi
- ⚡ Kombo çubuğu + dinamik halat hızı sistemi
- ❤️ 3 can sistemi
- 📳 Haptik geri bildirim, ses efektleri ve müzik (ayrı ayrı açılıp kapanabilir)
- 🎚️ 3 zorluk seviyesi: Kolay / Normal / Zor
- 🎉 Parçacık efektleri (konfeti, toz), ekran sarsıntısı, flaş
- 📴 Tamamen çevrimdışı — hiçbir veri toplanmaz, ağ izni yok

## 🛠️ Teknolojiler

| Katman | Teknoloji |
| --- | --- |
| Framework | React Native 0.81 + Expo SDK 54 |
| Dil | TypeScript |
| Oyun döngüsü | `requestAnimationFrame` tabanlı özel fizik (sarkaç, yerçekimi, kamera lerp) |
| Ses | expo-audio |
| Depolama | AsyncStorage |
| Build | EAS Build (APK / AAB) |

Oyun motoru kullanılmadı; sarkaç fiziği, çarpışma toleransı, kombo-hız sistemi ve kamera takibi sıfırdan yazıldı.

## 🚀 Çalıştırma

```bash
npm install
npx expo start
```

Expo Go ile QR kodu okutarak cihazda test edebilirsin.

### Üretim derlemesi

```bash
npx eas build --platform android --profile production
```
