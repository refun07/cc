<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;

/**
 * Extracts structured fields from a photographed/scanned document (ID card,
 * accounts register, supplier invoice) using a vision LLM, so panel forms can
 * be auto-filled. Works with a FREE Google Gemini key or an Anthropic key —
 * whichever is configured (Gemini takes priority).
 */
class NidScanner
{
    /** Read a national ID card into name / nid / dob / address. */
    public function extract(UploadedFile $file): array
    {
        $prompt = <<<'TXT'
You are reading a Bangladeshi National ID (NID) card — it may be a single image or a
PDF with both the front and the back. Read BOTH sides if present.
Extract these fields and reply with ONLY a JSON object, no prose:
{
  "name": string,              // the ENGLISH name printed under "Name" (e.g. "MD. AZMIR SHABIB")
  "nid": string,               // the "NID No" digits ONLY, no spaces (e.g. "3730124389"). Prefer the printed NID No over the MRZ code.
  "date_of_birth": string,     // from "Date of Birth", as ISO YYYY-MM-DD
  "address": string            // the address from the back ("ঠিকানা"); keep Bangla text as-is
}
Layout hints:
- Front: Bangla name, then "Name" in English, father/mother names, "Date of Birth", "NID No".
- Back: "ঠিকানা" (address), Blood Group, Place of Birth, and an MRZ block of <<< characters.
- The NID No on the front may contain spaces — remove them. It is usually 10, 13 or 17 digits.
Use "" for any field you genuinely cannot read. Do not invent values.
TXT;

        $data = $this->visionJson($file, $prompt, 400);

        return [
            'name' => trim($data['name'] ?? '') ?: null,
            'nid' => preg_replace('/\D/', '', $data['nid'] ?? '') ?: null,
            'date_of_birth' => $this->normalizeDate($data['date_of_birth'] ?? ''),
            'address' => trim($data['address'] ?? '') ?: null,
        ];
    }

    /** Read a handwritten/printed accounts register or receipt into ledger rows. */
    public function extractLedger(UploadedFile $file): array
    {
        $today = now()->format('Y-m-d');
        $prompt = <<<TXT
You are reading a photo or scanned PDF of a handwritten or printed accounts register / receipt for a community centre.
Extract every transaction line. Reply with ONLY a JSON array, no prose:
[
  { "type": "income" | "expense", "date": "YYYY-MM-DD", "category": string, "description": string, "amount": number }
]
Rules:
- "type": money coming in = "income", money going out = "expense". If unclear, use "expense".
- "date": ISO YYYY-MM-DD. If a row has no date, use "$today".
- "category": a short label (e.g. Utilities, Maintenance, Catering, Rent, Misc). Guess sensibly.
- "amount": positive number only, no currency symbols or commas.
- Skip totals/subtotal rows. Return [] if nothing is readable.
TXT;

        $rows = $this->visionJson($file, $prompt, 1500, '[');

        return collect($rows)->map(fn ($r) => [
            'type' => in_array(($r['type'] ?? ''), ['income', 'expense'], true) ? $r['type'] : 'expense',
            'date' => $this->normalizeDate($r['date'] ?? '') ?? $today,
            'category' => trim((string) ($r['category'] ?? '')) ?: 'Misc',
            'description' => trim((string) ($r['description'] ?? '')) ?: 'Entry',
            'amount' => round((float) preg_replace('/[^0-9.]/', '', (string) ($r['amount'] ?? 0)), 2),
        ])->filter(fn ($r) => $r['amount'] > 0)->values()->all();
    }

    /** Read a supplier invoice / quotation into a draft purchase order. */
    public function extractPurchaseOrder(UploadedFile $file): array
    {
        $today = now()->format('Y-m-d');
        $prompt = <<<TXT
You are reading a supplier invoice, quotation or purchase order for a community centre.
Reply with ONLY a JSON object, no prose:
{
  "supplier_name": string,
  "order_date": "YYYY-MM-DD",
  "expected_date": "YYYY-MM-DD" or "",
  "discount": number,
  "tax": number,
  "notes": string,
  "lines": [ { "name": string, "quantity": number, "unit_cost": number } ]
}
Rules:
- Dates in ISO YYYY-MM-DD. If order date missing use "$today". "" for missing expected date.
- Numbers only, no currency symbols or commas. Use 0 when absent.
- "lines": one object per product row (skip totals/subtotal/tax rows).
- Use "" / [] for anything unreadable.
TXT;

        $d = $this->visionJson($file, $prompt, 1500);

        $lines = collect($d['lines'] ?? [])->map(fn ($r) => [
            'name' => trim((string) ($r['name'] ?? '')),
            'quantity' => max(round((float) preg_replace('/[^0-9.]/', '', (string) ($r['quantity'] ?? 0)), 2), 0),
            'unit_cost' => max(round((float) preg_replace('/[^0-9.]/', '', (string) ($r['unit_cost'] ?? 0)), 2), 0),
        ])->filter(fn ($r) => $r['name'] !== '' && $r['quantity'] > 0)->values()->all();

        return [
            'supplier_name' => trim((string) ($d['supplier_name'] ?? '')) ?: null,
            'order_date' => $this->normalizeDate($d['order_date'] ?? '') ?? $today,
            'expected_date' => $this->normalizeDate($d['expected_date'] ?? ''),
            'discount' => max(round((float) ($d['discount'] ?? 0), 2), 0),
            'tax' => max(round((float) ($d['tax'] ?? 0), 2), 0),
            'notes' => trim((string) ($d['notes'] ?? '')) ?: null,
            'lines' => $lines,
        ];
    }

