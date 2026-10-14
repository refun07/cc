<?php

namespace App\Support;

use App\Models\AppSetting;

class GuideContent
{
    private const KEY = 'booking_guides';

    public static function defaults(): array
    {
        return [
            [
                'slug' => 'find-a-centre',
                'title' => 'Find the right centre',
                'title_bn' => 'পছন্দের সেন্টার খুঁজুন',
                'summary' => 'Compare centres by area, capacity, facilities and reviews before choosing a date.',
                'summary_bn' => 'এলাকা, ধারণক্ষমতা, সুবিধা ও রিভিউ দেখে সেন্টার বাছুন।',
                'body' => "Open Centres and search by centre name or area. Use the filters to narrow the list.\n\nOpen a centre to check its floors, capacity, facilities, decorator contact and customer reviews. Select the floor and date that suit your event.\n\nA full-day booking uses the whole day. Morning and evening half-day sessions can be booked separately when available.",
                'body_bn' => "সেন্টার পেজে গিয়ে নাম বা এলাকা দিয়ে খুঁজুন। প্রয়োজনমতো ফিল্টার ব্যবহার করুন।\n\nএকটি সেন্টার খুলে ফ্লোর, ধারণক্ষমতা, সুবিধা, ডেকরেটরের যোগাযোগ ও গ্রাহকের রিভিউ দেখুন। এরপর আপনার অনুষ্ঠানের ফ্লোর ও তারিখ বাছুন।\n\nপূর্ণ দিনের বুকিংয়ে সারাদিন পাওয়া যায়। খালি থাকলে সকাল ও সন্ধ্যার অর্ধ-দিনের সেশন আলাদাভাবে বুক করা যায়।",
                'video_url' => null,
                'published' => true,
            ],
            [
                'slug' => 'create-account',
                'title' => 'Create an account with your phone',
                'title_bn' => 'মোবাইল নম্বর দিয়ে অ্যাকাউন্ট খুলুন',
                'summary' => 'Register or sign in using your mobile number so you can manage bookings.',
                'summary_bn' => 'মোবাইল নম্বর দিয়ে রেজিস্ট্রেশন বা লগইন করে বুকিং পরিচালনা করুন।',
                'body' => "Select Sign in, then create an account with your mobile number if you are new. Enter the SMS code when requested.\n\nYou do not need to provide your NID while registering. Keep access to your mobile number because it is also used for password recovery.",
                'body_bn' => "সাইন ইন চাপুন। নতুন হলে মোবাইল নম্বর দিয়ে অ্যাকাউন্ট খুলুন এবং চাওয়া হলে SMS কোড দিন।\n\nঅ্যাকাউন্ট খোলার সময় NID নম্বর লাগবে না। পাসওয়ার্ড ভুলে গেলেও আপনার মোবাইল নম্বর প্রয়োজন হবে।",
                'video_url' => null,
                'published' => true,
            ],
            [
                'slug' => 'place-a-booking',
                'title' => 'Place and review your booking',
                'title_bn' => 'বুকিং করুন ও তথ্য যাচাই করুন',
                'summary' => 'Choose a floor, date and session, then review the charges and submit.',
                'summary_bn' => 'ফ্লোর, তারিখ ও সেশন বেছে খরচ যাচাই করে বুকিং জমা দিন।',
                'body' => "After choosing a centre, select the floor, event date and full-day or half-day session. Enter the event details and guest count.\n\nYour NID number is requested on your first booking, not at registration. Review the booking details and total charge before confirming. You can return to My bookings to check the status.",
                'body_bn' => "সেন্টার বেছে ফ্লোর, অনুষ্ঠানের তারিখ এবং পূর্ণ দিন বা অর্ধ-দিনের সেশন নির্বাচন করুন। অনুষ্ঠানের তথ্য ও অতিথির সংখ্যা দিন।\n\nপ্রথম বুকিংয়ের সময় NID নম্বর চাওয়া হবে; রেজিস্ট্রেশনের সময় নয়। নিশ্চিত করার আগে বুকিংয়ের তথ্য ও মোট খরচ দেখে নিন। পরে ‘আমার বুকিং’ থেকে অবস্থা দেখতে পারবেন।",
                'video_url' => null,
                'published' => true,
            ],
            [
                'slug' => 'payment-and-status',
                'title' => 'Understand payment and booking status',
                'title_bn' => 'পেমেন্ট ও বুকিংয়ের অবস্থা বুঝুন',
                'summary' => 'See how to pay when available and where to track the remaining balance.',
                'summary_bn' => 'পেমেন্টের সুযোগ ও বকেয়া কোথায় দেখবেন জেনে নিন।',
                'body' => "At checkout, review the payment choices shown for your booking. If online payment is available, the app sends you to ekPay to select a payment method there. The available methods are determined by ekPay.\n\nIf you choose Pay later, the booking remains unpaid until payment is recorded. Open My bookings to see the current status and any remaining balance. Do not treat a redirect alone as proof of payment; wait for the confirmed status.",
                'body_bn' => "চেকআউটে আপনার বুকিংয়ের জন্য দেখানো পেমেন্টের বিকল্পগুলো দেখুন। অনলাইন পেমেন্ট চালু থাকলে অ্যাপ আপনাকে ekPay-তে পাঠাবে; সেখানে মাধ্যম বাছবেন। কোন মাধ্যম পাওয়া যাবে তা ekPay নির্ধারণ করে।\n\n‘পরে পরিশোধ’ বেছে নিলে পেমেন্ট রেকর্ড হওয়া পর্যন্ত বুকিংটি অপরিশোধিত থাকবে। বর্তমান অবস্থা ও বকেয়া ‘আমার বুকিং’ পেজে দেখুন। শুধু redirect হওয়াকে পেমেন্ট সম্পন্ন হওয়ার প্রমাণ ভাববেন না; নিশ্চিত status দেখুন।",
                'video_url' => null,
                'published' => true,
            ],
        ];
    }

    public static function all(): array
    {
        $saved = json_decode((string) AppSetting::get(self::KEY, ''), true);

        return is_array($saved) && array_is_list($saved) ? $saved : self::defaults();
    }

    public static function published(): array
    {
        return array_values(array_filter(self::all(), fn ($guide) => ($guide['published'] ?? false) === true));
    }

    public static function put(array $guides): array
    {
        AppSetting::put(self::KEY, json_encode(array_values($guides), JSON_UNESCAPED_UNICODE));

        return self::all();
    }

    public static function youtubeId(?string $url): ?string
    {
        if (! $url || parse_url($url, PHP_URL_SCHEME) !== 'https') {
            return null;
        }

        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        $path = trim((string) parse_url($url, PHP_URL_PATH), '/');
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);

        if (in_array($host, ['youtu.be', 'www.youtu.be'], true)) {
            $id = $path;
        } elseif (in_array($host, ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'], true)) {
            $id = $path === 'watch' ? ($query['v'] ?? '') : (preg_match('~^(?:embed|shorts|live)/([A-Za-z0-9_-]+)$~', $path, $match) ? $match[1] : '');
        } else {
            return null;
        }

        return is_string($id) && preg_match('/^[A-Za-z0-9_-]{11}$/', $id) ? $id : null;
    }
}
