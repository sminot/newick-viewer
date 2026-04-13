import { test, expect } from '@playwright/test';

const EXAMPLE_NEWICK = '((A:0.1,B:0.2):0.3,(C:0.4,D:0.5):0.6);';
const PRIMATE_NEWICK = '((((Homo sapiens:0.0067,Pan_troglodytes:0.0072):0.0024,Gorilla_gorilla:0.0089):0.0096,(Pongo_abelii:0.0183,Hylobates_lar:0.0220):0.0033):0.0350,(Macaca mulatta:0.0370,Papio_anubis:0.0365):0.0150);';

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
    await page.locator('#newick-input-1').fill(EXAMPLE_NEWICK);
    await page.locator('button.primary').click();

    // SVG should be created
    const svg = page.locator('#viewer svg');
    await expect(svg).toBeVisible();

    // Check that leaf labels are present
    await expect(page.locator('text.leaf-label').filter({ hasText: 'A' })).toBeVisible();
    await expect(page.locator('text.leaf-label').filter({ hasText: 'B' })).toBeVisible();
    await expect(page.locator('text.leaf-label').filter({ hasText: 'C' })).toBeVisible();
    await expect(page.locator('text.leaf-label').filter({ hasText: 'D' })).toBeVisible();
  });

  test('renders branches as SVG paths', async ({ page }) => {
    await page.goto('/');
    await page.locator('#newick-input-1').fill(EXAMPLE_NEWICK);
    await page.locator('button.primary').click();

    const branches = page.locator('path.branch');
    const count = await branches.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('renders a primate tree with all 7 taxa', async ({ page }) => {
    await page.goto('/');
    await page.locator('#newick-input-1').fill(PRIMATE_NEWICK);
    await page.locator('button.primary').click();

    const leaves = page.locator('text.leaf-label');
    await expect(leaves).toHaveCount(7);

    await expect(page.locator('text.leaf-label').filter({ hasText: 'Homo sapiens' })).toBeVisible();
    await expect(page.locator('text.leaf-label').filter({ hasText: 'Macaca mulatta' })).toBeVisible();
  });

  test('Load example button renders the demo tree', async ({ page }) => {
    await page.goto('/');
    // Click "Load example"
    await page.locator('button', { hasText: 'Load example' }).click();

    const svg = page.locator('#viewer svg');
    await expect(svg).toBeVisible();

    const leaves = page.locator('text.leaf-label');
    const count = await leaves.count();
    expect(count).toBe(7);
  });
});

test.describe('Layout switching', () => {
  test('switches between rectangular and radial layouts', async ({ page }) => {
    await page.goto('/');
    await page.locator('#newick-input-1').fill(EXAMPLE_NEWICK);
    await page.locator('button.primary').click();

    // Default is rectangular - should have path elements for elbows
    await expect(page.locator('path.branch').first()).toBeVisible();

    // Switch to radial
    await page.locator('#toolbar button', { hasText: 'Radial' }).click();

    // Should now have line elements instead of paths
    await expect(page.locator('#viewer svg')).toBeVisible();
    // Leaf labels should still be visible
    await expect(page.locator('text.leaf-label').filter({ hasText: 'A' })).toBeVisible();
  });
});

test.describe('Style controls', () => {
  test('changing branch width updates the SVG', async ({ page }) => {
    await page.goto('/');
    await page.locator('#newick-input-1').fill(EXAMPLE_NEWICK);
    await page.locator('button.primary').click();

    // Get initial stroke width
    const initialWidth = await page.locator('path.branch').first().getAttribute('stroke-width');

    // Change branch width slider to max
    const slider = page.locator('#controls-panel input[type="range"]').first();
    await slider.fill('5');

    // Stroke width should change
    const newWidth = await page.locator('path.branch').first().getAttribute('stroke-width');
    expect(newWidth).not.toBe(initialWidth);
  });
});

test.describe('Error handling', () => {
  test('shows error for invalid Newick input', async ({ page }) => {
    await page.goto('/');
    await page.locator('#newick-input-1').fill('this is not valid newick');
    await page.locator('button.primary').click();

    await expect(page.locator('.error-message')).toBeVisible();
  });
});

test.describe('Tanglegram mode', () => {
  test('enables tanglegram with two tree inputs', async ({ page }) => {
    await page.goto('/');

    // Enable tanglegram
    await page.locator('#toolbar button', { hasText: 'Tanglegram' }).click();

    // Second textarea should appear
    await expect(page.locator('#newick-input-2')).toBeVisible();
  });

  test('renders tanglegram with matching taxa', async ({ page }) => {
    await page.goto('/');

    await page.locator('#toolbar button', { hasText: 'Tanglegram' }).click();
    await page.locator('#newick-input-1').fill('((A:0.1,B:0.2):0.3,(C:0.4,D:0.5):0.6);');
    await page.locator('#newick-input-2').fill('((C:0.3,A:0.1):0.2,(B:0.4,D:0.5):0.6);');
    await page.locator('button.primary').click();

    // SVG should be visible with connection lines
    await expect(page.locator('#viewer svg')).toBeVisible();
    // Should have connecting paths between matching leaves
    const connections = page.locator('path.connection');
    const count = await connections.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

test.describe('URL state sharing', () => {
  test('URL hash updates after rendering a tree', async ({ page }) => {
    await page.goto('/');
    await page.locator('#newick-input-1').fill(EXAMPLE_NEWICK);
    await page.locator('button.primary').click();

    // Wait a moment for URL to update
    await page.waitForTimeout(500);

    const url = page.url();
    expect(url).toContain('#');
    expect(url).toContain('s=');
  });

  test('loading a URL with state restores the tree', async ({ page }) => {
    // First, render a tree and get the URL
    await page.goto('/');
    await page.locator('#newick-input-1').fill(EXAMPLE_NEWICK);
    await page.locator('button.primary').click();
    await page.waitForTimeout(500);

    const urlWithState = page.url();

    // Navigate to that URL in a fresh page
    await page.goto(urlWithState);
    await page.waitForTimeout(500);

    // The tree should be rendered
    const svg = page.locator('#viewer svg');
    await expect(svg).toBeVisible();

    // Leaf labels should be present
    await expect(page.locator('text.leaf-label').filter({ hasText: 'A' })).toBeVisible();
  });
});

test.describe('Visual appearance', () => {
  test('tree rendering looks correct', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: 'Load example' }).click();
    await page.waitForTimeout(300);

    // Take a screenshot of the viewer area for visual validation
    const viewer = page.locator('#viewer');
    await expect(viewer).toHaveScreenshot('primate-tree-rectangular.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('radial layout looks correct', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: 'Load example' }).click();
    await page.locator('#toolbar button', { hasText: 'Radial' }).click();
    await page.waitForTimeout(300);

    const viewer = page.locator('#viewer');
    await expect(viewer).toHaveScreenshot('primate-tree-radial.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});
