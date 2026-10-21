# دليل تشغيل وبناء تطبيق الهاتف (Android & iOS) باستخدام Capacitor
# Daftrk Mobile App Guide (Capacitor)

تم تجهيز وتكامل مشروع **دفترك (Daftrk)** ليعمل كـ **تطبيق هاتف أصلي (Native Mobile App)** بنظامي **Android** و **iOS** باستخدام **Capacitor 8**.

---

## 📱 معلومات التطبيق (App Configuration)

* **App ID:** `com.daftrk.app`
* **App Name:** `Daftrk — دفترك`
* **Web Build Directory:** `dist`
* **Config File:** `capacitor.config.ts`

---

## 🚀 الأوامر السريعة (NPM Scripts)

تمت إضافة أوامر التشغيل والبناء التالية إلى `package.json`:

| الأمر (Script) | الوصف |
| :--- | :--- |
| `npm run cap:sync` | بناء كود الواجهة وتحديث ملفات وبلاجنز Android و iOS |
| `npm run cap:open:android` | فتح المشروع في **Android Studio** لبناء وتشغيل APK/AAB |
| `npm run cap:open:ios` | فتح المشروع في **Xcode** لتشغيل التطبيق على محاكي أو جهاز iPhone |
| `npm run cap:run:android` | بناء وتشغيل فوري على جهاز أندرويد متصل |
| `npm run cap:run:ios` | بناء وتشغيل فوري على جهاز أو محاكي iOS |

---

## 🛠️ خطوات التشغيل والبناء للمطورين

### 1. لتشغيل تطبيق Android:
1. تأكد من تثبيت **Android Studio** و Android SDK على جهازك.
2. قم بتنفيذ:
   ```bash
   npm run cap:sync
   npm run cap:open:android
   ```
3. من داخل **Android Studio**، اضغط على زر **Run ▶** لتشغيل التطبيق على جهازك أو المحاكي (Emulator)، أو اختر **Build > Build Bundle(s) / APK(s) > Build APK** لاستخراج ملف APK جاهز للتثبيت.

### 2. لتشغيل تطبيق iOS:
1. يتطلب نظام macOS مع تثبيت **Xcode** و CocoaPods / Swift Package Manager.
2. قم بتنفيذ:
   ```bash
   npm run cap:sync
   npm run cap:open:ios
   ```
3. من داخل **Xcode**، اختر جهاز التشغيل أو المحاكي (iPhone 15/16 Pro) واضغط على **Run ▶**.

---

## ✨ المميزات والتحسينات المضافة لتجربة الهاتف (Mobile UX)

1. **دعم كامل لـ Safe Area Insets (النوتش وشريط الإيماءات):**
   * إضافة `viewport-fit=cover` و `user-scalable=no` في `index.html`.
   * دعم هوامش الحماية (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`) لمنع تداخل المحتوى مع كاميرا النوتش أو شريط الـ Home indicator في هواتف آيفون الحديثة وأندرويد.
2. **شريط تنقل سفلي أصلي (Native Bottom Navigation Bar):**
   * شريط سفلي سريع بلمسة واحدة للوصول المباشر إلى: (الرئيسية، الفواتير، المنتجات، العملاء، والمزيد).
   * يظهر فقط على شاشات الهواتف المحمولة (`lg:hidden`).
3. **مزامنة شريط الحالة (Status Bar):**
   * يتغير لون شريط الحالة وتنسيقه تلقائياً عند التبديل بين الوضع الليلي (Dark Mode) والنهاري (Light Mode).
4. **زر الرجوع الفعلي في أندرويد (Hardware Back Button):**
   * معالجة زر الرجوع في أندرويد لمنع إغلاق التطبيق المفاجئ ودعم الرجوع الطبيعي بين الصفحات.
5. **رصد حالة الشبكة وعدم الاتصال (Offline Detection):**
   * إضافة مكون `OfflineNotice` لرصد اتصال الإنترنت وإشعار المستخدم فورياً بوضع عدم الاتصال وعودة الشبكة.
6. **إخفاء شاشة البداية تلقائياً (Splash Screen):**
   * إخفاء شاشة البداية بسلاسة بمجرد اكتمال تحميل واجهة React.
