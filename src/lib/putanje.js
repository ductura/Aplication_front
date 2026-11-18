// The app is served under /admin (edge proxy on :8000, ugovor c.6993786629 §1).
// Next adds the base path to <Link>, router and redirect(); fetch() does not,
// so BFF calls from the browser go through api().
export const BASE_PATH = "/admin";
export const api = (putanja) => `${BASE_PATH}/api${putanja}`;
