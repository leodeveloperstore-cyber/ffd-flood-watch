/* PakFlood Watch - Map-First Pro Mobile App Controller */

document.addEventListener('DOMContentLoaded', () => {
  initMapViewport();
  initBottomSheetDrawer();
  initProAppData();
  initProModals();
});

// Primary Pakistani River Stations & Coordinates
const riverStations = [
  { id: 'marala', name: 'Head Marala', river: 'Chenab', inflow: 128500, outflow: 112000, status: 'Low Flood', lat: 32.66, lon: 74.50 },
  { id: 'khanki', name: 'Head Khanki', river: 'Chenab', inflow: 115000, outflow: 108000, status: 'Low Flood', lat: 32.40, lon: 73.87 },
  { id: 'qadirabad', name: 'Head Qadirabad', river: 'Chenab', inflow: 98000, outflow: 89000, status: 'Normal', lat: 32.32, lon: 73.69 },
  { id: 'mangla', name: 'Mangla Reservoir', river: 'Jhelum', inflow: 65000, outflow: 42000, status: 'Normal', lat: 33.14, lon: 73.64 },
  { id: 'rasul', name: 'Rasul Barrage', river: 'Jhelum', inflow: 48000, outflow: 35000, status: 'Normal', lat: 32.70, lon: 73.53 },
  { id: 'tarbela', name: 'Tarbela Reservoir', river: 'Indus', inflow: 285000, outflow: 240000, status: 'Normal', lat: 34.08, lon: 72.70 },
  { id: 'kalabagh', name: 'Kalabagh Barrage', river: 'Indus', inflow: 260000, outflow: 252000, status: 'Low Flood', lat: 32.96, lon: 71.55 },
  { id: 'chashma', name: 'Chashma Barrage', river: 'Indus', inflow: 275000, outflow: 265000, status: 'Low Flood', lat: 32.43, lon: 71.37 },
  { id: 'guddu', name: 'Guddu Barrage', river: 'Indus', inflow: 310000, outflow: 298000, status: 'Low Flood', lat: 28.42, lon: 69.70 },
  { id: 'sukkur', name: 'Sukkur Barrage', river: 'Indus', inflow: 280000, outflow: 265000, status: 'Low Flood', lat: 27.70, lon: 68.85 },
  { id: 'kotri', name: 'Kotri Barrage', river: 'Indus', inflow: 145000, outflow: 132000, status: 'Normal', lat: 25.36, lon: 68.31 },
  { id: 'balloki', name: 'Head Balloki', river: 'Ravi', inflow: 42000, outflow: 28000, status: 'Normal', lat: 31.22, lon: 73.86 },
  { id: 'sulemanki', name: 'Head Sulemanki', river: 'Sutlej', inflow: 38000, outflow: 25000, status: 'Normal', lat: 30.37, lon: 73.87 },
  { id: 'nowshera', name: 'Nowshera Bridge', river: 'Kabul', inflow: 58000, outflow: 58000, status: 'Normal', lat: 34.01, lon: 71.97 }
];

let mapInstance = null;

