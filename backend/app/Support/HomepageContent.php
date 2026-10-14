<?php

namespace App\Support;

use App\Models\AppSetting;

/**
 * Editable marketing content for the public home page.
 * Stored as one JSON blob in app_settings so the super admin can change the
 * hero, stat strip, feature cards and "how it works" steps without a deploy.
 * Any missing key falls back to the shipped default below.
 */
class HomepageContent
{
    private const KEY = 'homepage_content';

    public static function defaults(): array
    {
        return [
            'hero' => [
                'badge' => 'ICCMS · DSCC',
                'title_lead' => 'Your event deserves the',
                'title_highlight' => 'perfect venue',
                'subtitle' => 'Book verified ICCMS community centres for weddings, corporate events & gatherings — full or half day, with decorator contacts, local payments and built-in zero waste management.',
                'search_placeholder' => 'Search by centre name or area…',
                'trust_badges' => ['100% verified venues', 'Local payment support', 'Zero waste ready'],
            ],
            'stats' => [
                ['label' => 'Verified Centres', 'value' => 120, 'suffix' => '+', 'icon' => 'ShieldCheck'],
                ['label' => 'Events Hosted', 'value' => 8400, 'suffix' => '+', 'icon' => 'CalendarDays'],
                ['label' => 'Areas Covered', 'value' => 25, 'suffix' => '', 'icon' => 'MapPin'],
                ['label' => 'Tonnes Recycled', 'value' => 32, 'suffix' => 'T', 'icon' => 'Recycle'],
            ],
            'features_heading' => 'Everything for a smooth event',
            'features_subheading' => 'ICCMS serves citizens, centre owners and DSCC administrators.',
            'features' => [
                ['icon' => 'ShieldCheck', 'title' => 'Verified Centres', 'description' => 'Every ICCMS centre is verified with trade license & fire safety clearance.'],
                ['icon' => 'CalendarDays', 'title' => 'Full / Half Day', 'description' => 'Book the entire day or just a morning or evening session.'],
                ['icon' => 'Phone', 'title' => 'Decorator Contact', 'description' => 'Find the decorator contact for your chosen centre.'],
                ['icon' => 'Wallet', 'title' => 'Local Payments', 'description' => 'Available online payment methods are shown on the ekPay checkout page.'],
                ['icon' => 'Recycle', 'title' => 'Zero Waste', 'description' => 'Event waste routed to verified recycling & compost partners.'],
            ],
            'steps_heading' => 'How it works',
            'steps' => [
                ['title' => 'Browse centres', 'description' => 'Search by area and capacity; compare reviews and decorator contacts.'],
                ['title' => 'Sign in by phone', 'description' => 'Register with an SMS code or sign in using your mobile number.'],
                ['title' => 'Choose your booking', 'description' => 'Pick date, floor and session; add guests and organiser details. NID is needed only on your first booking.'],
                ['title' => 'Review & reserve', 'description' => 'Check charges, choose pay later or online payment when available, then track your booking.'],
            ],
            'footer_links' => [
                ['label' => 'Dhaka South City Corporation', 'label_bn' => 'ঢাকা দক্ষিণ সিটি করপোরেশন', 'url' => 'https://dscc.gov.bd/'],
            ],
        ];
    }

    /** Keys holding ordered lists — these replace wholesale, never merge by index. */
    private const LISTS = ['stats', 'features', 'steps', 'footer_links'];

    /** Stored content merged over the defaults. */
    public static function get(): array
    {
        $saved = json_decode((string) AppSetting::get(self::KEY, ''), true);
        if (! is_array($saved)) {
            return self::defaults();
        }

        $content = self::defaults();
        foreach ($saved as $key => $value) {
            if (in_array($key, self::LISTS, true) && is_array($value)) {
                $content[$key] = array_values($value);   // deleting an item must stick
            } elseif ($key === 'hero' && is_array($value)) {
                $content['hero'] = array_replace($content['hero'], $value);
                if (isset($value['trust_badges']) && is_array($value['trust_badges'])) {
                    $content['hero']['trust_badges'] = array_values($value['trust_badges']);
                }
            } else {
                $content[$key] = $value;
            }
        }

        return $content;
    }

    public static function put(array $content): array
    {
        AppSetting::put(self::KEY, json_encode($content));

        return self::get();
    }

    public static function reset(): array
    {
        AppSetting::put(self::KEY, json_encode(self::defaults()));

        return self::defaults();
    }
}
