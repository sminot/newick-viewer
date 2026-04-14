import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useViewerState, useViewerServices } from '@cirrobio/react-tool';
import type { FileSystemObject } from '@cirrobio/sdk';
import { renderNewickTree } from './core-viewer';
import { parseCSV, buildTipColorMap, TipColorMap } from '../metadata';

const NEWICK_EXTENSIONS = ['.nwk', '.newick', '.tree', '.nw', '.nex', '.nexus', '.nxs'];
const CSV_EXTENSIONS = ['.csv', '.tsv', '.txt', '.metadata'];

function hasExtension(name: string, exts: string[]): boolean {
  const lower = name.toLowerCase();
  return exts.some((ext) => lower.endsWith(ext));
}

export function CirroTreeViewer() {
  const { files, selectedFile, fileAccessContext } = useViewerState();
  const { fileService } = useViewerServices();

  const viewerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<{ destroy: () => void } | null>(null);

  const [newickFiles, setNewickFiles] = useState<FileSystemObject[]>([]);
  const [csvFiles, setCsvFiles] = useState<FileSystemObject[]>([]);
  const [selectedNewick, setSelectedNewick] = useState<string>('');
  const [selectedCsv, setSelectedCsv] = useState<string>('');
  const [newickContent, setNewickContent] = useState<string>('');
  const [tipColorMap, setTipColorMap] = useState<TipColorMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Discover Newick and CSV files in the dataset
  useEffect(() => {
    if (!files) return;
    const nwkFiles = (files as FileSystemObject[]).filter(
      (f) => f.type?.toString() === 'file' && hasExtension(f.name, NEWICK_EXTENSIONS)
    );
    const metaFiles = (files as FileSystemObject[]).filter(
      (f) => f.type?.toString() === 'file' && hasExtension(f.name, CSV_EXTENSIONS)
    );
    setNewickFiles(nwkFiles);
    setCsvFiles(metaFiles);

    // Auto-select first Newick file, or use selectedFile if it's a Newick
    if (selectedFile && hasExtension(selectedFile.name ?? '', NEWICK_EXTENSIONS)) {
      setSelectedNewick(selectedFile.url);
    } else if (nwkFiles.length > 0) {
      setSelectedNewick(nwkFiles[0].url);
    }
  }, [files, selectedFile]);

  // Load Newick file content when selection changes
  useEffect(() => {
    if (!selectedNewick || !fileService) return;
    const file = newickFiles.find((f) => f.url === selectedNewick);
    if (!file) return;

    setLoading(true);
    setError('');
    fileService.getProjectFile(file)
      .then((resp) => resp.text())
      .then((text) => {
        setNewickContent(text.trim());
      })
      .catch((e) => {
        setError(`Failed to load file: ${e.message}`);
      })
      .finally(() => setLoading(false));
  }, [selectedNewick, fileService, newickFiles]);

  // Load CSV metadata when selection changes
  const loadMetadata = useCallback(async (url: string) => {
    if (!url || !fileService) {
      setTipColorMap(null);
      return;
    }
    const file = csvFiles.find((f) => f.url === url);
    if (!file) return;

    try {
      const resp = await fileService.getProjectFile(file);
      const text = await resp.text();
      const table = parseCSV(text);
      if (table.headers.length >= 2) {
        const map = buildTipColorMap(table, table.headers[0], table.headers[1]);
        setTipColorMap(map);
      }
    } catch (e: any) {
      console.warn('Failed to load metadata:', e);
    }
  }, [fileService, csvFiles]);

  useEffect(() => {
    if (selectedCsv) {
      loadMetadata(selectedCsv);
    } else {
      setTipColorMap(null);
    }
  }, [selectedCsv, loadMetadata]);

  // Render tree when content or colors change
  useEffect(() => {
    if (!viewerRef.current || !newickContent) return;

    // Clean up previous render
    if (cleanupRef.current) {
      cleanupRef.current.destroy();
      cleanupRef.current = null;
    }

    try {
      cleanupRef.current = renderNewickTree({
        container: viewerRef.current,
        newick: newickContent,
        tipColorMap,
      });
      setError('');
    } catch (e: any) {
      setError(`Failed to render tree: ${e.message}`);
    }
  }, [newickContent, tipColorMap]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current.destroy();
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'sans-serif' }}>
      {/* Toolbar */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid #dfe1e2',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
        fontSize: '13px',
        background: '#f8f8f8',
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>Tree file:</span>
          <select
            value={selectedNewick}
            onChange={(e) => setSelectedNewick(e.target.value)}
            style={{ fontSize: '12px', padding: '2px 4px' }}
          >
            {newickFiles.length === 0 && <option value="">No Newick files found</option>}
            {newickFiles.map((f) => (
              <option key={f.url} value={f.url}>{f.name}</option>
            ))}
          </select>
        </label>

        {csvFiles.length > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>Metadata:</span>
            <select
              value={selectedCsv}
              onChange={(e) => setSelectedCsv(e.target.value)}
              style={{ fontSize: '12px', padding: '2px 4px' }}
            >
              <option value="">None</option>
              {csvFiles.map((f) => (
                <option key={f.url} value={f.url}>{f.name}</option>
              ))}
            </select>
          </label>
        )}

        {loading && <span style={{ color: '#888', fontSize: '12px' }}>Loading...</span>}
      </div>

      {/* Error display */}
      {error && (
        <div style={{
          padding: '8px 12px',
          background: '#fef2f2',
          borderBottom: '1px solid #f3c7c7',
          borderLeft: '4px solid #b50909',
          color: '#b50909',
          fontSize: '12px',
        }}>
          {error}
        </div>
      )}

      {/* Viewer */}
      <div
        ref={viewerRef}
        style={{ flex: 1, overflow: 'hidden', position: 'relative' }}
      >
        {!newickContent && !loading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#888',
            textAlign: 'center',
          }}>
            {newickFiles.length === 0
              ? 'No Newick files found in this dataset'
              : 'Select a Newick file to view'}
          </div>
        )}
      </div>
    </div>
  );
}
