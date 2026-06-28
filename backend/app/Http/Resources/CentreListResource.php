<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class CentreListResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'area' => $this->area,
            'capacity' => $this->capacity,
            'starting_price' => (float) min($this->half_day_price, $this->full_day_price),
            'half_day_price' => (float) $this->half_day_price,
            'full_day_price' => (float) $this->full_day_price,
            'rating' => (float) $this->rating,
            'is_verified' => (bool) $this->is_verified,
            'cover_image' => $this->cover_image,
            'facilities' => $this->whenLoaded('facilities', fn () => $this->facilities->pluck('name')),
        ];
    }
}
