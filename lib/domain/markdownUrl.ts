/** Allow web and email URLs, plus relative links and fragments in model-authored Markdown. */
export function markdownUrl(url: string): string {
  if (/[\u0000-\u0020\u007f]/.test(url)) return "";
  const scheme = url.match(/^([^/?#]*):/);
  return !scheme || /^(https?|mailto)$/i.test(scheme[1]) ? url : "";
}
