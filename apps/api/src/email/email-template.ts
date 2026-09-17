export interface EmailLayout {
  readonly clinicName: string;
  /** Referenced as `cid:` so the mark survives the signed URL it was fetched from. */
  readonly logoContentId?: string | undefined;
  readonly heading: string;
  readonly body: readonly string[];
  readonly action: { readonly label: string; readonly url: string };
  readonly footer: string;
}

const escape = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
      character,
  );

// Hard-coded rather than read from the theme: an email is opened somewhere the app's stylesheet
// will never reach, so the two cannot share a token. Kept to the brand's blue and a neutral ink.
const INK = "#12303f";
const MUTED = "#4e6975";
const LINE = "#e0eaee";
const CANVAS = "#f1f6f7";
const PRIMARY = "#1b6f97";

export function renderEmail(layout: EmailLayout): { html: string; text: string } {
  const mark = layout.logoContentId
    ? `<img src="cid:${escape(layout.logoContentId)}" alt="${escape(layout.clinicName)}" width="56" height="56" style="display:block;border:0;border-radius:12px;object-fit:contain" />`
    : `<div style="font:600 18px/1.4 Tahoma,Arial,sans-serif;color:${INK}">${escape(layout.clinicName)}</div>`;

  const paragraphs = layout.body
    .map(
      (line) =>
        `<p style="margin:0 0 12px;font:400 15px/1.7 Tahoma,Arial,sans-serif;color:${MUTED}">${escape(line)}</p>`,
    )
    .join("");

  const html = `<!doctype html>
<html dir="rtl" lang="ar"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /><title>${escape(layout.heading)}</title></head>
<body style="margin:0;padding:24px 12px;background:${CANVAS}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;border-collapse:collapse;background:#ffffff;border:1px solid ${LINE};border-radius:16px">
  <tr><td style="padding:24px 24px 0" align="right">${mark}</td></tr>
  <tr><td style="padding:16px 24px 0" align="right">
    <h1 style="margin:0;font:600 20px/1.5 Tahoma,Arial,sans-serif;color:${INK}">${escape(layout.heading)}</h1>
  </td></tr>
  <tr><td style="padding:12px 24px 0" align="right">${paragraphs}</td></tr>
  <tr><td style="padding:8px 24px 24px" align="right">
    <a href="${escape(layout.action.url)}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:${PRIMARY};color:#ffffff;font:500 15px/1 Tahoma,Arial,sans-serif;text-decoration:none">${escape(layout.action.label)}</a>
  </td></tr>
  <tr><td style="padding:0 24px 24px" align="right">
    <p style="margin:0;font:400 12px/1.6 Tahoma,Arial,sans-serif;color:${MUTED};word-break:break-all">${escape(layout.action.url)}</p>
  </td></tr>
  <tr><td style="padding:16px 24px;border-top:1px solid ${LINE}" align="right">
    <p style="margin:0;font:400 12px/1.6 Tahoma,Arial,sans-serif;color:${MUTED}">${escape(layout.footer)}</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    layout.clinicName,
    "",
    layout.heading,
    "",
    ...layout.body,
    "",
    `${layout.action.label}: ${layout.action.url}`,
    "",
    layout.footer,
  ].join("\n");

  return { html, text };
}
