// Builds fully self-contained, inline-styled HTML for an email signature.
// Inline styles (not CSS classes) are required here because Gmail/Outlook
// strip <style> blocks and external stylesheets when you paste into the
// signature box — only inline style="" attributes survive reliably.

import { COLLEGE_WEBSITE_URL } from "./app-config.js";

const TEAL = "#0e6f5f";
const INK = "#1f2d2b";
const PHOTO_SIZE = 130;
// The whole signature is locked to this width — including the banner — so
// nothing (the banner in particular) forces the table wider than the rest
// of the block and throws proportions off.
const SIGNATURE_WIDTH = 470;

// Relative to the app's own root. Resolved to an absolute URL at copy-time
// (see dashboard.js) so the copied signature keeps working once it's pasted
// into Gmail and opened from anywhere else.
const ICON_PATH = (name) => `assets/icons/${name}.png`;
const BANNER_PATH = "assets/banner.gif";

// Only fonts a recipient's own device is likely to already have installed
// render reliably in an email — clients don't load @font-face/web fonts in
// mail bodies. Inter, EB Garamond, and Garamond aren't standard system
// fonts, so they're listed with a safe fallback and will silently drop to
// that fallback for anyone who doesn't have them installed.
export const FONT_OPTIONS = {
  Inter: "'Inter', Arial, sans-serif",
  "EB Garamond": "'EB Garamond', Georgia, serif",
  Georgia: "Georgia, 'Times New Roman', serif",
  "Comic Sans MS": "'Comic Sans MS', 'Comic Sans', cursive",
  Serif: "serif",
  Garamond: "Garamond, 'EB Garamond', Georgia, serif",
  "Trebuchet MS": "'Trebuchet MS', Helvetica, sans-serif",
};
const DEFAULT_FONT = "Inter";

function fontStack(fontFamily) {
  return FONT_OPTIONS[fontFamily] || FONT_OPTIONS[DEFAULT_FONT];
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function socialIcon(iconName, url) {
  if (!url) return "";
  const safeUrl = escapeHtml(url);
  return `
    <a href="${safeUrl}" target="_blank" style="display:inline-block;margin-right:8px;line-height:0;"><img src="${ICON_PATH(iconName)}" width="26" height="26" style="width:26px;height:26px;display:block;border:0;" alt="${iconName}" /></a>`;
}

export function buildSignatureHTML(profile, { withPhoto } = { withPhoto: true }) {
  const {
    fullName = "",
    program = "",
    department = "",
    school = "",
    campus = "",
    mobile = "",
    website = "",
    photoURL = "",
    linkedin = "",
    instagram = "",
    youtube = "",
    facebook = "",
    twitter = "",
    fontFamily = DEFAULT_FONT,
    // Per-signature overrides, set by the admin panel for a
    // managed (non-GITAM) signature. A self-service student signature
    // never has these set, so it always falls back to the defaults.
    bannerURL = "",
    bannerLink = "",
  } = profile;

  const font = fontStack(fontFamily);

  const infoLines = [program, department, school, campus]
    .filter(Boolean)
    .map(
      (line) =>
        `<p style="margin:0;font-size:13px;font-weight:600;line-height:1.35;color:${INK};font-family:${font};">${escapeHtml(line)}</p>`
    )
    .join("");

  const contactLines = [];
  if (mobile) contactLines.push(`<b>M</b> ${escapeHtml(mobile)}`);
  if (website) contactLines.push(`<a href="${escapeHtml(website)}" style="color:${INK};text-decoration:none;" target="_blank">${escapeHtml(website)}</a>`);

  const contactHtml = contactLines
    .map(
      (line) =>
        `<p style="margin:0;font-size:13px;font-family:${font};color:${INK};">${line}</p>`
    )
    .join("");

  const socialsHtml = [
    socialIcon("linkedin", linkedin),
    socialIcon("instagram", instagram),
    socialIcon("youtube", youtube),
    socialIcon("facebook", facebook),
    socialIcon("twitter", twitter),
  ].join("");

  const nameHtml = `<p style="margin:0;font-size:17px;font-weight:700;color:${TEAL};font-family:${font};">${escapeHtml(fullName)}</p>`;

  const effectiveBannerSrc = bannerURL || BANNER_PATH;
  const effectiveBannerLink = bannerLink || COLLEGE_WEBSITE_URL;

  const banner = `
    <tr>
      <td colspan="2" style="padding-top:0;">
        <a href="${escapeHtml(effectiveBannerLink)}" target="_blank" style="display:block;line-height:0;">
          <img src="${escapeHtml(effectiveBannerSrc)}" width="${SIGNATURE_WIDTH}" style="display:block;width:100%;max-width:${SIGNATURE_WIDTH}px;border:0;" alt="" />
        </a>
      </td>
    </tr>`;

  const photoCell = withPhoto
    ? `
    <td style="vertical-align:middle;text-align:center;width:140px;padding:0px 10px 0px 5px;">
      ${
        photoURL
          ? `<img src="${escapeHtml(photoURL)}" width="${PHOTO_SIZE}" height="${PHOTO_SIZE}" style="width:${PHOTO_SIZE}px;height:${PHOTO_SIZE}px;border-radius:50%;border:3px solid #fff;object-fit:cover;display:block;" alt="${escapeHtml(fullName)}" />`
          : `<div style="width:${PHOTO_SIZE}px;height:${PHOTO_SIZE}px;border-radius:50%;background:#eef3f2;"></div>`
      }
    </td>`
    : "";

  return `
<table width="${SIGNATURE_WIDTH}" height="195" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:${SIGNATURE_WIDTH}px;font-family:${font};color:${INK};">
  <tr>
    ${photoCell}
    <td style="vertical-align:middle;">
      ${nameHtml}
      ${infoLines}
      <div style="margin-top:10px;">
        ${contactHtml}
      </div>
      <div style="margin-top:10px;">
        ${socialsHtml}
      </div>
    </td>
  </tr>
  ${banner}
</table>`.trim();
}
