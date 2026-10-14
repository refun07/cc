/**
 * Translation dictionary. Add a key under both `en` and `bn`.
 * Use via the `useT()` hook: const { t } = useT(); t("nav.home").
 */
export const LANGUAGES = [
  { code: "en", label: "English", short: "ENG" },
  { code: "bn", label: "বাংলা", short: "বাং" },
];

export const translations = {
  en: {
    "nav.home": "Home",
    "nav.centres": "Centres",
    "nav.how": "How it works",
    "nav.signin": "Sign in",
    "nav.signout": "Sign out",
    "nav.startBooking": "Start Booking",
    "nav.myBookings": "My bookings",
    "nav.myApplications": "My applications",
    "nav.myProfile": "My profile",
    "nav.tagline": "Community Centre Booking",

    "hero.badge": "ICCMS · DSCC",
    "hero.titleA": "Your event deserves the",
    "hero.titleB": "perfect venue",
    "hero.subtitle":
      "Book verified ICCMS community centres for weddings, corporate events & gatherings — full or half day, with decorator contacts, local payments and built-in zero waste management.",

    "stats.verifiedCentres": "Verified Centres",
    "stats.eventsHosted": "Events Hosted",
    "stats.areasCovered": "Areas Covered",
    "stats.tonnesRecycled": "Tonnes Recycled",

    "section.whyTitle": "Everything you need to host",
    "section.stepsTitle": "How it works",

    "features.verified.t": "Verified Centres",
    "features.verified.d": "Every ICCMS centre is verified with trade license & fire safety clearance.",
    "features.day.t": "Full / Half Day",
    "features.day.d": "Book the entire day or just a morning or evening session.",
    "features.food.t": "Decorator Contact",
    "features.food.d": "Find the decorator contact for your chosen centre.",
    "features.pay.t": "Local Payments",
    "features.pay.d": "Available online payment methods are shown on the ekPay checkout page.",
    "features.owner.t": "Owner Tools",
    "features.owner.d": "Inventory, HRM, payroll & expense management for owners.",
    "features.waste.t": "Zero Waste",
    "features.waste.d": "Event waste routed to verified recycling & compost partners.",

    "steps.browse.t": "Browse centres",
    "steps.browse.d": "Search by area and capacity; compare reviews and decorator contacts.",
    "steps.pick.t": "Sign in by phone",
    "steps.pick.d": "Register with an SMS code or sign in using your mobile number.",
    "steps.review.t": "Choose your booking",
    "steps.review.d": "Pick date, floor and session; add guests and organiser details. NID is needed only on your first booking.",
    "steps.confirm.t": "Review & reserve",
    "steps.confirm.d": "Check charges, choose pay later or online payment when available, then track your booking.",

    "lang.label": "Language",
  },
  bn: {
    "nav.home": "হোম",
    "nav.centres": "কেন্দ্রসমূহ",
    "nav.how": "যেভাবে কাজ করে",
    "nav.signin": "সাইন ইন",
    "nav.signout": "সাইন আউট",
    "nav.startBooking": "বুকিং শুরু করুন",
    "nav.myBookings": "আমার বুকিং",
    "nav.myApplications": "আমার আবেদনপত্র",
    "nav.myProfile": "আমার প্রোফাইল",
    "nav.tagline": "কমিউনিটি সেন্টার বুকিং",

    "hero.badge": "ICCMS · DSCC",
    "hero.titleA": "আপনার অনুষ্ঠানের জন্য চাই",
    "hero.titleB": "সেরা ভেন্যু",
    "hero.subtitle":
      "বিয়ে, কর্পোরেট ইভেন্ট ও সামাজিক অনুষ্ঠানের জন্য যাচাইকৃত ICCMS কমিউনিটি সেন্টার বুক করুন — পূর্ণ বা অর্ধ দিন, ডেকরেটরের যোগাযোগ, স্থানীয় পেমেন্ট এবং জিরো ওয়েস্ট ব্যবস্থাপনাসহ।",

    "stats.verifiedCentres": "যাচাইকৃত কেন্দ্র",
    "stats.eventsHosted": "আয়োজিত অনুষ্ঠান",
    "stats.areasCovered": "এলাকা অন্তর্ভুক্ত",
    "stats.tonnesRecycled": "টন পুনর্ব্যবহৃত",

    "section.whyTitle": "আয়োজনের জন্য প্রয়োজনীয় সবকিছু",
    "section.stepsTitle": "যেভাবে কাজ করে",

    "features.verified.t": "যাচাইকৃত কেন্দ্র",
    "features.verified.d": "প্রতিটি ICCMS কেন্দ্র ট্রেড লাইসেন্স ও অগ্নি নিরাপত্তা ছাড়পত্রসহ যাচাইকৃত।",
    "features.day.t": "পূর্ণ / অর্ধ দিন",
    "features.day.d": "পুরো দিন অথবা শুধু সকাল বা সন্ধ্যার সেশন বুক করুন।",
    "features.food.t": "ডেকরেটরের যোগাযোগ",
    "features.food.d": "পছন্দের কেন্দ্রের ডেকরেটরের নম্বর দেখুন।",
    "features.pay.t": "স্থানীয় পেমেন্ট",
    "features.pay.d": "অনলাইনে কোন পেমেন্ট মাধ্যম পাওয়া যাবে, তা ekPay-এর পেমেন্ট পেজে দেখা যাবে।",
    "features.owner.t": "মালিকের টুলস",
    "features.owner.d": "মালিকদের জন্য ইনভেন্টরি, এইচআরএম, পে-রোল ও খরচ ব্যবস্থাপনা।",
    "features.waste.t": "জিরো ওয়েস্ট",
    "features.waste.d": "অনুষ্ঠানের বর্জ্য যাচাইকৃত রিসাইক্লিং ও কম্পোস্ট পার্টনারে পাঠানো হয়।",

    "steps.browse.t": "সেন্টার খুঁজুন",
    "steps.browse.d": "এলাকা ও ধারণক্ষমতা অনুযায়ী খুঁজে রিভিউ এবং ডেকরেটরের যোগাযোগের তথ্য দেখুন।",
    "steps.pick.t": "ফোন নম্বর দিয়ে লগইন করুন",
    "steps.pick.d": "এসএমএস কোড দিয়ে নিবন্ধন করুন অথবা মোবাইল নম্বর দিয়ে লগইন করুন।",
    "steps.review.t": "বুকিংয়ের তথ্য দিন",
    "steps.review.d": "তারিখ, ফ্লোর ও সেশন বাছুন; অতিথি ও অনুষ্ঠান পরিচালনাকারীর তথ্য দিন। প্রথম বুকিংয়ে শুধু একবার এনআইডি লাগবে।",
    "steps.confirm.t": "যাচাই করে বুক করুন",
    "steps.confirm.d": "খরচ দেখে পরে পরিশোধ বা প্রাপ্য অনলাইন পেমেন্ট বাছুন, তারপর বুকিংয়ের অবস্থা দেখুন।",

    "lang.label": "ভাষা",
  },
};
