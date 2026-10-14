import { PHRASES_BN } from "./phrases";
import { translateBangla } from "./translateBangla";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA"]);
const ATTRIBUTES = ["placeholder", "aria-label", "title", "alt"];
const textState = new WeakMap();
const attributeState = new WeakMap();
let observer = null;

function translateText(node) {
  const current = node.nodeValue;
  if (!current?.trim()) return;
  const previous = textState.get(node);
  if (previous?.translated === current) return;

  const translated = translateBangla(current, PHRASES_BN);
  if (translated === current) {
    textState.delete(node);
    return;
  }
  textState.set(node, { original: current, translated });
  node.nodeValue = translated;
}

function restoreText(node) {
  const previous = textState.get(node);
  if (previous?.translated === node.nodeValue) node.nodeValue = previous.original;
  textState.delete(node);
}

function translateAttribute(el, name) {
  const current = el.getAttribute(name);
  if (!current) return;
  const state = attributeState.get(el) || {};
  if (state[name]?.translated === current) return;

  const translated = translateBangla(current, PHRASES_BN);
  if (translated === current) {
    delete state[name];
    attributeState.set(el, state);
    return;
  }
  state[name] = { original: current, translated };
  attributeState.set(el, state);
  el.setAttribute(name, translated);
}

function restoreAttribute(el, name) {
  const state = attributeState.get(el);
  if (state?.[name]?.translated === el.getAttribute(name)) {
    el.setAttribute(name, state[name].original);
  }
  if (state) delete state[name];
}

function walk(root, onText, onAttribute) {
  const visit = (el) => {
    if (el.isContentEditable || el.closest?.("[data-no-translate]")) return;
    for (const name of ATTRIBUTES) {
      if (el.hasAttribute(name)) onAttribute(el, name);
    }
    if (SKIP_TAGS.has(el.nodeName)) return;
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) onText(child);
      else if (child.nodeType === Node.ELEMENT_NODE) visit(child);
    }
  };
  if (root.nodeType === Node.TEXT_NODE) onText(root);
  else if (root.nodeType === Node.ELEMENT_NODE) visit(root);
}

export function applyAutoTranslate(lang) {
  observer?.disconnect();
  observer = null;
  if (!document.body) return;

  if (lang !== "bn") {
    walk(document.body, restoreText, restoreAttribute);
    return;
  }

  walk(document.body, translateText, translateAttribute);
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") translateText(mutation.target);
      if (mutation.type === "attributes") translateAttribute(mutation.target, mutation.attributeName);
      for (const node of mutation.addedNodes || []) {
        walk(node, translateText, translateAttribute);
      }
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRIBUTES,
  });
}
