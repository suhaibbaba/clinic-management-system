import { SITE_SECTIONS, type LocalizedText, type SiteContent } from "@clinic/shared";

export const SITE_PHOTOS = [
  "chair",
  "treatment-room",
  "instruments",
  "consultation-chair",
  "child-checkup",
  "whitening",
  "examination",
  "hygiene",
  "smile",
  "happy-patient",
  "confident-smile",
  "waiting-room",
] as const;

export type SitePhoto = (typeof SITE_PHOTOS)[number];

export interface SiteDoctorSeed {
  readonly doctorId: string;
  readonly title: LocalizedText;
  readonly bio: LocalizedText;
}

export const SITE_DOCTOR_PROFILES: readonly Omit<SiteDoctorSeed, "doctorId">[] = [
  {
    title: {
      ar: "تجميل وزراعة الأسنان",
      en: "Cosmetic and implant dentistry",
      tr: "Estetik diş hekimliği ve implant",
    },
    bio: {
      ar: "خبرة تزيد عن خمسة عشر عاماً في تجميل الأسنان والزراعة الفورية وابتسامة هوليوود، مع خطة علاج واضحة وتجربة مريحة من أول زيارة.",
      en: "Over fifteen years in cosmetic dentistry, immediate implants and smile makeovers, with a clear treatment plan and a comfortable first visit.",
      tr: "Estetik diş hekimliği, hemen implant ve gülüş tasarımında on beş yılı aşkın deneyim; net bir tedavi planı ve rahat bir ilk ziyaret.",
    },
  },
  {
    title: {
      ar: "علاج العصب وطب أسنان الأطفال",
      en: "Root canals and children's dentistry",
      tr: "Kanal tedavisi ve çocuk diş hekimliği",
    },
    bio: {
      ar: "علاج قنوات الجذور بالمجهر وطب أسنان الأطفال، مع شرح كل خطوة للمريض وأهله وزيارة أولى مريحة للطفل.",
      en: "Microscope-assisted root canal treatment and children's dentistry, with every step explained to patients and parents and a gentle first visit for children.",
      tr: "Mikroskop destekli kanal tedavisi ve çocuk diş hekimliği; her adım hastaya ve ailesine anlatılır, çocuklar için nazik bir ilk ziyaret sunulur.",
    },
  },
];

const blankPair: LocalizedText = {};

