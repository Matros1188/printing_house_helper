(() => {
  "use strict";
  const STORAGE_KEY = "printcalc-flexo-auth";
  function getClient() {
    if (window.__PRINTORA_SUPABASE_CLIENT) return window.__PRINTORA_SUPABASE_CLIENT;
    const config=window.PRINTCALC_CONFIG||{};
    if(!window.supabase || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) return null;
    window.__PRINTORA_SUPABASE_CLIENT=window.supabase.createClient(config.SUPABASE_URL,config.SUPABASE_ANON_KEY,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storage:window.localStorage,storageKey:STORAGE_KEY}
    });
    return window.__PRINTORA_SUPABASE_CLIENT;
  }
  window.PRINTCALC_AUTH_CORE=window.PRINTCALC_AUTH_CORE||{};
  window.PRINTCALC_AUTH_CORE.storageKey=STORAGE_KEY;
  window.PRINTCALC_AUTH_CORE.getClient=getClient;
  window.PRINTCALC_AUTH_CORE.getSession=async()=>{const c=getClient();return c?c.auth.getSession():{data:{session:null},error:null};};
  window.PRINTCALC_AUTH_CORE.signOut=async()=>{const c=getClient();if(c)await c.auth.signOut({scope:"local"});};
})();
