const BOOTSTRAP_SCRIPT = '<script id="omni-bootstrap" type="application/json">';

export function serializeBootstrapForHtml(value: unknown) {
  return JSON.stringify(value)
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function injectBootstrapHtml(template: string, bootstrap: unknown) {
  const script = `${BOOTSTRAP_SCRIPT}${serializeBootstrapForHtml(bootstrap)}</script>`;
  const bodyClose = template.lastIndexOf("</body>");
  if (bodyClose < 0) {
    return `${template}${script}`;
  }
  return `${template.slice(0, bodyClose)}${script}${template.slice(bodyClose)}`;
}
