<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class CentreDetailResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'area' => $this->area,
            'address' => $this->address,
            'description' => $this->description,
            'decorator_phone' => $this->decorator_phone,
            'decorator_name' => $this->decorator_name,
            'decorators' => $this->decorators->where('status', 'active')->values()->map(fn ($decorator) => [
                'id' => $decorator->id,
                'name' => $decorator->name,
                'phone' => $decorator->phone,
                'service_area' => $decorator->service_area,
                'address' => $decorator->address,
                'description' => $decorator->description,
            ]),
            'capacity' => $this->capacity,
            'base_price' => (float) $this->base_price,
            'half_day_price' => (float) $this->half_day_price,
            'full_day_price' => (float) $this->full_day_price,
            'starting_price' => (float) min($this->half_day_price, $this->full_day_price),
            'rating' => (float) $this->rating,
            'is_verified' => (bool) $this->is_verified,
            'virtual_tour_url' => $this->virtual_tour_url,
            'cover_image' => $this->cover_image,
            'images' => $this->images->map(fn ($i) => [
                'id' => $i->id,
                'image_path' => $i->image_path,
                'type' => $i->type,
            ]),
            'facilities' => $this->facilities->map(fn ($f) => [
                'name' => $f->name,
                'icon' => $f->icon,
            ]),
            // Empty means the venue is booked as a single unit (no floor choice).
            'floors' => $this->floors->where('status', 'active')->values()->map(fn ($f) => [
                'id' => $f->id,
                'name' => $f->name,
                'description' => $f->description,
                'capacity' => (int) ($f->capacity ?: $this->capacity),
                'half_day_price' => (float) ($f->half_day_price ?: $this->half_day_price),
                'full_day_price' => (float) ($f->full_day_price ?: $this->full_day_price),
            ]),
        ];
    }
}
