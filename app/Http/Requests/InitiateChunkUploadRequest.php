<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class InitiateChunkUploadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'filename' => ['required', 'string', 'max:255'],
            'total_size_bytes' => ['required', 'integer', 'min:1'],
            'total_chunks' => ['required', 'integer', 'min:1'],
            'mime_type' => ['nullable', 'string', 'max:128'],
            'retention_days' => ['nullable', 'integer', 'min:1', 'max:3650'],
        ];
    }
}
