
const document = {
  documentElement: { dataset: {}, setAttribute: () => {} },
  getElementById: (id) => ({ addEventListener: () => {}, textContent: '', classList: { add:()=>{}, remove:()=>{} }, innerHTML: '', style: {}, insertAdjacentHTML: ()=>{} }),
  querySelectorAll: () => [],
  querySelector: () => ({ appendChild: ()=>{} }),
  createElement: () => ({ classList:{add:()=>{}}, setAttribute:()=>{}, appendChild:()=>{} }),
  addEventListener: (evt, cb) => { if(evt==='DOMContentLoaded') cb(); }
};
const window = { _map: null, _lightTile: null, _darkTile: null, PAKISTAN_GEOJSON_DATA: {}, addEventListener: ()=>{} };
const L = {
  map: () => ({ setView: () => ({ removeLayer: () => {} }), removeLayer: () => {} }),
  tileLayer: () => ({ addTo: () => {} }),
  geoJSON: () => ({ addTo: () => ({ bringToBack: () => {} }) }),
  polyline: () => ({ addTo: () => ({ bindTooltip: () => {} }) }),
  divIcon: () => ({}),
  marker: () => ({ addTo: () => ({ bindPopup: () => {} }) })
};
const localStorage = { getItem: () => 'dark', setItem: () => {} };
const fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({stations:[]}) });
const navigator = { serviceWorker: { register: () => Promise.resolve() } };
const IntersectionObserver = class { observe(){} disconnect(){} };


document.addEventListener('DOMContentLoaded', () => {
  // Inject Hamburger Button into topbar
  const topbarRight = document.querySelector('.topbar-right');
  if (topbarRight && !document.getElementById('topbar-hamburger')) {
    const hBtn = document.createElement('div');
    hBtn.className = 'hamburger-btn';
    hBtn.id = 'topbar-hamburger';
    hBtn.innerHTML = '☰';
    hBtn.title = 'Open Menu & Controls';
    topbarRight.insertBefore(hBtn, topbarRight.firstChild);

    hBtn.addEventListener('click', () => {
      document.getElementById('drawer-overlay')?.classList.add('active');
      document.getElementById('app-drawer')?.classList.add('active');
    });
  }

  const overlay = document.getElementById('drawer-overlay');
  const drawer = document.getElementById('app-drawer');
  const closeBtn = document.getElementById('drawer-close');

  const closeDrawer = () => {
    overlay?.classList.remove('active');
    drawer?.classList.remove('active');
  };

  overlay?.addEventListener('click', closeDrawer);
  closeBtn?.addEventListener('click', closeDrawer);

  // Copy Left Panel and Legend into Drawer
  setTimeout(() => {
    const lp = document.getElementById('left-panel');
    if (lp) document.getElementById('drawer-controls-copy').innerHTML = lp.innerHTML;
    const leg = document.querySelector('.map-legend');
    if (leg) document.getElementById('drawer-legend-copy').innerHTML = leg.innerHTML;

    const r = document.getElementById('pane-rivers');
    if (r) document.getElementById('f-rivers-body').innerHTML = r.innerHTML;
    const w = document.getElementById('pane-weather');
    if (w) document.getElementById('f-weather-body').innerHTML = w.innerHTML;
    const a = document.getElementById('pane-news');
    if (a) document.getElementById('f-alerts-body').innerHTML = a.innerHTML;
    const h = document.getElementById('pane-help');
    if (h) document.getElementById('f-help-body').innerHTML = h.innerHTML;
  }, 300);

  // Footer Navigation Bar Tab Switching
  document.querySelectorAll('.f-nav-item').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.f-nav-item').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.f-screen-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');

      const target = tab.dataset.target;
      if (target && target !== 'panel-map') {
        document.getElementById(target)?.classList.add('active');
      }
    });
  });
});
