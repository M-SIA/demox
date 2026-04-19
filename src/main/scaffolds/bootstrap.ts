/**
 * HTML snippet injected into scaffold index.html. When the page is opened with
 * a `__demox_sdk` query param it loads the comment overlay SDK from that URL.
 * Silent no-op otherwise, so deployed prototypes stay clean by default.
 */
export const DEMOX_BOOTSTRAP = `<script>
(function(){
  try {
    var u = new URL(location.href);
    var sdk = u.searchParams.get('__demox_sdk');
    var pid = u.searchParams.get('__demox_pid');
    var api = u.searchParams.get('__demox_api');
    if (!sdk || !pid || !api) return;
    window.__DEMOX__ = { project: pid, api: api };
    var s = document.createElement('script');
    s.src = sdk; s.async = true;
    document.head.appendChild(s);
  } catch (e) { /* ignore */ }
})();
</script>`
