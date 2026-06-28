<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'centre_slug' => ['required', 'string', 'exists:community_centres,slug'],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:30'],
            'customer_email' => ['nullable', 'email', 'max:255'],
            'event_date' => ['required', 'date', 'after_or_equal:today'],
            'session_type' => ['required', 'in:full_day,half_day_morning,half_day_evening'],
            'guest_count' => ['required', 'integer', 'min:1'],
            'event_type' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'food_selections' => ['nullable', 'array'],
            'food_selections.*.food_menu_id' => ['required', 'integer', 'distinct', 'exists:food_menus,id'],
            'food_selections.*.quantity' => ['nullable', 'integer', 'min:1'],
            'payment_option' => ['nullable', 'in:full,advance'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'booking_dates' => ['nullable', 'array', 'min:1', 'max:30'],
            'booking_dates.*.date' => ['required', 'date', 'after_or_equal:today', 'distinct'],
            'booking_dates.*.session_type' => ['required', 'in:full_day,half_day_morning,half_day_evening'],
        ];
    }
}