function initMapViewport() {
  // Initialize Leaflet Map Centered over Pakistan
  mapInstance = L.map('map-viewport', {
    zoomControl: false
  }).setView([30.3753, 69.3451], 6);

  // Dark Vector Tile Layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap & PakFlood Watch GIS'
  }).addTo(mapInstance);

  // Draw Main River Channel Polylines
  const chenabPath = [[32.9, 75.2], [32.66, 74.5], [32.40, 73.87], [32.32, 73.69], [31.5, 72.3], [29.3, 71.1]];
  const indusPath = [[35.2, 75.6], [34.08, 72.7], [32.96, 71.55], [32.43, 71.37], [28.42, 69.70], [27.70, 68.85], [25.36, 68.31]];
  const jhelumPath = [[34.1, 74.3], [33.14, 73.64], [32.70, 73.53], [31.8, 72.3]];

  L.polyline(chenabPath, { color: '#00d2ff', weight: 4, opacity: 0.8, dashArray: '8, 8' }).addTo(mapInstance);
  L.polyline(indusPath, { color: '#3b82f6', weight: 5, opacity: 0.8, dashArray: '8, 8' }).addTo(mapInstance);
  L.polyline(jhelumPath, { color: '#6366f1', weight: 4, opacity: 0.8, dashArray: '8, 8' }).addTo(mapInstance);

  // Add Pulsing Station Markers
  riverStations.forEach(st => {
    let color = '#10b981';
    if (st.status.includes('Low')) color = '#3b82f6';
    if (st.status.includes('Medium')) color = '#f59e0b';
    if (st.status.includes('High')) color = '#ef4444';

    const circle = L.circleMarker([st.lat, st.lon], {
      color: color,
      fillColor: color,
      fillOpacity: 0.9,
      radius: 9
    }).addTo(mapInstance);

    circle.bindPopup(`
      <div style="font-family: 'Outfit', sans-serif; color: #000; padding: 4px;">
        <h4 style="margin:0; font-size: 1rem;">${st.name}</h4>
        <p style="margin:4px 0 0 0; font-size:0.8rem;">River: <strong>${st.river}</strong></p>
        <p style="margin:2px 0 0 0; font-size:0.8rem;">Inflow: <strong>${st.inflow.toLocaleString()} Cfs</strong></p>
        <p style="margin:2px 0 0 0; font-size:0.8rem;">Outflow: <strong>${st.outflow.toLocaleString()} Cfs</strong></p>
        <p style="margin:4px 0 0 0; font-size:0.8rem;">Status: <span style="color:${color}; font-weight:800;">${st.status}</span></p>
        <button onclick="openHydroModal('${st.name}', ${st.lat}, ${st.lon})" style="margin-top:6px; background:#00d2ff; color:#000; border:none; padding:4px 8px; border-radius:4px; font-weight:700; cursor:pointer; width:100%;">
          📊 7-Day Forecast Chart
        </button>
      </div>
    `);
  });

  // Map Controls Buttons
  document.getElementById('recenter-map-btn').addEventListener('click', () => {
    mapInstance.setView([30.3753, 69.3451], 6);
  });
}

// Pro Sliding Bottom Sheet / Drawer Toggle
function initBottomSheetDrawer() {
  const drawer = document.getElementById('bottom-drawer');
  const handle = document.getElementById('drawer-drag-handle');
  
  handle.addEventListener('click', () => {
    drawer.classList.toggle('collapsed');
    drawer.classList.toggle('expanded');
  });

  // Drawer Tabs Switcher
  const tabs = document.querySelectorAll('.drawer-tab-btn');
  const panes = document.querySelectorAll('.drawer-pane');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.style.display = 'none');

      tab.classList.add('active');
      const targetId = tab.getAttribute('data-drawer-tab');
      document.getElementById(targetId).style.display = 'block';

      // Automatically expand drawer when clicking tabs
      drawer.classList.remove('collapsed');
      drawer.classList.add('expanded');
    });
  });
}

