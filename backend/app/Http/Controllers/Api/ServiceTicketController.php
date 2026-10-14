<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CommunityCentre;
use App\Models\ServiceTicket;
use App\Models\User;
use App\Services\Notify;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ServiceTicketController extends Controller
{
    private const ROLES = ['owner', 'caretaker', 'area_admin', 'project_coordinator', 'waste_partner', 'admin'];

    public function index(Request $request)
    {
        $user = $request->user();
        $this->allowRole($user);
        $filters = $request->validate(['status' => ['nullable', Rule::in(['open', 'in_progress', 'resolved', 'closed'])]]);

        $query = ServiceTicket::query()->with('centre:id,name,area', 'creator:id,name,role', 'assignee:id,name,role');
        if ($user->role === 'owner') {
            $query->whereIn('centre_id', CommunityCentre::where('owner_id', $user->id)->select('id'));
        } elseif ($user->role === 'caretaker') {
            $query->where(fn ($q) => $q->where('created_by', $user->id)->orWhere('assigned_to', $user->id));
        } elseif ($user->role === 'area_admin') {
            abort_if(blank($user->area_scope), 403);
            $query->whereHas('centre', fn ($centre) => $centre->where('working_area', $user->area_scope));
        } elseif ($user->role !== 'admin') {
            $query->where('assigned_to', $user->id);
        }
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        return response()->json(['data' => $query->latest()->paginate(20)]);
    }

    public function options(Request $request)
    {
        $user = $request->user();
        abort_unless(in_array($user->role, ['owner', 'caretaker', 'admin'], true), 403);
        $centres = CommunityCentre::query()
            ->when($user->role === 'owner', fn ($query) => $query->where('owner_id', $user->id))
            ->when($user->role === 'caretaker', fn ($query) => $query->whereIn('id', $user->assignedCentreIds()))
            ->orderBy('name')->get(['id', 'name', 'area', 'working_area']);
        $recipients = [];
        foreach ($centres as $centre) {
            $recipients[$centre->id] = $this->recipientsFor($centre)->map(fn ($recipient) => [
                'id' => $recipient->id, 'name' => $recipient->name, 'role' => $recipient->role,
            ])->values();
        }

        return response()->json(['data' => ['centres' => $centres, 'recipients' => $recipients]]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        abort_unless(in_array($user->role, ['owner', 'caretaker', 'admin'], true), 403);
        $data = $request->validate([
            'centre_id' => ['required', 'integer', 'exists:community_centres,id'],
            'assigned_to' => [Rule::requiredIf(fn () => $user->role !== 'caretaker'), 'nullable', 'integer', 'exists:users,id'],
            'subject' => ['required', 'string', 'min:3', 'max:150'],
            'description' => ['required', 'string', 'min:5', 'max:5000'],
        ]);
        $centre = CommunityCentre::findOrFail($data['centre_id']);
        abort_unless($user->role === 'admin' || ($user->role === 'owner' && $centre->owner_id === $user->id)
            || ($user->role === 'caretaker' && $user->coordinatesCentre($centre->id)), 403);
        if ($user->role === 'caretaker') {
            $assignee = User::where('role', 'area_admin')->where('status', 'active')
                ->where('area_scope', $centre->working_area)->orderBy('id')->first()
                ?? User::where('role', 'admin')->where('status', 'active')->orderBy('id')->first();
            abort_unless($assignee, 422, 'No active area or city administrator is available.');
            $data['assigned_to'] = $assignee->id;
        } else {
            abort_unless($this->recipientsFor($centre)->contains('id', (int) $data['assigned_to']), 422,
                'The selected recipient is not assigned to this centre.');
        }

        $ticket = DB::transaction(function () use ($data, $user) {
            $ticket = ServiceTicket::create($data + ['created_by' => $user->id, 'status' => 'open']);
            $ticket->actions()->create(['actor_id' => $user->id, 'action' => 'created', 'message' => $data['description']]);

            return $ticket;
        });
        Notify::send($ticket->assigned_to, 'New service ticket', "Ticket #{$ticket->id}: {$ticket->subject}", 'info', $this->linkFor($ticket->assignee));
        if ($user->role === 'caretaker') {
            $this->notifyAreaAdmins($centre, 'New service ticket', "Ticket #{$ticket->id}: {$ticket->subject}", $ticket->assigned_to);
        }
        Notify::admins('New service ticket', "Ticket #{$ticket->id}: {$ticket->subject}", 'info', '/admin/tickets');

        return response()->json(['data' => $this->detail($ticket)], 201);
    }

    public function show(Request $request, ServiceTicket $ticket)
    {
        $this->authorizeTicket($request->user(), $ticket);

        return response()->json(['data' => $this->detail($ticket)]);
    }

    public function act(Request $request, ServiceTicket $ticket)
    {
        $user = $request->user();
        $this->authorizeTicket($user, $ticket);
        $data = $request->validate([
            'action' => ['required', Rule::in(['comment', 'acknowledge', 'resolve', 'close', 'reopen'])],
            'message' => ['nullable', 'string', 'max:5000'],
        ]);
        if (in_array($data['action'], ['comment', 'resolve', 'reopen'], true)) {
            abort_unless(filled($data['message'] ?? null), 422, 'A message is required for this action.');
        }

        DB::transaction(function () use ($ticket, $user, $data) {
            $locked = ServiceTicket::whereKey($ticket->id)->lockForUpdate()->firstOrFail();
            $isAssignee = $locked->assigned_to === $user->id;
            $isAdmin = $user->role === 'admin';
            $isOwner = ($user->role === 'owner' && $locked->centre()->where('owner_id', $user->id)->exists())
                || ($user->role === 'caretaker' && $locked->created_by === $user->id);
            $action = $data['action'];

            if ($action === 'comment') {
                abort_if($locked->status === 'closed', 422, 'Reopen this ticket before adding an update.');
            } elseif ($action === 'acknowledge') {
                abort_unless(($isAssignee || $isAdmin) && $locked->status === 'open', 403);
                $locked->status = 'in_progress';
                $locked->first_responded_at ??= now();
            } elseif ($action === 'resolve') {
                abort_unless(($isAssignee || $isAdmin) && $locked->status === 'in_progress', 403);
                $locked->status = 'resolved';
                $locked->resolved_at = now();
            } elseif ($action === 'close') {
                abort_unless(($isOwner || $isAdmin) && $locked->status === 'resolved', 403);
                $locked->status = 'closed';
            } else {
                abort_unless(($isOwner || $isAdmin) && in_array($locked->status, ['resolved', 'closed'], true), 403);
                $locked->status = 'open';
                $locked->resolved_at = null;
            }
            $locked->save();
            $locked->actions()->create([
                'actor_id' => $user->id, 'action' => $action, 'message' => $data['message'] ?? null,
            ]);
        });

        $ticket->refresh();
        $summary = "Ticket #{$ticket->id}: {$data['action']}";
        foreach (array_unique([$ticket->created_by, $ticket->assigned_to]) as $recipientId) {
            if ($recipientId !== $user->id) {
                $recipient = User::find($recipientId);
                Notify::send($recipientId, 'Service ticket updated', $summary, 'info', $this->linkFor($recipient));
            }
        }
        Notify::admins('Service ticket updated', $summary, 'info', '/admin/tickets');
        $this->notifyAreaAdmins($ticket->centre, 'Service ticket updated', $summary, $user->id);

        return response()->json(['data' => $this->detail($ticket)]);
    }

    private function detail(ServiceTicket $ticket): ServiceTicket
    {
        return $ticket->load('centre:id,name,area', 'creator:id,name,role', 'assignee:id,name,role', 'actions.actor:id,name,role');
    }

    private function authorizeTicket(User $user, ServiceTicket $ticket): void
    {
        $this->allowRole($user);
        abort_unless($user->role === 'admin' || $ticket->assigned_to === $user->id
            || ($user->role === 'owner' && $ticket->centre()->where('owner_id', $user->id)->exists())
            || ($user->role === 'caretaker' && $ticket->created_by === $user->id)
            || ($user->role === 'area_admin' && filled($user->area_scope)
                && $ticket->centre()->where('working_area', $user->area_scope)->exists()), 403);
    }

    private function notifyAreaAdmins(CommunityCentre $centre, string $title, string $body, ?int $excludeId = null): void
    {
        User::where('role', 'area_admin')->where('status', 'active')
            ->where('area_scope', $centre->working_area)
            ->when($excludeId, fn ($query) => $query->where('id', '!=', $excludeId))
            ->pluck('id')->each(fn ($id) => Notify::send($id, $title, $body, 'info', '/area/tickets'));
    }

    private function allowRole(User $user): void
    {
        abort_unless(in_array($user->role, self::ROLES, true), 403);
    }

    private function recipientsFor(CommunityCentre $centre)
    {
        return User::where('status', 'active')->where(function ($query) use ($centre) {
            $query->where(fn ($area) => $area->where('role', 'area_admin')->where('area_scope', $centre->working_area))
                ->orWhere(fn ($coordinator) => $coordinator->where('role', 'project_coordinator')
                    ->whereHas('coordinatorCentres', fn ($centres) => $centres->whereKey($centre->id)))
                ->orWhere(fn ($caretaker) => $caretaker->caretakersForCentre($centre->id))
                ->orWhere('role', 'waste_partner');
        })->orderBy('role')->orderBy('name')->get(['id', 'name', 'role']);
    }

    private function linkFor(?User $user): ?string
    {
        return match ($user?->role) {
            'owner' => '/owner/tickets',
            'caretaker' => '/caretaker/tickets',
            'area_admin' => '/area/tickets',
            'project_coordinator' => '/coordinator/tickets',
            'waste_partner' => '/partner/tickets',
            'admin' => '/admin/tickets',
            default => null,
        };
    }
}
