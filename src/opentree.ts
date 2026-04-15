/**
 * Client for the Open Tree of Life API v3.
 * https://github.com/OpenTreeOfLife/germinator/wiki/Open-Tree-of-Life-Web-APIs
 */

const REQUEST_TIMEOUT_MS = 30000;

const API_BASE = 'https://api.opentreeoflife.org/v3';

export interface TaxonMatch {
  ott_id: number;
  matched_name: string;
  unique_name: string;
  is_approximate_match: boolean;
  is_synonym: boolean;
  rank: string;
}

export interface AutocompleteResult {
  ott_id: number;
  unique_name: string;
  is_higher: boolean;
}

export interface InducedSubtreeResult {
  newick: string;
  supporting_studies: string[];
}

export interface SubtreeResult {
  newick: string;
  supporting_studies: string[];
}

/** Search for taxa by name (exact + fuzzy matching) */
export async function matchNames(
  names: string[],
  approximate: boolean = false
): Promise<TaxonMatch[]> {
  const resp = await fetch(`${API_BASE}/tnrs/match_names`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      names,
      do_approximate_matching: approximate,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenTree match_names failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  const matches: TaxonMatch[] = [];
  for (const result of data.results ?? []) {
    for (const match of result.matches ?? []) {
      matches.push({
        ott_id: match.taxon?.ott_id,
        matched_name: match.matched_name ?? '',
        unique_name: match.taxon?.unique_name ?? match.matched_name ?? '',
        is_approximate_match: match.is_approximate_match ?? false,
        is_synonym: match.is_synonym ?? false,
        rank: match.taxon?.rank ?? '',
      });
    }
  }
  return matches;
}

/** Autocomplete a partial taxon name */
export async function autocompleteName(
  name: string,
  context: string = 'All life',
  signal?: AbortSignal
): Promise<AutocompleteResult[]> {
  const resp = await fetch(`${API_BASE}/tnrs/autocomplete_name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      context_name: context,
    }),
    signal: signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenTree autocomplete failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  return (data ?? []).map((item: any) => ({
    ott_id: item.ott_id,
    unique_name: item.unique_name ?? '',
    is_higher: item.is_higher ?? false,
  }));
}

/** Get the induced subtree for a set of OTT IDs (returns Newick) */
export async function getInducedSubtree(
  ottIds: number[],
  labelFormat: 'name' | 'id' | 'name_and_id' = 'name'
): Promise<InducedSubtreeResult> {
  if (ottIds.length < 2) {
    throw new Error('At least 2 OTT IDs are required for an induced subtree');
  }

  const resp = await fetch(`${API_BASE}/tree_of_life/induced_subtree`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ott_ids: ottIds,
      label_format: labelFormat,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenTree induced_subtree failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  return {
    newick: data.newick ?? '',
    supporting_studies: data.supporting_studies ?? [],
  };
}

/** Get a subtree rooted at a specific OTT ID (returns Newick).
 *  If the taxon is "broken" in the synthetic tree, falls back to the MRCA node. */
export async function getSubtree(
  ottId: number,
  heightLimit: number = 3,
  labelFormat: 'name' | 'id' | 'name_and_id' = 'name'
): Promise<SubtreeResult> {
  const resp = await fetch(`${API_BASE}/tree_of_life/subtree`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ott_id: ottId,
      format: 'newick',
      label_format: labelFormat,
      height_limit: heightLimit,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!resp.ok) {
    const text = await resp.text();
    try {
      const errData = JSON.parse(text);
      if (errData.broken && errData.mrca) {
        // Try MRCA node in the synthetic tree
        const retryResp = await fetch(`${API_BASE}/tree_of_life/subtree`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            node_id: errData.mrca,
            format: 'newick',
            label_format: labelFormat,
            height_limit: heightLimit,
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (retryResp.ok) {
          const retryData = await retryResp.json();
          return {
            newick: retryData.newick ?? '',
            supporting_studies: retryData.supporting_studies ?? [],
          };
        }
        // MRCA also failed — fall back to taxonomy subtree
        const taxResp = await fetch(`${API_BASE}/taxonomy/subtree`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ott_id: ottId,
            label_format: labelFormat,
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (taxResp.ok) {
          const taxData = await taxResp.json();
          if (taxData.newick) {
            return {
              newick: taxData.newick,
              supporting_studies: [],
            };
          }
        }
        throw new Error(
          `This taxon is fragmented in the Open Tree of Life synthetic tree. ` +
          `Try using "Induced tree" mode with specific species instead.`
        );
      }
    } catch (e) {
      if (e instanceof Error && (e.message.startsWith('This taxon') || e.message.startsWith('OpenTree'))) throw e;
    }
    throw new Error(`OpenTree subtree failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  return {
    newick: data.newick ?? '',
    supporting_studies: data.supporting_studies ?? [],
  };
}

/** Convenience: search for a clade by name and return its subtree as Newick */
export async function searchAndGetSubtree(
  taxonName: string,
  heightLimit: number = 3
): Promise<{ newick: string; ottId: number; name: string }> {
  const matches = await matchNames([taxonName]);
  if (matches.length === 0) {
    throw new Error(`No match found for "${taxonName}"`);
  }

  const best = matches[0];
  const result = await getSubtree(best.ott_id, heightLimit);

  return {
    newick: result.newick,
    ottId: best.ott_id,
    name: best.unique_name,
  };
}
