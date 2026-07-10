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
    "nav.myProfile": "My profile",
    "nav.tagline": "Community Centre Booking",

    "hero.badge": "Dhaka South City Corporation · Official Marketplace",
    "hero.titleA": "Your event deserves the",
    "hero.titleB": "perfect venue",
    "hero.subtitle":
      "Book verified DSCC community centres for weddings, corporate events & gatherings — full or half day, with food menus, local payments and built-in zero waste management.",

    "stats.verifiedCentres": "Verified Centres",
    "stats.eventsHosted": "Events Hosted",
    "stats.areasCovered": "Areas Covered",
    "stats.tonnesRecycled": "Tonnes Recycled",

    "section.whyTitle": "Everything you need to host",
    "section.stepsTitle": "How it works",

    "features.verified.t": "Verified Centres",
    "features.verified.d": "Every DSCC centre is verified with trade license & fire safety clearance.",
    "features.day.t": "Full / Half Day",
    "features.day.d": "Book the entire day or just a morning or evening session.",
    "features.food.t": "Food Menus",
    "features.food.d": "Bangla, premium wedding, corporate or vegetarian packages.",
    "features.pay.t": "Local Payments",
    "features.pay.d": "bKash, Nagad, Rocket, Upay, SSLCommerz, card & bank transfer.",
    "features.owner.t": "Owner Tools",
    "features.owner.d": "Inventory, HRM, payroll & expense management for owners.",
    "features.waste.t": "Zero Waste",
    "features.waste.d": "Event waste routed to verified recycling & compost partners.",

    "steps.browse.t": "Browse & filter",
    "steps.browse.d": "Search verified centres by area, date, capacity and budget.",
    "steps.pick.t": "Pick session & menu",
    "steps.pick.d": "Choose full or half day and a food package for your guests.",
    "steps.review.t": "Review & pay",
    "steps.review.d": "See a transparent breakdown with VAT, then pay locally.",
    "steps.confirm.t": "Get confirmed",
    "steps.confirm.d": "Receive a booking number and track your event status.",

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
    "nav.myProfile": "আমার প্রোফাইল",
    "nav.tagline": "কমিউনিটি সেন্টার বুকিং",

    "hero.badge": "ঢাকা দক্ষিণ সিটি কর্পোরেশন · অফিসিয়াল মার্কেটপ্লেস",
    "hero.titleA": "আপনার অনুষ্ঠানের জন্য চাই",
    "hero.titleB": "সেরা ভেন্যু",
    "hero.subtitle":
      "বিয়ে, কর্পোরেট ইভেন্ট ও সামাজিক অনুষ্ঠানের জন্য যাচাইকৃত ডিএসসিসি কমিউনিটি সেন্টার বুক করুন — পূর্ণ বা অর্ধ দিন, খাবারের মেনু, স্থানীয় পেমেন্ট এবং জিরো ওয়েস্ট ব্যবস্থাপনাসহ।",

    "stats.verifiedCentres": "যাচাইকৃত কেন্দ্র",
    "stats.eventsHosted": "আয়োজিত অনুষ্ঠান",
    "stats.areasCovered": "এলাকা অন্তর্ভুক্ত",
    "stats.tonnesRecycled": "টন পুনর্ব্যবহৃত",

    "section.whyTitle": "আয়োজনের জন্য প্রয়োজনীয় সবকিছু",
    "section.stepsTitle": "যেভাবে কাজ করে",

    "features.verified.t": "যাচাইকৃত কেন্দ্র",
    "features.verified.d": "প্রতিটি ডিএসসিসি কেন্দ্র ট্রেড লাইসেন্স ও অগ্নি নিরাপত্তা ছাড়পত্রসহ যাচাইকৃত।",
    "features.day.t": "পূর্ণ / অর্ধ দিন",
    "features.day.d": "পুরো দিন অথবা শুধু সকাল বা সন্ধ্যার সেশন বুক করুন।",
    "features.food.t": "খাবারের মেনু",
    "features.food.d": "বাংলা, প্রিমিয়াম ওয়েডিং, কর্পোরেট বা নিরামিষ প্যাকেজ।",
    "features.pay.t": "স্থানীয় পেমেন্ট",
    "features.pay.d": "বিকাশ, নগদ, রকেট, উপায়, এসএসএলকমার্স, কার্ড ও ব্যাংক ট্রান্সফার।",
    "features.owner.t": "মালিকের টুলস",
    "features.owner.d": "মালিকদের জন্য ইনভেন্টরি, এইচআরএম, পে-রোল ও খরচ ব্যবস্থাপনা।",
    "features.waste.t": "জিরো ওয়েস্ট",
    "features.waste.d": "অনুষ্ঠানের বর্জ্য যাচাইকৃত রিসাইক্লিং ও কম্পোস্ট পার্টনারে পাঠানো হয়।",

    "steps.browse.t": "ব্রাউজ ও ফিল্টার",
    "steps.browse.d": "এলাকা, তারিখ, ধারণক্ষমতা ও বাজেট অনুযায়ী যাচাইকৃত কেন্দ্র খুঁজুন।",
    "steps.pick.t": "সেশন ও মেনু নির্বাচন",
    "steps.pick.d": "পূর্ণ বা অর্ধ দিন এবং অতিথিদের জন্য একটি খাবার প্যাকেজ বেছে নিন।",
    "steps.review.t": "রিভিউ ও পেমেন্ট",
    "steps.review.d": "ভ্যাটসহ স্বচ্ছ হিসাব দেখুন, তারপর স্থানীয়ভাবে পেমেন্ট করুন।",
    "steps.confirm.t": "নিশ্চিতকরণ",
    "steps.confirm.d": "একটি বুকিং নম্বর পান এবং আপনার অনুষ্ঠানের অবস্থা ট্র্যাক করুন।",

    "lang.label": "ভাষা",
  },
};
