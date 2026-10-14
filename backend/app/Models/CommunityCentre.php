<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CommunityCentre extends Model
{
    protected $guarded = [];

    protected $attributes = [
        'booking_prefix' => 'ICCMS',
    ];

    protected $casts = [
        'is_verified' => 'boolean',
        'base_price' => 'decimal:2',
        'half_day_price' => 'decimal:2',
        'full_day_price' => 'decimal:2',
        'commission_rate' => 'decimal:2',
        'rating' => 'decimal:2',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $centre) {
            if (blank($centre->working_area)) {
                $centre->working_area = $centre->area;
            }
        });
    }

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function images()
    {
        return $this->hasMany(CentreImage::class, 'centre_id')->orderBy('sort_order');
    }

    public function floors()
    {
        return $this->hasMany(CentreFloor::class, 'centre_id')->orderBy('sort_order')->orderBy('id');
    }

    /** Active, bookable floors. Empty means the venue is booked as a single unit. */
    public function activeFloors()
    {
        return $this->floors()->where('status', 'active');
    }

    public function facilities()
    {
        return $this->hasMany(CentreFacility::class, 'centre_id');
    }

    public function foodMenus()
    {
        return $this->hasMany(FoodMenu::class, 'centre_id');
    }

    public function decorators()
    {
        return $this->hasMany(CentreDecorator::class, 'centre_id');
    }

    public function availabilitySlots()
    {
        return $this->hasMany(AvailabilitySlot::class, 'centre_id');
    }

    public function bookings()
    {
        return $this->hasMany(Booking::class, 'centre_id');
    }

    public function settlements()
    {
        return $this->hasMany(Settlement::class, 'centre_id');
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }
}
