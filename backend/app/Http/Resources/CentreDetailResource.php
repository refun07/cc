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
            'food_menus' => $this->foodMenus->where('status', 'active')->values()->map(fn ($m) => [
                'id' => $m->id,
                'name' => $m->name,
                'description' => $m->description,
                'items' => $m->items,
                'menu_type' => $m->menu_type,
                'price_per_person' => (float) $m->price_per_person,
                'min_guest_count' => $m->min_guest_count,
            ]),
        ];
    }
}
