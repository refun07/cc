<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class PlausibleNid implements ValidationRule
{
    public static function accepts(mixed $value): bool
    {
        $nid = (string) $value;
        return (bool) (preg_match('/^(?:[0-9]{10}|[0-9]{13}|[0-9]{17})$/D', $nid)
            && ! preg_match('/^([0-9])\1+$/D', $nid)
            && ! str_contains('012345678901234567890123456789', $nid)
            && ! str_contains('987654321098765432109876543210', $nid));
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! self::accepts($value)) {
            $fail('Enter a valid 10, 13 or 17 digit NID number. Repeated or sequential digits are not accepted.');
        }
    }
}
