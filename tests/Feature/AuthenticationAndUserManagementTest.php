<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\SuperAdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthenticationAndUserManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_default_superadmin_can_login_with_default_credentials(): void
    {
        $this->seed(SuperAdminSeeder::class);

        $response = $this->postJson('/api/auth/login', [
            'login' => 'superadmin',
            'password' => '4dm1n',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('user.username', 'superadmin')
            ->assertJsonPath('user.role', 'superadmin');

        $this->assertAuthenticated();
    }

    public function test_management_routes_are_protected_against_unauthenticated_requests(): void
    {
        $response = $this->getJson('/api/management/stats');
        $response->assertStatus(401);

        $usersResponse = $this->getJson('/api/management/users');
        $usersResponse->assertStatus(401);
    }

    public function test_authenticated_user_can_manage_users(): void
    {
        $this->seed(SuperAdminSeeder::class);
        $superadmin = User::where('username', 'superadmin')->first();

        // 1. List users
        $response = $this->actingAs($superadmin)->getJson('/api/management/users');
        $response->assertStatus(200);

        // 2. Create a new user
        $createResponse = $this->actingAs($superadmin)->postJson('/api/management/users', [
            'name' => 'IT Admin',
            'username' => 'itadmin',
            'email' => 'itadmin@coss.local',
            'password' => 'secret123',
            'role' => 'admin',
        ]);

        $createResponse->assertStatus(201)
            ->assertJsonPath('user.username', 'itadmin');

        $this->assertDatabaseHas('users', [
            'username' => 'itadmin',
            'email' => 'itadmin@coss.local',
            'role' => 'admin',
        ]);

        $newUser = User::where('username', 'itadmin')->first();

        // 3. Update the user
        $updateResponse = $this->actingAs($superadmin)->putJson("/api/management/users/{$newUser->id}", [
            'name' => 'IT Admin Renamed',
            'username' => 'itadmin',
            'email' => 'itadmin@coss.local',
            'role' => 'admin',
        ]);

        $updateResponse->assertStatus(200)
            ->assertJsonPath('user.name', 'IT Admin Renamed');

        // 4. Delete the user
        $deleteResponse = $this->actingAs($superadmin)->deleteJson("/api/management/users/{$newUser->id}");
        $deleteResponse->assertStatus(200);

        $this->assertDatabaseMissing('users', [
            'id' => $newUser->id,
        ]);
    }
}
