import LZString from 'lz-string';
import { ViewState, StyleOptions, DEFAULT_STYLE, DEFAULT_TANGLEGRAM_STYLE, LayoutType } from './types';

const STATE_PARAM = 's';

/** Encode the full view state into a URL-safe string */
export function encodeState(state: ViewState): string {
  const json = JSON.stringify(state);
  return LZString.compressToEncodedURIComponent(json);
}

/** Decode a URL-safe string back into view state, merging with defaults */
export function decodeState(encoded: string): ViewState | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const parsed = JSON.parse(json);
    // Merge with defaults to handle missing fields from older URLs
    const defaults = defaultViewState();
    return {
      newick1: parsed.newick1 ?? defaults.newick1,
      newick2: parsed.newick2 ?? defaults.newick2,
      layout: parsed.layout ?? defaults.layout,
      tanglegram: parsed.tanglegram ?? defaults.tanglegram,
      style: { ...defaults.style, ...(parsed.style ?? {}) },
      tanglegramStyle: { ...defaults.tanglegramStyle, ...(parsed.tanglegramStyle ?? {}) },
      metadata: parsed.metadata ?? undefined,
      metadataIdCol: parsed.metadataIdCol ?? undefined,
      metadataCatCol: parsed.metadataCatCol ?? undefined,
    };
  } catch {
    return null;
  }
}

/** Get view state from the current URL hash */
export function getStateFromURL(): ViewState | null {
  const hash = window.location.hash.slice(1); // Remove '#'
  const params = new URLSearchParams(hash);
  const encoded = params.get(STATE_PARAM);
  if (!encoded) return null;
  return decodeState(encoded);
}

/** Update the URL hash with the current state (without triggering navigation) */
export function setStateInURL(state: ViewState): void {
  const encoded = encodeState(state);
  const params = new URLSearchParams();
  params.set(STATE_PARAM, encoded);
  window.history.replaceState(null, '', '#' + params.toString());
}

/** Build a shareable URL from the current state */
export function getShareableURL(state: ViewState): string {
  const encoded = encodeState(state);
  const params = new URLSearchParams();
  params.set(STATE_PARAM, encoded);
  return window.location.origin + window.location.pathname + '#' + params.toString();
}

/** Build an embed URL (adds ?embed=1 query parameter) */
export function getEmbedURL(state: ViewState): string {
  const encoded = encodeState(state);
  const params = new URLSearchParams();
  params.set(STATE_PARAM, encoded);
  const base = window.location.origin + window.location.pathname;
  return base + '?embed=1#' + params.toString();
}

/** Check if the page was loaded in embed mode */
export function isEmbedMode(): boolean {
  return new URLSearchParams(window.location.search).get('embed') === '1';
}

/** Build a default ViewState */
export function defaultViewState(): ViewState {
  return {
    newick1: '',
    newick2: '',
    layout: 'rectangular',
    style: { ...DEFAULT_STYLE },
    tanglegram: false,
    tanglegramStyle: { ...DEFAULT_TANGLEGRAM_STYLE },
  };
}
