import { SITE_SECTIONS, type SiteContent } from "@clinic/shared";

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
  readonly title: { ar: string; en: string };
  readonly bio: { ar: string; en: string };
}

export const SITE_DOCTOR_PROFILES: readonly Omit<SiteDoctorSeed, "doctorId">[] = [
  {
    title: { ar: "تجميل وزراعة الأسنان", en: "Cosmetic and implant dentistry" },
    bio: {
      ar: "خبرة تزيد عن خمسة عشر عاماً في تجميل الأسنان والزراعة الفورية وابتسامة هوليوود، مع خطة علاج واضحة وتجربة مريحة من أول زيارة.",
      en: "Over fifteen years in cosmetic dentistry, immediate implants and smile makeovers, with a clear treatment plan and a comfortable first visit.",
    },
  },
  {
    title: { ar: "علاج العصب وطب أسنان الأطفال", en: "Root canals and children's dentistry" },
    bio: {
      ar: "علاج قنوات الجذور بالمجهر وطب أسنان الأطفال، مع شرح كل خطوة للمريض وأهله وزيارة أولى مريحة للطفل.",
      en: "Microscope-assisted root canal treatment and children's dentistry, with every step explained to patients and parents and a gentle first visit for children.",
    },
  },
];

const blankPair = { ar: "", en: "" };

