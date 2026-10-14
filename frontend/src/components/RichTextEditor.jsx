import { useEffect, useRef, useState } from "react";
import {
  Bold, Italic, Underline, Strikethrough, Heading2, Heading3,
  List, ListOrdered, Link2, Quote, Eraser, ImagePlus, MonitorPlay, Loader2, Trash2,
} from "lucide-react";
import { sanitizeHtml, youtubeEmbedUrl } from "../lib/sanitizeHtml";
import { ownerUpload } from "../services/api";

const WIDTHS = ["25%", "50%", "75%", "100%"];

/**
 * Lightweight WYSIWYG editor built on contentEditable — no external dependency.
 * Supports text formatting, links, uploaded images and YouTube embeds, and lets
 * you resize a selected image/video. Emits sanitized HTML through `onChange`.
 *
 * `uploadImage` is injected so the editor isn't bound to one role's endpoint;
 * it defaults to the owner uploader. Pass another uploader (returning `{ url }`)
 * when embedding this in the admin or partner panels.
 *
 * The caret is preserved because we only write to the DOM when the incoming
 * value genuinely differs from what the element already contains (i.e. an
 * external reset, not our own keystroke).
 */
export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Write a description…",
  minHeight = "12rem",
  uploadImage: uploadFn = ownerUpload,
}) {
  const ref = useRef(null);
  const [active, setActive] = useState({});
  const [empty, setEmpty] = useState(!value);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState(null); // the clicked <img> / <iframe>

  // Sync external value in without clobbering the caret while typing.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const incoming = value || "";
    if (el.innerHTML !== incoming) el.innerHTML = incoming;
    setEmpty(!el.textContent.trim() && !el.querySelector("li, br, img, iframe"));
  }, [value]);

  // Clicking outside the editor clears the media selection.
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.parentElement.contains(e.target)) setSelected(null); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const refreshActive = () => {
    if (typeof document.queryCommandState !== "function") return;
    const is = (c) => { try { return document.queryCommandState(c); } catch { return false; } };
    setActive({
      bold: is("bold"), italic: is("italic"), underline: is("underline"),
      strikeThrough: is("strikeThrough"), insertUnorderedList: is("insertUnorderedList"),
      insertOrderedList: is("insertOrderedList"),
    });
  };

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    setEmpty(!el.textContent.trim() && !el.querySelector("li, br, img, iframe"));
    onChange(sanitizeHtml(el.innerHTML));
  };

  /** Run a formatting command against the current selection, keeping focus. */
  const exec = (command, arg = null) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    refreshActive();
    emit();
  };

  const block = (tag) => {
    ref.current?.focus();
    const current = document.queryCommandValue("formatBlock")?.toLowerCase();
    document.execCommand("formatBlock", false, current === tag.toLowerCase() ? "p" : tag);
    emit();
  };

  const addLink = () => {
    const url = window.prompt("Link URL", "https://");
    if (!url) return;
    if (!/^(https?:|mailto:|tel:)/i.test(url)) return window.alert("Only http, https, mailto or tel links are allowed.");
    exec("createLink", url);
  };

  /** Insert arbitrary HTML at the caret, then re-sanitize the document. */
  const insertHtml = (html) => {
    ref.current?.focus();
    document.execCommand("insertHTML", false, html);
    emit();
  };

  const uploadImage = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadFn(file);
      insertHtml(`<img src="${url}" alt="" width="100%" /><p><br/></p>`);
    } catch {
      window.alert("Could not upload that image.");
    } finally { setUploading(false); }
  };

  const addVideo = () => {
    const raw = window.prompt("YouTube video URL", "https://www.youtube.com/watch?v=");
    if (!raw) return;
    const embed = youtubeEmbedUrl(raw);
    if (!embed) return window.alert("That doesn't look like a YouTube link.");
    insertHtml(`<iframe src="${embed}" width="100%" allowfullscreen></iframe><p><br/></p>`);
  };

  /**
   * Select an image/video on click so it can be resized or removed.
   * Iframes have `pointer-events: none` (so a click selects rather than plays),
   * which means the click lands on the editor — hit-test them by coordinates.
   */
  const onClick = (event) => {
    const el = event.target;
    if (el.tagName === "IMG" || el.tagName === "IFRAME") { setSelected(el); return; }

    const { clientX: x, clientY: y } = event;
    const hit = [...(ref.current?.querySelectorAll("iframe") || [])].find((frame) => {
      const r = frame.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    });
    setSelected(hit || null);
  };

  const resize = (width) => {
    if (!selected) return;
    selected.setAttribute("width", width);
    emit();
  };

  const removeSelected = () => {
    if (!selected) return;
    selected.remove();
    setSelected(null);
    emit();
  };

  // Paste as plain text so foreign markup never enters the document.
  const onPaste = (event) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    const embed = youtubeEmbedUrl(text);
    if (embed) insertHtml(`<iframe src="${embed}" width="100%" allowfullscreen></iframe><p><br/></p>`);
    else { document.execCommand("insertText", false, text); emit(); }
  };

  const Btn = ({ cmd, arg, onClick: click, title, icon: Icon, isActive, disabled }) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={!!isActive}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep the selection
      onClick={click || (() => exec(cmd, arg))}
      className={`grid h-8 w-8 place-items-center rounded-lg transition disabled:opacity-40 ${isActive ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-100 bg-slate-50/70 px-2 py-1.5">
        <Btn cmd="bold" title="Bold" icon={Bold} isActive={active.bold} />
        <Btn cmd="italic" title="Italic" icon={Italic} isActive={active.italic} />
        <Btn cmd="underline" title="Underline" icon={Underline} isActive={active.underline} />
        <Btn cmd="strikeThrough" title="Strikethrough" icon={Strikethrough} isActive={active.strikeThrough} />
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <Btn onClick={() => block("H2")} title="Heading" icon={Heading2} />
        <Btn onClick={() => block("H3")} title="Subheading" icon={Heading3} />
        <Btn onClick={() => block("BLOCKQUOTE")} title="Quote" icon={Quote} />
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <Btn cmd="insertUnorderedList" title="Bullet list" icon={List} isActive={active.insertUnorderedList} />
        <Btn cmd="insertOrderedList" title="Numbered list" icon={ListOrdered} isActive={active.insertOrderedList} />
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <Btn onClick={addLink} title="Insert link" icon={Link2} />

        {/* Image upload */}
        <label
          title="Upload image"
          className={`grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 ${uploading ? "opacity-60" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => { uploadImage(e.target.files[0]); e.target.value = ""; }} />
        </label>

        <Btn onClick={addVideo} title="Embed YouTube video" icon={MonitorPlay} />
        <Btn cmd="removeFormat" title="Clear formatting" icon={Eraser} />
      </div>

      {/* Contextual toolbar for a selected image / video */}
      {selected && (
        <div className="flex flex-wrap items-center gap-2 border-b border-brand-100 bg-brand-50/70 px-3 py-2">
          <span className="text-xs font-semibold text-slate-600">{selected.tagName === "IMG" ? "Image" : "Video"} size</span>
          {WIDTHS.map((w) => (
            <button key={w} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => resize(w)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${selected.getAttribute("width") === w ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-brand-700"}`}>
              {w}
            </button>
          ))}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={removeSelected}
            className="ml-auto inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50">
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        </div>
      )}

      <div className="relative">
        {empty && (
          <span className="pointer-events-none absolute left-3 top-3 text-sm text-slate-400">{placeholder}</span>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          onInput={emit}
          onBlur={emit}
          onPaste={onPaste}
          onClick={onClick}
          onKeyUp={refreshActive}
          onMouseUp={refreshActive}
          style={{ minHeight }}
          className="prose-editor w-full px-3 py-3 text-sm leading-relaxed text-slate-700 outline-none"
        />
      </div>
    </div>
  );
}
