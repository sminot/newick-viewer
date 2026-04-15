import { test, expect } from '@playwright/test';

const EXAMPLE_NEWICK = '((A:0.1,B:0.2):0.3,(C:0.4,D:0.5):0.6);';
const PRIMATE_NEWICK = '((((Homo_sapiens:0.0067,Pan_troglodytes:0.0072):0.0024,Gorilla_gorilla:0.0089):0.0096,(Pongo_abelii:0.0183,Hylobates_lar:0.0220):0.0033):0.0350,(Macaca_mulatta:0.0370,Papio_anubis:0.0365):0.0150);';

/** Helper: fill the textarea and wait for auto-render debounce */
async function fillAndWait(page: any, newick: string) {
  await page.locator('#newick-input-1').fill(newick);
  // Wait for debounced render (400ms) + rendering time
  await page.locator('text.leaf-label').first().waitFor({ timeout: 5000 });
}

test.describe('Page loads correctly', () => {
  test('shows the app title and input panel', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.app-title')).toHaveText('Tree Viewer');
    await expect(page.locator('#newick-input-1')).toBeVisible();
  });

  test('shows placeholder message when no tree is loaded', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.viewer-message')).toBeVisible();
    await expect(page.locator('.viewer-message')).toContainText('Paste a Newick tree');
  });
});

test.describe('Tree rendering', () => {
  test('renders a simple tree with correct leaf labels', async ({ page }) => {
    await page.goto('/');
    await fillAndWait(page, EXAMPLE_NEWICK);

    await expect(page.locator('text.leaf-label').filter({ hasText: 'A' })).toBeVisible();
    await expect(page.locator('text.leaf-label').filter({ hasText: 'B' })).toBeVisible();
    await expect(page.locator('text.leaf-label').filter({ hasText: 'C' })).toBeVisible();
    await expect(page.locator('text.leaf-label').filter({ hasText: 'D' })).toBeVisible();
  });

  test('renders branches as SVG paths', async ({ page }) => {
    await page.goto('/');
    await fillAndWait(page, EXAMPLE_NEWICK);

    const branches = page.locator('path.branch');
    await expect(branches.first()).toBeVisible();
    const count = await branches.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('renders a primate tree with all 7 taxa', async ({ page }) => {
    await page.goto('/');
    await fillAndWait(page, PRIMATE_NEWICK);

    const leaves = page.locator('text.leaf-label');
    await expect(leaves).toHaveCount(7);
    await expect(page.locator('text.leaf-label').filter({ hasText: 'Homo sapiens' })).toBeVisible();
    await expect(page.locator('text.leaf-label').filter({ hasText: 'Macaca mulatta' })).toBeVisible();
  });

  test('Load example button renders a demo tree', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: 'Load example' }).click();
    await expect(page.locator('text.leaf-label').first()).toBeVisible();

    const leaves = page.locator('text.leaf-label');
    const count = await leaves.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });
});

test.describe('Layout switching', () => {
  test('switches between rectangular and radial layouts', async ({ page }) => {
    await page.goto('/');
    await fillAndWait(page, EXAMPLE_NEWICK);

    await expect(page.locator('path.branch').first()).toBeVisible();

    await page.locator('#toolbar button', { hasText: 'Radial' }).click();
    await expect(page.locator('#viewer svg')).toBeVisible();
    await expect(page.locator('text.leaf-label').filter({ hasText: 'A' })).toBeVisible();
  });
});

test.describe('Style controls', () => {
  test('changing branch width updates the SVG', async ({ page }) => {
    await page.goto('/');
    await fillAndWait(page, EXAMPLE_NEWICK);

    const initialWidth = await page.locator('path.branch').first().getAttribute('stroke-width');

    const slider = page.locator('#controls-panel input[type="range"]').first();
    await slider.fill('5');
    await page.waitForTimeout(300);

    const newWidth = await page.locator('path.branch').first().getAttribute('stroke-width');
    expect(newWidth).not.toBe(initialWidth);
  });
});

test.describe('Error handling', () => {
  test('shows error for invalid Newick input', async ({ page }) => {
    await page.goto('/');
    await page.locator('#newick-input-1').fill('((A,B);');
    // Wait for debounced render to attempt and fail
    await expect(page.locator('.error-message')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Tanglegram mode', () => {
  test('enables tanglegram with two tree inputs', async ({ page }) => {
    await page.goto('/');
    await page.locator('#toolbar button', { hasText: 'Tanglegram' }).click();
    await expect(page.locator('#newick-input-2')).toBeVisible();
  });

  test('renders tanglegram with matching taxa', async ({ page }) => {
    await page.goto('/');
    await page.locator('#toolbar button', { hasText: 'Tanglegram' }).click();
    await page.locator('#newick-input-1').fill('((A:0.1,B:0.2):0.3,(C:0.4,D:0.5):0.6);');
    await page.locator('#newick-input-2').fill('((C:0.3,A:0.1):0.2,(B:0.4,D:0.5):0.6);');
    // Wait for auto-render
    await expect(page.locator('path.connection').first()).toBeVisible({ timeout: 5000 });
    const connections = page.locator('path.connection');
    const count = await connections.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

test.describe('URL state sharing', () => {
  test('URL hash updates after rendering a tree', async ({ page }) => {
    await page.goto('/');
    await fillAndWait(page, EXAMPLE_NEWICK);
    await page.waitForTimeout(200);
    const url = page.url();
    expect(url).toContain('#');
    expect(url).toContain('s=');
  });

  test('loading a URL with state restores the tree', async ({ page }) => {
    await page.goto('/');
    await fillAndWait(page, EXAMPLE_NEWICK);
    await page.waitForTimeout(200);
    const urlWithState = page.url();

    await page.goto(urlWithState);
    await expect(page.locator('#viewer svg')).toBeVisible();
    await expect(page.locator('text.leaf-label').filter({ hasText: 'A' })).toBeVisible();
  });
});

test.describe('Visual appearance', () => {
  test('tree rendering produces visible output', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: 'Load example' }).click();
    await expect(page.locator('text.leaf-label').first()).toBeVisible();

    const viewer = page.locator('#viewer');
    await expect(viewer.locator('svg')).toBeVisible();
    await expect(viewer.locator('path.branch').first()).toBeVisible();
    const count1 = await viewer.locator('text.leaf-label').count();
    expect(count1).toBeGreaterThanOrEqual(5);
  });

  test('radial layout produces visible output', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: 'Load example' }).click();
    await expect(page.locator('text.leaf-label').first()).toBeVisible();

    await page.locator('#toolbar button', { hasText: 'Radial' }).click();
    await expect(page.locator('text.leaf-label').first()).toBeVisible();

    const viewer = page.locator('#viewer');
    await expect(viewer.locator('svg')).toBeVisible();
    const count2 = await viewer.locator('text.leaf-label').count();
    expect(count2).toBeGreaterThanOrEqual(5);
  });
});

test.describe('Auto-sync', () => {
  test('textarea content auto-renders the tree', async ({ page }) => {
    await page.goto('/');
    await page.locator('#newick-input-1').fill('(A,B,C);');
    // Wait for auto-render debounce
    await expect(page.locator('text.leaf-label').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text.leaf-label')).toHaveCount(3);
  });
});
