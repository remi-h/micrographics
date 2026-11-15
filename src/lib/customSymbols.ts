// Symbols a signed-in user uploads to their account (the `Custom` tab).
//
// An uploaded symbol is an SVG file. It is cleaned once, here, when it is
// picked, and the cleaned text is what gets stored and what a canvas item
// carries. It is drawn through an <image> with a data URI, never inlined into
// the page: an SVG shown as an image runs no script and loads nothing from the
// network, so the cleaning below is a second line of defence, not the only one.

const CUSTOM_MARK_PREFIX = 'custom:';

/** Large enough for a detailed logo, small enough to carry on every item that uses it. */
export const MAX_SYMBOL_SVG_LENGTH = 200_000;
export const MAX_SYMBOL_NAME_LENGTH = 60;

export function customMark(id: string) {
  return `${CUSTOM_MARK_PREFIX}${id}`;
}

export function isCustomMark(mark: unknown): mark is string {
  return typeof mark === 'string' && mark.startsWith(CUSTOM_MARK_PREFIX);
}

const BLOCKED_ELEMENTS = new Set([
  'script',
  'foreignobject',
  'iframe',
  'object',
  'embed',
  'audio',
  'video',
  'link',
  'meta',
  'handler',
  'listener',
]);

// Animation elements that can rewrite an attribute after the cleaning is done.
const ATTRIBUTE_ANIMATORS = new Set(['animate', 'set']);

function isSafeReference(value: string) {
  const reference = value.trim();
  return reference.startsWith('#') || /^data:image\/(png|jpeg|gif|webp);/i.test(reference);
}

function clean(element: Element) {
  for (const child of [...element.children]) {
    const name = child.localName.toLowerCase();
    if (BLOCKED_ELEMENTS.has(name)) {
      child.remove();
      continue;
    }
    if (ATTRIBUTE_ANIMATORS.has(name) && /^(xlink:)?href$/i.test(child.getAttribute('attributeName') ?? '')) {
      child.remove();
      continue;
    }
    clean(child);
  }
  for (const attribute of [...element.attributes]) {
    const name = attribute.name.toLowerCase();
    const local = attribute.localName.toLowerCase();
    if (name.startsWith('on')) element.removeAttributeNode(attribute);
    else if (local === 'href' && !isSafeReference(attribute.value)) element.removeAttributeNode(attribute);
  }
}

function length(value: string | null) {
  if (!value) return null;
  const match = /^\s*(\d+(\.\d+)?)(px)?\s*$/.exec(value);
  const number = match ? Number(match[1]) : NaN;
  return number > 0 ? number : null;
}

export type SanitizedSvg = { ok: true; svg: string } | { ok: false; error: string };

/**
 * Cleans the text of an uploaded SVG file: scripts, embedded pages, event
 * handlers and links out of the file are removed, and a drawing with a size
 * but no viewBox is given one so it scales into the box a symbol is drawn in.
 */
export function sanitizeSvg(source: string): SanitizedSvg {
  if (source.length > MAX_SYMBOL_SVG_LENGTH) {
    return { ok: false, error: `That SVG is too large. The limit is ${MAX_SYMBOL_SVG_LENGTH / 1000} KB.` };
  }

  let root: Element;
  try {
    const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
    root = parsed.documentElement;
    if (parsed.getElementsByTagName('parsererror').length > 0) throw new Error('parsererror');
  } catch {
    return { ok: false, error: 'That file could not be read as an SVG.' };
  }
  if (root.localName !== 'svg' || root.namespaceURI !== 'http://www.w3.org/2000/svg') {
    return { ok: false, error: 'That file is not an SVG.' };
  }

  clean(root);

  if (!root.getAttribute('viewBox')) {
    const width = length(root.getAttribute('width'));
    const height = length(root.getAttribute('height'));
    if (width && height) root.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }

  const svg = new XMLSerializer().serializeToString(root);
  if (svg.length > MAX_SYMBOL_SVG_LENGTH) return { ok: false, error: 'That SVG is too large.' };
  return { ok: true, svg };
}

/** A name for an uploaded file: its file name without the extension. */
export function symbolNameFromFile(fileName: string) {
  const name = fileName
    .replace(/\.svg$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .slice(0, MAX_SYMBOL_NAME_LENGTH);
  return name || 'Symbol';
}

const dataUris = new Map<string, string>();

/** The drawing as something an <image> can show. Cached: it is asked for on every render. */
export function svgDataUri(svg: string) {
  let uri = dataUris.get(svg);
  if (!uri) {
    uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    if (dataUris.size > 200) dataUris.clear();
    dataUris.set(svg, uri);
  }
  return uri;
}
