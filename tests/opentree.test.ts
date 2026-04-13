import { describe, it, expect } from 'vitest';
import {
  matchNames,
  autocompleteName,
  getInducedSubtree,
  getSubtree,
  searchAndGetSubtree,
} from '../src/opentree';

// These tests call the real Open Tree of Life API.
// They are tagged with 'api' and require network access.
// Run with: npx vitest run --testPathPattern opentree

describe('Open Tree of Life API', () => {
  // Increase timeout for network calls
  const TIMEOUT = 30000;

  describe('matchNames', () => {
    it('finds Homo sapiens', async () => {
      const matches = await matchNames(['Homo sapiens']);
      expect(matches.length).toBeGreaterThan(0);
      const human = matches.find((m) => m.matched_name === 'Homo sapiens');
      expect(human).toBeDefined();
      expect(human!.ott_id).toBeGreaterThan(0);
      expect(human!.rank).toBeTruthy();
    }, TIMEOUT);

    it('finds multiple taxa in a single call', async () => {
      const matches = await matchNames(['Mus musculus', 'Drosophila melanogaster']);
      expect(matches.length).toBeGreaterThanOrEqual(2);
      const names = matches.map((m) => m.matched_name);
      expect(names).toContain('Mus musculus');
      expect(names).toContain('Drosophila melanogaster');
    }, TIMEOUT);

    it('returns empty for nonexistent taxon', async () => {
      const matches = await matchNames(['Xyzzyplugh_nonexistent_taxon']);
      // Either empty or no good match
      const exactMatch = matches.find((m) => !m.is_approximate_match);
      expect(exactMatch).toBeUndefined();
    }, TIMEOUT);

    it('supports approximate matching', async () => {
      const matches = await matchNames(['Homo sapens'], true); // misspelled
      expect(matches.length).toBeGreaterThan(0);
      // Should find an approximate match
      const approx = matches.find((m) => m.is_approximate_match);
      expect(approx).toBeDefined();
    }, TIMEOUT);
  });

  describe('autocompleteName', () => {
    it('returns suggestions for a partial name', async () => {
      const results = await autocompleteName('Gorilla');
      expect(results.length).toBeGreaterThan(0);
      const gorilla = results.find((r) => r.unique_name.toLowerCase().includes('gorilla'));
      expect(gorilla).toBeDefined();
      expect(gorilla!.ott_id).toBeGreaterThan(0);
    }, TIMEOUT);

    it('returns suggestions for a genus prefix', async () => {
      const results = await autocompleteName('Droso');
      expect(results.length).toBeGreaterThan(0);
    }, TIMEOUT);
  });

  describe('getInducedSubtree', () => {
    it('returns a Newick tree for a set of OTT IDs', async () => {
      // Human (770315), Chimp (417957), Gorilla (417969)
      const result = await getInducedSubtree([770315, 417957, 417969]);
      expect(result.newick).toBeTruthy();
      expect(result.newick).toContain('(');
      expect(result.newick).toContain(')');
      // Should contain at least some taxon names
      expect(result.newick.length).toBeGreaterThan(10);
    }, TIMEOUT);

    it('throws for fewer than 2 OTT IDs', async () => {
      await expect(getInducedSubtree([770315])).rejects.toThrow('At least 2');
    }, TIMEOUT);
  });

  describe('getSubtree', () => {
    it('returns a Newick subtree for Hominidae', async () => {
      // Hominidae OTT ID: 770311
      const result = await getSubtree(770311, 3);
      expect(result.newick).toBeTruthy();
      expect(result.newick).toContain('(');
      expect(result.newick).toContain(')');
    }, TIMEOUT);
  });

  describe('searchAndGetSubtree', () => {
    it('searches by name and returns a Newick tree', async () => {
      const result = await searchAndGetSubtree('Felidae', 2);
      expect(result.newick).toBeTruthy();
      expect(result.newick).toContain('(');
      expect(result.ottId).toBeGreaterThan(0);
      expect(result.name).toBeTruthy();
    }, TIMEOUT);
  });
});
