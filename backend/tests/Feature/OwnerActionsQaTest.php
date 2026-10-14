<?php

namespace Tests\Feature;

use App\Models\CommunityCentre;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class OwnerActionsQaTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private CommunityCentre $centre;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create(['role' => 'owner', 'api_token' => Str::random(72)]);
        $this->centre = CommunityCentre::create(['owner_id' => $this->owner->id, 'name' => 'QA Centre', 'slug' => 'qa-centre', 'area' => 'Basabo', 'capacity' => 300, 'base_price' => 1000, 'half_day_price' => 1000, 'full_day_price' => 2000, 'status' => 'active']);
        $this->withToken($this->owner->api_token);
    }

    public function test_owner_read_actions_and_foreign_role_denial(): void
    {
        $paths = ['dashboard', 'bookings', 'decorators', 'availability', 'floors', 'profile', 'inventory', 'inventory-taxonomy', 'inventory-system', 'employees', 'attendance/report', 'hr-settings', 'expenses', 'waste', 'waste-partners', 'reports', 'payroll', 'accounting', 'crm'];
        foreach ($paths as $path) $this->getJson('/api/owner/'.$path)->assertOk();
        $customer = User::factory()->create(['role' => 'customer', 'api_token' => Str::random(72)]);
        $this->withToken($customer->api_token);
        foreach ($paths as $path) $this->getJson('/api/owner/'.$path)->assertForbidden();
    }

    public function test_expense_create_update_delete_validation_and_scope(): void
    {
        $this->postJson('/api/owner/expenses', ['title' => 'Invalid', 'amount' => -1])->assertUnprocessable();
        $id = $this->postJson('/api/owner/expenses', ['title' => 'Cleaning', 'amount' => 100.25, 'status' => 'pending'])->assertCreated()->json('data.id');
        $this->patchJson('/api/owner/expenses/'.$id, ['title' => 'Cleaning paid', 'amount' => 150.50, 'status' => 'paid'])->assertOk();
        $other = User::factory()->create(['role' => 'owner', 'api_token' => Str::random(72)]);
        $this->withToken($other->api_token)->deleteJson('/api/owner/expenses/'.$id)->assertForbidden();
        $this->withToken($this->owner->api_token)->deleteJson('/api/owner/expenses/'.$id)->assertOk();
        $this->assertDatabaseMissing('expenses', ['id' => $id]);
    }

    public function test_floor_and_facility_crud_are_scoped(): void
    {
        foreach (['floors' => ['name' => 'Ground Floor', 'capacity' => 80, 'full_day_price' => 1500], 'facilities' => ['name' => 'Parking', 'icon' => 'car']] as $path => $data) {
            $id = $this->postJson('/api/owner/'.$path, $data)->assertCreated()->json('data.id');
            $this->patchJson('/api/owner/'.$path.'/'.$id, ['name' => 'Updated'])->assertOk()->assertJsonPath('data.name', 'Updated');
            $other = User::factory()->create(['role' => 'owner', 'api_token' => Str::random(72)]);
            $this->withToken($other->api_token)->deleteJson('/api/owner/'.$path.'/'.$id)->assertForbidden();
            $this->withToken($this->owner->api_token)->deleteJson('/api/owner/'.$path.'/'.$id)->assertOk();
        }
    }

    public function test_employee_attendance_is_updated_without_duplicates(): void
    {
        $id = $this->postJson('/api/owner/employees', ['name' => 'QA Staff', 'phone' => '01711112222', 'salary' => 10000, 'joined_at' => '2026-10-01'])->assertCreated()->json('data.id');
        $this->patchJson('/api/owner/employees/'.$id, ['name' => 'Updated Staff', 'salary' => 12000])->assertOk();
        foreach (['present', 'absent'] as $status) $this->postJson('/api/owner/employees/'.$id.'/attendance', ['date' => '2026-10-12', 'status' => $status])->assertOk();
        $this->assertDatabaseCount('attendances', 1);
        $this->assertDatabaseHas('attendances', ['employee_id' => $id, 'status' => 'absent', 'check_in_at' => null]);
        $other = User::factory()->create(['role' => 'owner', 'api_token' => Str::random(72)]);
        $this->withToken($other->api_token)->postJson('/api/owner/employees/'.$id.'/attendance', ['status' => 'present'])->assertForbidden();
    }

    public function test_existing_unlinked_staff_account_cannot_be_taken_over_by_phone(): void
    {
        $victim = User::factory()->create(['role' => 'staff', 'phone' => '01711112222', 'api_token' => 'victim-token']);
        $hash = $victim->password;
        $employee = Employee::create(['centre_id' => $this->centre->id, 'name' => 'Duplicate phone', 'phone' => $victim->phone]);
        $this->postJson('/api/owner/employees/'.$employee->id.'/login', ['password' => 'changed-secret'])->assertUnprocessable();
        $this->assertSame($hash, $victim->fresh()->password);
        $this->assertNull($employee->fresh()->user_id);
    }

    public function test_payroll_generation_adjustment_and_paid_record_protection(): void
    {
        $employee = Employee::create(['centre_id' => $this->centre->id, 'name' => 'Payroll QA', 'salary' => 30000, 'employment_type' => 'monthly', 'status' => 'active']);
        $this->postJson('/api/owner/payroll/generate', ['month' => '2026-10'])->assertOk()->assertJsonPath('count', 1);
        $this->postJson('/api/owner/payroll/generate', ['month' => '2026-10'])->assertOk();
        $this->assertDatabaseCount('payrolls', 1);
        $id = \App\Models\Payroll::where('employee_id', $employee->id)->value('id');
        $this->patchJson('/api/owner/payroll/'.$id, ['bonus' => 500, 'deduction' => 200])->assertOk();
        $this->assertDatabaseHas('payrolls', ['id' => $id, 'net_salary' => 30300]);
        $other = User::factory()->create(['role' => 'owner', 'api_token' => Str::random(72)]);
        $this->withToken($other->api_token)->postJson('/api/owner/payroll/'.$id.'/pay', ['payment_method' => 'Cash'])->assertForbidden();
        $this->withToken($this->owner->api_token)->postJson('/api/owner/payroll/'.$id.'/pay', ['payment_method' => 'Cash'])->assertOk();
        $this->patchJson('/api/owner/payroll/'.$id, ['bonus' => 1000])->assertUnprocessable();
        $this->postJson('/api/owner/payroll/generate', ['month' => '2026-10'])->assertOk()->assertJsonPath('count', 0);
        $this->postJson('/api/owner/payroll/disburse-all', ['month' => '2026-10'])->assertOk()->assertJsonPath('count', 0);
        $this->assertDatabaseHas('payrolls', ['id' => $id, 'net_salary' => 30300, 'status' => 'paid']);
    }

    public function test_manual_ledger_bulk_validation_and_scoped_deletion(): void
    {
        $entry = ['type' => 'income', 'date' => '2026-10-12', 'description' => 'QA only', 'amount' => 100.25];
        $id = $this->postJson('/api/owner/ledger', $entry)->assertCreated()->json('data.id');
        $this->postJson('/api/owner/ledger/bulk', ['entries' => [$entry, array_merge($entry, ['amount' => -1])]])->assertUnprocessable();
        $this->assertDatabaseCount('ledger_entries', 1);
        $this->postJson('/api/owner/ledger/bulk', ['entries' => [$entry, array_merge($entry, ['type' => 'expense'])]])->assertCreated()->assertJsonPath('count', 2);
        $other = User::factory()->create(['role' => 'owner', 'api_token' => Str::random(72)]);
        $this->withToken($other->api_token)->deleteJson('/api/owner/ledger/'.$id)->assertForbidden();
        $this->withToken($this->owner->api_token)->deleteJson('/api/owner/ledger/'.$id)->assertOk();
        $this->assertDatabaseCount('ledger_entries', 2);
    }

    public function test_staff_password_reset_revokes_prior_token_and_empty_checkin_is_null(): void
    {
        $staff = User::factory()->create(['role' => 'staff', 'phone' => '01711112222', 'api_token' => 'old-staff-token']);
        $employee = Employee::create(['centre_id' => $this->centre->id, 'user_id' => $staff->id, 'name' => 'QA Staff', 'phone' => $staff->phone]);
        $this->postJson('/api/owner/employees/'.$employee->id.'/login', ['password' => 'new-qa-secret'])->assertOk();
        $this->assertTrue(Hash::check('new-qa-secret', $staff->fresh()->password));
        $this->assertNotSame('old-staff-token', $staff->fresh()->api_token);
        $this->withToken('old-staff-token')->getJson('/api/staff/me')->assertUnauthorized();
        $this->withToken($staff->fresh()->api_token)->getJson('/api/staff/me')->assertOk()->assertJsonPath('today_check_in', null);
    }
}
