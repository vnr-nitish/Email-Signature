// Builds fully self-contained, inline-styled HTML for an email signature.
// Inline styles (not CSS classes) are required here because Gmail/Outlook
// strip <style> blocks and external stylesheets when you paste into the
// signature box — only inline style="" attributes survive reliably.

import { COLLEGE_WEBSITE_URL } from "./app-config.js";

const TEAL = "#0e6f5f";
const INK = "#1f2d2b";

// Relative to the app's own root. Resolved to an absolute URL at copy-time
// (see dashboard.js) so the copied signature keeps working once it's pasted
// into Gmail and opened from anywhere else.
const ICON_PATH = (name) => `assets/icons/${name}.png`;
const BANNER_PATH = "assets/banner.gif";

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
  } = profile;

  const infoLines = [program, department, school, campus]
    .filter(Boolean)
    .map(
      (line) =>
        `<p style="margin:0 0 3px;font-size:13px;font-weight:600;line-height:1.35;color:${INK};font-family:Arial,Helvetica,sans-serif;">${escapeHtml(line)}</p>`
    )
    .join("");

  const contactLines = [];
  if (mobile) contactLines.push(`<b>M</b> ${escapeHtml(mobile)}`);
  if (website) contactLines.push(`<a href="${escapeHtml(website)}" style="color:${INK};text-decoration:none;" target="_blank">${escapeHtml(website)}</a>`);

  const contactHtml = contactLines
    .map(
      (line) =>
        `<p style="margin:0 0 3px;font-size:13px;font-family:Arial,Helvetica,sans-serif;color:${INK};">${line}</p>`
    )
    .join("");

  const socialsHtml = [
    socialIcon("linkedin", linkedin),
    socialIcon("instagram", instagram),
    socialIcon("youtube", youtube),
    socialIcon("facebook", facebook),
    socialIcon("twitter", twitter),
  ].join("");

  const nameHtml = `<p style="margin:0 0 4px;font-size:17px;font-weight:700;color:${TEAL};font-family:Arial,Helvetica,sans-serif;">${escapeHtml(fullName)}</p>`;

  const banner = `
    <tr>
      <td colspan="2" style="padding-top:14px;">
        <a href="${COLLEGE_WEBSITE_URL}" target="_blank" style="display:block;line-height:0;">
          <img src="${BANNER_PATH}" width="560" style="display:block;width:100%;max-width:560px;border:0;" alt="" />
        </a>
      </td>
    </tr>`;

  const photoCell = withPhoto
    ? `
    <td style="padding-right:18px;vertical-align:top;">
      ${
        photoURL
          ? `<img src="${escapeHtml(photoURL)}" width="84" height="84" style="width:84px;height:84px;border-radius:50%;object-fit:cover;display:block;" alt="${escapeHtml(fullName)}" />`
          : `<div style="width:84px;height:84px;border-radius:50%;background:#eef3f2;"></div>`
      }
    </td>`
    : "";

  return `
<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;color:${INK};">
  <tr>
    ${photoCell}
    <td style="vertical-align:top;">
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
