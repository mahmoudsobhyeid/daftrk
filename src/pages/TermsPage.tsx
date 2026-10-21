import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { BookOpen, Printer, ArrowLeft, ArrowUp, Moon, Sun, Languages } from 'lucide-react';
import { Button } from '../components/ui/Button';

export function TermsPage({ onBack }: { onBack?: () => void }) {
  const { lang, setLang } = useLanguage();
  const { theme, toggle } = useTheme();
  const [activeSection, setActiveSection] = useState<string>('section-1');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -90;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const sections = [
    { id: 'section-1', title: '1. هذه الشروط والأحكام ملزمة قانونًا' },
    { id: 'section-2', title: '2. التغييرات التي يتم إجراؤها على الاتفاقية أو الخدمات' },
    { id: 'section-3', title: '3. منح تراخيص الاستخدام' },
    { id: 'section-4', title: '4. شروط الدفع' },
    { id: 'section-5', title: '5. المدة والإنهاء' },
    { id: 'section-6', title: '6. سياسة إلغاء الاشتراك واسترداد الرسوم' },
    { id: 'section-7', title: '7. عملات الذكاء الاصطناعي (AIC) — شروط الاستخدام' },
    { id: 'section-8', title: '8. بياناتك وبيانات "دفترك" وتخزين ونقل بياناتك' },
    { id: 'section-9', title: '9. حسابك (حساباتك) وكلمة (كلمات) مرورك' },
    { id: 'section-10', title: '10. تعويضك لصالح "دفترك"' },
    { id: 'section-11', title: '11. اتفاقية مستوى الخدمة' },
    { id: 'section-12', title: '12. تحديد المسؤولية' },
    { id: 'section-13', title: '13. القوة القاهرة' },
  ];

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-secondary-950 text-secondary-900 dark:text-secondary-100" dir="rtl">
      {/* ─── Top Header (hidden when printing) ───────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-secondary-900/90 backdrop-blur-md border-b border-secondary-200 dark:border-secondary-800 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack ? onBack : () => { window.location.href = '/'; }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-secondary-100 dark:bg-secondary-800 text-secondary-700 dark:text-secondary-200 hover:bg-secondary-200 dark:hover:bg-secondary-700 transition-colors"
            >
              <ArrowLeft size={14} className="rotate-180" />
              <span>العودة للرئيسية</span>
            </button>
            <div className="h-5 w-px bg-secondary-200 dark:bg-secondary-800" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-primary">
                <BookOpen size={18} />
              </div>
              <span className="text-base font-bold text-secondary-900 dark:text-white">دفترك</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 text-xs"
            >
              <Printer size={15} />
              <span>طباعة</span>
            </Button>
            <button
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="btn-ghost p-2 rounded-lg text-secondary-600 dark:text-secondary-400"
              title="تغيير اللغة"
            >
              <Languages size={18} />
            </button>
            <button
              onClick={toggle}
              className="btn-ghost p-2 rounded-lg text-secondary-600 dark:text-secondary-400"
              title="تغيير المظهر"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* ─── Hero / Page Title ──────────────────────────────── */}
      <section className="bg-white dark:bg-secondary-900 border-b border-secondary-200 dark:border-secondary-800 py-10 print:py-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center sm:text-start">
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
            <div>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 mb-3 border border-primary-200 dark:border-primary-800">
                اتفاقية الخدمة القانونية
              </span>
              <h1 className="text-3xl sm:text-4xl font-black text-secondary-900 dark:text-white tracking-tight">
                شروط و أحكام دفترك
              </h1>
              <p className="mt-2 text-base text-secondary-500 dark:text-secondary-400 max-w-2xl">
                تحكم الشروط والأحكام التالية علاقتنا مع عملائنا ومستخدمي منصة وخدمات "دفترك".
              </p>
            </div>
            <div className="flex items-center gap-2 print:hidden shrink-0">
              <Button onClick={handlePrint} variant="primary" size="sm" className="gap-2 font-bold">
                <Printer size={16} />
                <span>طباعة الوثيقة</span>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Main Content Container ─────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Quick Table of Contents (Sidebar on desktop) */}
          <aside className="lg:col-span-1 print:hidden">
            <div className="sticky top-24 bg-white dark:bg-secondary-900 rounded-2xl p-4 border border-secondary-200 dark:border-secondary-800 shadow-sm">
              <h3 className="text-sm font-bold text-secondary-900 dark:text-white mb-3 pb-2 border-b border-secondary-100 dark:border-secondary-800">
                فهرس البنود
              </h3>
              <nav className="space-y-1 max-h-[calc(100vh-180px)] overflow-y-auto text-xs">
                {sections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => scrollToSection(s.id)}
                    className={`block w-full text-start px-2.5 py-1.5 rounded-lg transition-colors leading-relaxed truncate ${
                      activeSection === s.id
                        ? 'bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 font-bold'
                        : 'text-secondary-600 dark:text-secondary-400 hover:bg-secondary-50 dark:hover:bg-secondary-800'
                    }`}
                  >
                    {s.title}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Legal Document Text */}
          <article className="lg:col-span-3 space-y-8 bg-white dark:bg-secondary-900 p-6 sm:p-10 rounded-2xl border border-secondary-200 dark:border-secondary-800 shadow-sm leading-relaxed text-secondary-700 dark:text-secondary-300">
            {/* Table of contents print header */}
            <div className="p-4 rounded-xl bg-secondary-50 dark:bg-secondary-800/50 border border-secondary-200 dark:border-secondary-700">
              <h2 className="text-base font-bold text-secondary-900 dark:text-white mb-3">
                جدول المحتويات:
              </h2>
              <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm font-semibold list-decimal list-inside text-primary-700 dark:text-primary-400">
                <li>الشروط والأحكام</li>
                <li>التغييرات التي يتم إجراؤها على الاتفاقية أو الخدمات هذه</li>
                <li>منح تراخيص الاستخدام</li>
                <li>شروط الدفع</li>
                <li>المدة والإنهاء</li>
                <li>سياسة إلغاء الاشتراك واسترداد الرسوم</li>
                <li>عملات الذكاء الاصطناعي (AIC) — شروط الاستخدام</li>
                <li>بياناتك وبيانات "دفترك" وتخزين ونقل بياناتك وسياسة خصوصية "دفترك"</li>
                <li>حسابك (حساباتك) وكلمة (كلمات) مرورك</li>
                <li>تعويضك لصالح "دفترك"</li>
                <li>اتفاقية مستوى الخدمة</li>
                <li>تحديد المسؤولية</li>
                <li>القوة القاهرة</li>
              </ol>
            </div>

            {/* Section 1 */}
            <section id="section-1" className="pt-4 border-t border-secondary-100 dark:border-secondary-800 scroll-mt-24">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-secondary-900 dark:text-white">
                  1. هذه الشروط والأحكام ملزمة قانونًا
                </h2>
                <button onClick={scrollToTop} className="print:hidden text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
                  <ArrowUp size={12} />
                  <span>الذهاب لأعلى الصفحة</span>
                </button>
              </div>
              <p className="text-sm sm:text-base leading-relaxed">
                شركة "أيزام" هي المالك والمشغل لخدمات "دفترك" (المشار إليها فيما بعد بـ "الخدمة"). فيما يكون استخدامك للخدمة مشروطًا صراحة بقبولك لهذه الشروط والأحكام الخاصة بـ "دفترك" (المشار إليها فيما بعد بـ "الشروط والأحكام"). وباستخدام الخدمة، فإنك توافق دون قيد أو شرط على الالتزام قانونًا بهذه الشروط والأحكام. ولا تنطبق أي شروط أو أحكام أخرى من أي نوع ترد في أي مستندات أو كتابات أو أي عمليات تواصل أخرى من جانبك مع "دفترك" أو موظفيها أو ممثليها أو وكلائها فيما يتعلق بالخدمة، ولا تكون ملزمة لها.
              </p>
            </section>

            {/* Section 2 */}
            <section id="section-2" className="pt-6 border-t border-secondary-100 dark:border-secondary-800 scroll-mt-24">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-secondary-900 dark:text-white">
                  2. التغييرات التي يتم إجراؤها على الاتفاقية أو الخدمات هذه
                </h2>
                <button onClick={scrollToTop} className="print:hidden text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
                  <ArrowUp size={12} />
                  <span>الذهاب لأعلى الصفحة</span>
                </button>
              </div>
              <p className="text-sm sm:text-base leading-relaxed">
                يحتفظ "دفترك" بالحق في تغيير هذه الشروط والأحكام في أي وقت. وستكون هذه التغييرات فعالة وملزمة قانونًا لك عند نشرها على موقع الويب لدينا الخاص بالخدمة أو عندما نبذل جهودًا معقولة لإعلامك بوسائل أخرى. ويرجى مراجعة هذه الشروط والأحكام بشكل دوري للتعرف على آخر التغييرات. فيما يعني استمرار استخدامك لهذه الخدمة بعد نشر الشروط والأحكام المعدَّلة على هذا الموقع أو بعد لفت انتباهك بطريقة أخرى أنك توافق وتقبل أن تكون ملزمًا قانونًا بهذه التغييرات.
              </p>
            </section>

            {/* Section 3 */}
            <section id="section-3" className="pt-6 border-t border-secondary-100 dark:border-secondary-800 scroll-mt-24">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-secondary-900 dark:text-white">
                  3. منح تراخيص الاستخدام
                </h2>
                <button onClick={scrollToTop} className="print:hidden text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
                  <ArrowUp size={12} />
                  <span>الذهاب لأعلى الصفحة</span>
                </button>
              </div>
              <div className="space-y-4 text-sm sm:text-base">
                <p>
                  <strong>أ.</strong> يمنح "دفترك" بموجب هذه الشروط والأحكام حقًا محدودًا وغير حصري وغير قابل لنقل الملكية لاستخدام الخدمة شريطة موافقتك على ما يلي:
                </p>
                <div className="space-y-3 ps-4 border-s-2 border-secondary-200 dark:border-secondary-700">
                  <p>
                    <strong>i.</strong> يجوز "لدفترك"، وفقًا لتقديره الخاص والمطلق، دون إشعار مسبق لك ومن دون تحمل مسؤولية، رفض أو منع أو إيقاف أو تعليق حسابك (حساباتك) و/أو استخدامك للخدمة إذا كان "دفترك"، وفقًا لتقديره الخاص، يرى أن استخدامك لا يفي بمواصفات أو إرشادات "دفترك"، أو التي قد يعتبرها "دفترك" غير مناسبة أو غير قانونية أو ضارة بمصالحه. إذا مارس "دفترك" تقديره المطلق بموجب الفقرة 3.1 (أ)، فلن يتحمل أي مسؤولية عن رد أي جزء من اشتراكاتك المدفوعة مسبقًا، إن أمكن. دون تقييد أو التنازل عن أي حق ضدك قد يتمتع به "دفترك" بموجب القانون أو هذه الشروط والأحكام فيما يتعلق بأي استخدام غير مناسب أو غير قانوني أو ضار، يحتفظ "دفترك" بالحق في خصم أي تكاليف أو أضرار أو نفقات قد يتكبدها فيما يتعلق بمثل هذا الاستخدام غير المناسب أو غير القانوني أو الضار من اشتراكاتك المدفوعة مسبقًا غير المستخدمة، إن وجدت، أو المطالبة بالشيء نفسه منك بأي وسيلة أخرى.
                  </p>
                  <p>
                    <strong>ii.</strong> أنت توافق على الامتثال لأي سياسات أو إرشادات قد يقدمها "دفترك" أو يعدلها من وقت لآخر. وقد تتعلق سياسات أو إرشادات "دفترك" بالمواصفات الفنية والخصوصية والمحتوى المقبول وأي مسألة أخرى، حيث يجوز تعديلها من قبل "دفترك"، وفقًا لتقديره المطلق، من وقت لآخر.
                  </p>
                  <p>
                    <strong>iii.</strong> أنت توافق على أنك لن تمنح صلاحية الوصول إلى أو تقدم أي جزء من الخدمة إلى أي طرف ثالث؛ سواء تعديل أو تعطيل أو التدخل في الخدمة أو الخوادم أو الشبكات الداعمة إما يدويًا أو من خلال استخدام البرامج النصية أو الفيروسات أو الفيروسات المتنقلة؛ أو إعادة إنتاج الخدمة أو نسخها أو استنساخها أو تفكيكها أو بيعها أو المتاجرة بها أو إعادة بيعها؛ أو الإفراط في التحميل الزائد على الأنظمة التي تستخدمها "دفترك" لتقديم الخدمة.
                  </p>
                  <p>
                    <strong>iv.</strong> يجوز "لدفترك"، وفقًا لتقديره الخاص والمطلق ودون إشعار مسبق لك، تعديل أو تعليق أو تغيير أو سحب الخدمة و/أو الشروط والأحكام و/أو الموقع على الويب في أي وقت ومن وقت لآخر.
                  </p>
                  <p>
                    <strong>v.</strong> تقع المسؤولية عليك وحدك عن استخدامك للخدمة وتعويض "دفترك" عن جميع الخسائر والتكاليف والأضرار التي يتكبدها فيما يتعلق بأي مطالبات من قبل أطراف ثالثة ضد "دفترك" ذات صلة باستخدامك للخدمة وفيما يتعلق بخرقك لهذه الشروط والأحكام أو أي سياسات أو إرشادات قد يقدمها "دفترك" من وقت لآخر.
                  </p>
                  <p>
                    <strong>vi.</strong> أنت تقر بموجب هذه وتضمن وتتعهد "لدفترك" أنه في جميع الأوقات، (أ) لديك جميع الحقوق والموافقات والتراخيص والتصاريح التي قد تكون ضرورية أو مرغوبة بالنسبة لك من أجل استخدام المواد والرسومات والشعارات ومقاطع الفيديو والبيانات أو المعلومات التي تُدخِلُهَا في الخدمة (عند الاقتضاء) (يشار إليها فيما بعد بـ "المحتوى الخاص بك") بالطريقة والغرض الذي تستخدم المحتوى الخاص بك من أجله؛ (ب) كل المحتوى الخاص بك يتوافق مع جميع القوانين واللوائح المعمول بها ولا ينتهك حقوق (بما في ذلك، على سبيل المثال لا الحصر، حقوق الملكية الفكرية) لأي طرف ثالث.
                  </p>
                  <p>
                    <strong>vii.</strong> أنت تقر وتضمن "لدفترك" أن لديك حقوق الشركة الكاملة، والنفوذ والسلطة للموافقة على هذه الشروط والأحكام وتنفيذ الالتزامات التي وافقت عليها، وأن القيام بذلك لا ولن ينتهك أي اتفاق أو التزام أنت ملزم به، أو أي قانون أو قاعدة أو لائحة معمول بها.
                  </p>
                  <p>
                    <strong>viii.</strong> أنت توافق بموجب هذه على أنه يجوز "لدفترك"، ولكن ليس ملزمًا بذلك، استخدام اسمك والإشارة إليك كمستخدم للخدمة في أي دعاية أو بيان صحفي أو مواد إعلانية أو تسويقية في جميع أنحاء العالم وباستخدام أي شكل من أشكال الوسائط. إذا كنت ترغب في استخدام أو عرض علامات "دفترك" التجارية أو ذكر "دفترك" في أي منشور أو موقع ويب أو بيان صحفي أو بأي طريقة أخرى، فيجب عليك الحصول على موافقة خطية مسبقة من "دفترك".
                  </p>
                  <p>
                    <strong>ix.</strong> أنت توافق على تحمل المسؤولية وحدك عن الحصول على أو توفير أي أجهزة أو برامج قد تحتاجها للوصول إلى الخدمة واستخدامها، وعن أي ضرر أو خسارة تتكبدها نتيجة لتشغيل هذه الأجهزة أو البرامج، بما في ذلك عدم التوافق مع أي منصات تستخدمها "دفترك" في تقديم الخدمة.
                  </p>
                  <p>
                    <strong>x.</strong> أنت توافق على أن "دفترك" هو المالك الوحيد وله الحق في استخدام أي تعليقات تقدمها على الخدمة بأي طريقة كانت، بما في ذلك تحسين المنتجات والخدمات الحالية أو إنشاء منتجات وخدمات جديدة.
                  </p>
                </div>
                <p>
                  <strong>ب.</strong> يحتفظ "دفترك" بجميع الحقوق في الخدمة غير الممنوحة لك صراحةً في هذه الشروط والأحكام.
                </p>
                <p>
                  <strong>ج.</strong> أنت توافق بموجب هذه على منح "دفترك" ترخيصًا عموميًا وخاليًا من حقوق الملكية وغير حصري لنشر وتعديل وتكييف وتجميع واستضافة واستخدام (أ) المحتوى الخاص بك (بما في ذلك، على سبيل المثال لا الحصر، إعادة الإنتاج في شكل مادي والنشر والتنفيذ والتواصل مع العامة وإجراء التعديلات على المحتوى الخاص بك) لغرض تزويدك بالخدمة، و(ب) إذا كان "دفترك" يوفر أي منتدى مجتمعي لمستخدمي الخدمة لتبادل نصائح المستخدم ونشر التعليقات والآراء وأي تعليقات وآراء ومواد أخرى تقوم بتحميلها أو نشرها في مثل هذا المنتدى.
                </p>
              </div>
            </section>

            {/* Section 4 */}
            <section id="section-4" className="pt-6 border-t border-secondary-100 dark:border-secondary-800 scroll-mt-24">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-secondary-900 dark:text-white">
                  4. شروط الدفع
                </h2>
                <button onClick={scrollToTop} className="print:hidden text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
                  <ArrowUp size={12} />
                  <span>الذهاب لأعلى الصفحة</span>
                </button>
              </div>
              <div className="space-y-3 text-sm sm:text-base">
                <p>
                  <strong>أ.</strong> من خلال إنشاء حساب والاشتراك في الخدمة أو تجديد اشتراكك في الخدمة، فإنك تفيد بموافقتك على الرسوم المفروضة.
                </p>
                <p>
                  <strong>ب.</strong> الرسوم مقابل الخدمات أو المنتجات التي تطلبها؛ أنت توافق على الامتثال لأي شروط دفع قد يفرضها "دفترك" من وقت لآخر. وقد يُطلب منك الدفع إلى "دفترك" مقدمًا و/أو على أساس سنوي أو نصف سنوي أو ربع سنوي أو شهري لاستخدام الخدمة. وقد يتم تجديد اشتراكك تلقائيًا عند انتهاء صلاحيته أو بالقرب من انتهاء صلاحيته بأسعار الاشتراك المطبقة في وقت التجديد. على الرغم من ذلك، حتى في حالة وجود وسيلة لتجديد اشتراكك تلقائيًا، فإن مسؤولية ضمان تجديد اشتراكك قبل انتهاء صلاحيته تقع على عاتقك وحدك، وليست مسؤولية "دفترك"، وإلا ستنتهي قدرتك على استخدام الخدمة تلقائيًا. وقد لا يعطيك "دفترك" إشعارًا مسبقًا بالتجديد التلقائي. وإذا كان "دفترك" غير قادر على تنفيذ هذا التجديد التلقائي لأي سبب من الأسباب، فسوف ينتهي اشتراكك تلقائيًا. أما بالنسبة للمشتركين الذين يختارون الدفع بواسطة بطاقة الائتمان، قد يتم فرض رسوم الاشتراك للتجديد على بطاقة الائتمان المسجلة ما لم يتم إخطار "دفترك" بالتغيير أو الإلغاء كتابيًا باستخدام الأدوات أو الوسائل التي توفرها "دفترك".
                </p>
                <p>
                  <strong>ج.</strong> يجوز إدراج جميع المبالغ المستحقة عليك إلى "دفترك" في عرض أسعار باستثناء أي ضريبة سلع وخدمات، أو أي ضرائب أخرى قد تُفرض على الاشتراك.
                </p>
                <p>
                  <strong>د.</strong> الرسوم التي يفرضها "دفترك"؛ على هذا النحو، فإنك توافق على أن "دفترك" قد يفرض عليك و/أو بطاقة الائتمان المسجلة رسومًا مقابل أي ضرائب أو رسومًا يطلبها "دفترك" بموجب أي قانون أو لائحة معمول بها لفرضها على الاشتراك أو الرسوم.
                </p>
              </div>
            </section>

            {/* Section 5 */}
            <section id="section-5" className="pt-6 border-t border-secondary-100 dark:border-secondary-800 scroll-mt-24">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-secondary-900 dark:text-white">
                  5. المدة والإنهاء
                </h2>
                <button onClick={scrollToTop} className="print:hidden text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
                  <ArrowUp size={12} />
                  <span>الذهاب لأعلى الصفحة</span>
                </button>
              </div>
              <div className="space-y-3 text-sm sm:text-base">
                <p>
                  <strong>أ.</strong> يجوز "لدفترك" إنهاء علاقتها معك، دون إشعار مسبق، إذا انتهكت أو أخفقت في الامتثال لأي شرط من هذه الشروط والأحكام. ويجوز أيضًا إنهاء هذه الاتفاقية وقدرتك على استخدام الخدمة تلقائيًا عند انتهاء اشتراكك.
                </p>
                <p>
                  <strong>ب.</strong> بعد الإنهاء، يجوز "لدفترك"، وفقًا لتقديره الخاص، الاحتفاظ بأي بيانات قمت بتحميلها في أنظمته. على الرغم من ذلك، فإنك توافق على أنه بخلاف أي التزامات منصوص عليها صراحةً في هذه الشروط والأحكام، فإن "دفترك" لا يتحمل أي مسؤولية تجاهك للحفاظ على حساب المستخدم الخاص بك أو أي من بياناتك بعد الإنهاء، ويجب عليك عدم الإضرار بـ "دفترك" وإخلاء مسؤوليته من أي رسوم أو أضرار أو مطالبات التي قد تتعرض لها فيما يتعلق بنفس المطالبات أو الإجراءات التي قد تواجهها أو تتعرض لها فيما يتعلق بالشيء نفسه.
                </p>
                <p>
                  <strong>ج.</strong> إذا كان الإنهاء بسبب إخفاقك في تجديد اشتراكك في الوقت المناسب، فيمكنك إعادة تنشيط حسابك والوصول إلى بياناتك إذا تم التمكن من التجديد في ظل هذه الظروف بواسطة "دفترك". للقيام بذلك، قد تضطر إلى دفع أي رسوم اشتراك أو رسوم قد يفرضها "دفترك"، بما في ذلك رسوم إعادة التنشيط (إن وجدت)، خلال أي فترة قد يحددها "دفترك"، وإلا فإن "دفترك" قد يزيل حساب (حسابات) المستخدم الخاصة بك بشكل دائم وأي بيانات قمت بتحميلها على أنظمته.
                </p>
              </div>
            </section>

            {/* Section 6 */}
            <section id="section-6" className="pt-6 border-t border-secondary-100 dark:border-secondary-800 scroll-mt-24">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-secondary-900 dark:text-white">
                  6. سياسة إلغاء الاشتراك واسترداد الرسوم
                </h2>
                <button onClick={scrollToTop} className="print:hidden text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
                  <ArrowUp size={12} />
                  <span>الذهاب لأعلى الصفحة</span>
                </button>
              </div>

              <div className="space-y-4 text-sm sm:text-base">
                <div>
                  <h3 className="font-bold text-secondary-900 dark:text-white mb-2">أولاً: طريقة تقديم طلب الإلغاء</h3>
                  <ul className="list-disc list-inside space-y-1.5 ps-2">
                    <li><strong>i.</strong> لا يتم قبول أو اعتماد أي طلب لإلغاء الاشتراك إلا إذا تم إرساله حصراً من البريد الإلكتروني المسجَّل كـ (Admin Email) في إعدادات الحساب.</li>
                    <li><strong>ii.</strong> أي طلبات يتم إرسالها من بريد مختلف أو من طرف غير مخوّل تعتبر باطلة وغير معتمدة.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-bold text-secondary-900 dark:text-white mb-2">ثانياً: الاشتراكات</h3>
                  <ul className="list-disc list-inside space-y-1.5 ps-2">
                    <li><strong>i.</strong> عند تقديم طلب الإلغاء، يتم احتساب المدة المستهلكة من تاريخ بداية الاشتراك وحتى تاريخ استلام الطلب عبر البريد الإلكتروني المعتمد.</li>
                    <li><strong>ii.</strong> تُسوّى قيمة المدة المستهلكة على أساس السعر الشهري المعلن في الموقع الرسمي للشركة فقط (وذلك دون الاعتداد بأي خصومات أو عروض وأسعار خاصة مرتبطة بحساب العميل) ويتم احتساب قيمة مبلغ الاسترداد باليوم وفقاً لعدد الأيام الفعلية المستخدمة حتى تاريخ تقديم الطلب.</li>
                    <li><strong>iii.</strong> في حالة الاتفاق على حل بديل مع العميل واستمرار تفعيل الاشتراك، أو قيام الشركة بالرد عبر البريد الإلكتروني وإخطار العميل بأن المشكلة قد حُلّت وأن طلب الإلغاء قد أُسقط بموافقته، يعتبر طلب الإلغاء لاغياً. وإذا لم يعترض العميل أو يرفض الحل خلال يومين عمل كحد أقصى من تاريخ الإخطار، يُعتبر الرد نهائياً وملزماً وفي حال تقديم طلب إلغاء اخر ، يتم اعتماد تاريخ آخر طلب صالح حصراً، دون الاعتداد بأي طلبات سابقة.</li>
                    <li><strong>iv.</strong> تلتزم الشركة برد المبالغ المستحقة (إن وُجدت) خلال مدة لا تتجاوز ثلاثين (30) يوماً من تاريخ تأكيد الطلب، مالم يطرأ أي ظرف استثنائي خارج عن ارادة الشركة. وفي حال وجود عائق أو تأخير بسبب العميل، تبدأ مدة الثلاثين يوماً من تاريخ آخر تأكيد صادر عن الشركة بتنفيذ عملية الاسترداد.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-bold text-secondary-900 dark:text-white mb-2">ثالثاً: الاعتماد والتنفيذ</h3>
                  <ul className="list-disc list-inside space-y-1.5 ps-2">
                    <li><strong>i.</strong> لا يُعتبر طلب الإلغاء نافذاً إلا بعد إصدار تأكيد استلام رسمي من قِبل الشركة عبر البريد الإلكتروني.</li>
                    <li><strong>ii.</strong> يظل العميل ملزماً بسداد أي رسوم أو التزامات مالية مستحقة حتى تاريخ اعتماد الإلغاء.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-bold text-secondary-900 dark:text-white mb-2">رابعاً: أحكام عامة</h3>
                  <ul className="list-disc list-inside space-y-1.5 ps-2">
                    <li><strong>i.</strong> تحتفظ الشركة بحقها في تعديل أو تحديث سياسة الإلغاء الخاصة بها في أي وقت، على أن يتم نشر النسخة المحدثة على الموقع الرسمي.</li>
                    <li><strong>ii.</strong> استمرار العميل في استخدام الخدمة بعد نشر أي تعديل يُعتبر موافقة ضمنية على التعديلات.</li>
                    <li><strong>iii.</strong> <strong>البند الثاني: تحويل ورد المبالغ وفض النزاعات حول ملكية الحساب:</strong>
                      <div className="mt-2 ps-4 space-y-2">
                        <p><strong>أولاً: التحويل إلى الحساب الأصلي ورد الأموال:</strong> يتم رد أو تحويل أي مبالغ مالية حصراً إلى وسيلة الدفع الأصلية المستخدمة عند الاشتراك (بطاقة ائتمانية، حساب بنكي، محفظة إلكترونية، أو أي وسيلة دفع إلكترونية أخرى). ولا يُسمَح بأي حال من الأحوال بتحويل المبالغ إلى أي حساب أو وسيلة دفع تابعة لطرف ثالث، إذ تُعاد الأموال فقط إلى نفس الحساب أو الوسيلة التي تم استخدامها في عملية الدفع الأصلية، وباسم نفس المالك أو الجهة التي صدر عنها الدفع.</p>
                        <p><strong>ثانياً: مزاعم متعددة بملكية الحساب:</strong> في حال تلقت الشركة أكثر من طلب إلغاء أو استرداد من أطراف متعددة يدّعي كل منهم ملكية الحساب، يحق للشركة تعليق أي إجراء مالي أو تنفيذي لحين الفصل في النزاع قانونياً:</p>
                        <ul className="list-disc list-inside ps-4 space-y-1 text-xs sm:text-sm">
                          <li><strong>أ. وقف جميع الطلبات التنفيذية:</strong> بمجرد ورود شكوى أو نزاع يتعلق بملكية الحساب، تقوم الشركة فورًا بتعليق كافة الطلبات التنفيذية الخاصة بالاشتراك أو الاسترداد أو أي تحويل مالي، لحين استكمال المراجعة القانونية.</li>
                          <li><strong>ب. تقديم المستندات:</strong> يُطلب من جميع الأطراف تقديم المستندات الرسمية التي تحددها الشركة لإثبات الملكية (حكم قضائي نهائي، قرار قضائي واجب النفاذ، أو مستند صادر عن جهة مختصة).</li>
                          <li><strong>ج. عدم تنفيذ الطلبات قبل التحقق:</strong> لا يتم تنفيذ أي طلب استرداد أو إلغاء أو تحويل مالي إلا بعد مراجعة جميع المستندات والتحقق منها واعتمادها من الإدارة القانونية.</li>
                          <li><strong>د. مدة تقديم المستندات:</strong> في حال امتناع أحد الأطراف عن تقديم المستندات المطلوبة خلال مدة أقصاها يومي عمل، تحتفظ الشركة بحقها في رفض الطلب أو تعليق الحساب حتى صدور قرار قضائي نهائي.</li>
                          <li><strong>هـ. تنفيذ الحكم القضائي:</strong> عند صدور حكم قضائي نهائي يبت في ملكية الحساب، تلتزم الشركة بتنفيذ ما ورد فيه بشرط تطابق العمليات واعتمادها قانونياً.</li>
                        </ul>
                      </div>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-bold text-secondary-900 dark:text-white mb-2">خامساً: التنفيذ والاعتماد</h3>
                  <p className="mb-2">لا يُعتدّ إلا بالطلبات الواردة من البريد الإلكتروني المعتمد (البريد الإلكتروني الخاص بالمسؤول "الأدمن" المسجَّل في إعدادات الحساب).</p>
                  <ul className="list-disc list-inside space-y-1.5 ps-2">
                    <li><strong>i.</strong> يتم تنفيذ أي طلب استرداد أو إجراء آخر بعد إتمام المراجعة القانونية والتأكد من استيفاء جميع متطلبات التحقق من الهوية وملكية الحساب. وتُنجَز هذه الإجراءات خلال المدد الزمنية المنصوص عليها في هذه السياسة.</li>
                    <li><strong>ii.</strong> يُفهم أن للشركة الحق الكامل في رفض أو تأجيل أي طلب متى رأت أن المستندات أو الإثباتات المقدمة غير كافية أو لا تحقق شروط المراجعة القانونية اللازمة.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-bold text-secondary-900 dark:text-white mb-2">سادساً: حماية حقوق الشركة</h3>
                  <ul className="list-disc list-inside space-y-1.5 ps-2">
                    <li><strong>i.</strong> تحتفظ الشركة بحقها في اتخاذ أي تدابير قانونية لازمة لحماية مصالحها في حالة النزاع على ملكية الحساب، بما في ذلك رفع دعاوى قضائية، أو اتخاذ إجراءات تعويضية ضد الأطراف المتنازعة.</li>
                    <li><strong>ii.</strong> ويحق للشركة كذلك تحميل الأطراف المتنازعة أي رسوم أو تكاليف إدارية أو قانونية تراها مناسبة، ناتجة عن النزاع أو الإجراءات المتعلقة به، وذلك دون أدنى مسؤولية على الشركة في تحمل تلك الأعباء.</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 7 */}
            <section id="section-7" className="pt-6 border-t border-secondary-100 dark:border-secondary-800 scroll-mt-24">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-secondary-900 dark:text-white">
                  7. عملات الذكاء الاصطناعي (AIC) — شروط الاستخدام
                </h2>
                <button onClick={scrollToTop} className="print:hidden text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
                  <ArrowUp size={12} />
                  <span>الذهاب لأعلى الصفحة</span>
                </button>
              </div>
              <div className="space-y-3 text-sm sm:text-base">
                <p>
                  <strong>ما هي عملات الذكاء الاصطناعي؟</strong> عملات الذكاء الاصطناعي (AIC) هي رصيد تستخدمه للوصول إلى ميزات الذكاء الاصطناعي في <strong>دفترك</strong>. يُخصم من رصيدك في كل مرة تستخدم فيها إحدى هذه الميزات.
                </p>
                <div className="p-4 rounded-xl bg-secondary-50 dark:bg-secondary-800/40 border border-secondary-200 dark:border-secondary-700">
                  <h4 className="font-bold mb-2">الرصيد الشهري:</h4>
                  <p className="text-sm mb-2">يحصل كل مشترك نشط على رصيد شهري من عملات الذكاء الاصطناعي بحسب خطته:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm font-semibold">
                    <li>الأساسية: 60 عملة/شهر</li>
                    <li>المتقدمة: 200 عملة/شهر</li>
                    <li>المميزة: 500 عملة/شهر</li>
                  </ul>
                  <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-2">
                    يُضاف الرصيد في بداية كل دورة فوترة. العملات غير المستخدمة تنتهي صلاحيتها نهاية الشهر ولا تُنقل إلى الشهر التالي.
                  </p>
                </div>
                <p>
                  <strong>ترقية الخطة:</strong> عند ترقية خطتك في منتصف الدورة، تحصل فوراً على الفرق في الرصيد المخصص محسوباً بالتناسب مع الأيام المتبقية في دورة الفوترة الحالية.
                </p>
                <p>
                  <strong>شراء عملات إضافية:</strong> يمكنك شراء عملات إضافية في أي وقت بغض النظر عن خطتك (2,000 عملة مقابل 5 دولار). العملات الإضافية صالحة حتى نهاية فترة اشتراكك الحالية فقط. إذا كان لديك 6 أشهر متبقية في اشتراك سنوي، ستحصل على 2,000 عملة شهرياً لتلك الأشهر الست وسيتم خصم 5 × 6 = 30 دولاراً مقدماً.
                </p>
                <p>
                  <strong>انتهاء الصلاحية:</strong> رصيد الخطة الشهري ينتهي في نهاية كل شهر. العملات المشتراة تنتهي صلاحيتها بنهاية فترة اشتراكك النشط. العملات غير قابلة للاسترداد وليس لها قيمة نقدية.
                </p>
              </div>
            </section>

            {/* Section 8 */}
            <section id="section-8" className="pt-6 border-t border-secondary-100 dark:border-secondary-800 scroll-mt-24">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-secondary-900 dark:text-white">
                  8. بياناتك وبيانات "دفترك" وتخزين ونقل بياناتك وسياسة خصوصية "دفترك"
                </h2>
                <button onClick={scrollToTop} className="print:hidden text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
                  <ArrowUp size={12} />
                  <span>الذهاب لأعلى الصفحة</span>
                </button>
              </div>
              <div className="space-y-3 text-sm sm:text-base">
                <p>
                  <strong>أ.</strong> تعد أنت أو عملاؤك أو شركاؤك أو معاونوك، أيهما ينطبق، مالكًا لأي بيانات تقوم بتحميلها في الخدمة (المشار إليها فيما بعد بـ "بياناتك"). وأنت توافق بموجب هذه على أن "دفترك" هو المالك لجميع البيانات بخلاف بياناتك، بما في ذلك أي بيانات تم إنشاؤها بواسطة النظام ويتم إنشاؤها بواسطة الخدمة أو أي بيانات مجمعة من البيانات التي تم إدخالها في الخدمة من قبل جميع مستخدمي الخدمة على أساس إجمالي (يشار إليها فيما بعد "بيانات دفترك"). وقد يستخدم "دفترك" جميع "بيانات دفترك" بأي طريقة يختارها بما في ذلك لتحسين أو تكييف خدماته، أو لإنشاء أو تصميم منتجات وخدمات جديدة.
                </p>
                <p>
                  <strong>ب.</strong> أنت تقر وتوافق على أن طبيعة الإنترنت دولية وأن "دفترك" يمتلك موافقتك الصريحة على تخزين وتوفير الوصول إلى معلوماتك الشخصية أو السرية، وبيانات المستخدم (المستخدمين) والعملاء، في كندا ومنها، وعلى الإرسال وتقديم هذه المعلومات عبر الإنترنت والتي قد تنطوي على نقلها عبر ولايات قضائية متعددة.
                </p>
                <p>
                  <strong>ج.</strong> تم دمج سياسة خصوصية "دفترك"، كما قد يجوز تعديلها أو تحديثها من وقت لآخر، في هذه الشروط والأحكام وتشكل جزءًا منها.
                </p>
                <p>
                  <strong>د. استخدام بيانات العميل لأغراض التواصل التسويقي أو التوعوي:</strong> بمجرد قيامك بإنشاء حساب على "دفترك" أو تسجيل حساب لديك، أو في حالة تواصلك مع "دفترك" من خلال أي من قنوات التواصل المعتمدة، سواء عبر الهاتف، أو من خلال الموقع الرسمي عبر نموذج "اتصل بنا"، أو عبر المحادثات الكتابية الموثقة (واتس اب)، أو من خلال أي من الشركاء المعتمدين لدى "دفترك"، أو الجهات الحكومية ذات الصلة، فإنك تمنح "دفترك" الحق في استخدام بياناتك المسجلة، بما في ذلك اسمك الفردي أو التجاري ورقم هاتفك وأي معلومات أخرى قمت بتزويدنا بها، وذلك لغرض إرسال مواد دعائية أو معلوماتية أو توعوية تخص خدمات "دفترك" دون الحاجة إلى أي موافقة مسبقة إضافية من جانبك.
                </p>
                <p>
                  <strong>هـ. تسجيل المكالمات:</strong> قد يتم تسجيل المكالمات الهاتفية الواردة إلى الشركة أو الصادرة منها لأغراض ضمان الجودة والتدريب وتحسين مستوى الخدمة. باستخدامك لخدماتنا أو استمرارك في التواصل معنا، فإنك توافق على إمكانية تسجيل تلك المكالمات وفقاً للسياسات والإجراءات المعمول بها لدينا. تلتزم الشركة بالحفاظ على سرية وأمان هذه التسجيلات وعدم استخدامها لأي أغراض أخرى غير المشار إليها أعلاه، وذلك بما يتوافق مع القوانين واللوائح ذات الصلة.
                </p>
              </div>
            </section>

            {/* Section 9 */}
            <section id="section-9" className="pt-6 border-t border-secondary-100 dark:border-secondary-800 scroll-mt-24">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-secondary-900 dark:text-white">
                  9. حسابك (حساباتك) وكلمة (كلمات) مرورك
                </h2>
                <button onClick={scrollToTop} className="print:hidden text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
                  <ArrowUp size={12} />
                  <span>الذهاب لأعلى الصفحة</span>
                </button>
              </div>
              <div className="space-y-3 text-sm sm:text-base">
                <p>
                  <strong>أ.</strong> تقع مسؤولية الحفاظ على أمان وسرية أي كلمة (كلمات) مرور ومعرف (معرفات) المستخدم التي يصدرها "دفترك" لك للوصول إلى الخدمة على عاتقك وحدك وعلى الموظفين والممثلين والوكلاء المعتمدين لديك. وإذا علمت بأي وصول غير مصرح به إلى حسابك (حساباتك)، أو أي إساءة استخدام لكلمة (كلمات) المرور ومعرف (معرفات) المستخدم، فيجب عليك تنشيط العملية الموضوعة لتعطيل حسابك (حساباتك) و/أو إعادة إصدار كلمة (كلمات) مرور جديدة أو معرف (معرفات) مستخدم في أسرع وقت ممكن.
                </p>
                <p>
                  <strong>ب.</strong> أنت توافق على أنك المسؤول الوحيد عن تصرفات وإغفالات الشخص (الأشخاص) الذي ترشحه كمستخدم (مستخدمين) أو مسؤول (مسؤولين) لحسابك (حساباتك) للخدمة. كما توافق أيضًا على أنه يجوز "لدفترك" قبول التعليمات والطلبات من هذا الشخص (الأشخاص) والتواصل معه حتى وما لم يتلق "دفترك" إشعارًا يفيد بأن هذا الشخص (الأشخاص) لم يعد مستخدمًا (مستخدمين) أو مسؤولًا (مسؤولين)، وهذه الإرشادات والطلبات والاتصالات صالحة وملزمة قانونًا لك. بالإضافة إلى ذلك، أنت مسؤول عن أي وكل استخدام لحسابك (حساباتك) من قبل أي شخص يمتلك معرف (معرفات) المستخدم أو كلمة المرور (كلمات المرور) الخاصة بك.
                </p>
              </div>
            </section>

            {/* Section 10 */}
            <section id="section-10" className="pt-6 border-t border-secondary-100 dark:border-secondary-800 scroll-mt-24">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-secondary-900 dark:text-white">
                  10. تعويضك لصالح "دفترك"
                </h2>
                <button onClick={scrollToTop} className="print:hidden text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
                  <ArrowUp size={12} />
                  <span>الذهاب لأعلى الصفحة</span>
                </button>
              </div>
              <p className="text-sm sm:text-base leading-relaxed">
                إذا اتخذ "دفترك" و/أو أي من الشركات التابعة له (يشار إليها إجمالًا "الأطراف المعوضة") أي إجراء لفرض أي من الشروط والأحكام، فإنك توافق على تعويض وعدم إلحاق الضرر عن المستحقين للتعويض والشركات التابعة لهم والمسؤولين والمديرين والموظفين المعنيين. والوكلاء من وضد أي وجميع المطالبات، والخسائر، والتكاليف، والنفقات، وأسباب الدعوى أو الطلبات، بما في ذلك الرسوم القانونية والمحاسبية المعقولة، الناشئة عن استخدامك للخدمة والمتعلقة بها، وأي وجميع الانتهاكات من جانبك لهذه الأحكام والشروط.
              </p>
            </section>

            {/* Section 11 */}
            <section id="section-11" className="pt-6 border-t border-secondary-100 dark:border-secondary-800 scroll-mt-24">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-secondary-900 dark:text-white">
                  11. اتفاقية مستوى الخدمة
                </h2>
                <button onClick={scrollToTop} className="print:hidden text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
                  <ArrowUp size={12} />
                  <span>الذهاب لأعلى الصفحة</span>
                </button>
              </div>
              <div className="space-y-3 text-sm sm:text-base">
                <p>تم دمج اتفاقية مستوى الخدمة المرفقة بهذه الشروط والأحكام في هذه الشروط والأحكام وتشكل جزءًا منها.</p>
                <div className="p-4 rounded-xl bg-warning-50 dark:bg-warning-950/20 border border-warning-200 dark:border-warning-800/40 text-warning-900 dark:text-warning-200">
                  <h4 className="font-bold mb-1">لا توجد ضمانات:</h4>
                  <p className="text-xs sm:text-sm leading-relaxed">
                    ما لم يتم النص عليها صراحةً هنا، إلى أقصى حد يسمح به القانون، لا يقدم "دفترك" أي ضمان أو إقرار من أي نوع فيما يتعلق بموقعه على الويب أو الخدمة أو المنتجات أو الخدمات المتوفرة على هذا الموقع الإلكتروني و/أو أي من المواد المتوفرة على هذا الموقع الإلكتروني، والتي يتم توفيرها جمعيًا على أساس "كما هي". لا يضمن "دفترك" دقة أو اكتمال أو سريان أو موثوقية أي من المحتوى أو البيانات الموجودة على الخدمة أو هذا الموقع الإلكتروني. ويخلي دفترك صراحة مسؤوليته عن جميع الضمانات، والشروط والأحكام المتعلقة بالخدمة، بما في ذلك جميع الضمانات الضمنية فيما يتعلق بقابلية التسويق، والجودة المرضية، والملاءمة لغرض عام أو معين، وعدم التعدي على حقوق الملكية، والناشئة عن النظام القانوني أو غير ذلك في القانون أو عن طريق التعامل أو استخدام التجارة إلى أقصى حد تسمح به قوانين الولايات المتحدة الأمريكية.
                  </p>
                  <p className="text-xs sm:text-sm leading-relaxed mt-2">
                    لا يضمن "دفترك" أن الخدمة أو هذا الموقع الإلكتروني أو خوادمه أو أي بريد إلكتروني يتم إرساله من "دفترك" خالٍ من الفيروسات أو المكونات الضارة الأخرى. بغية تجنب الشك، لا يضمن "دفترك" فعالية الخدمة. لا يتحمل "دفترك" أي مسؤولية عن أمن أو سرية أو خصوصية الاتصالات و/أو البيانات المنقولة عبر الإنترنت ولا يقدم أي ضمان بأن تقديم الخدمة سيكون خاليًا من الأخطاء أو فقدان المحتوى أو البيانات أو المعلومات. بالإضافة إلى ذلك، لن يتحمل "دفترك" المسؤولية عن أي مشكلات توافق تتعلق بحواسيب العملاء أو تطبيقاتهم أو برامجهم الأخرى على أي أجهزة كمبيوتر تستخدم الخدمة.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 12 */}
            <section id="section-12" className="pt-6 border-t border-secondary-100 dark:border-secondary-800 scroll-mt-24">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-secondary-900 dark:text-white">
                  12. تحديد المسؤولية
                </h2>
                <button onClick={scrollToTop} className="print:hidden text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
                  <ArrowUp size={12} />
                  <span>الذهاب لأعلى الصفحة</span>
                </button>
              </div>
              <p className="text-sm sm:text-base leading-relaxed">
                إلى أقصى حد يسمح به القانون في أي حال من الأحوال، لن يكون "دفترك" مسؤولًا عن أي تلف أو خسارة أو مطالبة أو ضرر أو أي أضرار خاصة أو نموذجية أو عقابية أو غير مباشرة أو عرضية أو تبعية من أي نوع أو خسارة أو خسائر سواء كان مستندة إلى العقد، أو المسؤولية التقصيرية (بما في ذلك الإهمال) ، أو حقوق الملكية، أو المسؤولية الصارمة، أو النظام القانوني، أو غير ذلك، والذي ينشأ أو يكون بأي شكل من الأشكال محتوى موجود هنا، أو (2) أي إخفاق أو تأخير (بما في ذلك، على سبيل المثال لا الحصر، استخدام أو عدم القدرة على استخدام أي مكون من مكونات الخدمة أو هذا الموقع)، أو (3) الأداء أو عدم الأداء من قبل "دفترك" حتى إذا تم إخطار "دفترك" بإمكانية حدوث أضرار لهذه الأطراف أو أي طرف آخر.
              </p>
              <p className="text-sm sm:text-base leading-relaxed mt-3">
                إذا، على الرغم مما سبق، وجب على "دفترك" تحمل المسؤولية عن أي خسارة أو ضرر ينشأ عن أو يرتبط بأي شكل من الأشكال بأي من الوظائف أو الاستخدامات الموضحة أعلاه لهذا الموقع أو الخدمة أو محتواها، إلى أقصى حد مسموح به بموجب القانون، يجب ألا تتجاوز المسؤولية الإجمالية المجمعة لـ "دفترك" بأي حال من الأحوال قيمة الاشتراك الشهري للخدمة التي تدفعها أنت أو 1000.00 دولار أمريكي، أيهما أقل. علاوة على ذلك، سيتم تقليل مسؤولية "دفترك" تجاهك في العقد أو المسؤولية التقصيرية أو الإهمال أو المسؤولية الصارمة أو بموجب القانون أو غير ذلك إلى الحد، إن وجد، الذي ساهمت فيه في الخسارة أو الضرر.
              </p>
            </section>

            {/* Section 13 */}
            <section id="section-13" className="pt-6 border-t border-secondary-100 dark:border-secondary-800 scroll-mt-24">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-secondary-900 dark:text-white">
                  13. القوة القاهرة
                </h2>
                <button onClick={scrollToTop} className="print:hidden text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
                  <ArrowUp size={12} />
                  <span>الذهاب لأعلى الصفحة</span>
                </button>
              </div>
              <p className="text-sm sm:text-base leading-relaxed">
                لا يتحمل "دفترك" أي مسؤولية ويتم إعفاؤه من جميع الالتزامات والمسؤوليات التعاقدية (على سبيل المثال عن الأضرار) إذا تأثر أداءه لهذه الشروط والأحكام بحدث قوة قاهرة. لغرض هذا البند، يعني مصطلح "القوة القاهرة" ويتضمن أي حدث لم يكن تحت سيطرة "دفترك"، أو لم يكن متوقعًا بشكل معقول، بما في ذلك، على سبيل المثال لا الحصر، أي كارثة طبيعية مثل العواصف الرعدية أو الفيضانات أو العواصف أو الحريق أو الطوارئ الوطنية أو الإضراب أو الإجراءات العمالية المماثلة أو عدم توفر الإنترنت لأسباب خارجة عن سيطرة "دفترك".
              </p>
            </section>

            {/* Conclusion */}
            <div className="pt-8 border-t border-secondary-200 dark:border-secondary-700 text-center sm:text-start">
              <p className="text-sm font-bold text-primary-600 dark:text-primary-400">
                نشكرك على الوقت الذي استغرقته لفهم الشروط والأحكام الخاصة بنا.
              </p>
              <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                لأي استفسارات قانونية، يرجى التواصل معنا عبر البريد الإلكتروني: <a href="mailto:mahmoud.sobhy36@gmail.com" className="text-primary-600 underline">salse@daftrk.com</a> أو عبر الواتساب: <a href="https://wa.me/201111209131" className="text-emerald-600 font-bold underline" dir="ltr">01111209131</a>
              </p>
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}
