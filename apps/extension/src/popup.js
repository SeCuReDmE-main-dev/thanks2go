const ALLOWED_ORIGIN = "https://thanks2go.securedme.ca";
const status = document.querySelector("#status");
const result = document.querySelector("#result");
const route = document.querySelector("#route");
let candidate;

function canonical(input) {
  try {
    const url = new URL(input);
    const validPath = /^\/p\/[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(url.pathname);
    return url.protocol === "https:" && url.origin === ALLOWED_ORIGIN && validPath && !url.search && !url.hash && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

function present(profileUrl, sourceOrigin) {
  candidate = profileUrl;
  result.hidden = false;
  route.textContent = sourceOrigin ? `Declared by ${sourceOrigin} → Opens ${profileUrl}` : `Pasted manually → Opens ${profileUrl}`;
  status.textContent = "Valid canonical profile. Opening still requires your click.";
}

document.querySelector("#inspect").addEventListener("click", async () => {
  result.hidden = true; candidate = undefined;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/.test(tab.url ?? "")) throw new Error("RESTRICTED_PAGE");
    const [{ result: found }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
      const links = [...document.querySelectorAll('link[rel~="thanks2go"]')].map((node) => node.href).filter(Boolean);
      const metas = [...document.querySelectorAll('meta[name="thanks2go:profile"]')].map((node) => node.content).filter(Boolean);
      return { origin: location.origin, links, metas };
    }});
    const declarations = [...new Set([...(found?.links ?? []), ...(found?.metas ?? [])])];
    if (declarations.length === 0) throw new Error("NO_DECLARATION");
    if (declarations.length > 1) throw new Error("DECLARATION_CONFLICT");
    const value = canonical(declarations[0]);
    if (!value) throw new Error("INVALID_PROFILE_URL");
    present(value, found.origin);
  } catch (error) { status.textContent = `${error.message}. You may paste a canonical profile below.`; }
});

document.querySelector("#manual").addEventListener("submit", (event) => {
  event.preventDefault();
  const value = canonical(document.querySelector("#url").value);
  if (!value) { result.hidden = true; status.textContent = "INVALID_PROFILE_URL. Only the canonical Thanks2Go HTTPS host and /p/{slug} are accepted."; return; }
  present(value);
});

document.querySelector("#open").addEventListener("click", () => { if (candidate) chrome.tabs.create({ url: candidate }); });