export function siteContent(
  photo: (name: SitePhoto) => string,
  doctors: readonly SiteDoctorSeed[],
): SiteContent {
  return {
    sections: [...SITE_SECTIONS],
    brand: {
      tagline: {
        ar: "ابتسامتك أمانة",
        en: "Your smile, in good hands",
        tr: "Gülüşünüz güvenilir ellerde",
      },
      social: {
        instagram: "https://www.instagram.com/abuobeid.dental",
        facebook: "https://www.facebook.com/abuobeid.dental",
        whatsapp: "https://wa.me/970599000101",
        youtube: "",
      },
    },
    hero: {
      title: {
        ar: "رعاية متكاملة\nلصحة وجمال أسنانك",
        en: "Complete care\nfor a healthy, beautiful smile",
        tr: "Sağlıklı ve güzel bir gülüş için\ntam kapsamlı bakım",
      },
      subtitle: {
        ar: "رعاية أسنان متكاملة لكل العائلة في قلب نابلس: فحص، تنظيف، تجميل، زراعة وتقويم، بأحدث الأجهزة وبأيدي فريق يهتم بك.",
        en: "Complete dental care for the whole family in the heart of Nablus: check-ups, cleaning, cosmetics, implants and orthodontics, with modern equipment and a team that cares.",
        tr: "Nablus'un kalbinde tüm aile için eksiksiz diş bakımı: muayene, temizlik, estetik, implant ve ortodonti; modern cihazlar ve sizi önemseyen bir ekiple.",
      },
      images: [photo("chair"), photo("smile"), photo("whitening")],
      stat: {
        value: "+12,000",
        label: { ar: "ابتسامة سعيدة", en: "happy smiles", tr: "mutlu gülüş" },
      },
    },
    highlights: [
      {
        icon: "shield",
        label: { ar: "تعقيم كامل", en: "Full sterilisation", tr: "Tam sterilizasyon" },
        text: {
          ar: "أدوات معقمة لكل مريض وفق بروتوكولات صارمة.",
          en: "Sterile instruments for every patient, under strict protocols.",
          tr: "Her hasta için steril aletler, sıkı protokoller altında.",
        },
      },
      {
        icon: "monitor",
        label: { ar: "أشعة رقمية", en: "Digital X-rays", tr: "Dijital röntgen" },
        text: {
          ar: "تشخيص أدق بجرعة إشعاع أقل بكثير.",
          en: "Sharper diagnosis with a fraction of the radiation.",
          tr: "Çok daha düşük radyasyonla daha net teşhis.",
        },
      },
      {
        icon: "clock",
        label: { ar: "مواعيد دقيقة", en: "On-time appointments", tr: "Zamanında randevular" },
        text: {
          ar: "نحترم وقتك ونلتزم بموعدك.",
          en: "We respect your time and keep to your slot.",
          tr: "Zamanınıza saygı duyar, randevu saatinize uyarız.",
        },
      },
      {
        icon: "heart",
        label: { ar: "علاج بلا ألم", en: "Gentle treatment", tr: "Ağrısız tedavi" },
        text: {
          ar: "تخدير موضعي حديث وتعامل هادئ مع المرضى القلقين.",
          en: "Modern local anaesthesia and a calm approach for anxious patients.",
          tr: "Modern lokal anestezi ve kaygılı hastalar için sakin bir yaklaşım.",
        },
      },
    ],
    story: {
      eyebrow: { ar: "قصتنا", en: "Our story", tr: "Hikayemiz" },
      title: {
        ar: "أكثر من عشرين عاماً ونحن نرسم الابتسامات في نابلس",
        en: "Over twenty years of smiles in Nablus",
        tr: "Nablus'ta yirmi yılı aşkın süredir gülüşler",
      },
      badge: { ar: "منذ 2004", en: "Since 2004", tr: "2004'ten beri" },
      image: photo("child-checkup"),
    },
    services: {
      title: { ar: "خدماتنا", en: "Our services", tr: "Hizmetlerimiz" },
      subtitle: {
        ar: "كل ما تحتاجه أسنانك تحت سقف واحد",
        en: "Everything your teeth need, under one roof",
        tr: "Dişlerinizin ihtiyacı olan her şey tek çatı altında",
      },
      intro: {
        ar: "من الفحص الدوري إلى الابتسامة الكاملة، نضع لك خطة علاج واضحة بالتكلفة والمدة قبل أن نبدأ.",
        en: "From a routine check-up to a full smile makeover, you get a clear plan with cost and duration before we begin.",
        tr: "Rutin muayeneden tam bir gülüş tasarımına kadar, başlamadan önce maliyeti ve süresi belli net bir plan alırsınız.",
      },
      image: photo("treatment-room"),
      items: [
        {
          id: "checkup",
          title: { ar: "الفحص والتنظيف", en: "Check-up and cleaning", tr: "Muayene ve temizlik" },
          description: {
            ar: "فحص شامل مع أشعة رقمية وتنظيف الجير وتلميع الأسنان.",
            en: "A full examination with digital X-rays, scaling and polishing.",
            tr: "Dijital röntgenle kapsamlı muayene, diş taşı temizliği ve cilalama.",
          },
          image: photo("examination"),
          icon: "stethoscope",
        },
        {
          id: "whitening",
          title: { ar: "تبييض الأسنان", en: "Teeth whitening", tr: "Diş beyazlatma" },
          description: {
            ar: "تبييض آمن في العيادة بنتيجة واضحة من الجلسة الأولى.",
            en: "Safe in-clinic whitening with visible results from the first session.",
            tr: "Klinikte güvenli beyazlatma; sonuç ilk seanstan itibaren görünür.",
          },
          image: photo("whitening"),
          icon: "sparkles",
        },
        {
          id: "implants",
          title: { ar: "زراعة الأسنان", en: "Dental implants", tr: "Diş implantı" },
          description: {
            ar: "تعويض الأسنان المفقودة بزراعات عالية الجودة تدوم لسنوات طويلة.",
            en: "Replace missing teeth with high-quality implants built to last.",
            tr: "Eksik dişlerinizi uzun yıllar dayanacak yüksek kaliteli implantlarla tamamlayın.",
          },
          image: photo("instruments"),
          icon: "tooth",
        },
        {
          id: "root-canal",
          title: { ar: "علاج العصب", en: "Root canal treatment", tr: "Kanal tedavisi" },
          description: {
            ar: "علاج دقيق للقنوات يحافظ على سنك الطبيعي ويريحك من الألم.",
            en: "Precise canal treatment that saves your natural tooth and ends the pain.",
            tr: "Doğal dişinizi koruyan ve ağrınızı sonlandıran hassas kanal tedavisi.",
          },
          image: photo("consultation-chair"),
          icon: "shield",
        },
        {
          id: "kids",
          title: { ar: "طب أسنان الأطفال", en: "Children's dentistry", tr: "Çocuk diş hekimliği" },
          description: {
            ar: "زيارات لطيفة للأطفال، فلورايد وحشوات وقائية وتوعية للأهل.",
            en: "Friendly visits for children, fluoride, sealants and advice for parents.",
            tr: "Çocuklar için nazik ziyaretler, flor, fissür örtücü ve ebeveynlere öneriler.",
          },
          image: photo("child-checkup"),
          icon: "smile",
        },
        {
          id: "cosmetic",
          title: { ar: "تجميل الابتسامة", en: "Smile makeover", tr: "Gülüş tasarımı" },
          description: {
            ar: "عدسات وقشور خزفية وتصميم ابتسامة رقمي يناسب ملامح وجهك.",
            en: "Veneers and digital smile design shaped to your face.",
            tr: "Yüz hatlarınıza uygun lamina kaplamalar ve dijital gülüş tasarımı.",
          },
          image: photo("confident-smile"),
          icon: "gem",
        },
      ],
      promo: {
        title: {
          ar: "فحص وتنظيف بسعر خاص لكل العائلة هذا الشهر",
          en: "A family check-up and cleaning at a special price this month",
          tr: "Bu ay tüm aile için özel fiyatlı muayene ve temizlik",
        },
        image: photo("hygiene"),
      },
    },
    doctors: {
      title: { ar: "أطباؤنا", en: "Our dentists", tr: "Diş hekimlerimiz" },
      subtitle: {
        ar: "فريق من الأخصائيين يجمع الخبرة والاهتمام",
        en: "A team of specialists who bring experience and care",
        tr: "Deneyimi ve ilgiyi bir araya getiren uzman bir ekip",
      },
      hidden: [],
      image: photo("instruments"),
      features: [
        {
          icon: "award",
          label: {
            ar: "أخصائيون معتمدون",
            en: "Certified specialists",
            tr: "Sertifikalı uzmanlar",
          },
          text: blank(),
        },
        {
          icon: "users",
          label: {
            ar: "رعاية لكل العائلة",
            en: "Care for the whole family",
            tr: "Tüm aile için bakım",
          },
          text: blank(),
        },
        {
          icon: "sparkles",
          label: { ar: "تعليم طبي مستمر", en: "Continuous training", tr: "Sürekli eğitim" },
          text: blank(),
        },
      ],
      profiles: doctors.map((doctor) => ({ ...doctor })),
      promo: {
        title: {
          ar: "احجز استشارتك الأولى مع طبيبك",
          en: "Book your first consultation",
          tr: "İlk muayenenizi planlayın",
        },
        image: photo("examination"),
      },
    },
    about: {
      eyebrow: { ar: "من نحن", en: "About us", tr: "Hakkımızda" },
      title: {
        ar: "عيادة عائلية بمعايير حديثة",
        en: "A family clinic with modern standards",
        tr: "Modern standartlara sahip bir aile kliniği",
      },
      subtitle: {
        ar: "نجمع بين دفء العيادة العائلية ودقة التقنيات الحديثة",
        en: "The warmth of a family practice with the precision of modern technology",
        tr: "Aile kliniğinin sıcaklığı ile modern teknolojinin hassasiyeti bir arada",
      },
      body: {
        ar: "بدأت عيادة أبو عبيد لطب الأسنان عام 2004 بكرسي واحد وحلم بسيط: أن يجد كل مريض في نابلس رعاية أسنان صادقة ومريحة. اليوم نستقبل آلاف المرضى سنوياً، ونستخدم الأشعة الرقمية والتعقيم المعتمد وأحدث مواد الحشو والتجميل، دون أن نتخلى عن الاهتمام الشخصي الذي بدأنا به.",
        en: "Abu Obeid Dental Clinic opened in 2004 with a single chair and a simple aim: honest, comfortable dental care for everyone in Nablus. Today we see thousands of patients a year with digital X-rays, certified sterilisation and modern restorative and cosmetic materials, without losing the personal care we started with.",
        tr: "Ebu Ubeyd Diş Kliniği 2004 yılında tek bir koltuk ve basit bir hedefle açıldı: Nablus'taki herkese dürüst ve rahat diş bakımı sunmak. Bugün dijital röntgen, sertifikalı sterilizasyon ve modern dolgu ve estetik malzemelerle yılda binlerce hastayı ağırlıyoruz; başladığımız kişisel ilgiyi de kaybetmeden.",
      },
      image: photo("chair"),
      pillars: [
        {
          icon: "target",
          label: { ar: "رسالتنا", en: "Our mission", tr: "Misyonumuz" },
          text: {
            ar: "رعاية أسنان صادقة ومريحة لكل فرد في العائلة.",
            en: "Honest, comfortable dental care for every member of the family.",
            tr: "Ailenin her ferdi için dürüst ve rahat diş bakımı.",
          },
        },
        {
          icon: "eye",
          label: { ar: "رؤيتنا", en: "Our vision", tr: "Vizyonumuz" },
          text: {
            ar: "أن نكون العيادة الأولى التي يثق بها أهل نابلس لابتساماتهم.",
            en: "To be the clinic Nablus trusts first with its smiles.",
            tr: "Nablus halkının gülüşleri için ilk güvendiği klinik olmak.",
          },
        },
        {
          icon: "gem",
          label: { ar: "قيمنا", en: "Our values", tr: "Değerlerimiz" },
          text: {
            ar: "الأمانة، الدقة، والاحترام في كل زيارة.",
            en: "Honesty, precision and respect at every visit.",
            tr: "Her ziyarette dürüstlük, titizlik ve saygı.",
          },
        },
      ],
      note: {
        ar: "مرخصة من وزارة الصحة الفلسطينية",
        en: "Licensed by the Palestinian Ministry of Health",
        tr: "Filistin Sağlık Bakanlığı lisanslıdır",
      },
      stats: [
        {
          icon: "calendar",
          value: "20+",
          label: { ar: "سنة خبرة", en: "years of experience", tr: "yıllık deneyim" },
        },
        {
          icon: "smile",
          value: "12k",
          label: { ar: "مريض سعيد", en: "happy patients", tr: "mutlu hasta" },
        },
        {
          icon: "stethoscope",
          value: "4",
          label: { ar: "أخصائيين", en: "specialists", tr: "uzman" },
        },
        {
          icon: "star",
          value: "4.9",
          label: { ar: "تقييم المرضى", en: "patient rating", tr: "hasta puanı" },
        },
      ],
      statsImage: photo("treatment-room"),
      whyTitle: {
        ar: "لماذا يختارنا مرضانا؟",
        en: "Why patients choose us",
        tr: "Hastalarımız bizi neden seçiyor?",
      },
      values: [
        {
          icon: "armchair",
          label: { ar: "راحتك أولاً", en: "Your comfort first", tr: "Önce rahatınız" },
          text: {
            ar: "غرف هادئة ووقت كافٍ لكل مريض دون استعجال.",
            en: "Quiet rooms and enough time for every patient, never rushed.",
            tr: "Sakin odalar ve her hasta için acele etmeden yeterli zaman.",
          },
        },
        {
          icon: "shield",
          label: { ar: "أسعار واضحة", en: "Clear prices", tr: "Net fiyatlar" },
          text: {
            ar: "تعرف التكلفة كاملة قبل بدء أي علاج.",
            en: "You know the full cost before any treatment begins.",
            tr: "Herhangi bir tedaviye başlamadan önce toplam maliyeti bilirsiniz.",
          },
        },
        {
          icon: "building",
          label: { ar: "موقع مميز", en: "Easy to reach", tr: "Kolay ulaşım" },
          text: {
            ar: "في رفيديا مع مواقف قريبة ومصعد.",
            en: "In Rafidia, with nearby parking and a lift.",
            tr: "Rafidiya'da, yakında otopark ve asansör ile.",
          },
        },
        {
          icon: "tooth",
          label: { ar: "متابعة بعد العلاج", en: "Follow-up care", tr: "Tedavi sonrası takip" },
          text: {
            ar: "نتصل بك بعد العلاج للاطمئنان ونذكرك بموعدك القادم.",
            en: "We call after treatment and remind you of your next visit.",
            tr: "Tedaviden sonra sizi arar, bir sonraki randevunuzu hatırlatırız.",
          },
        },
      ],
      whyImage: photo("happy-patient"),
      whyBadge: {
        ar: "رضا المرضى 98%",
        en: "98% patient satisfaction",
        tr: "%98 hasta memnuniyeti",
      },
      quote: {
        text: {
          ar: "كنت أخاف من طبيب الأسنان طوال حياتي، هنا أول مرة أنهي العلاج وأنا مرتاح ومبتسم.",
          en: "I was afraid of the dentist all my life. Here, for the first time, I finished treatment relaxed and smiling.",
          tr: "Hayatım boyunca diş hekiminden korktum. Burada ilk kez tedaviyi rahat ve gülümseyerek tamamladım.",
        },
        image: photo("confident-smile"),
      },
      cta: {
        title: {
          ar: "جاهز لابتسامة جديدة؟",
          en: "Ready for a new smile?",
          tr: "Yeni bir gülüşe hazır mısınız?",
        },
        subtitle: {
          ar: "احجز موعدك خلال دقيقة واحدة واختر الوقت الذي يناسبك.",
          en: "Book in under a minute and pick the time that suits you.",
          tr: "Bir dakikadan kısa sürede randevu alın ve size uygun saati seçin.",
        },
        image: photo("smile"),
      },
    },
    gallery: {
      eyebrow: { ar: "جولة في العيادة", en: "Inside the clinic", tr: "Klinikten kareler" },
      title: {
        ar: "مساحة مريحة ومعقمة بالكامل",
        en: "A calm, fully sterilised space",
        tr: "Sakin ve tamamen steril bir ortam",
      },
      body: {
        ar: "صممنا العيادة لتكون هادئة ومشرقة، مع غرف علاج مجهزة بأحدث الأجهزة.",
        en: "The clinic is designed to be bright and calm, with fully equipped treatment rooms.",
        tr: "Klinik aydınlık ve sakin olacak şekilde tasarlandı; tedavi odaları en yeni cihazlarla donatılmıştır.",
      },
      images: [photo("treatment-room"), photo("waiting-room"), photo("consultation-chair")],
    },
    cases: {
      title: { ar: "قصص نجاح حقيقية", en: "Real success stories", tr: "Gerçek başarı hikayeleri" },
      subtitle: {
        ar: "شاهد الفرق واستمع إلى تجارب مرضانا",
        en: "See the difference our patients made",
        tr: "Hastalarımızın yaşadığı farkı görün",
      },
      items: [
        {
          title: { ar: "تبييض الأسنان", en: "Teeth whitening", tr: "Diş beyazlatma" },
          before: photo("examination"),
          after: photo("whitening"),
        },
        {
          title: { ar: "ابتسامة هوليوود", en: "Smile makeover", tr: "Gülüş tasarımı" },
          before: photo("hygiene"),
          after: photo("confident-smile"),
        },
        {
          title: { ar: "تقويم الأسنان", en: "Orthodontics", tr: "Ortodonti" },
          before: photo("instruments"),
          after: photo("smile"),
        },
      ],
    },
    testimonials: {
      title: { ar: "ماذا يقول مرضانا", en: "What our patients say", tr: "Hastalarımız ne diyor?" },
      subtitle: blankPair,
      items: [
        {
          name: "سناء محمود",
          text: {
            ar: "اهتمام كبير وتفاصيل دقيقة، والعيادة مجهزة بأحدث التقنيات.",
            en: "Great care and attention to detail, in a clinic with the latest equipment.",
            tr: "Ayrıntılara gösterilen büyük özen ve en yeni cihazlarla donatılmış bir klinik.",
          },
          rating: 5,
        },
        {
          name: "خالد ناصر",
          text: {
            ar: "تجربة مريحة والنتائج كانت أفضل مما توقعت. شكراً للفريق الرائع.",
            en: "A comfortable experience and results beyond what I expected. Thank you to a great team.",
            tr: "Rahat bir deneyim ve beklediğimden de iyi sonuçlar. Harika ekibe teşekkürler.",
          },
          rating: 5,
        },
        {
          name: "مريم أحمد",
          text: {
            ar: "خدمة مميزة واهتمام طبي رائع. أنصح بعيادة أبو عبيد لكل من يبحث عن رعاية أسنان احترافية.",
            en: "Outstanding service and wonderful medical care. I recommend the clinic to anyone looking for professional dental care.",
            tr: "Olağanüstü hizmet ve harika bir tıbbi bakım. Profesyonel diş bakımı arayan herkese kliniği tavsiye ederim.",
          },
          rating: 5,
        },
      ],
    },
    booking: {
      title: { ar: "احجز موعدك", en: "Book an appointment", tr: "Randevu alın" },
      subtitle: {
        ar: "اختر الطبيب واليوم والوقت، وسنرسل لك تأكيداً برسالة نصية.",
        en: "Choose the dentist, the day and the time, and we will confirm by text.",
        tr: "Diş hekimini, günü ve saati seçin; randevunuzu kısa mesajla onaylayalım.",
      },
      image: photo("smile"),
    },
    contact: {
      title: { ar: "تواصل معنا", en: "Contact us", tr: "Bize ulaşın" },
      subtitle: {
        ar: "نسعد بالإجابة عن أسئلتك واستقبالك في العيادة",
        en: "We are happy to answer your questions and welcome you",
        tr: "Sorularınızı yanıtlamaktan ve sizi ağırlamaktan memnuniyet duyarız",
      },
      intro: {
        ar: "اتصل بنا أو راسلنا على واتساب أو اترك رسالتك هنا وسنعود إليك في أقرب وقت.",
        en: "Call us, message us on WhatsApp, or leave a note here and we will get back to you soon.",
        tr: "Bizi arayın, WhatsApp'tan yazın veya buraya mesajınızı bırakın; en kısa sürede size dönelim.",
      },
      image: photo("waiting-room"),
      note: {
        ar: "نرد عادة خلال ساعات العمل نفسها",
        en: "We usually reply within working hours",
        tr: "Genellikle çalışma saatleri içinde yanıt veririz",
      },
      welcome: {
        ar: "أهلاً بك في عيادتنا",
        en: "Welcome to our clinic",
        tr: "Kliniğimize hoş geldiniz",
      },
      welcomeBody: {
        ar: "نابلس، رفيديا، شارع تونس، عمارة الرؤية، الطابق الثاني — بجانب صيدلية الشفاء.",
        en: "Tunis Street, Rafidia, Nablus — Al-Ru'ya building, second floor, next to Al-Shifa pharmacy.",
        tr: "Tunus Caddesi, Rafidiya, Nablus — er-Rü'ya Binası, 2. kat, eş-Şifa Eczanesi yanı.",
      },
      welcomeImage: photo("consultation-chair"),
      topics: [
        {
          ar: "حجز أو تعديل موعد",
          en: "Booking or changing an appointment",
          tr: "Randevu alma veya değiştirme",
        },
        { ar: "استفسار عن علاج", en: "A question about treatment", tr: "Tedavi hakkında soru" },
        { ar: "الأسعار والتأمين", en: "Prices and insurance", tr: "Fiyatlar ve sigorta" },
        { ar: "اقتراح أو شكوى", en: "Feedback", tr: "Öneri veya şikayet" },
      ],
      formEnabled: true,
    },
  };
}

function blank(): LocalizedText {
  return {};
}
