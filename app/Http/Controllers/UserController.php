<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * List all users.
     */
    public function index(): JsonResponse
    {
        $users = User::select(['id', 'name', 'username', 'email', 'role', 'created_at', 'updated_at'])
            ->orderBy('id', 'asc')
            ->get();

        return response()->json($users);
    }

    /**
     * Create a new user.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:255', 'unique:users,username'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:4'],
            'role' => ['required', 'string', 'in:superadmin,admin,user'],
        ]);

        $validated['password'] = Hash::make($validated['password']);

        $user = User::create($validated);

        return response()->json([
            'message' => 'User created successfully.',
            'user' => $user->makeHidden(['password', 'remember_token']),
        ], 201);
    }

    /**
     * Update an existing user.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:255', Rule::unique('users', 'username')->ignore($user->id)],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:4'],
            'role' => ['required', 'string', 'in:superadmin,admin,user'],
        ]);

        // Prevent demoting the last superadmin
        if ($user->role === 'superadmin' && $validated['role'] !== 'superadmin') {
            $superadminCount = User::where('role', 'superadmin')->count();
            if ($superadminCount <= 1) {
                return response()->json([
                    'message' => 'Cannot change role. At least one superadmin is required in the system.',
                ], 422);
            }
        }

        if (! empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $user->update($validated);

        return response()->json([
            'message' => 'User updated successfully.',
            'user' => $user->makeHidden(['password', 'remember_token']),
        ]);
    }

    /**
     * Delete an existing user.
     */
    public function destroy(int $id): JsonResponse
    {
        $currentUser = Auth::user();

        if ($currentUser && $currentUser->id === $id) {
            return response()->json([
                'message' => 'You cannot delete your own logged-in user account.',
            ], 422);
        }

        $user = User::findOrFail($id);

        if ($user->role === 'superadmin') {
            $superadminCount = User::where('role', 'superadmin')->count();
            if ($superadminCount <= 1) {
                return response()->json([
                    'message' => 'Cannot delete the only remaining superadmin account.',
                ], 422);
            }
        }

        $user->delete();

        return response()->json([
            'message' => 'User deleted successfully.',
        ]);
    }
}