export function siteContent(
  photo: (name: SitePhoto) => string,
  doctors: readonly SiteDoctorSeed[],
): SiteContent {
  return {
    sections: [...SITE_SECTIONS],
    brand: {
      tagline: { ar: "ابتسامتك أمانة", en: "Your smile, in good hands" },
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
      },
      subtitle: {
        ar: "رعاية أسنان متكاملة لكل العائلة في قلب نابلس: فحص، تنظيف، تجميل، زراعة وتقويم، بأحدث الأجهزة وبأيدي فريق يهتم بك.",
        en: "Complete dental care for the whole family in the heart of Nablus: check-ups, cleaning, cosmetics, implants and orthodontics, with modern equipment and a team that cares.",
      },
      images: [photo("chair"), photo("smile"), photo("whitening")],
      stat: { value: "+12,000", label: { ar: "ابتسامة سعيدة", en: "happy smiles" } },
    },
    highlights: [
      {
        icon: "shield",
        label: { ar: "تعقيم كامل", en: "Full sterilisation" },
        text: {
          ar: "أدوات معقمة لكل مريض وفق بروتوكولات صارمة.",
          en: "Sterile instruments for every patient, under strict protocols.",
        },
      },
      {
        icon: "monitor",
        label: { ar: "أشعة رقمية", en: "Digital X-rays" },
        text: {
          ar: "تشخيص أدق بجرعة إشعاع أقل بكثير.",
          en: "Sharper diagnosis with a fraction of the radiation.",
        },
      },
      {
        icon: "clock",
        label: { ar: "مواعيد دقيقة", en: "On-time appointments" },
        text: {
          ar: "نحترم وقتك ونلتزم بموعدك.",
          en: "We respect your time and keep to your slot.",
        },
      },
      {
        icon: "heart",
        label: { ar: "علاج بلا ألم", en: "Gentle treatment" },
        text: {
          ar: "تخدير موضعي حديث وتعامل هادئ مع المرضى القلقين.",
          en: "Modern local anaesthesia and a calm approach for anxious patients.",
        },
      },
    ],
    story: {
      eyebrow: { ar: "قصتنا", en: "Our story" },
      title: {
        ar: "أكثر من عشرين عاماً ونحن نرسم الابتسامات في نابلس",
        en: "Over twenty years of smiles in Nablus",
      },
      badge: { ar: "منذ 2004", en: "Since 2004" },
      image: photo("child-checkup"),
    },
    services: {
      title: { ar: "خدماتنا", en: "Our services" },
      subtitle: {
        ar: "كل ما تحتاجه أسنانك تحت سقف واحد",
        en: "Everything your teeth need, under one roof",
      },
      intro: {
        ar: "من الفحص الدوري إلى الابتسامة الكاملة، نضع لك خطة علاج واضحة بالتكلفة والمدة قبل أن نبدأ.",
        en: "From a routine check-up to a full smile makeover, you get a clear plan with cost and duration before we begin.",
      },
      image: photo("treatment-room"),
      items: [
        {
          id: "checkup",
          title: { ar: "الفحص والتنظيف", en: "Check-up and cleaning" },
          description: {
            ar: "فحص شامل مع أشعة رقمية وتنظيف الجير وتلميع الأسنان.",
            en: "A full examination with digital X-rays, scaling and polishing.",
          },
          image: photo("examination"),
          icon: "stethoscope",
        },
        {
          id: "whitening",
          title: { ar: "تبييض الأسنان", en: "Teeth whitening" },
          description: {
            ar: "تبييض آمن في العيادة بنتيجة واضحة من الجلسة الأولى.",
            en: "Safe in-clinic whitening with visible results from the first session.",
          },
          image: photo("whitening"),
          icon: "sparkles",
        },
        {
          id: "implants",
          title: { ar: "زراعة الأسنان", en: "Dental implants" },
          description: {
            ar: "تعويض الأسنان المفقودة بزراعات عالية الجودة تدوم لسنوات طويلة.",
            en: "Replace missing teeth with high-quality implants built to last.",
          },
          image: photo("instruments"),
          icon: "tooth",
        },
        {
          id: "root-canal",
          title: { ar: "علاج العصب", en: "Root canal treatment" },
          description: {
            ar: "علاج دقيق للقنوات يحافظ على سنك الطبيعي ويريحك من الألم.",
            en: "Precise canal treatment that saves your natural tooth and ends the pain.",
          },
          image: photo("consultation-chair"),
          icon: "shield",
        },
        {
          id: "kids",
          title: { ar: "طب أسنان الأطفال", en: "Children's dentistry" },
          description: {
            ar: "زيارات لطيفة للأطفال، فلورايد وحشوات وقائية وتوعية للأهل.",
            en: "Friendly visits for children, fluoride, sealants and advice for parents.",
          },
          image: photo("child-checkup"),
          icon: "smile",
        },
        {
          id: "cosmetic",
          title: { ar: "تجميل الابتسامة", en: "Smile makeover" },
          description: {
            ar: "عدسات وقشور خزفية وتصميم ابتسامة رقمي يناسب ملامح وجهك.",
            en: "Veneers and digital smile design shaped to your face.",
          },
          image: photo("confident-smile"),
          icon: "gem",
        },
      ],
      promo: {
        title: {
          ar: "فحص وتنظيف بسعر خاص لكل العائلة هذا الشهر",
          en: "A family check-up and cleaning at a special price this month",
        },
        image: photo("hygiene"),
      },
    },
    doctors: {
      title: { ar: "أطباؤنا", en: "Our dentists" },
      subtitle: {
        ar: "فريق من الأخصائيين يجمع الخبرة والاهتمام",
        en: "A team of specialists who bring experience and care",
      },
      hidden: [],
      image: photo("instruments"),
      features: [
        {
          icon: "award",
          label: { ar: "أخصائيون معتمدون", en: "Certified specialists" },
          text: blank(),
        },
        {
          icon: "users",
          label: { ar: "رعاية لكل العائلة", en: "Care for the whole family" },
          text: blank(),
        },
        {
          icon: "sparkles",
          label: { ar: "تعليم طبي مستمر", en: "Continuous training" },
          text: blank(),
        },
      ],
      profiles: doctors.map((doctor) => ({ ...doctor })),
      promo: {
        title: { ar: "احجز استشارتك الأولى مع طبيبك", en: "Book your first consultation" },
        image: photo("examination"),
      },
    },
    about: {
      eyebrow: { ar: "من نحن", en: "About us" },
      title: { ar: "عيادة عائلية بمعايير حديثة", en: "A family clinic with modern standards" },
      subtitle: {
        ar: "نجمع بين دفء العيادة العائلية ودقة التقنيات الحديثة",
        en: "The warmth of a family practice with the precision of modern technology",
      },
      body: {
        ar: "بدأت عيادة أبو عبيد لطب الأسنان عام 2004 بكرسي واحد وحلم بسيط: أن يجد كل مريض في نابلس رعاية أسنان صادقة ومريحة. اليوم نستقبل آلاف المرضى سنوياً، ونستخدم الأشعة الرقمية والتعقيم المعتمد وأحدث مواد الحشو والتجميل، دون أن نتخلى عن الاهتمام الشخصي الذي بدأنا به.",
        en: "Abu Obeid Dental Clinic opened in 2004 with a single chair and a simple aim: honest, comfortable dental care for everyone in Nablus. Today we see thousands of patients a year with digital X-rays, certified sterilisation and modern restorative and cosmetic materials, without losing the personal care we started with.",
      },
      image: photo("chair"),
      pillars: [
        {
          icon: "target",
          label: { ar: "رسالتنا", en: "Our mission" },
          text: {
            ar: "رعاية أسنان صادقة ومريحة لكل فرد في العائلة.",
            en: "Honest, comfortable dental care for every member of the family.",
          },
        },
        {
          icon: "eye",
          label: { ar: "رؤيتنا", en: "Our vision" },
          text: {
            ar: "أن نكون العيادة الأولى التي يثق بها أهل نابلس لابتساماتهم.",
            en: "To be the clinic Nablus trusts first with its smiles.",
          },
        },
        {
          icon: "gem",
          label: { ar: "قيمنا", en: "Our values" },
          text: {
            ar: "الأمانة، الدقة، والاحترام في كل زيارة.",
            en: "Honesty, precision and respect at every visit.",
          },
        },
      ],
      note: {
        ar: "مرخصة من وزارة الصحة الفلسطينية",
        en: "Licensed by the Palestinian Ministry of Health",
      },
      stats: [
        { icon: "calendar", value: "20+", label: { ar: "سنة خبرة", en: "years of experience" } },
        { icon: "smile", value: "12k", label: { ar: "مريض سعيد", en: "happy patients" } },
        { icon: "stethoscope", value: "4", label: { ar: "أخصائيين", en: "specialists" } },
        { icon: "star", value: "4.9", label: { ar: "تقييم المرضى", en: "patient rating" } },
      ],
      statsImage: photo("treatment-room"),
      whyTitle: { ar: "لماذا يختارنا مرضانا؟", en: "Why patients choose us" },
      values: [
        {
          icon: "armchair",
          label: { ar: "راحتك أولاً", en: "Your comfort first" },
          text: {
            ar: "غرف هادئة ووقت كافٍ لكل مريض دون استعجال.",
            en: "Quiet rooms and enough time for every patient, never rushed.",
          },
        },
        {
          icon: "shield",
          label: { ar: "أسعار واضحة", en: "Clear prices" },
          text: {
            ar: "تعرف التكلفة كاملة قبل بدء أي علاج.",
            en: "You know the full cost before any treatment begins.",
          },
        },
        {
          icon: "building",
          label: { ar: "موقع مميز", en: "Easy to reach" },
          text: {
            ar: "في رفيديا مع مواقف قريبة ومصعد.",
            en: "In Rafidia, with nearby parking and a lift.",
          },
        },
        {
          icon: "tooth",
          label: { ar: "متابعة بعد العلاج", en: "Follow-up care" },
          text: {
            ar: "نتصل بك بعد العلاج للاطمئنان ونذكرك بموعدك القادم.",
            en: "We call after treatment and remind you of your next visit.",
          },
        },
      ],
      whyImage: photo("happy-patient"),
      whyBadge: { ar: "رضا المرضى 98%", en: "98% patient satisfaction" },
      quote: {
        text: {
          ar: "كنت أخاف من طبيب الأسنان طوال حياتي، هنا أول مرة أنهي العلاج وأنا مرتاح ومبتسم.",
          en: "I was afraid of the dentist all my life. Here, for the first time, I finished treatment relaxed and smiling.",
        },
        image: photo("confident-smile"),
      },
      cta: {
        title: { ar: "جاهز لابتسامة جديدة؟", en: "Ready for a new smile?" },
        subtitle: {
          ar: "احجز موعدك خلال دقيقة واحدة واختر الوقت الذي يناسبك.",
          en: "Book in under a minute and pick the time that suits you.",
        },
        image: photo("smile"),
      },
    },
    gallery: {
      eyebrow: { ar: "جولة في العيادة", en: "Inside the clinic" },
      title: { ar: "مساحة مريحة ومعقمة بالكامل", en: "A calm, fully sterilised space" },
      body: {
        ar: "صممنا العيادة لتكون هادئة ومشرقة، مع غرف علاج مجهزة بأحدث الأجهزة.",
        en: "The clinic is designed to be bright and calm, with fully equipped treatment rooms.",
      },
      images: [photo("treatment-room"), photo("waiting-room"), photo("consultation-chair")],
    },
    cases: {
      title: { ar: "قصص نجاح حقيقية", en: "Real success stories" },
      subtitle: {
        ar: "شاهد الفرق واستمع إلى تجارب مرضانا",
        en: "See the difference our patients made",
      },
      items: [
        {
          title: { ar: "تبييض الأسنان", en: "Teeth whitening" },
          before: photo("examination"),
          after: photo("whitening"),
        },
        {
          title: { ar: "ابتسامة هوليوود", en: "Smile makeover" },
          before: photo("hygiene"),
          after: photo("confident-smile"),
        },
        {
          title: { ar: "تقويم الأسنان", en: "Orthodontics" },
          before: photo("instruments"),
          after: photo("smile"),
        },
      ],
    },
    testimonials: {
      title: { ar: "ماذا يقول مرضانا", en: "What our patients say" },
      subtitle: blankPair,
      items: [
        {
          name: "سناء محمود",
          text: {
            ar: "اهتمام كبير وتفاصيل دقيقة، والعيادة مجهزة بأحدث التقنيات.",
            en: "Great care and attention to detail, in a clinic with the latest equipment.",
          },
          rating: 5,
        },
        {
          name: "خالد ناصر",
          text: {
            ar: "تجربة مريحة والنتائج كانت أفضل مما توقعت. شكراً للفريق الرائع.",
            en: "A comfortable experience and results beyond what I expected. Thank you to a great team.",
          },
          rating: 5,
        },
        {
          name: "مريم أحمد",
          text: {
            ar: "خدمة مميزة واهتمام طبي رائع. أنصح بعيادة أبو عبيد لكل من يبحث عن رعاية أسنان احترافية.",
            en: "Outstanding service and wonderful medical care. I recommend the clinic to anyone looking for professional dental care.",
          },
          rating: 5,
        },
      ],
    },
    booking: {
      title: { ar: "احجز موعدك", en: "Book an appointment" },
      subtitle: {
        ar: "اختر الطبيب واليوم والوقت، وسنرسل لك تأكيداً برسالة نصية.",
        en: "Choose the dentist, the day and the time, and we will confirm by text.",
      },
      image: photo("smile"),
    },
    contact: {
      title: { ar: "تواصل معنا", en: "Contact us" },
      subtitle: {
        ar: "نسعد بالإجابة عن أسئلتك واستقبالك في العيادة",
        en: "We are happy to answer your questions and welcome you",
      },
      intro: {
        ar: "اتصل بنا أو راسلنا على واتساب أو اترك رسالتك هنا وسنعود إليك في أقرب وقت.",
        en: "Call us, message us on WhatsApp, or leave a note here and we will get back to you soon.",
      },
      image: photo("waiting-room"),
      note: { ar: "نرد عادة خلال ساعات العمل نفسها", en: "We usually reply within working hours" },
      welcome: { ar: "أهلاً بك في عيادتنا", en: "Welcome to our clinic" },
      welcomeBody: {
        ar: "نابلس، رفيديا، شارع تونس، عمارة الرؤية، الطابق الثاني — بجانب صيدلية الشفاء.",
        en: "Tunis Street, Rafidia, Nablus — Al-Ru'ya building, second floor, next to Al-Shifa pharmacy.",
      },
      welcomeImage: photo("consultation-chair"),
      topics: [
        { ar: "حجز أو تعديل موعد", en: "Booking or changing an appointment" },
        { ar: "استفسار عن علاج", en: "A question about treatment" },
        { ar: "الأسعار والتأمين", en: "Prices and insurance" },
        { ar: "اقتراح أو شكوى", en: "Feedback" },
      ],
      formEnabled: true,
    },
  };
}

function blank(): { ar: string; en: string } {
  return { ar: "", en: "" };
}
