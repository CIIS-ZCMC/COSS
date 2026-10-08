<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Authenticate user with username or email.
     */
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'login' => ['required', 'string'],
            'password' => ['required', 'string'],
            'remember' => ['nullable', 'boolean'],
        ]);

        $loginField = filter_var($credentials['login'], FILTER_VALIDATE_EMAIL) ? 'email' : 'username';

        $attemptCredentials = [
            $loginField => $credentials['login'],
            'password' => $credentials['password'],
        ];

        if (Auth::attempt($attemptCredentials, (bool) ($credentials['remember'] ?? false))) {
            $request->session()->regenerate();

            return response()->json([
                'message' => 'Logged in successfully.',
                'user' => Auth::user(),
            ]);
        }

        throw ValidationException::withMessages([
            'login' => ['Invalid username/email or password.'],
        ]);
    }

    /**
     * Log the current user out.
     */
    public function logout(Request $request): JsonResponse
    {
        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }

    /**
     * Get the authenticated user.
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $request->user(),
        ]);
    }
}
