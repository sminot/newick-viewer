/**
 * Export utilities for downloading tree visualizations as PDF or standalone HTML.
 */

/** Get the current SVG element's serialized content with zoom reset */
function getSVGContent(container: HTMLElement): string | null {
  const svg = container.querySelector('svg');
  if (!svg) return null;

  // Get content bounding box from the original (before cloning)
  const group = svg.querySelector('g');
  const contentBBox = group ? group.getBBox() : null;

  // Clone the SVG so we can modify it without affecting the display
  const clone = svg.cloneNode(true) as SVGSVGElement;

  // Reset the zoom transform on the cloned group so we export the full tree
  const cloneGroup = clone.querySelector('g');
  if (cloneGroup) {
    cloneGroup.removeAttribute('transform');
  }

  // Use content bounding box to size the export (includes labels + legend)
  if (contentBBox) {
    const pad = 10;
    const w = contentBBox.x + contentBBox.width + pad;
    const h = contentBBox.y + contentBBox.height + pad;
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
  } else {
    const bbox = svg.getBoundingClientRect();
    clone.setAttribute('width', String(bbox.width));
    clone.setAttribute('height', String(bbox.height));
  }
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  return new XMLSerializer().serializeToString(clone);
}

/** Download a file via a temporary anchor element */
function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Export tree as a standalone HTML file that can be opened in any browser */
export function exportStandaloneHTML(container: HTMLElement, title: string = 'Phylogenetic Tree'): void {
  const svgContent = getSVGContent(container);
  if (!svgContent) return;
  const safeTitle = escapeHtmlAttr(title);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    background: #fff;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    padding: 20px;
  }
  .container {
    width: 100%;
    max-width: 1400px;
  }
  h1 {
    font-size: 16px;
    font-weight: 500;
    color: #333;
    margin-bottom: 12px;
  }
  svg {
    width: 100%;
    height: auto;
    border: 1px solid #e0e0e0;
  }
</style>
</head>
<body>
<div class="container">
  <h1>${safeTitle}</h1>
  ${svgContent}
</div>
<script>
  // Enable zoom/pan via mouse wheel and drag
  const svg = document.querySelector('svg');
  const g = svg.querySelector('g');
  if (svg && g) {
    let scale = 1, tx = 0, ty = 0, dragging = false, startX, startY;

    function updateTransform() {
      g.setAttribute('transform', 'translate(' + tx + ',' + ty + ') scale(' + scale + ')');
    }

    svg.addEventListener('wheel', function(e) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      scale *= delta;
      scale = Math.max(0.1, Math.min(20, scale));
      updateTransform();
    });

    svg.addEventListener('mousedown', function(e) {
      dragging = true;
      startX = e.clientX - tx;
      startY = e.clientY - ty;
    });

    window.addEventListener('mousemove', function(e) {
      if (!dragging) return;
      tx = e.clientX - startX;
      ty = e.clientY - startY;
      updateTransform();
    });

    window.addEventListener('mouseup', function() { dragging = false; });
  }
</script>
</body>
</html>`;

  downloadFile('phylogenetic-tree.html', html, 'text/html');
}

/** Export tree as PDF using the browser's print functionality */
export function exportPDF(container: HTMLElement, title: string = 'Phylogenetic Tree'): void {
  const svgContent = getSVGContent(container);
  if (!svgContent) return;
  const safeTitle = escapeHtmlAttr(title);

  // Open a new window with just the SVG for printing
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to export PDF');
    return;
  }

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<title>${safeTitle}</title>
<style>
  @page { size: landscape; margin: 0.5in; }
  * { margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
  h1 { font-size: 14px; font-weight: 500; color: #333; margin-bottom: 10px; }
  svg { width: 100%; height: auto; max-height: 90vh; }
</style>
</head>
<body>
  <h1>${safeTitle}</h1>
  ${svgContent}
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); window.close(); }, 250);
    };
  </script>
</body>
</html>`);
  printWindow.document.close();
}

/** Export just the SVG file */
export function exportSVG(container: HTMLElement): void {
  const svgContent = getSVGContent(container);
  if (!svgContent) return;
  downloadFile('phylogenetic-tree.svg', svgContent, 'image/svg+xml');
}
