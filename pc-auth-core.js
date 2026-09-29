(() => {
  "use strict";

  const STORAGE_KEY = "printcalc-flexo-auth";

  function getClient() {
    if (window.__PRINTCALC_SUPABASE_CLIENT) {
      return window.__PRINTCALC_SUPABASE_CLIENT;
    }

    const config = window.PRINTCALC_CONFIG || {};
    const supabaseLib = window.supabase || null;

    if (!supabaseLib || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
      return null;
    }

    window.__PRINTCALC_SUPABASE_CLIENT = supabaseLib.createClient(
      config.SUPABASE_URL,
      config.SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storage: window.localStorage,
          storageKey: STORAGE_KEY,
        },
      }
    );

    return window.__PRINTCALC_SUPABASE_CLIENT;
  }

  window.PRINTCALC_AUTH_CORE = {
    storageKey: STORAGE_KEY,
    getClient,
  };
})();
