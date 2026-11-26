// The app is served under /administracija (karta adresa D-318, DAN-1574; edge
// proxy on :8000). Old /admin addresses are redirected (301) by the edge, not
// here. Next adds the base path to <Link>, router and redirect(); fetch() does
// not, so BFF calls from the browser go through api().
export const BASE_PATH = "/administracija";
export const api = (putanja) => `${BASE_PATH}/api/v1${putanja}`;