    /** Read a photo/PDF of a product list into inventory rows for review. */
    public function extractProducts(UploadedFile $file): array
    {
        $prompt = <<<'TXT'
You are reading a photo or scanned PDF of a product/stock list for a community centre store.
Extract every product row. Reply with ONLY a JSON array, no prose:
[
  { "name": string, "category": string, "brand": string, "sku": string, "unit": string, "current_stock": number, "minimum_stock": number, "purchase_price": number }
]
Rules:
- One object per product. Skip header/total rows.
- "unit": e.g. pcs, kg, box, litre. Default "pcs" if unclear.
- Numbers only (no symbols/commas); use 0 when absent.
- Use "" for unreadable text. Return [] if nothing is readable.
TXT;

        $rows = $this->visionJson($file, $prompt, 2000, '[');

        return collect($rows)->map(fn ($r) => [
            'name' => trim((string) ($r['name'] ?? '')),
            'category' => trim((string) ($r['category'] ?? '')) ?: 'General',
            'brand' => trim((string) ($r['brand'] ?? '')),
            'sku' => trim((string) ($r['sku'] ?? '')),
            'unit' => trim((string) ($r['unit'] ?? '')) ?: 'pcs',
            'current_stock' => max(round((float) preg_replace('/[^0-9.]/', '', (string) ($r['current_stock'] ?? 0)), 2), 0),
            'minimum_stock' => max(round((float) preg_replace('/[^0-9.]/', '', (string) ($r['minimum_stock'] ?? 0)), 2), 0),
            'purchase_price' => max(round((float) preg_replace('/[^0-9.]/', '', (string) ($r['purchase_price'] ?? 0)), 2), 0),
        ])->filter(fn ($r) => $r['name'] !== '')->values()->all();
    }

    // ---------------------------------------------------------------------

    /**
     * Send the file + prompt to the configured vision provider and decode the
     * JSON it returns. $expect is "{" for an object or "[" for an array.
     */
    private function visionJson(UploadedFile $file, string $prompt, int $maxTokens, string $expect = '{'): array
    {
        $base64 = base64_encode(file_get_contents($file->getRealPath()));
        $mime = $this->mime($file);

        $gemini = config('services.gemini.key');
        $anthropic = config('services.anthropic.key');
        abort_if(! $gemini && ! $anthropic, 422, 'Scanning is not configured. Add a free GEMINI_API_KEY (or ANTHROPIC_API_KEY) to the server .env to enable it.');

        $text = $gemini
            ? $this->callGemini($gemini, $base64, $mime, $prompt, $maxTokens)
            : $this->callAnthropic($anthropic, $base64, $mime, $prompt, $maxTokens);

        // Pull the JSON object/array out of the reply in case of stray text.
        $pattern = $expect === '[' ? '/\[.*\]/s' : '/\{.*\}/s';
        if (preg_match($pattern, $text, $m)) {
            $text = $m[0];
        }

        return json_decode($text, true) ?: [];
    }

    /** Google Gemini (free tier). Handles images and PDFs via inline_data. */
    private function callGemini(string $key, string $base64, string $mime, string $prompt, int $maxTokens): string
    {
        $model = config('services.gemini.model', 'gemini-2.0-flash');
        $response = Http::timeout(60)->post(
            "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$key}",
            [
                'contents' => [[
                    'parts' => [
                        ['inline_data' => ['mime_type' => $mime, 'data' => $base64]],
                        ['text' => $prompt],
                    ],
                ]],
                'generationConfig' => ['temperature' => 0, 'maxOutputTokens' => $maxTokens, 'responseMimeType' => 'application/json'],
            ]
        );

        abort_if($response->failed(), 422, 'Could not read the file. Please try a clearer photo or PDF.');

        return (string) $response->json('candidates.0.content.parts.0.text', '');
    }

    /** Anthropic Claude vision. */
    private function callAnthropic(string $key, string $base64, string $mime, string $prompt, int $maxTokens): string
    {
        $block = $mime === 'application/pdf'
            ? ['type' => 'document', 'source' => ['type' => 'base64', 'media_type' => 'application/pdf', 'data' => $base64]]
            : ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $mime, 'data' => $base64]];

        $response = Http::withHeaders([
            'x-api-key' => $key,
            'anthropic-version' => '2023-06-01',
            'content-type' => 'application/json',
        ])->timeout(60)->post('https://api.anthropic.com/v1/messages', [
            'model' => config('services.anthropic.model'),
            'max_tokens' => $maxTokens,
            'messages' => [[
                'role' => 'user',
                'content' => [$block, ['type' => 'text', 'text' => $prompt]],
            ]],
        ]);

        abort_if($response->failed(), 422, 'Could not read the file. Please try a clearer photo or PDF.');

        return (string) $response->json('content.0.text', '');
    }

    private function mime(UploadedFile $file): string
    {
        if ($file->getMimeType() === 'application/pdf' || strtolower($file->getClientOriginalExtension()) === 'pdf') {
            return 'application/pdf';
        }

        return $file->getMimeType() === 'image/png' ? 'image/png' : 'image/jpeg';
    }

    private function normalizeDate(string $value): ?string
    {
        $value = trim($value);
        if ($value === '') {
            return null;
        }
        try {
            return \Carbon\Carbon::parse($value)->format('Y-m-d');
        } catch (\Throwable) {
            return null;
        }
    }
}
