import { describe, it, expect } from 'vitest';
import { encodeState, decodeState, defaultViewState } from '../src/state';
import { ViewState, DEFAULT_STYLE, DEFAULT_TANGLEGRAM_STYLE } from '../src/types';

describe('state encoding/decoding', () => {
  it('round-trips a default state', () => {
    const state = defaultViewState();
    const encoded = encodeState(state);
    const decoded = decodeState(encoded);
    expect(decoded).toEqual(state);
  });

  it('round-trips a state with tree data', () => {
    const state: ViewState = {
      newick1: '((A:0.1,B:0.2):0.3,(C:0.4,D:0.5):0.6);',
      newick2: '',
      layout: 'rectangular',
      style: { ...DEFAULT_STYLE, branchColor: '#ff0000', branchWidth: 3 },
      tanglegram: false,
      tanglegramStyle: { ...DEFAULT_TANGLEGRAM_STYLE },
    };
    const encoded = encodeState(state);
    const decoded = decodeState(encoded);
    expect(decoded).toEqual(state);
  });

  it('round-trips a tanglegram state with custom connection settings', () => {
    const state: ViewState = {
      newick1: '(A,B,C);',
      newick2: '(C,B,A);',
      layout: 'rectangular',
      style: DEFAULT_STYLE,
      tanglegram: true,
      tanglegramStyle: {
        spacing: 0.35,
        connectionColor: '#ff0000',
        connectionColorMode: 'multi',
        connectionWidth: 2,
        connectionLineStyle: 'dashed',
      },
    };
    const encoded = encodeState(state);
    const decoded = decodeState(encoded);
    expect(decoded).toEqual(state);
  });

  it('produces a string that can be placed in a URL hash', () => {
    const state: ViewState = {
      newick1: '((((Homo_sapiens:0.0067,Pan_troglodytes:0.0072):0.0024,Gorilla_gorilla:0.0089):0.0096,(Pongo_abelii:0.0183,Hylobates_lar:0.0220):0.0033):0.0350,(Macaca_mulatta:0.0370,Papio_anubis:0.0365):0.0150);',
      newick2: '',
      layout: 'rectangular',
      style: DEFAULT_STYLE,
      tanglegram: false,
      tanglegramStyle: { ...DEFAULT_TANGLEGRAM_STYLE },
    };
    const encoded = encodeState(state);
    expect(encoded.length).toBeGreaterThan(0);
    expect(typeof encoded).toBe('string');
    const decoded = decodeState(encoded);
    expect(decoded).toEqual(state);
  });

  it('fills in missing tanglegramStyle from older URLs', () => {
    // Simulate an older URL that doesn't have tanglegramStyle
    const oldState = {
      newick1: '(A,B);',
      newick2: '',
      layout: 'rectangular',
      style: DEFAULT_STYLE,
      tanglegram: false,
    };
    const encoded = encodeState(oldState as ViewState);
    const decoded = decodeState(encoded);
    // Should fill in default tanglegramStyle
    expect(decoded!.tanglegramStyle).toEqual(DEFAULT_TANGLEGRAM_STYLE);
  });

  it('returns null for invalid encoded data', () => {
    expect(decodeState('not-valid-data')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(decodeState('')).toBeNull();
  });

  it('round-trips a state with metadata', () => {
    const state: ViewState = {
      newick1: '(A,B,C);',
      newick2: '',
      layout: 'rectangular',
      style: { ...DEFAULT_STYLE },
      tanglegram: false,
      tanglegramStyle: { ...DEFAULT_TANGLEGRAM_STYLE },
      metadata: 'name,group\nA,X\nB,Y\nC,X',
      metadataIdCol: 'name',
      metadataCatCol: 'group',
    };
    const encoded = encodeState(state);
    const decoded = decodeState(encoded);
    expect(decoded).toEqual(state);
    expect(decoded!.metadata).toBe('name,group\nA,X\nB,Y\nC,X');
    expect(decoded!.metadataIdCol).toBe('name');
    expect(decoded!.metadataCatCol).toBe('group');
  });

  it('handles older URLs without metadata fields', () => {
    const oldState = {
      newick1: '(A,B);',
      newick2: '',
      layout: 'rectangular',
      style: DEFAULT_STYLE,
      tanglegram: false,
      tanglegramStyle: { ...DEFAULT_TANGLEGRAM_STYLE },
    };
    const encoded = encodeState(oldState as ViewState);
    const decoded = decodeState(encoded);
    expect(decoded!.metadata).toBeUndefined();
    expect(decoded!.metadataIdCol).toBeUndefined();
    expect(decoded!.metadataCatCol).toBeUndefined();
  });
});
