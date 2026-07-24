// UI module — team rules say the pipeline must NOT touch UI files.
export function renderBanner(title) {
  return `<div class="banner"><h1>${title}</h1></div>`;
}
