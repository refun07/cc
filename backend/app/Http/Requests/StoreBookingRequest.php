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
            'centre_floor_id' => ['nullable', 'integer', 'exists:centre_floors,id'],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:30'],
            'customer_email' => ['nullable', 'email', 'max:255'],
            'nid_number' => [\Illuminate\Validation\Rule::requiredIf(fn () => ! \App\Rules\PlausibleNid::accepts($this->user()?->nid_number)), 'nullable', new \App\Rules\PlausibleNid],
            'decorator_id' => ['nullable', 'integer', 'min:0'],
            'event_date' => ['required', 'date', 'after_or_equal:today'],
            'session_type' => ['required', 'in:full_day,half_day_morning,half_day_evening'],
            'guest_count' => ['required', 'integer', 'min:1'],
            'event_type' => ['nullable', 'string', 'max:255'],
            'event_manager_name' => ['nullable', 'required_with:event_manager_phone', 'string', 'max:255'],
            'event_manager_phone' => ['nullable', 'required_with:event_manager_name', 'regex:/^01[0-9]{9}$/'],
            'notes' => ['nullable', 'string'],
            'payment_option' => ['nullable', 'in:full,advance'],
            'expected_total_amount' => ['sometimes', 'numeric', 'min:0', 'decimal:0,2'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'booking_dates' => ['nullable', 'array', 'min:1', 'max:30'],
            'booking_dates.*.date' => ['required', 'date', 'after_or_equal:today', 'distinct'],
            'booking_dates.*.session_type' => ['required', 'in:full_day,half_day_morning,half_day_evening'],
        ];
    }
}
