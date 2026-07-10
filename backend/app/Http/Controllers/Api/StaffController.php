<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Employee;
use App\Models\Payroll;
use Illuminate\Http\Request;

class StaffController extends Controller
{
    protected function employee(Request $request): Employee
    {
        $employee = Employee::where('user_id', $request->user()->id)->with('centre:id,name,area')->first();
        abort_unless($employee, 404, 'No staff profile linked to this account.');

        return $employee;
    }

    public function me(Request $request)
    {
        $e = $this->employee($request);
        $today = now()->toDateString();

        return response()->json([
            'profile' => [
                'name' => $e->name,
                'employee_code' => $e->employee_code,
                'designation' => $e->designation,
                'phone' => $e->phone,
                'salary' => (float) $e->salary,
                'status' => $e->status,
                'joined_at' => $e->joined_at,
                'centre' => $e->centre?->name,
                'area' => $e->centre?->area,
            ],
            'today_attendance' => Attendance::where('employee_id', $e->id)->where('date', $today)->value('status'),
            'today_check_in' => optional(Attendance::where('employee_id', $e->id)->where('date', $today)->value('check_in_at'))
                ? \Illuminate\Support\Carbon::parse(Attendance::where('employee_id', $e->id)->where('date', $today)->value('check_in_at'))->format('h:i A')
                : null,
            'stats' => [
                'present_30d' => Attendance::where('employee_id', $e->id)->where('date', '>=', now()->subDays(30)->toDateString())->where('status', 'present')->count(),
                'absent_30d' => Attendance::where('employee_id', $e->id)->where('date', '>=', now()->subDays(30)->toDateString())->where('status', 'absent')->count(),
                'paid_payslips' => Payroll::where('employee_id', $e->id)->where('status', 'paid')->count(),
            ],
        ]);
    }

    public function attendance(Request $request)
    {
        $e = $this->employee($request);
        $rows = Attendance::where('employee_id', $e->id)->orderByDesc('date')->limit(60)->get(['date', 'status', 'check_in_at', 'logged_by']);

        return response()->json(['data' => $rows]);
    }

    /** Employee self check-in for today. */
    public function checkIn(Request $request)
    {
        $e = $this->employee($request);
        $today = now()->toDateString();

        $existing = Attendance::where('employee_id', $e->id)->where('date', $today)->first();
        if ($existing && $existing->check_in_at) {
            return response()->json(['message' => 'You have already checked in today.'], 422);
        }

        // Late cutoff resolves employee → centre → global default.
        $cutoff = $e->late_after ?: $e->centre?->hr_late_cutoff ?: \App\Models\AppSetting::get('late_cutoff', '10:00');
        $late = now()->format('H:i') > $cutoff;
        $att = Attendance::updateOrCreate(
            ['employee_id' => $e->id, 'date' => $today],
            ['status' => $late ? 'late' : 'present', 'check_in_at' => now(), 'logged_by' => 'self']
        );

        return response()->json([
            'message' => 'Checked in at '.now()->format('h:i A').($late ? ' (marked late).' : '.'),
            'data' => ['status' => $att->status, 'check_in_at' => $att->check_in_at->format('h:i A')],
        ]);
    }

    public function payslips(Request $request)
    {
        $e = $this->employee($request);
        $rows = Payroll::where('employee_id', $e->id)->orderByDesc('month')->get();

        return response()->json(['data' => $rows]);
    }
}
