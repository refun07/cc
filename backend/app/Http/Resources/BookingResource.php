<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class BookingResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'booking_no' => $this->booking_no,
            'centre' => [
                'name' => $this->centre?->name,
                'slug' => $this->centre?->slug,
                'area' => $this->centre?->area,
            ],
            'customer_name' => $this->customer_name,
            'customer_phone' => $this->customer_phone,
            'customer_email' => $this->customer_email,
            'event_date' => $this->event_date?->format('Y-m-d'),
            'session_type' => $this->session_type,
            'booking_dates' => $this->relationLoaded('bookingDates') && $this->bookingDates->isNotEmpty()
                ? $this->bookingDates->map(fn ($slot) => [
                    'id' => $slot->id,
                    'date' => $slot->date?->format('Y-m-d'),
                    'session_type' => $slot->session_type,
                ])->values()
                : [[
                    'date' => $this->event_date?->format('Y-m-d'),
                    'session_type' => $this->session_type,
                ]],
            'date_count' => $this->relationLoaded('bookingDates') && $this->bookingDates->isNotEmpty() ? $this->bookingDates->count() : 1,
            'guest_count' => $this->guest_count,
            'event_type' => $this->event_type,
            'venue_amount' => (float) $this->venue_amount,
            'food_amount' => (float) $this->food_amount,
            'service_charge' => (float) $this->service_charge,
            'vat_amount' => (float) $this->vat_amount,
            'adjustment_amount' => (float) $this->adjustment_amount,
            'adjustment_reason' => $this->adjustment_reason,
            'total_amount' => (float) $this->total_amount,
            'payment_option' => $this->payment_option,
            'advance_amount' => (float) $this->advance_amount,
            'paid_amount' => (float) $this->paid_amount,
            'due_amount' => (float) $this->due_amount,
            'refunded_amount' => (float) $this->refunded_amount,
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'cancellation_reason' => $this->cancellation_reason,
            'status' => $this->status,
            'notes' => $this->notes,
            'food_items' => $this->foodItems->map(fn ($f) => [
                'menu_name' => $f->menu_name,
                'quantity' => $f->quantity,
                'unit_price' => (float) $f->unit_price,
                'total_price' => (float) $f->total_price,
            ]),
            'payment' => $this->whenLoaded('payment', fn () => $this->payment ? [
                'payment_method' => $this->payment->payment_method,
                'transaction_id' => $this->payment->transaction_id,
                'status' => $this->payment->status,
                'amount' => (float) $this->payment->amount,
            ] : null),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
