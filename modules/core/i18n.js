// === core/i18n.js ===
/* ALIN v2.3.5 — one language service for every role and page. */
(function(){
  'use strict';

  const STORAGE_KEY='alin_language_v110';
  const SUPPORTED=['ar','ku','en'];
  const LOCALES={ar:'ar-IQ',ku:'ckb-IQ',en:'en-IQ'};
  const HTML_LANG={ar:'ar',ku:'ckb',en:'en'};
  const RTL=new Set(['ar','ku']);

  const en={
    'آلين':'Alin','منصة آلين':'Alin Platform','متجر آلين':'Alin Store','لوحة آلين':'Alin Dashboard','لوحة إدارة آلين':'Alin Administration','منصة آلين للتوصيل':'Alin Delivery','نظام التوصيل':'Delivery system',
    'الرئيسية':'Dashboard','المتجر':'Store','الكتالوج الكامل':'Full catalog','كل المتجر':'Entire store','كل المنتجات':'All products','عرض الكل':'Show all','عروض':'Offers','عرض':'View','عرض اليوم':'Today’s offer','الأكثر طلباً':'Most ordered','وصل حديثاً':'New arrivals','أحدث المواد المضافة':'Recently added items',
    'الحسابات':'Accounts','حسابي':'My account','الحساب الشخصي':'Profile','ملفي':'My profile','الملف الشخصي':'Profile','اسم الدخول':'Username','اسم المستخدم':'Username','الرمز السري':'Password','كلمة المرور':'Password','تأكيد كلمة المرور':'Confirm password','تغيير كلمة المرور':'Change password','الاسم الكامل':'Full name','رقم الهاتف':'Phone number','الهاتف':'Phone','البريد الإلكتروني':'Email','الدور':'Role','الصلاحية':'Permission','الصلاحيات':'Permissions','الحالة':'Status','النشاط':'Activity','سجل النشاط':'Activity log',
    'المدير':'Administrator','الإدارة':'Administration','لوحة المدير':'Admin dashboard','المدرس':'Teacher','المدرسون':'Teachers','لوحة المدرس':'Teacher dashboard','ملف المدرس':'Teacher profile','المكتبة':'Library','المكتبات':'Libraries','لوحة المكتبة':'Library dashboard','لوحة إدارة المكتبة':'Library administration','المندوب':'Courier','المندوبون':'Couriers','صفحة المندوب':'Courier page','المحاسب':'Accountant','الطلبة والمتجر':'Students and store','الجميع':'Everyone',
    'الملازم':'Booklets','ملزمة':'Booklet','ملازمي':'My booklets','رفع ملزمة':'Upload booklet','نشر ملزمة':'Publish booklet','اسم الملزمة':'Booklet name','طلبات النشر':'Publishing requests','طلبات المدرسين':'Teacher requests','المنتجات':'Products','منتج':'Product','إضافة المنتج':'Add product','تفاصيل المنتج':'Product details','الأقسام':'Categories','اسم القسم':'Category name','قرطاسية':'Stationery','هدايا':'Gifts','مادة':'Subject','الصف':'Grade','الفصل':'Chapter','الإصدار':'Edition','غلاف':'Cover','ملف PDF':'PDF file','المخزون':'Stock','حد تنبيه المخزون':'Low-stock threshold','مخزون منخفض':'Low stock','مخزون قليل':'Low stock','متوفر':'Available','نافد':'Out of stock',
    'الطلبات':'Orders','الطلب':'Order','طلب':'Order','طلب جديد':'New order','طلبات جديدة':'New orders','طلبات اليوم':'Today’s orders','طلباتك الحالية':'Your current orders','الطلبات الحالية':'Current orders','الطلبات المكتملة':'Completed orders','طلبات التوصيل':'Delivery orders','طلبات ملغاة':'Cancelled orders','طلب مكتمل':'Completed order','رقم الطلب':'Order number','تفاصيل الطلب':'Order details','تعيين الطلب':'Assign order','تأكيد الطلب الآن':'Confirm order now','تتبع الطلب':'Track order','تتبع حالة الطلب':'Track order status','تتبع الآن':'Track now','طريقة الاستلام والدفع':'Delivery and payment method','استلام من المكتبة':'Pick up from library','توصيل للبيت':'Home delivery','عن طريق المندوب':'By courier','اختيار مكتبة الاستلام':'Choose pickup library','اختر مكتبة الاستلام':'Choose pickup library','اختر منطقة التوصيل':'Choose delivery area','أقرب نقطة دالة':'Nearest landmark','المنطقة':'Area','الموقع':'Location','فتح موقع الطالب':'Open student location','فتح موقع الطالب GPS':'Open student GPS location','اسم الطالب الكامل':'Student full name','الكمية':'Quantity','المجموع الفرعي':'Subtotal','الخصم':'Discount','أجرة التوصيل':'Delivery fee','الإجمالي':'Total','المبلغ':'Amount','طريقة الاستلام':'Fulfilment method','ملاحظات الطالب':'Student notes','ملاحظات الإدارة':'Administration notes','سجل حركة الطلب':'Order history',
    'المالية':'Finance','الأرباح':'Earnings','ربح المنصة':'Platform share','ربح المدرس':'Teacher share','ربح المكتبة':'Library share','ربح المندوب':'Courier share','التسويات':'Settlements','تسوية':'Settlement','تسويات المندوبين':'Courier settlements','ذمم المكتبات':'Library balances','ذمة المكتبة':'Library balance','المبلغ بذمة المكتبة':'Amount due from library','المدفوع':'Paid','المتبقي':'Remaining','الرصيد':'Balance','سند قبض':'Receipt voucher','سندات الدفع':'Payment receipts','طلبات السحب':'Withdrawal requests','التقارير':'Reports','تصدير التقرير':'Export report','مبيعات الشهر':'Monthly sales','مبيعات اليوم':'Today’s sales','سجل العمليات':'Activity log','آخر العمليات المسجلة داخل المنصة.':'Latest operations recorded on the platform.',
    'الإعلانات':'Advertisements','إعلان':'Advertisement','إعلانات منصة آلين':'Alin advertisements','إضافة البنر':'Add banner','الكوبونات':'Coupons','كوبون':'Coupon','إضافة كوبون':'Add coupon','تعديل الكوبون':'Edit coupon','بحث بالكود':'Search by code','أدخل كود الخصم':'Enter coupon code','تطبيق':'Apply','الإشعارات':'Notifications','إشعار':'Notification','إشعار جديد':'New notification','مركز الإشعارات':'Notification center','إرسال الإشعار':'Send notification','اكتب نص الإشعار':'Enter notification text','كل الفئات':'All audiences','مقروء':'Read','غير مقروء':'Unread','جديد':'New','جديداً':'New',
    'الإعدادات':'Settings','الإعدادات العامة':'General settings','عام':'General','التواصل':'Contact','تواصل معنا':'Contact us','عن المنصة':'About the platform','عن منصة آلين':'About Alin','الهوية البصرية':'Brand identity','اللون الأساسي':'Primary color','اللون الثانوي':'Secondary color','الشعار':'Logo','الأيقونة':'Icon','الخلفية':'Background','اللغة':'Language','المظهر':'Appearance','نهاري':'Light','ليلي':'Dark','النظام':'System','الخيارات':'Options','التفضيلات':'Preferences','المساعدة':'Help','النسخ الاحتياطي':'Backup','استعادة':'Restore','صحة النظام':'System health','فحص الربط':'Connection check','حالة الاتصال':'Connection status','تحديث مباشر':'Live update','إعدادات المظهر':'Appearance settings','قوالب جاهزة هادئة':'Calm ready-made themes','اختر قالبًا ثم شاهد المعاينة قبل الحفظ.':'Choose a theme and preview it before saving.','قوالب':'themes','مختار':'Selected','اختيار':'Select','الشعار الأساسي':'Primary logo','شعار الوضع الليلي':'Dark-mode logo','أيقونة التطبيق':'App icon','تخصيص الألوان':'Customize colors','استعادة هوية آلين':'Restore Alin identity','حفظ وتطبيق الهوية':'Save and apply identity','معاينة مباشرة':'Live preview','هذه المعاينة لا تغيّر المنصة إلا بعد الحفظ.':'This preview does not change the platform until you save.','الوضع النهاري والليلي يبقيان مستقلين عن القالب المختار.':'Light and dark appearance remain independent from the selected theme.','تم حفظ وتطبيق الهوية على جميع صفحات المنصة':'The identity was saved and applied to every platform page',
    'إدارة المناطق':'Manage areas','مناطق العمل':'Work areas','مناطق العمل:':'Work areas:','اسم المنطقة الجديدة':'New area name','إجمالي المندوبين':'Total couriers','فعالون':'Active','متاحون':'Available','طلبات جارية':'Active orders','إجمالي الذمم':'Total balances','بيانات حساب المندوب':'Courier account information','حالة توفر المندوب':'Courier availability','حدد كل المناطق التي يعمل بها المندوب.':'Select every area served by the courier.','الطلبات تُطابق حسب منطقة الزبون.':'Orders are matched by the customer’s area.',
    'طلبات جديدة':'New orders','قيد الطباعة':'Printing','جاهزة للتسليم':'Ready for pickup','تسليمات اليوم':'Today’s deliveries','بدء الطباعة':'Start printing','جاهز للتسليم':'Ready for delivery','تم التسليم':'Delivered','استلمه المندوب':'Picked up by courier','بدء التوصيل':'Start delivery','قبول الطلب':'Accept order','استلمت الطلب':'Order picked up','خرج للتوصيل':'Out for delivery','في الطريق':'On the way',
    'الرئيسية':'Dashboard','الطلبات الحالية':'Current orders','المالية':'Finance','الإشعارات':'Notifications','الحساب الشخصي':'Profile',
    'إضافة':'Add','تعديل':'Edit','حذف':'Delete','إلغاء':'Cancel','إغلاق':'Close','فتح':'Open','إظهار':'Show','إخفاء':'Hide','تشغيل':'Enable','إيقاف':'Disable','نشر':'Publish','أرشفة':'Archive','طباعة':'Print','حفظ':'Save','حفظ التعديل':'Save changes','حفظ الإعدادات':'Save settings','حفظ الإعدادات العامة':'Save general settings','حفظ نسب الأرباح':'Save profit shares','حفظ التعيين':'Save assignment','إرسال':'Send','إرسال للإدارة':'Send to administration','إعادة الإرسال':'Resubmit','تحديث':'Refresh','بحث':'Search','فلترة':'Filter','مسح':'Clear','رجوع':'Back','التالي':'Next','السابق':'Previous','التفاصيل':'Details','معاينة':'Preview','نسخ':'Copy','واتساب':'WhatsApp','اتصال هاتفي':'Phone call','خروج':'Sign out','دخول':'Sign in','تسجيل الدخول':'Sign in','تسجيل الخروج':'Sign out','إنشاء حساب':'Create account','حذف الحساب':'Delete account','تعديل كامل':'Full edit','ربط وحفظ':'Link and save','تأكيد':'Confirm','تأكيد العملية':'Confirm action','إجراءات سريعة':'Quick actions','عوامل التصفية':'Filters','إغلاق لوحة الفلاتر':'Close filters panel','إزالة فلتر':'Remove filter',
    'الكل':'All','كل الحالات':'All statuses','كل المواد':'All subjects','كل المراحل':'All grades','كل الفئات':'All categories','كل المنتجات':'All products','الأحدث':'Newest','الأقدم أولاً':'Oldest first','حسب مرحلتي':'For my grade','بحث بالاسم أو القسم':'Search by name or category','ابحث باسم الحساب':'Search account name','البحث في المتجر':'Search the store','اكتب اسم الملزمة':'Enter booklet name','اكتب رقم الهاتف.':'Enter the phone number.','اكتب سبب الإلغاء':'Enter cancellation reason','اكتب الملاحظة أولاً':'Enter the note first','اكتب رأيك':'Write your review','وصف مختصر وواضح':'A short, clear description','ملاحظة إدارية':'Administration note','بدون اسم':'Unnamed','بدون عنوان':'Untitled','بدون مادة':'No subject','بدون صف':'No grade','بدون رقم':'No number','غير محدد':'Not specified','غير محددة':'Not specified','غير معيّن':'Unassigned','لا توجد':'None','لا توجد بيانات كافية':'Not enough data','لا توجد صورة':'No image','لا توجد إشعارات جديدة':'No new notifications','لا توجد تنبيهات مخزون':'No stock alerts','لا توجد ملازم مطابقة.':'No matching booklets.',
    'فعال':'Active','غير فعال':'Inactive','نشط':'Active','موقوف':'Suspended','متاح':'Available','مشغول':'Busy','غير متصل':'Offline','متصل':'Connected','مفتوح':'Open','مفتوح الآن':'Open now','مغلق':'Closed','مغلق حالياً':'Currently closed','ظاهر':'Visible','مخفي':'Hidden','منشور':'Published','منشورة':'Published','مؤرشف':'Archived','مؤرشفة':'Archived','مسودة':'Draft','جديد':'New','قيد الانتظار':'Pending','قيد المراجعة':'Under review','قيد التجهيز':'Processing','قيد التنفيذ':'In progress','قيد التوصيل':'Out for delivery','قيد الطباعة':'Printing','جاهز':'Ready','مكتمل':'Completed','تم الإرسال':'Sent','تمت الموافقة':'Approved','مقبول':'Accepted','مرفوض':'Rejected','مرفوضة':'Rejected','ملغي':'Cancelled','ملغاة':'Cancelled','مدفوع':'Paid','بانتظار الدفع':'Awaiting payment','بانتظار القبول':'Awaiting acceptance','بانتظار الإدارة':'Awaiting administration','بانتظار التأكيد':'Awaiting confirmation','بانتظار التعيين':'Awaiting assignment','بانتظار المراجعة':'Awaiting review','مطلوب تعديل':'Changes requested','جاهزة للنشر':'Ready to publish','محول للمندوب':'Assigned to courier','مقبول من المندوب':'Accepted by courier',
    'السلة':'Cart','المفضلة':'Favorites','السلة فارغة':'Your cart is empty','إغلاق السلة':'Close cart','تمت الإضافة إلى السلة':'Added to cart','زيادة الكمية':'Increase quantity','تقليل الكمية':'Decrease quantity','إضافة إلى السلة':'Add to cart','حفظ بالمفضلة':'Save to favorites','إزالة من المفضلة':'Remove from favorites','تمت الإضافة إلى المفضلة':'Added to favorites','تمت الإزالة من المفضلة':'Removed from favorites','مفضلتك جاهزة لاختياراتك':'Your favorites are ready','تصفح المنتجات':'Browse products','أبلغني عند التوفر':'Notify me when available','تم تسجيل طلب التنبيه.':'Availability alert registered.','المنتج نافد':'Product is out of stock','الكمية غير متوفرة':'Requested quantity is unavailable',
    'تم الحفظ':'Saved','تم حفظ التعديل':'Changes saved','تم حفظ الإعدادات بنجاح':'Settings saved successfully','تم إنشاء الحساب':'Account created','تم حذف الحساب':'Account deleted','تم تسجيل الدخول':'Signed in','تم تسجيل الخروج':'Signed out','تم تغيير اللغة':'Language changed','تم تغيير المظهر':'Appearance changed','تم تحديد الموقع':'Location selected','تم إنشاء الطلب بنجاح':'Order created successfully','تم تحديث حالة الطلب':'Order status updated','تم تحويل الطلب للمندوب':'Order assigned to courier','تم استلام الطلب':'Order accepted','تم تسجيل تسليم الطلب':'Delivery recorded','تم حذف المنتج':'Product deleted','تم تعديل المنتج':'Product updated','تم إخفاء المنتج':'Product hidden','تم إظهار المنتج':'Product shown','تم حذف الملزمة':'Booklet deleted','تم تحديث الملزمة':'Booklet updated','تم حذف الكوبون':'Coupon deleted','تم تطبيق كوبون':'Coupon applied','تم تحديث الإشعارات':'Notifications updated','تم النسخ':'Copied','جاري الحفظ...':'Saving…','جارٍ الحفظ...':'Saving…','جاري الإرسال...':'Sending…','جارٍ إرسال الطلب...':'Sending order…','جاري إنشاء الطلب...':'Creating order…','جاري تحميل البيانات':'Loading data…','جاري ربط البيانات':'Connecting data…','جاري تحديد الموقع...':'Locating…','جاري تجهيز الطباعة...':'Preparing print…','جاري تجهيز صفحة المدرس...':'Preparing teacher page…','جارٍ فتح منصة آلين...':'Opening Alin…','العملية قيد التنفيذ':'Operation in progress',
    'فشل':'Failed','خطأ غير معروف':'Unknown error','تعذر تنفيذ العملية':'Could not complete the operation','تعذر الاتصال بخدمة المنصة':'Could not connect to the platform service','تعذر تحميل Supabase':'Could not load Supabase','خدمة البيانات غير جاهزة':'Data service is not ready','خدمة الإشعارات غير جاهزة':'Notification service is not ready','الحساب غير موجود':'Account not found','الطلب غير موجود':'Order not found','المادة غير موجودة':'Item not found','الملزمة غير موجودة':'Booklet not found','المجموعة غير موجودة':'Group not found','لا يوجد رقم هاتف':'No phone number','لم يتم الفحص بعد':'Not checked yet','لم يتم اختيار ملف.':'No file selected.','المتصفح لا يدعم GPS':'This browser does not support GPS','لم يتم السماح بالموقع':'Location permission was not granted','سبب الإلغاء مطلوب':'Cancellation reason is required','سجل دخول أولاً':'Please sign in first','اختر مندوباً أولاً':'Choose a courier first','اختر ملف Word بصيغة DOCX':'Choose a DOCX Word file','ملف PDF غير متاح':'PDF file is unavailable','خارج الخدمة':'Out of service','إذن النسخ منتهي':'Copy permit expired','انتهت الجلسة لعدم النشاط':'Session ended due to inactivity',
    'د.ع':'IQD','بالدينار العراقي':'In Iraqi dinars','نقدي':'Cash','الدفع عند الاستلام':'Pay on pickup','الدفع للمندوب':'Pay the courier',
    'منصة الطالب':'Student platform','بوابات الشركاء:':'Partner portals:','مدرس معتمد':'Verified teacher','كل ما تحتاجه للدراسة':'Everything you need to study','بمكان واحد':'in one place','تصفح المتجر':'Browse store','خصومات وعروض حصرية':'Exclusive offers and discounts','جميع المواد والمراحل':'All subjects and grades','أدوات الدراسة والكتب':'Study tools and books','هدايا راقية ومميزة':'Premium thoughtful gifts','ملازم • قرطاسية • هدايا':'Booklets • Stationery • Gifts','تصاميم • ملازم • قرطاسية':'Designs • Booklets • Stationery','منصة آلين تجمع الملازم والقرطاسية والهدايا في مكان واحد.':'Alin brings booklets, stationery and gifts together in one place.','للاستفسار والدعم':'For inquiries and support'
  };

  const ku={
    'آلين':'ئالین','منصة آلين':'پلاتفۆرمی ئالین','متجر آلين':'فرۆشگای ئالین','لوحة آلين':'داشبۆردی ئالین','لوحة إدارة آلين':'بەڕێوەبردنی ئالین','منصة آلين للتوصيل':'گەیاندنی ئالین','نظام التوصيل':'سیستەمی گەیاندن',
    'الرئيسية':'سەرەکی','المتجر':'فرۆشگا','الكتالوج الكامل':'کەتەلۆگی تەواو','كل المتجر':'هەموو فرۆشگا','كل المنتجات':'هەموو بەرهەمەکان','عرض الكل':'هەمووی پیشان بدە','عروض':'ئۆفەرەکان','عرض':'پیشاندان','عرض اليوم':'ئۆفەری ئەمڕۆ','الأكثر طلباً':'زۆرترین داواکراو','وصل حديثاً':'نوێترین','أحدث المواد المضافة':'نوێترین کاڵاکان',
    'الحسابات':'هەژمارەکان','حسابي':'هەژمارەکەم','الحساب الشخصي':'هەژماری کەسی','ملفي':'پڕۆفایلەکەم','الملف الشخصي':'پڕۆفایل','اسم الدخول':'ناوی بەکارهێنەر','اسم المستخدم':'ناوی بەکارهێنەر','الرمز السري':'وشەی نهێنی','كلمة المرور':'وشەی نهێنی','تأكيد كلمة المرور':'دووپاتکردنەوەی وشەی نهێنی','تغيير كلمة المرور':'گۆڕینی وشەی نهێنی','الاسم الكامل':'ناوی تەواو','رقم الهاتف':'ژمارەی مۆبایل','الهاتف':'مۆبایل','البريد الإلكتروني':'ئیمەیڵ','الدور':'ڕۆڵ','الصلاحية':'دەسەڵات','الصلاحيات':'دەسەڵاتەکان','الحالة':'دۆخ','النشاط':'چالاکی','سجل النشاط':'تۆماری چالاکی',
    'المدير':'بەڕێوەبەر','الإدارة':'بەڕێوەبەرایەتی','لوحة المدير':'داشبۆردی بەڕێوەبەر','المدرس':'مامۆستا','المدرسون':'مامۆستایان','لوحة المدرس':'داشبۆردی مامۆستا','ملف المدرس':'پڕۆفایلی مامۆستا','المكتبة':'کتێبخانە','المكتبات':'کتێبخانەکان','لوحة المكتبة':'داشبۆردی کتێبخانە','لوحة إدارة المكتبة':'بەڕێوەبردنی کتێبخانە','المندوب':'گەیەنەر','المندوبون':'گەیەنەرەکان','صفحة المندوب':'پەڕەی گەیەنەر','المحاسب':'ژمێریار','الطلبة والمتجر':'خوێندکاران و فرۆشگا','الجميع':'هەمووان',
    'الملازم':'ملزمەکان','ملزمة':'ملزمە','ملازمي':'ملزمەکانم','رفع ملزمة':'بارکردنی ملزمە','نشر ملزمة':'بڵاوکردنەوەی ملزمە','اسم الملزمة':'ناوی ملزمە','طلبات النشر':'داواکارییەکانی بڵاوکردنەوە','طلبات المدرسين':'داواکارییەکانی مامۆستا','المنتجات':'بەرهەمەکان','منتج':'بەرهەم','إضافة المنتج':'زیادکردنی بەرهەم','تفاصيل المنتج':'وردەکاریی بەرهەم','الأقسام':'بەشەکان','اسم القسم':'ناوی بەش','قرطاسية':'کەرەستەی خوێندن','هدايا':'دیارییەکان','مادة':'وانە','الصف':'پۆل','الفصل':'بەش','الإصدار':'وەشان','غلاف':'بەرگ','ملف PDF':'فایلی PDF','المخزون':'کۆگا','حد تنبيه المخزون':'سنووری ئاگاداری کۆگا','مخزون منخفض':'کۆگای کەم','مخزون قليل':'کۆگای کەم','متوفر':'بەردەست','نافد':'تەواوبووە',
    'الطلبات':'داواکارییەکان','الطلب':'داواکاری','طلب':'داواکاری','طلب جديد':'داواکاریی نوێ','طلبات جديدة':'داواکارییە نوێکان','طلبات اليوم':'داواکارییەکانی ئەمڕۆ','طلباتك الحالية':'داواکارییە ئێستاکانت','الطلبات الحالية':'داواکارییە ئێستاکان','الطلبات المكتملة':'داواکارییە تەواوبووەکان','طلبات التوصيل':'داواکارییەکانی گەیاندن','طلبات ملغاة':'داواکارییە هەڵوەشاوەکان','طلب مكتمل':'داواکاریی تەواو','رقم الطلب':'ژمارەی داواکاری','تفاصيل الطلب':'وردەکاریی داواکاری','تعيين الطلب':'دیاریکردنی داواکاری','تأكيد الطلب الآن':'ئێستا داواکارییەکە پشتڕاست بکە','تتبع الطلب':'بەدواداچوونی داواکاری','تتبع حالة الطلب':'بەدواداچوونی دۆخی داواکاری','تتبع الآن':'ئێستا بەدواداچوون بکە','طريقة الاستلام والدفع':'شێوازی وەرگرتن و پارەدان','استلام من المكتبة':'وەرگرتن لە کتێبخانە','توصيل للبيت':'گەیاندن بۆ ماڵ','عن طريق المندوب':'لە ڕێگەی گەیەنەر','اختيار مكتبة الاستلام':'کتێبخانەی وەرگرتن هەڵبژێرە','اختر مكتبة الاستلام':'کتێبخانەی وەرگرتن هەڵبژێرە','اختر منطقة التوصيل':'ناوچەی گەیاندن هەڵبژێرە','أقرب نقطة دالة':'نزیکترین خاڵی ناسراو','المنطقة':'ناوچە','الموقع':'شوێن','فتح موقع الطالب':'کردنەوەی شوێنی خوێندکار','فتح موقع الطالب GPS':'کردنەوەی GPSی خوێندکار','اسم الطالب الكامل':'ناوی تەواوی خوێندکار','الكمية':'بڕ','المجموع الفرعي':'کۆی سەرەتایی','الخصم':'داشکاندن','أجرة التوصيل':'کرێی گەیاندن','الإجمالي':'کۆی گشتی','المبلغ':'بڕی پارە','طريقة الاستلام':'شێوازی وەرگرتن','ملاحظات الطالب':'تێبینییەکانی خوێندکار','ملاحظات الإدارة':'تێبینییەکانی بەڕێوەبەرایەتی','سجل حركة الطلب':'مێژووی داواکاری',
    'المالية':'دارایی','الأرباح':'قازانج','ربح المنصة':'قازانجی پلاتفۆرم','ربح المدرس':'قازانجی مامۆستا','ربح المكتبة':'قازانجی کتێبخانە','ربح المندوب':'قازانجی گەیەنەر','التسويات':'پاککردنەوەی حساب','تسوية':'پاککردنەوەی حساب','تسويات المندوبين':'پاککردنەوەی حسابی گەیەنەران','ذمم المكتبات':'قەرزی کتێبخانەکان','ذمة المكتبة':'قەرزی کتێبخانە','المبلغ بذمة المكتبة':'بڕی لەسەر کتێبخانە','المدفوع':'پارەدراو','المتبقي':'ماوە','الرصيد':'باڵانس','سند قبض':'بەڵگەی وەرگرتن','سندات الدفع':'بەڵگەکانی پارەدان','طلبات السحب':'داواکارییەکانی ڕاکێشان','التقارير':'ڕاپۆرتەکان','تصدير التقرير':'هەناردەکردنی ڕاپۆرت','مبيعات الشهر':'فرۆشی مانگ','مبيعات اليوم':'فرۆشی ئەمڕۆ','سجل العمليات':'تۆماری کردارەکان','آخر العمليات المسجلة داخل المنصة.':'دوایین کردارە تۆمارکراوەکانی پلاتفۆرم.',
    'الإعلانات':'ڕیکلامەکان','إعلان':'ڕیکلام','إعلانات منصة آلين':'ڕیکلامەکانی ئالین','إضافة البنر':'زیادکردنی بانەر','الكوبونات':'کوپۆنەکان','كوبون':'کوپۆن','إضافة كوبون':'زیادکردنی کوپۆن','تعديل الكوبون':'دەستکاریکردنی کوپۆن','بحث بالكود':'گەڕان بە کۆد','أدخل كود الخصم':'کۆدی داشکاندن بنووسە','تطبيق':'جێبەجێکردن','الإشعارات':'ئاگادارکردنەوەکان','إشعار':'ئاگادارکردنەوە','إشعار جديد':'ئاگادارکردنەوەی نوێ','مركز الإشعارات':'ناوەندی ئاگادارکردنەوە','إرسال الإشعار':'ناردنی ئاگادارکردنەوە','اكتب نص الإشعار':'دەقی ئاگادارکردنەوە بنووسە','كل الفئات':'هەموو گرووپەکان','مقروء':'خوێندراوە','غير مقروء':'نەخوێندراوە','جديد':'نوێ',
    'الإعدادات':'ڕێکخستنەکان','الإعدادات العامة':'ڕێکخستنە گشتییەکان','عام':'گشتی','التواصل':'پەیوەندی','تواصل معنا':'پەیوەندیمان پێوە بکە','عن المنصة':'دەربارەی پلاتفۆرم','عن منصة آلين':'دەربارەی ئالین','الهوية البصرية':'ناسنامەی بینراو','اللون الأساسي':'ڕەنگی سەرەکی','اللون الثانوي':'ڕەنگی لاوەکی','الشعار':'لۆگۆ','الأيقونة':'ئایکۆن','الخلفية':'پاشبنەما','اللغة':'زمان','المظهر':'ڕووکار','نهاري':'ڕووناک','ليلي':'تاریک','النظام':'سیستەم','الخيارات':'هەڵبژاردەکان','التفضيلات':'هەڵبژاردەکان','المساعدة':'یارمەتی','النسخ الاحتياطي':'پاڵپشتی','استعادة':'گەڕاندنەوە','صحة النظام':'تەندروستی سیستەم','فحص الربط':'پشکنینی پەیوەندی','حالة الاتصال':'دۆخی پەیوەندی','تحديث مباشر':'نوێکردنەوەی ڕاستەوخۆ','إعدادات المظهر':'ڕێکخستنەکانی ڕووکار','قوالب جاهزة هادئة':'ڕووکارە ئامادە و ئارامەکان','اختر قالبًا ثم شاهد المعاينة قبل الحفظ.':'ڕووکارێک هەڵبژێرە و پێش پاشەکەوتکردن پێشبینینی بکە.','قوالب':'ڕووکار','مختار':'هەڵبژێردراو','اختيار':'هەڵبژاردن','الشعار الأساسي':'لۆگۆی سەرەکی','شعار الوضع الليلي':'لۆگۆی دۆخی تاریک','أيقونة التطبيق':'ئایکۆنی ئەپ','تخصيص الألوان':'دەستکاریکردنی ڕەنگەکان','استعادة هوية آلين':'گەڕاندنەوەی ناسنامەی ئالین','حفظ وتطبيق الهوية':'پاشەکەوت و جێبەجێکردنی ناسنامە','معاينة مباشرة':'پێشبینینی ڕاستەوخۆ','هذه المعاينة لا تغيّر المنصة إلا بعد الحفظ.':'ئەم پێشبینینە پلاتفۆرم ناگۆڕێت تا پاشەکەوت نەکرێت.','الوضع النهاري والليلي يبقيان مستقلين عن القالب المختار.':'دۆخی ڕووناک و تاریک لە ڕووکاری هەڵبژێردراو سەربەخۆ دەبن.','تم حفظ وتطبيق الهوية على جميع صفحات المنصة':'ناسنامە پاشەکەوت و لە هەموو پەڕەکان جێبەجێ کرا',
    'إدارة المناطق':'بەڕێوەبردنی ناوچەکان','مناطق العمل':'ناوچەکانی کار','مناطق العمل:':'ناوچەکانی کار:','اسم المنطقة الجديدة':'ناوی ناوچەی نوێ','إجمالي المندوبين':'کۆی گەیەنەران','فعالون':'چالاک','متاحون':'بەردەست','طلبات جارية':'داواکارییە بەردەوامەکان','إجمالي الذمم':'کۆی قەرزەکان','بيانات حساب المندوب':'زانیاری هەژماری گەیەنەر','حالة توفر المندوب':'دۆخی بەردەستبوونی گەیەنەر','حدد كل المناطق التي يعمل بها المندوب.':'هەموو ناوچەکانی کاری گەیەنەر دیاری بکە.','الطلبات تُطابق حسب منطقة الزبون.':'داواکارییەکان بەپێی ناوچەی کڕیار دەگونجێندرێن.',
    'قيد الطباعة':'لە چاپکردندایە','جاهزة للتسليم':'ئامادەی وەرگرتن','تسليمات اليوم':'گەیاندنەکانی ئەمڕۆ','بدء الطباعة':'دەستپێکردنی چاپ','جاهز للتسليم':'ئامادەی گەیاندن','تم التسليم':'گەیەندرا','استلمه المندوب':'گەیەنەر وەریگرت','بدء التوصيل':'دەستپێکردنی گەیاندن','قبول الطلب':'پەسەندکردنی داواکاری','استلمت الطلب':'داواکاری وەرگیرا','خرج للتوصيل':'چووە بۆ گەیاندن','في الطريق':'لە ڕێگادایە',
    'إضافة':'زیادکردن','تعديل':'دەستکاری','حذف':'سڕینەوە','إلغاء':'هەڵوەشاندنەوە','إغلاق':'داخستن','فتح':'کردنەوە','إظهار':'پیشاندان','إخفاء':'شاردنەوە','تشغيل':'چالاککردن','إيقاف':'وەستاندن','نشر':'بڵاوکردنەوە','أرشفة':'ئەرشیفکردن','طباعة':'چاپ','حفظ':'پاشەکەوتکردن','حفظ التعديل':'پاشەکەوتکردنی دەستکاری','حفظ الإعدادات':'پاشەکەوتکردنی ڕێکخستنەکان','حفظ الإعدادات العامة':'پاشەکەوتکردنی ڕێکخستنە گشتییەکان','حفظ نسب الأرباح':'پاشەکەوتکردنی ڕێژەی قازانج','حفظ التعيين':'پاشەکەوتکردنی دیاریکردن','إرسال':'ناردن','إرسال للإدارة':'ناردن بۆ بەڕێوەبەرایەتی','إعادة الإرسال':'دووبارە ناردن','تحديث':'نوێکردنەوە','بحث':'گەڕان','فلترة':'پاڵاوتن','مسح':'سڕینەوە','رجوع':'گەڕانەوە','التالي':'دواتر','السابق':'پێشتر','التفاصيل':'وردەکاری','معاينة':'پێشبینین','نسخ':'کۆپیکردن','واتساب':'واتساپ','اتصال هاتفي':'پەیوەندی تەلەفۆنی','خروج':'دەرچوون','دخول':'چوونەژوورەوە','تسجيل الدخول':'چوونەژوورەوە','تسجيل الخروج':'دەرچوون','إنشاء حساب':'دروستکردنی هەژمار','حذف الحساب':'سڕینەوەی هەژمار','تعديل كامل':'دەستکاریی تەواو','ربط وحفظ':'بەستنەوە و پاشەکەوتکردن','تأكيد':'پشتڕاستکردنەوە','تأكيد العملية':'پشتڕاستکردنەوەی کردار','إجراءات سريعة':'کردارە خێراکان','عوامل التصفية':'پاڵاوتەکان','إغلاق لوحة الفلاتر':'داخستنی پاڵاوتەکان','إزالة فلتر':'لابردنی پاڵاوتن',
    'الكل':'هەموو','كل الحالات':'هەموو دۆخەکان','كل المواد':'هەموو وانەکان','كل المراحل':'هەموو قۆناغەکان','كل الفئات':'هەموو پۆلەکان','الأحدث':'نوێترین','الأقدم أولاً':'کۆنترین یەکەم','حسب مرحلتي':'بەپێی قۆناغەکەم','بحث بالاسم أو القسم':'گەڕان بە ناو یان بەش','ابحث باسم الحساب':'گەڕان بە ناوی هەژمار','البحث في المتجر':'گەڕان لە فرۆشگا','اكتب اسم الملزمة':'ناوی ملزمە بنووسە','اكتب رقم الهاتف.':'ژمارەی مۆبایل بنووسە.','اكتب سبب الإلغاء':'هۆکاری هەڵوەشاندنەوە بنووسە','اكتب الملاحظة أولاً':'سەرەتا تێبینی بنووسە','اكتب رأيك':'ڕای خۆت بنووسە','وصف مختصر وواضح':'وەسفێکی کورت و ڕوون','ملاحظة إدارية':'تێبینی بەڕێوەبەرایەتی','بدون اسم':'بێ ناو','بدون عنوان':'بێ ناونیشان','بدون مادة':'بێ وانە','بدون صف':'بێ پۆل','بدون رقم':'بێ ژمارە','غير محدد':'دیاری نەکراوە','غير محددة':'دیاری نەکراوە','غير معيّن':'دیاری نەکراوە','لا توجد':'نییە','لا توجد بيانات كافية':'زانیاری پێویست نییە','لا توجد صورة':'وێنە نییە','لا توجد إشعارات جديدة':'ئاگادارکردنەوەی نوێ نییە','لا توجد تنبيهات مخزون':'ئاگاداری کۆگا نییە','لا توجد ملازم مطابقة.':'ملزمەی گونجاو نییە.',
    'فعال':'چالاک','غير فعال':'ناچالاک','نشط':'چالاک','موقوف':'ڕاگیراو','متاح':'بەردەست','مشغول':'سەرقاڵ','غير متصل':'دەرەوەی هێڵ','متصل':'پەیوەست','مفتوح':'کراوە','مفتوح الآن':'ئێستا کراوەیە','مغلق':'داخراو','مغلق حالياً':'ئێستا داخراوە','ظاهر':'دیار','مخفي':'شاردراوە','منشور':'بڵاوکراوەتەوە','منشورة':'بڵاوکراوەتەوە','مؤرشف':'ئەرشیفکراو','مؤرشفة':'ئەرشیفکراو','مسودة':'ڕەشنووس','قيد الانتظار':'چاوەڕوان','قيد المراجعة':'لە پێداچوونەوەدایە','قيد التجهيز':'لە ئامادەکردندایە','قيد التنفيذ':'لە جێبەجێکردندایە','قيد التوصيل':'لە گەیاندندایە','جاهز':'ئامادە','مكتمل':'تەواو','تم الإرسال':'نێردرا','تمت الموافقة':'پەسەندکرا','مقبول':'پەسەندکراو','مرفوض':'ڕەتکراوە','مرفوضة':'ڕەتکراوە','ملغي':'هەڵوەشاوە','ملغاة':'هەڵوەشاوە','مدفوع':'پارەدراو','بانتظار الدفع':'چاوەڕوانی پارەدان','بانتظار القبول':'چاوەڕوانی پەسەندکردن','بانتظار الإدارة':'چاوەڕوانی بەڕێوەبەرایەتی','بانتظار التأكيد':'چاوەڕوانی پشتڕاستکردنەوە','بانتظار التعيين':'چاوەڕوانی دیاریکردن','بانتظار المراجعة':'چاوەڕوانی پێداچوونەوە','مطلوب تعديل':'دەستکاری پێویستە','جاهزة للنشر':'ئامادەی بڵاوکردنەوە','محول للمندوب':'سپێردراوە بە گەیەنەر','مقبول من المندوب':'لە لایەن گەیەنەر پەسەندکرا',
    'السلة':'سەبەتە','المفضلة':'دڵخوازەکان','السلة فارغة':'سەبەتە بەتاڵە','إغلاق السلة':'داخستنی سەبەتە','تمت الإضافة إلى السلة':'زیادکرا بۆ سەبەتە','زيادة الكمية':'زیادکردنی بڕ','تقليل الكمية':'کەمکردنەوەی بڕ','إضافة إلى السلة':'زیادکردن بۆ سەبەتە','حفظ بالمفضلة':'پاشەکەوتکردن لە دڵخوازەکان','إزالة من المفضلة':'لابردن لە دڵخوازەکان','تمت الإضافة إلى المفضلة':'زیادکرا بۆ دڵخوازەکان','تمت الإزالة من المفضلة':'لابرا لە دڵخوازەکان','مفضلتك جاهزة لاختياراتك':'دڵخوازەکانت ئامادەن','تصفح المنتجات':'گەڕان بە بەرهەمەکان','أبلغني عند التوفر':'کاتێک بەردەست بوو ئاگادارم بکە','تم تسجيل طلب التنبيه.':'داواکاریی ئاگادارکردنەوە تۆمارکرا.','المنتج نافد':'بەرهەم تەواوبووە','الكمية غير متوفرة':'بڕی داواکراو بەردەست نییە',
    'تم الحفظ':'پاشەکەوتکرا','تم حفظ التعديل':'دەستکارییەکان پاشەکەوتکران','تم حفظ الإعدادات بنجاح':'ڕێکخستنەکان بە سەرکەوتوویی پاشەکەوتکران','تم إنشاء الحساب':'هەژمار دروستکرا','تم حذف الحساب':'هەژمار سڕایەوە','تم تسجيل الدخول':'چوونەژوورەوە سەرکەوتوو بوو','تم تسجيل الخروج':'دەرچوون سەرکەوتوو بوو','تم تغيير اللغة':'زمان گۆڕدرا','تم تغيير المظهر':'ڕووکار گۆڕدرا','تم تحديد الموقع':'شوێن دیاریکرا','تم إنشاء الطلب بنجاح':'داواکاری بە سەرکەوتوویی دروستکرا','تم تحديث حالة الطلب':'دۆخی داواکاری نوێکرایەوە','تم تحويل الطلب للمندوب':'داواکاری سپێردرا بە گەیەنەر','تم استلام الطلب':'داواکاری وەرگیرا','تم تسجيل تسليم الطلب':'گەیاندنی داواکاری تۆمارکرا','تم حذف المنتج':'بەرهەم سڕایەوە','تم تعديل المنتج':'بەرهەم نوێکرایەوە','تم إخفاء المنتج':'بەرهەم شاردراوە','تم إظهار المنتج':'بەرهەم پیشاندرا','تم حذف الملزمة':'ملزمە سڕایەوە','تم تحديث الملزمة':'ملزمە نوێکرایەوە','تم حذف الكوبون':'کوپۆن سڕایەوە','تم تطبيق كوبون':'کوپۆن جێبەجێکرا','تم تحديث الإشعارات':'ئاگادارکردنەوەکان نوێکرانەوە','تم النسخ':'کۆپیکرا','جاري الحفظ...':'لە پاشەکەوتکردندایە…','جارٍ الحفظ...':'لە پاشەکەوتکردندایە…','جاري الإرسال...':'لە ناردندایە…','جارٍ إرسال الطلب...':'داواکاری دەنێردرێت…','جاري إنشاء الطلب...':'داواکاری دروست دەکرێت…','جاري تحميل البيانات':'داتا بار دەکرێت…','جاري ربط البيانات':'داتا پەیوەست دەکرێت…','جاري تحديد الموقع...':'شوێن دیاری دەکرێت…','جاري تجهيز الطباعة...':'چاپ ئامادە دەکرێت…','جاري تجهيز صفحة المدرس...':'پەڕەی مامۆستا ئامادە دەکرێت…','جارٍ فتح منصة آلين...':'پلاتفۆرمی ئالین دەکرێتەوە…','العملية قيد التنفيذ':'کردارەکە لە جێبەجێکردندایە',
    'فشل':'شکست','خطأ غير معروف':'هەڵەی نەناسراو','تعذر تنفيذ العملية':'کردارەکە جێبەجێ نەکرا','تعذر الاتصال بخدمة المنصة':'پەیوەندی بە خزمەتگوزاری پلاتفۆرم نەکرا','تعذر تحميل Supabase':'Supabase بار نەکرا','خدمة البيانات غير جاهزة':'خزمەتگوزاری داتا ئامادە نییە','خدمة الإشعارات غير جاهزة':'خزمەتگوزاری ئاگادارکردنەوە ئامادە نییە','الحساب غير موجود':'هەژمار نەدۆزرایەوە','الطلب غير موجود':'داواکاری نەدۆزرایەوە','المادة غير موجودة':'کاڵا نەدۆزرایەوە','الملزمة غير موجودة':'ملزمە نەدۆزرایەوە','المجموعة غير موجودة':'گرووپ نەدۆزرایەوە','لا يوجد رقم هاتف':'ژمارەی مۆبایل نییە','لم يتم الفحص بعد':'هێشتا پشکنین نەکراوە','لم يتم اختيار ملف.':'فایل هەڵنەبژێردراوە.','المتصفح لا يدعم GPS':'وێبگەڕ GPS پشتگیری ناکات','لم يتم السماح بالموقع':'ڕێگە بە شوێن نەدرا','سبب الإلغاء مطلوب':'هۆکاری هەڵوەشاندنەوە پێویستە','سجل دخول أولاً':'سەرەتا بچۆ ژوورەوە','اختر مندوباً أولاً':'سەرەتا گەیەنەر هەڵبژێرە','اختر ملف Word بصيغة DOCX':'فایلی Word بە DOCX هەڵبژێرە','ملف PDF غير متاح':'فایلی PDF بەردەست نییە','خارج الخدمة':'لە خزمەتدا نییە','إذن النسخ منتهي':'مۆڵەتی کۆپی تەواوبووە','انتهت الجلسة لعدم النشاط':'دانیشتن بەهۆی ناچالاکی کۆتایی هات',
    'د.ع':'د.ع','بالدينار العراقي':'بە دیناری عێراقی','نقدي':'نەقد','الدفع عند الاستلام':'پارەدان لە کاتی وەرگرتن','الدفع للمندوب':'پارەدان بە گەیەنەر',
    'منصة الطالب':'پلاتفۆرمی خوێندکار','بوابات الشركاء:':'دەروازەی هاوبەشەکان:','مدرس معتمد':'مامۆستای پەسەندکراو','كل ما تحتاجه للدراسة':'هەموو ئەوەی بۆ خوێندن پێویستتە','بمكان واحد':'لە یەک شوێن','تصفح المتجر':'گەڕان بە فرۆشگا','خصومات وعروض حصرية':'داشکاندن و ئۆفەری تایبەت','جميع المواد والمراحل':'هەموو وانە و قۆناغەکان','أدوات الدراسة والكتب':'کەرەستە و کتێب','هدايا راقية ومميزة':'دیاری تایبەت و جوان','ملازم • قرطاسية • هدايا':'ملزمە • کەرەستەی خوێندن • دیاری','تصاميم • ملازم • قرطاسية':'دیزاین • ملزمە • کەرەستەی خوێندن','منصة آلين تجمع الملازم والقرطاسية والهدايا في مكان واحد.':'ئالین ملزمە و کەرەستەی خوێندن و دیاری لە یەک شوێن کۆدەکاتەوە.','للاستفسار والدعم':'بۆ پرسیار و پشتگیری'
  };

  const dictionaries={ar:{},ku,en};
  const reverse={en:new Map(),ku:new Map()};
  for(const lang of ['en','ku'])for(const [ar,value] of Object.entries(dictionaries[lang]))if(value)reverse[lang].set(value,ar);
  const textState=new WeakMap();
  const attrState=new WeakMap();
  let applying=false;
  let observer=null;

  function normalizeLanguage(value){return SUPPORTED.includes(value)?value:'ar'}
  function current(){try{return normalizeLanguage(localStorage.getItem(STORAGE_KEY)||'ar')}catch(_){return'ar'}}
  function locale(code=current()){return LOCALES[normalizeLanguage(code)]}
  function direction(code=current()){return RTL.has(normalizeLanguage(code))?'rtl':'ltr'}

  function canonicalExact(value){
    if(en[value]||ku[value])return value;
    for(const lang of ['en','ku'])if(reverse[lang].has(value))return reverse[lang].get(value);
    return value;
  }

  function translateExact(value,lang){
    const canonical=canonicalExact(value);
    if(lang==='ar')return canonical;
    return dictionaries[lang][canonical]||value;
  }

  const partialKeys=Object.keys(en).filter(key=>key.includes(' ')||/[.:،•]/.test(key)).sort((a,b)=>b.length-a.length);
  function replaceKnownPhrases(value,lang){
    let output=String(value);
    if(lang==='ar'){
      for(const sourceLang of ['en','ku']){
        const entries=[...reverse[sourceLang].entries()].filter(([key])=>key.includes(' ')||/[.:،•]/.test(key)).sort((a,b)=>b[0].length-a[0].length);
        for(const [translated,arabic] of entries)if(output.includes(translated))output=output.split(translated).join(arabic);
      }
      return output;
    }
    for(const key of partialKeys){const translated=dictionaries[lang][key];if(translated&&output.includes(key))output=output.split(key).join(translated)}
    return output;
  }

  function applyPatterns(value,lang){
    if(lang==='ar')return value;
    const terms=lang==='en'?{
      order:'order',orders:'orders',booklet:'booklet',booklets:'booklets',product:'product',products:'products',teacher:'teacher',teachers:'teachers',library:'library',libraries:'libraries',courier:'courier',couriers:'couriers',page:'Page',of:'of',available:'available',copy:'copy',copies:'copies',result:'result',results:'results',area:'area',areas:'areas',item:'item',items:'items',inCart:'in cart',welcome:'Welcome',hello:'Hello',from5:'out of 5'
    }:{
      order:'داواکاری',orders:'داواکاری',booklet:'ملزمە',booklets:'ملزمە',product:'بەرهەم',products:'بەرهەم',teacher:'مامۆستا',teachers:'مامۆستا',library:'کتێبخانە',libraries:'کتێبخانە',courier:'گەیەنەر',couriers:'گەیەنەر',page:'پەڕە',of:'لە',available:'بەردەست',copy:'دانە',copies:'دانە',result:'ئەنجام',results:'ئەنجام',area:'ناوچە',areas:'ناوچە',item:'کاڵا',items:'کاڵا',inCart:'لە سەبەتە',welcome:'بەخێربێیت',hello:'سڵاو',from5:'لە 5'
    };
    let out=value;
    out=out.replace(/(\d+[٠-٩]*)\s+طلب(?:ات)?/g,(_,n)=>`${n} ${Number(n)===1?terms.order:terms.orders}`);
    out=out.replace(/(\d+[٠-٩]*)\s+ملزم(?:ة|ات)/g,(_,n)=>`${n} ${Number(n)===1?terms.booklet:terms.booklets}`);
    out=out.replace(/(\d+[٠-٩]*)\s+منتج(?:ات)?/g,(_,n)=>`${n} ${Number(n)===1?terms.product:terms.products}`);
    out=out.replace(/(\d+[٠-٩]*)\s+مدرس(?:ين|ون)?/g,(_,n)=>`${n} ${Number(n)===1?terms.teacher:terms.teachers}`);
    out=out.replace(/(\d+[٠-٩]*)\s+مكتبة/g,(_,n)=>`${n} ${Number(n)===1?terms.library:terms.libraries}`);
    out=out.replace(/(\d+[٠-٩]*)\s+مندوب(?:ين|ون)?/g,(_,n)=>`${n} ${Number(n)===1?terms.courier:terms.couriers}`);
    out=out.replace(/صفحة\s+(\d+)\s+من\s+(\d+)/g,(_,a,b)=>`${terms.page} ${a} ${terms.of} ${b}`);
    out=out.replace(/(\d+)\s+نتيجة/g,(_,n)=>`${n} ${Number(n)===1?terms.result:terms.results}`);
    out=out.replace(/(\d+)\s+نسخ(?:ة)?/g,(_,n)=>`${n} ${Number(n)===1?terms.copy:terms.copies}`);
    out=out.replace(/(\d+)\s+مناطق/g,(_,n)=>`${n} ${terms.areas}`);
    out=out.replace(/(\d+)\s+مادة في السلة/g,(_,n)=>`${n} ${Number(n)===1?terms.item:terms.items} ${terms.inCart}`);
    out=out.replace(/مرحباً\s+(.+)/,(_,name)=>`${terms.welcome} ${name}`);
    out=out.replace(/أهلاً\s+(.+)/,(_,name)=>`${terms.hello} ${name}`);
    out=out.replace(/—\s*(\d+(?:\.\d+)?)\s+من\s+5/g,(_,n)=>`— ${n} ${terms.from5}`);
    if(lang==='en')out=out.replace(/د\.ع/g,'IQD');
    return out;
  }

  function translate(value,lang=current()){
    if(value==null)return value;
    const input=String(value);
    if(!input.trim())return input;
    const leading=input.match(/^\s*/)?.[0]||'';
    const trailing=input.match(/\s*$/)?.[0]||'';
    const core=input.slice(leading.length,input.length-trailing.length);
    const exact=translateExact(core,lang);
    const mixed=exact!==core?exact:applyPatterns(replaceKnownPhrases(core,lang),lang);
    return leading+mixed+trailing;
  }

  function shouldSkip(element){
    if(!element)return true;
    if(['SCRIPT','STYLE','NOSCRIPT','CODE','PRE','TEXTAREA'].includes(element.tagName))return true;
    return Boolean(element.closest?.('[data-i18n-skip],[data-no-translate],[translate="no"],[contenteditable="true"],[data-lang]'));
  }

  function translateTextNode(node,lang){
    const parent=node.parentElement;
    if(!parent||shouldSkip(parent))return;
    let state=textState.get(node);
    if(!state||(!applying&&node.nodeValue!==state.last))state={source:node.nodeValue,last:node.nodeValue};
    const next=translate(state.source,lang);
    state.last=next;textState.set(node,state);
    if(node.nodeValue!==next)node.nodeValue=next;
  }

  const ATTRS=['placeholder','title','aria-label','data-label'];
  function translateAttributes(element,lang){
    if(shouldSkip(element))return;
    let state=attrState.get(element)||{};
    for(const attr of ATTRS){
      if(!element.hasAttribute?.(attr))continue;
      const now=element.getAttribute(attr)||'';
      const old=state[attr];
      if(!old||(!applying&&now!==old.last))state[attr]={source:now,last:now};
      const next=translate(state[attr].source,lang);
      state[attr].last=next;
      if(now!==next)element.setAttribute(attr,next);
    }
    if(element.tagName==='INPUT'&&['button','submit','reset'].includes(String(element.type).toLowerCase())){
      const now=element.value||'',old=state.value;
      if(!old||(!applying&&now!==old.last))state.value={source:now,last:now};
      const next=translate(state.value.source,lang);state.value.last=next;if(now!==next)element.value=next;
    }
    attrState.set(element,state);
  }

  function translateTree(root=document,lang=current()){
    if(!root)return;
    applying=true;
    try{
      if(root.nodeType===3)translateTextNode(root,lang);
      if(root.nodeType===1)translateAttributes(root,lang);
      const walker=document.createTreeWalker?.(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
      if(walker){let node;while((node=walker.nextNode()))node.nodeType===3?translateTextNode(node,lang):translateAttributes(node,lang)}
    }finally{applying=false}
  }

  function applyDocument(code=current(),options={}){
    const lang=normalizeLanguage(code);
    try{localStorage.setItem(STORAGE_KEY,lang)}catch(_){}
    const html=document.documentElement;
    if(html){html.lang=HTML_LANG[lang];html.dir=direction(lang);html.dataset.alinLanguage=lang}
    if(document.body){document.body.dir=direction(lang);document.body.classList.toggle('alin-ltr',lang==='en');document.body.classList.toggle('alin-rtl',lang!=='en')}
    translateTree(document,lang);
    if(options.emit)window.dispatchEvent(new CustomEvent('alin:language-applied',{detail:{language:lang,locale:locale(lang),direction:direction(lang)}}));
    return lang;
  }

  function setLanguage(code,options={}){
    const lang=applyDocument(code,{emit:options.emit!==false});
    if(options.announce)window.toast?.(translate('تم تغيير اللغة',lang));
    return lang;
  }

  function formatNumber(value,options,code=current()){return Number(value||0).toLocaleString(locale(code),options)}
  function formatMoney(value,code=current()){return `${formatNumber(value,{maximumFractionDigits:0},code)} ${code==='en'?'IQD':'د.ع'}`}
  function formatDate(value,options,code=current()){const date=value instanceof Date?value:new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleString(locale(code),options)}

  function startObserver(){
    if(observer||typeof MutationObserver!=='function'||!document.documentElement)return;
    observer=new MutationObserver(records=>{
      if(applying)return;
      const lang=current();
      for(const record of records){
        if(record.type==='characterData')translateTextNode(record.target,lang);
        else if(record.type==='attributes')translateAttributes(record.target,lang);
        else for(const node of record.addedNodes)translateTree(node,lang);
      }
    });
    observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS});
  }

  const nativeDialogs={alert:window.alert?.bind(window),confirm:window.confirm?.bind(window),prompt:window.prompt?.bind(window)};
  if(nativeDialogs.alert)window.alert=message=>nativeDialogs.alert(translate(message));
  if(nativeDialogs.confirm)window.confirm=message=>nativeDialogs.confirm(translate(message));
  if(nativeDialogs.prompt)window.prompt=(message,defaultValue)=>nativeDialogs.prompt(translate(message),defaultValue);

  window.AlinI18n=Object.freeze({
    languages:[...SUPPORTED],current,locale,direction,t:translate,translate,translateTree,apply:applyDocument,setLanguage,formatNumber,formatMoney,formatDate,
    dictionaries:Object.freeze({en:Object.freeze(en),ku:Object.freeze(ku)})
  });
  window.alinT=translate;

  window.addEventListener('alin:language-changed',event=>applyDocument(event.detail?.language||current(),{emit:true}));
  window.addEventListener('alin:rendered',()=>translateTree(document,current()));
  window.addEventListener('alin:data-refreshed',()=>translateTree(document,current()));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{applyDocument(current());startObserver()},{once:true});
  else{applyDocument(current());startObserver()}
})();
