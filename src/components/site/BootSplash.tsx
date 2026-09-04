import { BrandSplash } from "@/components/site/BrandSplash";

/**
 * Overlay só no PWA (standalone). O script inline some com ele depois
 * de um instante — conteúdo já está atrás, então a abertura parece app.
 */
const BOOT_SCRIPT = `
(function(){
  var nav = window.navigator;
  var standalone = false;
  try {
    standalone = window.matchMedia("(display-mode: standalone)").matches
      || window.matchMedia("(display-mode: fullscreen)").matches
      || nav.standalone === true;
  } catch (e) {}
  var path = location.pathname || "";
  var force = false;
  try { force = /(?:^|[?&])garagem_splash=1(?:&|$)/.test(location.search); } catch (e) {}
  function boot(){
    document.documentElement.classList.add("garagem-booted");
    try { sessionStorage.setItem("garagem:booted", "1"); } catch (e) {}
  }
  if (force) {
    document.documentElement.classList.add("garagem-splash-on");
  }
  if (!force && (!standalone || path.indexOf("/admin") === 0)) {
    boot();
    return;
  }
  try {
    if (!force && sessionStorage.getItem("garagem:booted") === "1") {
      boot();
      return;
    }
    if (force) sessionStorage.removeItem("garagem:booted");
  } catch (e) {}
  var done = false;
  function hide(){
    if (done) return;
    done = true;
    boot();
  }
  var reduced = false;
  try { reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  window.setTimeout(hide, force ? 3500 : reduced ? 200 : 800);
  window.addEventListener("load", function(){ window.setTimeout(hide, 160); }, { once: true });
})();
`;

export function BootSplash() {
  return (
    <>
      <div id="garagem-boot" className="garagem-boot" aria-hidden="true">
        <BrandSplash label="Seminovos com procedência" />
      </div>
      <script
        id="garagem-boot-script"
        dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }}
      />
    </>
  );
}
