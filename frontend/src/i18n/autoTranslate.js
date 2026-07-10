import { PHRASES_BN } from "./phrases";

/**
 * Global auto-translator. Walks visible text nodes (and input placeholders)
 * and swaps exact-match English phrases for Bangla, so every screen — admin,
 * owner, customer — is covered without wrapping each string by hand.
 * Dynamic data (names, numbers, IDs) never matches the dictionary, so it stays
 * as-is. Switching back to English restores the stored originals.
 */

const DICT = { bn: PHRASES_BN };
// Reverse lookup (translated value -> true) so we can recognise our own output
// and never re-process it, which keeps dynamic re-renders working correctly.
const REVERSE = { bn: new Set(Object.values(PHRASES_BN)) };
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA"]);
const ORIG = "__i18nOrig";        // stored original text on a text node
const ORIG_PH = "__i18nOrigPh";   // stored original placeholder on an input

function translateText(map, reverse, node) {
  // Always read the CURRENT value: React may have rewritten this node with new
  // text (e.g. a status changing). Never trust a previously cached original.
  const current = node.nodeValue;
  const key = current.trim();
  if (!key) return;
  if (reverse.has(key)) return; // already our own translated output — leave it
  const hit = map[key];
  if (hit === undefined) return;
  node[ORIG] = current; // refresh so a later restore/rewrite uses the latest English
  node.nodeValue = current.replace(key, hit);
}

function restoreText(node) {
  if (node[ORIG] !== undefined && node.nodeValue !== node[ORIG]) node.nodeValue = node[ORIG];
}

function walkElement(el, fn) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentNode;
      if (!p || SKIP_TAGS.has(p.nodeName)) return NodeFilter.FILTER_REJECT;
      if (p.isContentEditable) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n;
  while ((n = walker.nextNode())) fn(n);
}

function handlePlaceholders(root, map) {
  const inputs = root.querySelectorAll?.("input[placeholder], textarea[placeholder]") || [];
  inputs.forEach((el) => {
    const original = el[ORIG_PH] ?? el.getAttribute("placeholder");
    if (!original) return;
    if (map) {
      const hit = map[original.trim()];
      if (hit === undefined) return;
      if (el[ORIG_PH] === undefined) el[ORIG_PH] = original;
      el.setAttribute("placeholder", hit);
    } else if (el[ORIG_PH] !== undefined) {
      el.setAttribute("placeholder", el[ORIG_PH]);
    }
  });
}

let observer = null;

/** Apply (lang="bn") or restore (lang="en") translation across the whole document. */
export function applyAutoTranslate(lang) {
  if (observer) { observer.disconnect(); observer = null; }
  const map = DICT[lang];
  const reverse = REVERSE[lang];

  if (!map) {
    walkElement(document.body, restoreText);
    handlePlaceholders(document.body, null);
    return;
  }

  walkElement(document.body, (n) => translateText(map, reverse, n));
  handlePlaceholders(document.body, map);

  // Re-translate anything React renders later (route changes, modals, lists).
  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "characterData" && m.target.nodeType === Node.TEXT_NODE) {
        translateText(map, reverse, m.target);
      }
      m.addedNodes?.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) translateText(map, reverse, node);
        else if (node.nodeType === Node.ELEMENT_NODE) {
          walkElement(node, (n) => translateText(map, reverse, n));
          handlePlaceholders(node, map);
        }
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}
