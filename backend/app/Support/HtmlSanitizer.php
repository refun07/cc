<?php

namespace App\Support;

/**
 * Allowlist sanitizer for rich-text fields saved from the WYSIWYG editor.
 * Mirrors the front-end allowlist. Never trust markup posted by a client:
 * this strips disallowed tags, every inline event handler, and unsafe URLs.
 * Images and YouTube embeds are permitted, with strict source + size rules.
 */
class HtmlSanitizer
{
    private const ALLOWED_TAGS = '<p><br><strong><b><em><i><u><s><h2><h3><ul><ol><li><a><blockquote><img><iframe>';

    /** Images: remote http(s), our own /storage uploads, or inline data images. */
    private const SAFE_IMG = '#^(https?://|/storage/|data:image/(png|jpe?g|gif|webp|avif);base64,)#i';

    /** Embeds: YouTube only, and only the /embed/ player URL. */
    private const SAFE_EMBED = '#^https://(www\.)?(youtube\.com|youtube-nocookie\.com)/embed/[\w-]{6,}(\?[\w=&;-]*)?$#i';

    private const SAFE_LINK = '#^(https?:|mailto:|tel:)#i';
    private const SAFE_WIDTH = '#^(25|50|75|100)%$#';

    public static function clean(?string $html): ?string
    {
        if ($html === null || trim($html) === '') {
            return null;
        }

        // Drop script/style blocks entirely (content included).
        $html = preg_replace('#<(script|style|object|embed)\b[^>]*>.*?</\1>#is', '', $html);

        // Remove any iframe whose src isn't an allowed embed — element and all.
        // Done before the attribute pass so no orphan </iframe> can be left behind.
        $html = preg_replace_callback('#<iframe\b([^>]*)>.*?</iframe>#is', function ($m) {
            return preg_match(self::SAFE_EMBED, self::attr($m[1], 'src')) ? $m[0] : '';
        }, $html);
        // An iframe with no closing tag can't be trusted either.
        $html = preg_replace('#<iframe\b(?![^>]*>.*?</iframe>)[^>]*>#is', '', $html);

        // Unwrap any tag outside the allowlist while keeping its text.
        $html = strip_tags($html, self::ALLOWED_TAGS);

        // Rebuild each tag with only the attributes it is allowed to keep.
        $html = preg_replace_callback('#<([a-z0-9]+)\b([^>]*?)(/?)>#i', function ($m) {
            $tag = strtolower($m[1]);
            $attrs = $m[2];

            if ($tag === 'a') {
                $href = self::attr($attrs, 'href');
                return preg_match(self::SAFE_LINK, $href)
                    ? '<a href="'.self::esc($href).'" target="_blank" rel="noopener noreferrer">'
                    : '<a>';
            }

            if ($tag === 'img') {
                $src = self::attr($attrs, 'src');
                if (! preg_match(self::SAFE_IMG, $src)) {
                    return '';                                  // drop the image entirely
                }
                $out = '<img src="'.self::esc($src).'"';
                $alt = self::attr($attrs, 'alt');
                if ($alt !== '') $out .= ' alt="'.self::esc($alt).'"';
                $width = self::attr($attrs, 'width');
                if (preg_match(self::SAFE_WIDTH, $width)) $out .= ' width="'.$width.'"';
                return $out.' />';
            }

            if ($tag === 'iframe') {
                // Invalid frames were already removed above; rebuild with safe attrs only.
                // Idempotent: re-running the sanitizer yields the same markup.
                $src = self::attr($attrs, 'src');
                $out = '<iframe src="'.self::esc($src).'"';
                $width = self::attr($attrs, 'width');
                if (preg_match(self::SAFE_WIDTH, $width)) $out .= ' width="'.$width.'"';
                return $out.' allowfullscreen>';                // </iframe> is preserved as-is
            }

            return "<{$tag}>";                                  // everything else: no attributes
        }, $html);

        // <img> has no closing tag; a stray one may survive a paste.
        $html = preg_replace('#</img>#i', '', $html);

        return trim($html) === '' ? null : $html;
    }

    private static function attr(string $attrs, string $name): string
    {
        if (preg_match('#\b'.preg_quote($name, '#').'\s*=\s*("|\')(.*?)\1#i', $attrs, $m)) {
            return trim(html_entity_decode($m[2], ENT_QUOTES, 'UTF-8'));
        }
        return '';
    }

    private static function esc(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
    }
}
