/**
 * Keep automated guest/mobile QA from writing synthetic engagement events
 * to the real Supabase project. All other backend calls are left untouched.
 */
export async function registerQaTelemetryRoute(context) {
 await context.route(
  url=>url.hostname.endsWith('.supabase.co')&&url.pathname==='/rest/v1/player_engagement_events',
  async route=>{
   const headers={
    'access-control-allow-origin':'*',
    'access-control-allow-methods':'POST, OPTIONS',
    'access-control-allow-headers':route.request().headers()['access-control-request-headers']||'apikey, authorization, content-type, prefer, x-client-info',
    'content-type':'application/json'
   };
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
   if(route.request().method()==='POST')return route.fulfill({status:201,headers,body:'[]'});
   return route.continue();
  }
 );
}
