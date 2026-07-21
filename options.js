/* ALIN 2.0.1 - account, language, and appearance options */
(function () {
  'use strict';

  const LANG_KEY = 'alin_language_v110';
  const THEME_KEY = 'alin_theme_v110';
  const validLanguages = ['ar', 'ku', 'en'];
  const validThemes = ['light', 'dark', 'system'];
  let lastFocus = null;

  const copy = {
    ar: {
      options: 'الخيارات', subtitle: 'حسابك، اللغة ومظهر المنصة', account: 'حسابي',
      guest: 'غير مسجّل الدخول', signed: 'مسجّل باسم', accountHelp: 'تسجيل الدخول وإدارة حساب الطالب',
      local: 'بيانات حساب الطالب محفوظة على هذا الجهاز ما لم تُزامنها المنصة.',
      preferences: 'التفضيلات', language: 'اللغة', appearance: 'المظهر',
      light: 'نهاري', dark: 'ليلي', system: 'النظام', help: 'المساعدة',
      contact: 'تواصل معنا', about: 'عن منصة آلين', close: 'إغلاق',
      privacy: 'تُحفظ تفضيلات اللغة والمظهر على هذا الجهاز.',
      whatsapp: 'واتساب', phone: 'اتصال هاتفي', noPhone: 'رقم التواصل غير مضاف حاليًا. يرجى مراجعة إدارة المنصة.',
      contactTitle: 'تواصل مع آلين', search: 'ابحث عن ملزمة، مادة، مدرس أو منتج',
      cart: 'السلة', favorites: 'المفضلة', notifications: 'الإشعارات', exit: 'خروج',
      statusLanguage: 'تم تغيير اللغة', statusTheme: 'تم تغيير المظهر',
      brandSub:'ملازم • قرطاسية • هدايا',filter:'فلترة',login:'تسجيل الدخول',optional:'التسجيل اختياري',
      heroBadge:'منصة الطالب',heroTitle:'كل ما تحتاجه للدراسة<br>بمكان واحد',heroText:'اختر ملزمتك أو قرطاسيتك واطلبها بسهولة.',browse:'تصفح المتجر',trackOrder:'تتبع الطلب',
      booklet:'ملازم',bookletSub:'جميع المواد والمراحل',stationery:'قرطاسية',stationerySub:'أدوات الدراسة والكتب',gifts:'هدايا',giftsSub:'هدايا راقية ومميزة',deals:'عروض',dealsSub:'خصومات وعروض حصرية',
      catalog:'الكتالوج الكامل',allProducts:'كل المنتجات',showAll:'عرض الكل',trackTitle:'تتبع حالة الطلب',trackText:'اكتب رقم الطلب لمعرفة هل هو قيد التجهيز، جاهز بالمكتبة، أو تم التسليم.',trackPlaceholder:'مثال: ALIN-0001 أو رقم الطلب',track:'تتبع',
      available:'ملزمة متاحة',completed:'طلب مكتمل',teachers:'مدرس',libraries:'مكتبة',aboutTitle:'عن المنصة',aboutText:'منصة آلين تجمع الملازم والقرطاسية والهدايا في مكان واحد، مع طلب سريع وتواصل واضح بين الطالب والمكتبة والإدارة.',contactText:'للاستفسار أو الانضمام كمدرس أو مكتبة، تواصل مع إدارة منصة آلين.',partner:'بوابات الشركاء:',teacher:'المدرس',library:'المكتبة',admin:'الإدارة',footer:'منصة آلين للتصميم والملازم والقرطاسية'
    },
    ku: {
      options: 'هەڵبژاردەکان', subtitle: 'هەژمار، زمان و ڕووکار', account: 'هەژمارەکەم',
      guest: 'چوونەژوورەوە نەکراوە', signed: 'چوونەژوورەوە بە ناوی', accountHelp: 'چوونەژوورەوە و بەڕێوەبردنی هەژماری خوێندکار',
      local: 'زانیاری هەژمار لەم ئامێرەدا هەڵدەگیرێت، مەگەر پلاتفۆرمەکە هاوکاتی بکات.',
      preferences: 'هەڵبژاردەکان', language: 'زمان', appearance: 'ڕووکار',
      light: 'ڕووناک', dark: 'تاریک', system: 'سیستەم', help: 'یارمەتی',
      contact: 'پەیوەندیمان پێوە بکە', about: 'دەربارەی ئالین', close: 'داخستن',
      privacy: 'زمان و ڕووکار لەم ئامێرەدا هەڵدەگیرێن.',
      whatsapp: 'واتساپ', phone: 'پەیوەندی تەلەفۆنی', noPhone: 'ژمارەی پەیوەندی زیاد نەکراوە.',
      contactTitle: 'پەیوەندی بە ئالین', search: 'بگەڕێ بۆ ملزمە، وانە، مامۆستا یان بەرهەم',
      cart: 'سەبەتە', favorites: 'دڵخوازەکان', notifications: 'ئاگادارکردنەوە', exit: 'دەرچوون',
      statusLanguage: 'زمان گۆڕدرا', statusTheme: 'ڕووکار گۆڕدرا',
      brandSub:'ملزمە • کەرەستەی خوێندن • دیاری',filter:'پاڵاوتن',login:'چوونەژوورەوە',optional:'تۆمارکردن ئارەزوومەندانەیە',
      heroBadge:'پلاتفۆرمی خوێندکار',heroTitle:'هەموو ئەوەی بۆ خوێندن پێویستتە<br>لە یەک شوێن',heroText:'ملزمە یان کەرەستەی خوێندنت هەڵبژێرە و بە ئاسانی داوای بکە.',browse:'گەڕان بە فرۆشگا',trackOrder:'بەدواداچوونی داواکاری',
      booklet:'ملزمە',bookletSub:'هەموو وانە و قۆناغەکان',stationery:'کەرەستەی خوێندن',stationerySub:'کەرەستە و کتێب',gifts:'دیاری',giftsSub:'دیاری تایبەت و جوان',deals:'داشکاندن',dealsSub:'داشکاندن و ئۆفەری تایبەت',
      catalog:'کەتەلۆگی تەواو',allProducts:'هەموو بەرهەمەکان',showAll:'هەمووی پیشان بدە',trackTitle:'بەدواداچوونی دۆخی داواکاری',trackText:'ژمارەی داواکاری بنووسە بۆ زانینی دۆخەکەی.',trackPlaceholder:'نموونە: ALIN-0001 یان ژمارەی داواکاری',track:'بەدواداچوون',
      available:'ملزمەی بەردەست',completed:'داواکاری تەواو',teachers:'مامۆستا',libraries:'کتێبخانە',aboutTitle:'دەربارەی پلاتفۆرم',aboutText:'ئالین ملزمە و کەرەستەی خوێندن و دیاری لە یەک شوێن کۆدەکاتەوە.',contactText:'بۆ پرسیار یان بەشداریکردن وەک مامۆستا یان کتێبخانە، پەیوەندیمان پێوە بکە.',partner:'دەروازەی هاوبەشەکان:',teacher:'مامۆستا',library:'کتێبخانە',admin:'بەڕێوەبەرایەتی',footer:'پلاتفۆرمی ئالین بۆ دیزاین و ملزمە و کەرەستەی خوێندن'
    },
    en: {
      options: 'Options', subtitle: 'Your account, language and appearance', account: 'My account',
      guest: 'Not signed in', signed: 'Signed in as', accountHelp: 'Sign in and manage your student account',
      local: 'Student account data is stored on this device unless the platform syncs it.',
      preferences: 'Preferences', language: 'Language', appearance: 'Appearance',
      light: 'Light', dark: 'Dark', system: 'System', help: 'Help',
      contact: 'Contact us', about: 'About Alin', close: 'Close',
      privacy: 'Language and appearance preferences are saved on this device.',
      whatsapp: 'WhatsApp', phone: 'Phone call', noPhone: 'No contact number is configured. Please check with the platform administration.',
      contactTitle: 'Contact Alin', search: 'Search booklets, subjects, teachers or products',
      cart: 'Cart', favorites: 'Favorites', notifications: 'Notifications', exit: 'Exit',
      statusLanguage: 'Language changed', statusTheme: 'Appearance changed',
      brandSub:'Booklets • Stationery • Gifts',filter:'Filter',login:'Sign in',optional:'Registration is optional',
      heroBadge:'Student platform',heroTitle:'Everything you need to study<br>in one place',heroText:'Choose your booklets or stationery and order with ease.',browse:'Browse store',trackOrder:'Track order',
      booklet:'Booklets',bookletSub:'All subjects and stages',stationery:'Stationery',stationerySub:'Study tools and books',gifts:'Gifts',giftsSub:'Thoughtful premium gifts',deals:'Offers',dealsSub:'Exclusive discounts and offers',
      catalog:'Full catalog',allProducts:'All products',showAll:'Show all',trackTitle:'Track your order',trackText:'Enter the order number to see whether it is being prepared, ready at the library, or delivered.',trackPlaceholder:'Example: ALIN-0001 or order number',track:'Track',
      available:'Booklets available',completed:'Orders completed',teachers:'Teachers',libraries:'Libraries',aboutTitle:'About the platform',aboutText:'Alin brings booklets, stationery and gifts together with quick ordering and clear communication.',contactText:'For support or to join as a teacher or library, contact the Alin team.',partner:'Partner portals:',teacher:'Teacher',library:'Library',admin:'Administration',footer:'Alin platform for design, booklets and stationery'
    }
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const language = () => validLanguages.includes(localStorage.getItem(LANG_KEY)) ? localStorage.getItem(LANG_KEY) : 'ar';
  const themeMode = () => validThemes.includes(localStorage.getItem(THEME_KEY)) ? localStorage.getItem(THEME_KEY) : 'system';
  const resolvedTheme = mode => mode === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode;
  const text = (selector, value) => { const el = $(selector); if (el) el.textContent = value; };
  const escapeHtml = value => String(value??'').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function student() {
    try { return typeof window.currentStudent === 'function' ? window.currentStudent() : null; } catch (_) { return null; }
  }

  function accountName(value) {
    return value && (value.name || value.full_name || value.student_name || value.username || value.phone);
  }

  function icon(name) {
    const paths = {
      account: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c.6-4.2 2.9-6.2 7-6.2s6.4 2 7 6.2"/>',
      globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.4 3 14.6 0 18M12 3c-3 3.4-3 14.6 0 18"/>',
      theme: '<path d="M20 15.3A8.5 8.5 0 0 1 8.7 4a8.5 8.5 0 1 0 11.3 11.3Z"/>',
      contact: '<path d="M4 5.5h16v11H9l-5 3v-14Z"/><path d="M8 10h8M8 13h5"/>',
      about: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.3v.2"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
  }

  function optionsContent() {
    return `<div class="alin-options-sections">
      <button class="alin-account-card" type="button" data-alin-account>
        <span class="alin-option-icon">${icon('account')}</span>
        <span class="alin-account-copy"><b data-copy="account"></b><small data-account-status></small><em data-copy="accountHelp"></em></span>
        <span class="alin-option-chevron" aria-hidden="true">‹</span>
      </button>
      <p class="alin-local-note" data-copy="local"></p>
      <section class="alin-settings-section" aria-labelledby="alinPreferencesLabel">
        <h3 id="alinPreferencesLabel" data-copy="preferences"></h3>
        <div class="alin-setting-row"><span class="alin-option-icon">${icon('globe')}</span><div><b data-copy="language"></b>
          <div class="alin-segment" role="group" aria-label="Language">
            <button type="button" data-lang="ar">العربية</button><button type="button" data-lang="ku">کوردی</button><button type="button" data-lang="en">English</button>
          </div></div></div>
        <div class="alin-setting-row"><span class="alin-option-icon">${icon('theme')}</span><div><b data-copy="appearance"></b>
          <div class="alin-segment" role="group" aria-label="Theme">
            <button type="button" data-theme="light" data-copy="light"></button><button type="button" data-theme="dark" data-copy="dark"></button><button type="button" data-theme="system" data-copy="system"></button>
          </div></div></div>
      </section>
      <section class="alin-settings-section"><h3 data-copy="help"></h3>
        <button class="alin-help-row" type="button" data-alin-contact><span class="alin-option-icon">${icon('contact')}</span><b data-copy="contact"></b><span aria-hidden="true">‹</span></button>
        <button class="alin-help-row" type="button" data-alin-about><span class="alin-option-icon">${icon('about')}</span><b data-copy="about"></b><span aria-hidden="true">‹</span></button>
      </section>
      <p class="alin-privacy-note" data-copy="privacy"></p>
      <div class="alin-options-status" role="status" aria-live="polite"></div>
    </div>`;
  }

  function installUI() {
    const mobileSheet = $('#alinAccountSheet');
    if (mobileSheet) {
      mobileSheet.innerHTML = `<div class="alin-sheet-handle"></div><div class="alin-sheet-head"><div><h2 data-copy="options"></h2><p data-copy="subtitle"></p></div><button type="button" data-alin-close aria-label="إغلاق">×</button></div>${optionsContent()}`;
      mobileSheet.setAttribute('aria-labelledby', 'alinMobileOptionsTitle');
      $('[data-copy="options"]', mobileSheet).id = 'alinMobileOptionsTitle';
    }

    if (!$('.alin-desktop-options-button')) {
      const actions = $('.desktop-store-actions');
      if (actions) {
        const button = document.createElement('button');
        button.className = 'desktop-action alin-desktop-options-button';
        button.type = 'button';
        button.setAttribute('aria-label', 'الخيارات');
        button.innerHTML = `<span class="alin-desktop-options-icon" aria-hidden="true"></span><small data-copy="options">الخيارات</small>`;
        actions.prepend(button);
      }
    }

    if (!$('#alinOptionsDialog')) {
      document.body.insertAdjacentHTML('beforeend', `<div class="alin-options-backdrop" data-alin-backdrop hidden></div>
        <section class="alin-options-dialog" id="alinOptionsDialog" role="dialog" aria-modal="true" aria-labelledby="alinOptionsTitle" hidden>
          <header><div><h2 id="alinOptionsTitle" data-copy="options"></h2><p data-copy="subtitle"></p></div><button type="button" data-alin-close aria-label="إغلاق">×</button></header>
          ${optionsContent()}
        </section>
        <section class="alin-contact-dialog" id="alinContactDialog" role="dialog" aria-modal="true" aria-labelledby="alinContactTitle" hidden>
          <header><h2 id="alinContactTitle" data-copy="contactTitle"></h2><button type="button" data-contact-close aria-label="إغلاق">×</button></header>
          <div data-contact-content></div>
        </section>
        <section class="alin-contact-dialog alin-about-dialog" id="alinAboutDialog" role="dialog" aria-modal="true" aria-labelledby="alinAboutTitle" hidden>
          <header><h2 id="alinAboutTitle" data-copy="about"></h2><button type="button" data-about-close aria-label="إغلاق">×</button></header>
          <div data-about-content></div>
        </section>`);
    }
    bindUI();
  }

  function bindUI() {
    $('.alin-desktop-options-button')?.addEventListener('click', openOptions);
    $$('[data-alin-close]').forEach(el => el.addEventListener('click', closeOptions));
    $('[data-alin-backdrop]')?.addEventListener('click', () => {
      if (!$('#alinContactDialog')?.hidden) closeContact();
      else if (!$('#alinAboutDialog')?.hidden) closeAbout();
      else closeOptions();
    });
    $$('[data-alin-account]').forEach(el => el.addEventListener('click', openAccount));
    $$('[data-alin-contact]').forEach(el => el.addEventListener('click', openContact));
    $$('[data-alin-about]').forEach(el => el.addEventListener('click', openAbout));
    $$('[data-lang]').forEach(el => el.addEventListener('click', () => applyLanguage(el.dataset.lang, true)));
    $$('[data-theme]').forEach(el => el.addEventListener('click', () => applyTheme(el.dataset.theme, true)));
    $$('[data-contact-close]').forEach(el => el.addEventListener('click', closeContact));
    $$('[data-about-close]').forEach(el => el.addEventListener('click', closeAbout));
  }

  function announce(message) {
    $$('.alin-options-status').forEach(el => {
      el.textContent = message;
      clearTimeout(el._timer);
      el._timer = setTimeout(() => { el.textContent = ''; }, 1800);
    });
  }

  function applyLanguage(code, notify) {
    if (!validLanguages.includes(code)) code = 'ar';
    localStorage.setItem(LANG_KEY, code);
    document.documentElement.lang = code === 'ku' ? 'ckb' : code;
    document.documentElement.dir = code === 'en' ? 'ltr' : 'rtl';
    const t = copy[code];
    $$('[data-copy]').forEach(el => { const value = t[el.dataset.copy]; if (value) el.textContent = value; });
    $$('[data-lang]').forEach(el => {
      const active = el.dataset.lang === code;
      el.classList.toggle('active', active); el.setAttribute('aria-pressed', String(active));
    });
    const s = student(), name = accountName(s);
    $$('[data-account-status]').forEach(el => { el.textContent = name ? `${t.signed} ${name}` : t.guest; });
    const search = $('#searchInput'); if (search) search.placeholder = t.search;
    text('[data-desktop-control="cart"] small', t.cart);
    text('[data-desktop-control="favorites"] small', t.favorites);
    text('[data-desktop-control="notifications"] small', t.notifications);
    text('[data-desktop-control="exit"] small', t.exit);
    text('[data-mobile-control="cart"] small', t.cart);
    text('[data-mobile-control="favorites"] small', t.favorites);
    const shell = [
      ['.alin98-brand small','brandSub'],['[data-desktop-control="filter"] small','filter'],
      ['[data-desktop-control="account"] small','login'],['#studentAuthStatus','optional'],
      ['[data-v99-category="booklet"] strong','booklet'],['[data-v99-category="booklet"] small','bookletSub'],
      ['[data-v99-category="stationery"] strong','stationery'],['[data-v99-category="stationery"] small','stationerySub'],
      ['[data-v99-category="gift"] strong','gifts'],['[data-v99-category="gift"] small','giftsSub'],
      ['[data-v99-category="deal"] strong','deals'],['[data-v99-category="deal"] small','dealsSub'],
      ['#v99CatalogKicker','catalog'],['#v99CatalogTitle','allProducts'],['[data-v99-action="clearDesktopCategory"]','showAll'],
      ['#orderTrackBox h2','trackTitle'],['#orderTrackBox p','trackText'],['#orderTrackBox button','track'],
      ['#storeAbout>div:nth-child(1) small','available'],
      ['#storeAbout>div:nth-child(2) small','teachers'],['#storeAbout>div:nth-child(3) small','libraries'],
      ['.desktop-partner-access>span','partner'],['.desktop-partner-access button:nth-of-type(1)','teacher'],['.desktop-partner-access button:nth-of-type(2)','library'],['.desktop-partner-access button:nth-of-type(3)','admin'],['.alin-footer','footer']
    ];
    shell.forEach(([selector,key,html]) => $$(selector).forEach(el => { if (html) el.innerHTML=t[key]; else el.textContent=t[key]; }));
    const trackInput=$('#orderTrackInput'); if(trackInput) trackInput.placeholder=t.trackPlaceholder;
    if (notify) announce(t.statusLanguage);
    window.dispatchEvent(new CustomEvent('alin:language-changed', { detail: { language: code } }));
  }

  function applyTheme(mode, notify) {
    if (!validThemes.includes(mode)) mode = 'system';
    localStorage.setItem(THEME_KEY, mode);
    const resolved = resolvedTheme(mode);
    document.documentElement.dataset.alinTheme = resolved;
    document.documentElement.dataset.alinThemeMode = mode;
    $$('[data-theme]').forEach(el => {
      const active = el.dataset.theme === mode;
      el.classList.toggle('active', active); el.setAttribute('aria-pressed', String(active));
    });
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = resolved === 'dark' ? '#07182b' : '#f8f3e8';
    if (notify) announce(copy[language()].statusTheme);
    window.dispatchEvent(new CustomEvent('alin:theme-changed', { detail: { theme: mode, resolved } }));
  }

  function openOptions() {
    lastFocus = document.activeElement;
    const dialog = $('#alinOptionsDialog'), backdrop = $('[data-alin-backdrop]');
    if (!dialog) return;
    dialog.hidden = false; backdrop.hidden = false;
    document.body.classList.add('alin-options-open');
    setInert(dialog);
    updateAccount();
    requestAnimationFrame(() => $('[data-alin-close]', dialog)?.focus());
  }

  function closeOptions() {
    const dialog = $('#alinOptionsDialog'), backdrop = $('[data-alin-backdrop]');
    if (dialog) dialog.hidden = true;
    if (backdrop) backdrop.hidden = true;
    document.body.classList.remove('alin-options-open');
    clearInert();
    if ($('#alinAccountSheet') && !$('#alinAccountSheet').hidden && typeof window.alinCloseMobileSheets === 'function') window.alinCloseMobileSheets();
    lastFocus?.focus?.();
  }

  function updateAccount() { applyLanguage(language(), false); }

  function openAccount() {
    closeOptions();
    const s = student();
    if (typeof window.openStudentAuth === 'function') window.openStudentAuth(s ? 'profile' : 'login');
    else if (s && typeof window.showStudentAccount === 'function') window.showStudentAccount();
  }

  function getPhone() {
    try { return String(window.db?.settings?.whatsapp || window.db?.settings?.platform_phone || window.db?.settings?.contact_phone || '').trim(); }
    catch (_) { return ''; }
  }

  function whatsappNumber(phone) {
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = `964${digits.slice(1)}`;
    if (!digits.startsWith('964') && digits.length === 10) digits = `964${digits}`;
    return digits;
  }

  function openContact() {
    const desktop=$('#alinOptionsDialog'), mobile=$('#alinAccountSheet');
    if (desktop && !desktop.hidden) desktop.hidden=true;
    if (mobile && !mobile.hidden) mobile.hidden=true;
    clearInert();
    const dialog = $('#alinContactDialog'), content = $('[data-contact-content]', dialog);
    const phone = getPhone(), t = copy[language()];
    if (!phone) content.innerHTML = `<p class="alin-contact-empty">${t.noPhone}</p>`;
    else {
      const wa = whatsappNumber(phone);
      content.innerHTML = `<p class="alin-contact-number" dir="ltr">${phone}</p><div class="alin-contact-actions">
        <a href="https://wa.me/${wa}" target="_blank" rel="noopener">${t.whatsapp}</a>
        <a href="tel:${phone.replace(/[^\d+]/g, '')}">${t.phone}</a></div>`;
    }
    dialog.hidden = false;
    $('[data-alin-backdrop]').hidden = false;
    setInert(dialog);
    requestAnimationFrame(() => $('[data-contact-close]', dialog)?.focus());
  }

  function closeContact() {
    $('#alinContactDialog').hidden = true;
    $('[data-alin-backdrop]').hidden = true;
    clearInert();
    lastFocus?.focus?.();
  }

  function openAbout() {
    const desktop=$('#alinOptionsDialog'), mobile=$('#alinAccountSheet');
    if (desktop && !desktop.hidden) desktop.hidden=true;
    if (mobile && !mobile.hidden) mobile.hidden=true;
    document.body.classList.remove('alin-options-open');
    clearInert();
    const dialog=$('#alinAboutDialog'), content=$('[data-about-content]',dialog), t=copy[language()];
    if(!dialog||!content)return;
    const settings=window.db?.settings||{};
    const title=String(settings.about_title||t.about||t.aboutTitle||'عن منصة آلين');
    const description=String(settings.about_text||t.aboutText||'منصة آلين تجمع الملازم والقرطاسية والهدايا في مكان واحد.');
    $('#alinAboutTitle').textContent=title;
    content.innerHTML=`<div class="alin-about-content"><div class="alin-about-mark" aria-hidden="true">آ</div><p>${escapeHtml(description)}</p></div>`;
    dialog.hidden=false;
    $('[data-alin-backdrop]').hidden=false;
    setInert(dialog);
    requestAnimationFrame(()=>$('[data-about-close]',dialog)?.focus());
  }

  function closeAbout() {
    const dialog=$('#alinAboutDialog');
    if(dialog)dialog.hidden=true;
    $('[data-alin-backdrop]').hidden=true;
    clearInert();
    lastFocus?.focus?.();
  }

  function trapKey(event) {
    if (event.key === 'Escape') {
      if (!$('#alinContactDialog')?.hidden) closeContact();
      else if (!$('#alinAboutDialog')?.hidden) closeAbout();
      else closeOptions();
      return;
    }
    const dialog = !$('#alinContactDialog')?.hidden ? $('#alinContactDialog') : (!$('#alinAboutDialog')?.hidden ? $('#alinAboutDialog') : (!$('#alinOptionsDialog')?.hidden ? $('#alinOptionsDialog') : (!$('#alinAccountSheet')?.hidden ? $('#alinAccountSheet') : null)));
    if (!dialog || event.key !== 'Tab') return;
    const focusable = $$('button:not([disabled]),a[href],input:not([disabled])', dialog);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  window.alinSetLanguage = code => applyLanguage(code, true);
  window.alinSetTheme = mode => applyTheme(mode, true);
  window.alinOpenRealAccount = openAccount;
  window.alinContactUs = openContact;
  window.alinAboutPlatform = openAbout;

  function setInert(activeDialog) {
    Array.from(document.body.children).forEach(el => {
      if (el === activeDialog || el === $('[data-alin-backdrop]') || el.contains(activeDialog)) return;
      el.inert = true; el.dataset.alinInert = 'true';
    });
  }
  function clearInert() {
    $$('[data-alin-inert="true"]').forEach(el => { el.inert=false; delete el.dataset.alinInert; });
  }
  function mobileSheetChanged() {
    const sheet=$('#alinAccountSheet');
    if (!sheet) return;
    if (!sheet.hidden) {
      if (!lastFocus || !document.contains(lastFocus)) lastFocus=$('[data-mobile-control="account"]');
      setInert(sheet);
      requestAnimationFrame(() => $('[data-alin-close]',sheet)?.focus());
    } else {
      if (!$('#alinContactDialog')?.hidden || !$('#alinAboutDialog')?.hidden) return;
      clearInert();
      lastFocus?.focus?.();
    }
  }

  document.addEventListener('keydown', trapKey);
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (themeMode() === 'system') applyTheme('system', false);
  });
  document.addEventListener('DOMContentLoaded', () => {
    installUI();
    const mobileTrigger=$('[data-mobile-control="account"]');
    mobileTrigger?.addEventListener('click', () => { lastFocus=mobileTrigger; setTimeout(mobileSheetChanged,0); }, true);
    const mobileSheet=$('#alinAccountSheet');
    if(mobileSheet) new MutationObserver(mobileSheetChanged).observe(mobileSheet,{attributes:true,attributeFilter:['hidden']});
    applyTheme(themeMode(), false);
    applyLanguage(language(), false);
  });
})();
