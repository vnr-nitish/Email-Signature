// Copies a rendered signature node's HTML (with inline styles) so pasting
// into the Gmail signature box keeps the layout, photo, and colors intact.
// Shared by the student dashboard and the admin panel.
export async function copySignatureNode(node) {
  // Icon/banner <img> tags use relative src paths so they work whether
  // this app is running on localhost or a deployed domain. Rewriting each
  // attribute to element.src (a browser getter that always resolves to a
  // full absolute URL based on the current page) bakes in the right host
  // at copy time, so the pasted signature keeps working once it leaves
  // this page.
  node.querySelectorAll("img").forEach((img) => {
    img.setAttribute("src", img.src);
  });

  const html = node.innerHTML;
  const text = node.innerText;

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      }),
    ]);
    return true;
  } catch (err) {
    // Fallback for browsers without ClipboardItem support: select the
    // rendered node in the page and use the older execCommand copy.
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const ok = document.execCommand("copy");
    selection.removeAllRanges();
    return ok;
  }
}
