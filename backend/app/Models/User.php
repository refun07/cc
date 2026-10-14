<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'phone',
        'password',
        'role',
        'status',
        'api_token',
        'nid_number',
        'area_scope',
        'coordinator_permissions',
        'caretaker_centre_id',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'api_token',
        'nid_number',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'nid_number' => 'encrypted',
            'coordinator_permissions' => 'array',
            'caretaker_centre_id' => 'integer',
        ];
    }

    public function coordinatorCentres()
    {
        return $this->belongsToMany(CommunityCentre::class, 'coordinator_centre', 'user_id', 'community_centre_id');
    }

    public function caretakerCentre()
    {
        return $this->belongsTo(CommunityCentre::class, 'caretaker_centre_id');
    }

    public function hasCoordinatorPermission(string $permission): bool
    {
        return in_array($this->role, ['project_coordinator', 'caretaker'], true)
            && in_array($permission, $this->coordinator_permissions ?? [], true);
    }

    public function coordinatesCentre(int $centreId): bool
    {
        return in_array($this->role, ['project_coordinator', 'caretaker'], true)
            && $this->assignedCentreIds()->contains($centreId);
    }

    public function assignedCentreIds()
    {
        $ids = $this->coordinatorCentres()->pluck('community_centres.id');
        if ($this->role === 'caretaker' && $this->caretaker_centre_id) {
            $ids->push($this->caretaker_centre_id);
        }
        return $ids->unique()->values();
    }

    public function scopeCaretakersForCentre($query, int $centreId)
    {
        return $query->where('role', 'caretaker')->where('status', 'active')
            ->where(fn ($q) => $q->where('caretaker_centre_id', $centreId)
                ->orWhereHas('coordinatorCentres', fn ($c) => $c->whereKey($centreId)));
    }
}