// Render Rivers List Cards & Rainfall Grid Inside Drawer
function initProAppData() {
  const container = document.getElementById('pro-rivers-container');
  container.innerHTML = riverStations.map(st => {
    let color = '#10b981';
    if (st.status.includes('Low')) color = '#3b82f6';
    if (st.status.includes('Medium')) color = '#f59e0b';
    if (st.status.includes('High')) color = '#ef4444';

    return `
      <div class="pro-river-card">
        <div class="pro-card-header">
          <div>
            <span class="pro-station-name">${st.name}</span>
            <div class="pro-river-name">River ${st.river}</div>
          </div>
          <span style="background:${color}22; color:${color}; border:1px solid ${color}44; padding:3px 8px; border-radius:6px; font-size:0.7rem; font-weight:800;">${st.status}</span>
        </div>

        <div class="pro-flow-box">
          <div>
            <div class="pro-flow-lbl">Inflow (Cfs)</div>
            <div class="pro-flow-val">${st.inflow.toLocaleString()}</div>
          </div>
          <div>
            <div class="pro-flow-lbl">Outflow (Cfs)</div>
            <div class="pro-flow-val">${st.outflow.toLocaleString()}</div>
          </div>
        </div>

        <button class="pro-btn" onclick="openHydroModal('${st.name}', ${st.lat}, ${st.lon})">
          📊 View 7-Day Discharge Forecast Chart
        </button>
      </div>
    `;
  }).join('');

  // Fetch Open-Meteo City Rain Data
  if (window.OpenMeteoFloodAPI) {
    window.OpenMeteoFloodAPI.fetchCityRainfall().then(cities => {
      const rainGrid = document.getElementById('pro-rain-grid');
      rainGrid.innerHTML = cities.map(c => `
        <div style="background: rgba(0,0,0,0.4); border:1px solid var(--glass-border); padding:10px; border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:0.8rem; font-weight:700;">📍 ${c.name}</span>
          <span style="font-size:0.9rem; font-weight:800; color:var(--accent-cyan);">${c.rainMm} mm</span>
        </div>
      `).join('');
    });
  }

  // Render Community Feed
  const feed = document.getElementById('pro-community-feed');
  feed.innerHTML = `
    <div style="background: rgba(0,0,0,0.4); border:1px solid var(--glass-border); padding:12px; border-radius:12px;">
      <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--accent-cyan); font-weight:800;">
        <span>📍 Sialkot - Kashmir Road Bridge</span>
        <span>Water Rising</span>
      </div>
      <p style="font-size:0.85rem; margin:6px 0; color:var(--text-main);">Nullah Aik water level increasing rapidly. Local administration on alert.</p>
    </div>
    <div style="background: rgba(0,0,0,0.4); border:1px solid var(--glass-border); padding:12px; border-radius:12px;">
      <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--accent-rose); font-weight:800;">
        <span>⚠️ PMD FFD Official Warning</span>
        <span>Advisory</span>
      </div>
      <p style="font-size:0.85rem; margin:6px 0; color:var(--text-main);">Medium to High flood predicted in River Chenab at Marala during next 24-48 hours.</p>
    </div>
  `;
}

// Hydrograph Chart Modal & Incident Form Modal
let hydroChartInstance = null;

function initProModals() {
  const hydroModal = document.getElementById('hydro-modal');
  const reportModal = document.getElementById('report-modal');

  document.getElementById('close-hydro-modal').addEventListener('click', () => {
    hydroModal.classList.remove('active');
  });

  document.getElementById('pro-report-btn').addEventListener('click', () => {
    reportModal.classList.add('active');
  });

  document.getElementById('close-report-modal').addEventListener('click', () => {
    reportModal.classList.remove('active');
  });

  document.getElementById('pro-report-form').addEventListener('submit', (e) => {
    e.preventDefault();
    alert('✅ Incident report submitted for verification!');
    reportModal.classList.remove('active');
    document.getElementById('pro-report-form').reset();
  });
}

window.openHydroModal = async function(stationName, lat, lon) {
  document.getElementById('hydro-station-title').innerText = `${stationName} Forecast`;
  const modal = document.getElementById('hydro-modal');
  modal.classList.add('active');

  let forecast = { dates: ['Today', 'D+1', 'D+2', 'D+3', 'D+4', 'D+5', 'D+6'], dischargeCfs: [128500, 142000, 158000, 145000, 132000, 125000, 118000] };
  if (window.OpenMeteoFloodAPI) {
    forecast = await window.OpenMeteoFloodAPI.fetchRiverForecast(lat, lon);
  }

  const ctx = document.getElementById('hydro-chart-canvas').getContext('2d');
  if (hydroChartInstance) hydroChartInstance.destroy();

  hydroChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: forecast.dates,
      datasets: [{
        label: 'Discharge Flow (Cusecs)',
        data: forecast.dischargeCfs,
        borderColor: '#00d2ff',
        backgroundColor: 'rgba(0, 210, 255, 0.2)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#3b82f6',
        pointRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { color: '#94a3b8' } },
        x: { grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { color: '#94a3b8' } }
      },
      plugins: {
        legend: { labels: { color: '#f8fafc' } }
      }
    }
  });
};
