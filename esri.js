
    require([
        "esri/Map",
        "esri/views/MapView",
        "esri/layers/KMLLayer",
        "esri/layers/GraphicsLayer",
        "esri/Graphic",
        "esri/geometry/Point",
        "esri/geometry/Polygon",
        "esri/geometry/Extent",
        "esri/geometry/geometryEngine",
        "esri/symbols/SimpleMarkerSymbol",
        "esri/symbols/SimpleFillSymbol",
    ], function (Map, MapView, KMLLayer, GraphicsLayer, Graphic, Point, Polygon, Extent, geometryEngine, SimpleMarkerSymbol, SimpleFillSymbol) {

        // ── Theme colours the ArcGIS layer needs in raw RGBA (CSS vars can't reach here) ──
        var THEME = {
            light: { veil: [226, 232, 240, 0.66], border: [71, 85, 105, 0.9], label: '#1f2937', halo: 'rgba(255,255,255,0.85)' },
            dark:  { veil: [2, 6, 16, 0.62],       border: [148, 163, 184, 0.85], label: '#cbd5e1', halo: 'rgba(2,6,23,0.85)' }
        };
        function themeName() { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
        function tc() { return THEME[themeName()]; }
        function defaultBasemap() { return themeName() === 'dark' ? 'dark-gray-vector' : 'topo-vector'; }

        var rivers = null;
        try { rivers = new KMLLayer({ url: "https://ffd.pmd.gov.pk/kmz/rivers.kmz" }); } catch (e) { }

        var map = new Map({ basemap: defaultBasemap(), layers: rivers ? [rivers] : [] });
        var staticLayer = new GraphicsLayer();   // mask + national border (survives step re-renders)
        var markerLayer = new GraphicsLayer();   // dynamic markers, labels, catchment fills
        map.addMany([staticLayer, markerLayer]);

        var view = new MapView({
            container: "viewDiv",
            map: map,
            center: [71, 30.6],
            zoom: 7,
            popup: { dockEnabled: false, dockOptions: { buttonEnabled: false } }
        });

        // ── Pakistan mask (veil) + national border + navigation lock ──
        var pakPoly = null;
        try {
            if (typeof kmz_pakistan !== 'undefined') {
                pakPoly = geometryEngine.simplify(new Polygon({ rings: kmz_pakistan, spatialReference: { wkid: 4326 } }));
            }
        } catch (e) { pakPoly = null; }

        function buildStatic() {
            staticLayer.removeAll();
            if (!pakPoly) { return; }
            var region = new Polygon({ rings: [[[45, 3], [102, 3], [102, 44], [45, 44], [45, 3]]], spatialReference: { wkid: 4326 } });
            var veil;
            try { veil = geometryEngine.difference(region, pakPoly); } catch (e) { veil = null; }
            if (veil) {
                staticLayer.add(new Graphic({ geometry: veil, symbol: new SimpleFillSymbol({ color: tc().veil, style: 'solid', outline: { width: 0 } }) }));
            }
            staticLayer.add(new Graphic({ geometry: pakPoly, symbol: new SimpleFillSymbol({ color: [0, 0, 0, 0], style: 'solid', outline: { color: tc().border, width: 1.4 } }) }));
        }

        // ── Source filter + search state ──────────────────────────────
        var enabledSources = { synoptic: true, telemetric: true, aws: true, india_synop: true };
        var searchQuery = '';
        var SHAPE = { synoptic: 'circle', telemetric: 'diamond', aws: 'triangle', india_synop: 'square', hydro: 'circle' };
        var OUTLINE = { synoptic: [255, 255, 255], telemetric: [31, 41, 55], aws: [124, 58, 237], india_synop: [234, 88, 12], hydro: [15, 23, 42] };

        // ── Dataset + timeline scrubber state ─────────────────────────
        var BANDS = {"zero":"#9ca3af","bands":[[10,"#7ec8e3"],[25,"#2b6cb0"],[50,"#dd6b20"],[null,"#c81e1e"]]};
        var MODE = 'rain';
        var FRAMES_RAIN = null;
        var FRAMES_HYDRO = null;
        var FRAMES = null;
        var tlMode = 'daily';
        var tlIndex = 0;
        var tlPlaying = false;
        var tlTimer = 0;
        var onlyRain = true;

        var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        function intensityColor(mm) {
            if (mm === null || mm === undefined || mm <= 0) { return BANDS.zero; }
            for (var i = 0; i < BANDS.bands.length; i++) {
                var upper = BANDS.bands[i][0], color = BANDS.bands[i][1];
                if (upper === null || mm < upper) { return color; }
            }
            return BANDS.zero;
        }

        function activeStations() { return MODE === 'hydro' ? HYDRO_STATIONS : STATIONS; }

        function hydroStatusId(s, q) {
            var th = s.thresholds || [], id = 0;
            for (var i = 0; i < th.length; i++) { if (q >= th[i].min_discharge) { id = th[i].status_id; } }
            return id;
        }

        function colorFor(s, v) { return MODE === 'hydro' ? HYDRO_COLORS[hydroStatusId(s, v)] : intensityColor(v); }
        function fmtStepVal(v) { return MODE === 'hydro' ? fmtFlow(v) : fmtMm(v); }

        /** True when a marker is high-severity → gets an alert glow halo. */
        function isAlert(s, v) { return MODE === 'hydro' ? hydroStatusId(s, v) >= 3 : v >= 50; }

        function tlAxis() { return !FRAMES ? [] : (tlMode === '3hourly' ? FRAMES.cycles : FRAMES.days); }
        function tlAxisLen() { return tlAxis().length; }

        function defaultIndex() {
            if (!FRAMES) { return 0; }
            if (tlMode === '3hourly') {
                return (typeof FRAMES.latest_cycle_index === 'number') ? FRAMES.latest_cycle_index : Math.max(0, FRAMES.cycles.length - 1);
            }
            if (MODE !== 'hydro' && FRAMES.today) {
                var idx = FRAMES.days.indexOf(FRAMES.today);
                if (idx !== -1) { return idx; }
            }
            return Math.max(0, FRAMES.days.length - 1);
        }

        function activeValue(s) {
            if (!FRAMES) { return (s.daily_mm === null || s.daily_mm === undefined) ? 0 : Number(s.daily_mm); }
            var key = s.source + ':' + s.source_station_id;
            if (tlMode === '3hourly') {
                var cycle = FRAMES.cycles[tlIndex];
                if (!cycle) { return 0; }
                var hourly = FRAMES.hourly[key];
                if (hourly) { return hourly[cycle] !== undefined ? hourly[cycle] : 0; }
                var dgridH = FRAMES.daily[key];
                var dKey = cycle.slice(0, 10);
                return (dgridH && dgridH[dKey] !== undefined) ? dgridH[dKey] : 0;
            }
            var day = FRAMES.days[tlIndex];
            if (!day) { return 0; }
            var dgrid = FRAMES.daily[key];
            return (dgrid && dgrid[day] !== undefined) ? dgrid[day] : 0;
        }

        function todayTotalSoFar(s) {
            if (!FRAMES || MODE === 'hydro') { return null; }
            var hgrid = FRAMES.hourly[s.source + ':' + s.source_station_id];
            if (!hgrid) { return null; }
            var sum = 0, any = false;
            for (var ck in hgrid) {
                if (ck.slice(0, 10) === FRAMES.today && ck.slice(11, 13) >= '06') { sum += hgrid[ck]; any = true; }
            }
            return any ? Math.round(sum * 10) / 10 : 0;
        }

        function currentStepDate() {
            if (!FRAMES) { return null; }
            return tlMode === '3hourly' ? (FRAMES.cycles[tlIndex] || '').slice(0, 10) : (FRAMES.days[tlIndex] || null);
        }

        function fmtDatePart(ymd) { var p = ymd.split('-'); return parseInt(p[2], 10) + ' ' + MONTHS[parseInt(p[1], 10) - 1]; }

        function formatStep() {
            if (!FRAMES) { return 'Loading timeline…'; }
            if (tlMode === '3hourly') {
                var c = FRAMES.cycles[tlIndex];
                if (!c) { return '—'; }
                if (MODE === 'hydro') { return fmtDatePart(c.slice(0, 10)) + ' ' + c.slice(11, 16) + ' PKT'; }
                return fmtDatePart(c.slice(0, 10)) + ' ' + c.slice(11, 16).replace(':', '') + ' UTC';
            }
            var d = FRAMES.days[tlIndex];
            if (!d) { return '—'; }
            if (MODE === 'hydro') { return fmtDatePart(d) + ' ' + d.slice(0, 4) + ' — daily peak'; }
            if (FRAMES.live_day && d === FRAMES.live_day) { return fmtDatePart(d) + ' — so far (from 0600 UTC)'; }
            if (d === FRAMES.today) { return fmtDatePart(d) + ' — 24h to 0300z'; }
            return fmtDatePart(d) + ' ' + d.slice(0, 4);
        }

        /** Daily series for the open station over the whole window → the panel sparkline. */
        function buildDailySeries(s) {
            if (!FRAMES) { return []; }
            var grid = FRAMES.daily[s.source + ':' + s.source_station_id] || {};
            return FRAMES.days.map(function (day) { return { label: fmtDatePart(day), day: day, v: grid[day] !== undefined ? grid[day] : 0 }; });
        }

        function renderPanelStep() {
            var box = document.getElementById('rw-step');
            var soFarBox = document.getElementById('rw-today-sofar');
            var sparkWrap = document.getElementById('rw-spark-wrap');
            if (!box) { return; }
            var cur = window.RainWatch && RainWatch.cur;
            if (!cur || !FRAMES) {
                box.style.display = 'none';
                if (soFarBox) { soFarBox.style.display = 'none'; }
                if (sparkWrap) { sparkWrap.style.display = 'none'; }
                return;
            }
            document.getElementById('rw-step-label').textContent = formatStep();
            document.getElementById('rw-step-value').textContent = fmtStepVal(activeValue(cur));
            var unitEl = document.getElementById('rw-step-unit');
            if (unitEl) { unitEl.textContent = MODE === 'hydro' ? ' cusecs' : ' mm'; }
            box.style.display = 'block';

            var soFar = todayTotalSoFar(cur);
            if (soFarBox) {
                if (soFar !== null && currentStepDate() === FRAMES.today) {
                    document.getElementById('rw-today-sofar-value').textContent = fmtMm(soFar);
                    soFarBox.style.display = 'block';
                } else { soFarBox.style.display = 'none'; }
            }

            // Always-on sparkline (everyone). Highlights the step only in daily mode.
            if (sparkWrap) {
                var series = buildDailySeries(cur);
                var host = document.getElementById('rw-spark');
                var title = document.getElementById('rw-spark-title');
                if (series.length && host) {
                    sparkWrap.style.display = '';
                    if (title) { title.textContent = MODE === 'hydro' ? 'Daily peak discharge — window' : 'Daily rainfall — window'; }
                    var hi = -1;
                    if (tlMode === 'daily') { hi = FRAMES.days.indexOf(FRAMES.days[tlIndex]); }
                    SvgChart.sparkline(host, series, {
                        highlight: hi,
                        unit: MODE === 'hydro' ? 'cusecs' : 'mm',
                        fmt: MODE === 'hydro' ? fmtFlow : fmtMm
                    });
                    RainWatch._spark = function () { SvgChart.sparkline(host, series, { highlight: hi, unit: MODE === 'hydro' ? 'cusecs' : 'mm', fmt: MODE === 'hydro' ? fmtFlow : fmtMm }); };
                } else { sparkWrap.style.display = 'none'; }
            }
        }
        window.rwRenderStep = renderPanelStep;

        function visibleStations() {
            var q = searchQuery.trim().toLowerCase();
            return activeStations().filter(function (s) {
                if (MODE !== 'hydro' && !enabledSources[s.source]) { return false; }
                if (q && (s.name || '').toLowerCase().indexOf(q) === -1) { return false; }
                if (MODE !== 'hydro' && onlyRain && activeValue(s) <= 0) { return false; }
                return true;
            });
        }

        function hexToRgba(hex, a) {
            var h = (hex || '#999999').replace('#', '');
            return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), a];
        }

        function drawShape(rings, hex) {
            markerLayer.add(new Graphic({
                geometry: new Polygon({ rings: rings }),
                symbol: new SimpleFillSymbol({ color: hexToRgba(hex, 0.45), style: 'solid', outline: { color: hexToRgba(hex, 0.9), width: 1 } })
            }));
        }

        var KOT_MITHON = [[70.6618471, 29.13008927], [70.5674074, 29.06314633], [70.49415617, 29.00491483],
            [70.47676812, 28.95596259], [70.43124868, 28.91515787], [70.36673827, 28.87128139],
            [70.27886259, 28.85037568], [70.20383469, 28.81566626], [70.15636264, 28.76251284],
            [70.09788003, 28.71760662], [70.07003542, 28.66832114], [70.01092722, 28.62228135],
            [69.96172177, 28.56822386], [69.8090134, 28.53217335], [69.73253116, 28.47226826],
            [69.70282965, 28.42616955], [69.73173375, 28.40734728], [69.7537013, 28.42891826],
            [69.77977677, 28.44162729], [69.82149182, 28.47870145], [69.84131373, 28.49885687],
            [69.87590901, 28.49724314], [69.94866955, 28.51230452], [70.01692665, 28.5582164],
            [70.0756109, 28.6104055], [70.14431929, 28.63473537], [70.16623032, 28.67845943],
            [70.2020704, 28.70320368], [70.23555306, 28.77304343], [70.28973421, 28.76624021],
            [70.32662241, 28.7949499], [70.38446986, 28.81455594], [70.44190373, 28.82684441],
            [70.4705352, 28.87035153], [70.55855025, 28.93605553], [70.61081385, 29.01883546],
            [70.67684597, 29.04533689], [70.7347615, 29.0846386], [70.73537167, 29.08783857],
            [70.7400595, 29.14373407], [70.73408015, 29.1895912]];

        function kotMithonStatusId() {
            var ids = [0];
            ['Panjnad', 'Taunsa'].forEach(function (name) {
                var s = HYDRO_STATIONS.find(function (x) { return x.name === name; });
                if (s) { ids.push(hydroStatusId(s, activeValue(s))); }
            });
            return Math.max.apply(null, ids);
        }

        function renderStations(zoom) {
            markerLayer.removeAll();

            if (MODE === 'hydro') { drawShape(KOT_MITHON, HYDRO_COLORS[kotMithonStatusId()]); }

            var list = visibleStations();
            var counts = { synoptic: 0, telemetric: 0, aws: 0, india_synop: 0 };
            var reporting = 0, wettest = null;
            var theme = tc();

            list.forEach(function (s) {
                var v = activeValue(s);
                counts[s.source] = (counts[s.source] || 0) + 1;
                if (v > 0) { reporting++; if (!wettest || v > wettest.v) { wettest = { name: s.name, v: v }; } }

                if (MODE === 'hydro' && s.shape) { drawShape(s.shape, colorFor(s, v)); }

                var point = new Point({ longitude: s.lng, latitude: s.lat });
                var fill = colorFor(s, v);

                // Alert glow — a soft translucent halo behind critical markers.
                if (isAlert(s, v)) {
                    markerLayer.add(new Graphic({
                        geometry: point,
                        symbol: new SimpleMarkerSymbol({ style: 'circle', color: hexToRgba(fill, 0.28), size: zoom * 3.4 + 8, outline: { width: 0 } })
                    }));
                }

                markerLayer.add(new Graphic({
                    geometry: point,
                    attributes: { source: s.source, sid: s.source_station_id },
                    symbol: new SimpleMarkerSymbol({
                        style: SHAPE[s.source] || 'circle', color: fill, size: zoom * 1.7 + 2,
                        outline: { color: OUTLINE[s.source] || [255, 255, 255], width: 1.3 }
                    })
                }));

                if (zoom > 7) {
                    var vLabel = MODE === 'hydro' ? fmtFlow(v) : (Math.round(v * 10) / 10);
                    var lbl = s.name + (v > 0 ? '  ' + vLabel : '');
                    markerLayer.add(new Graphic({
                        geometry: point,
                        symbol: { type: "text", color: theme.label, text: lbl, yoffset: zoom * -1.6, font: { size: 7, family: "Arial" }, haloColor: theme.halo, haloSize: "1px" }
                    }));
                }
            });

            var countEl = document.getElementById('rw-count');
            if (countEl) { countEl.textContent = list.length; }
            var totalEl = document.getElementById('rw-total');
            if (totalEl) { totalEl.textContent = activeStations().length; }

            Object.keys(counts).forEach(function (src) {
                var el = document.getElementById('legend-count-' + src);
                if (el) { el.textContent = counts[src]; }
            });

            var sumEl = document.getElementById('tl-summary');
            if (sumEl) {
                if (MODE === 'hydro') {
                    sumEl.innerHTML = reporting
                        ? '<b>' + reporting + '</b> gauge' + (reporting === 1 ? '' : 's') + ' flowing · highest: ' + escHtml(wettest.name) + ' <b>' + fmtFlow(wettest.v) + '</b> cusecs'
                        : (list.length ? 'No flow at this step' : '');
                } else if (reporting === 0) {
                    sumEl.textContent = list.length ? 'No rain at this step' : '';
                } else {
                    sumEl.innerHTML = '<b>' + reporting + '</b> station' + (reporting === 1 ? '' : 's') + ' reporting · wettest: ' + escHtml(wettest.name) + ' <b>' + (Math.round(wettest.v * 10) / 10) + '</b> mm';
                }
            }
        }

        // ── Hover tooltip chip ────────────────────────────────────────
        var tipEl = document.getElementById('map-tip');
        function showTip(screenPt, attrs) {
            var s = RW_LOOKUP[attrs.source + ':' + attrs.sid];
            if (!s || !tipEl) { return; }
            var v = activeValue(s);
            var color = colorFor(s, v);
            var sub;
            if (MODE === 'hydro') { sub = HYDRO_LABELS[hydroStatusId(s, v)] + ' · ' + (s.area || '—'); }
            else { sub = (RW_LABELS[s.source] || s.source) + ' · ' + (s.area || '—'); }
            tipEl.innerHTML =
                '<div class="mt-name"><span class="mt-swatch" style="background:' + color + ';color:' + color + '"></span>' + escHtml(s.name) + '</div>' +
                '<div class="mt-val">' + fmtStepVal(v) + ' <span class="u">' + (MODE === 'hydro' ? 'cusecs' : 'mm') + '</span></div>' +
                '<div class="mt-sub">' + escHtml(sub) + '</div>';
            tipEl.style.display = 'block';
            var vw = view.width, tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
            var left = screenPt.x + 16, top = screenPt.y + 16;
            if (left + tw > vw - 8) { left = screenPt.x - tw - 16; }
            if (top + th > view.height - 8) { top = screenPt.y - th - 16; }
            tipEl.style.left = Math.max(4, left) + 'px';
            tipEl.style.top = Math.max(4, top) + 'px';
        }
        function hideTip() { if (tipEl) { tipEl.style.display = 'none'; } }

        function throttle(fn, ms) {
            var last = 0, pend = null;
            return function (a) {
                var now = Date.now();
                if (now - last >= ms) { last = now; fn(a); }
                else { clearTimeout(pend); pend = setTimeout(function () { last = Date.now(); fn(a); }, ms); }
            };
        }

        view.on("pointer-move", throttle(function (event) {
            view.hitTest(event, { include: [markerLayer] }).then(function (response) {
                var hit = response.results.find(function (r) { return r.graphic && r.graphic.attributes && r.graphic.attributes.sid; });
                if (hit) { view.container.style.cursor = 'pointer'; showTip({ x: event.x, y: event.y }, hit.graphic.attributes); }
                else { view.container.style.cursor = 'default'; hideTip(); }
            });
        }, 55));

        view.on("click", function (event) {
            hideTip();
            var rb = document.getElementById('rw-results');
            if (rb) { rb.classList.remove('open'); }
            view.hitTest(event, { include: [markerLayer] }).then(function (response) {
                var hit = response.results.find(function (r) { return r.graphic && r.graphic.attributes && r.graphic.attributes.sid; });
                if (hit) {
                    var a = hit.graphic.attributes;
                    var s = RW_LOOKUP[a.source + ':' + a.sid];
                    if (s) { view.goTo({ center: [s.lng, s.lat], zoom: Math.max(view.zoom, 9) }, { duration: 650, easing: 'ease-in-out' }); }
                    RainWatch.open(a.source, a.sid);
                } else if (event.mapPoint) {
                    // Clicked empty map → read out the coordinates (to eyeball/fix station locations).
                    showClickCoords(event.mapPoint);
                }
            });
        });

        // ── Click-to-read coordinates (top-right) ─────────────────────
        var coordBox = document.getElementById('coord-readout');
        var lastCoordText = '';
        function showClickCoords(mapPoint) {
            if (!coordBox) { return; }
            var lat = mapPoint.latitude, lng = mapPoint.longitude;
            if (lat === null || lat === undefined || lng === null || lng === undefined) { return; }
            lastCoordText = lat.toFixed(5) + ', ' + lng.toFixed(5);
            document.getElementById('coord-val').textContent = lastCoordText;
            coordBox.style.display = 'flex';
        }
        window.rwCopyCoords = function () {
            if (!lastCoordText) { return; }
            var done = function () {
                var b = document.getElementById('coord-copy');
                if (b) { var t = b.textContent; b.textContent = '✓'; setTimeout(function () { b.textContent = t; }, 1200); }
            };
            if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(lastCoordText).then(done, done); }
            else { done(); }
        };
        window.rwHideCoords = function () { if (coordBox) { coordBox.style.display = 'none'; } };

        window.RainMap = {
            toggleSource: function (source, on) { enabledSources[source] = !!on; renderStations(view.zoom); this.renderResults(); },
            setSearch: function (q) { searchQuery = q || ''; renderStations(view.zoom); this.renderResults(); },
            setBasemap: function (v) { map.basemap = (v === '__theme') ? defaultBasemap() : v; },
            renderResults: function () {
                var box = document.getElementById('rw-results');
                if (!box) { return; }
                if (searchQuery.trim() === '') { box.classList.remove('open'); box.innerHTML = ''; return; }
                var matches = visibleStations().slice(0, 12);
                if (matches.length === 0) { box.innerHTML = '<div class="none">No stations match.</div>'; }
                else {
                    box.innerHTML = matches.map(function (s) {
                        return '<div class="res" onclick="RainMap.goTo(\'' + s.source + '\',' + s.source_station_id + ')">' +
                            '<span>' + escHtml(s.name) + '</span><span class="src">' + s.source + '</span></div>';
                    }).join('');
                }
                box.classList.add('open');
            },
            goTo: function (source, id) {
                var s = activeStations().find(function (x) { return x.source === source && x.source_station_id === id; });
                if (!s) { return; }
                view.goTo({ center: [s.lng, s.lat], zoom: Math.max(view.zoom, 10) }, { duration: 700, easing: 'ease-in-out' });
                var box = document.getElementById('rw-results');
                if (box) { box.classList.remove('open'); }
                RainWatch.open(source, id);
            },
            toggleLegend: function () { var el = document.getElementById('legend'); if (el) { el.classList.toggle('collapsed'); } }
        };

        window.RainTimeline = {
            setMode: function (mode) {
                if (!FRAMES || mode === tlMode) { return; }
                this.pause(); tlMode = mode; tlIndex = defaultIndex();
                this.syncUI(); renderStations(view.zoom); if (window.FloodWatch) { FloodWatch.syncHash(); }
            },
            setIndex: function (i) {
                tlIndex = Math.max(0, Math.min(parseInt(i, 10) || 0, Math.max(0, tlAxisLen() - 1)));
                this.syncUI(); renderStations(view.zoom); if (window.FloodWatch) { FloodWatch.syncHash(); }
            },
            step: function (delta) { this.pause(); this.setIndex(tlIndex + delta); },
            togglePlay: function () { tlPlaying ? this.pause() : this.play(); },
            play: function () {
                if (!FRAMES || tlAxisLen() === 0) { return; }
                tlPlaying = true;
                if (tlIndex >= tlAxisLen() - 1) { tlIndex = 0; }
                this.syncPlayBtn();
                var self = this;
                tlTimer = setInterval(function () {
                    if (tlIndex >= tlAxisLen() - 1) { self.pause(); self.syncUI(); renderStations(view.zoom); return; }
                    tlIndex++; self.syncUI(); renderStations(view.zoom);
                }, 700);
            },
            pause: function () { tlPlaying = false; if (tlTimer) { clearInterval(tlTimer); tlTimer = 0; } this.syncPlayBtn(); },
            toggleOnlyRain: function (on) { onlyRain = !!on; renderStations(view.zoom); RainMap.renderResults(); },
            setDataset: function (mode) {
                if (mode === MODE) { return; }
                this.pause(); MODE = mode;
                if (window.RainWatch) { RainWatch.close(); }
                document.getElementById('legend-rain').style.display = mode === 'hydro' ? 'none' : '';
                document.getElementById('legend-hydro').style.display = mode === 'hydro' ? '' : 'none';
                document.getElementById('tl-ds-rain').classList.toggle('active', mode === 'rain');
                document.getElementById('tl-ds-hydro').classList.toggle('active', mode === 'hydro');
                document.getElementById('tl-mode-3h').textContent = mode === 'hydro' ? 'By Hour' : '3-hourly (SYNOP)';
                document.getElementById('tl-mode-d').textContent = mode === 'hydro' ? 'Daily (peak)' : 'Daily';

                var self = this;
                var apply = function () {
                    FRAMES = (mode === 'hydro') ? FRAMES_HYDRO : FRAMES_RAIN;
                    tlMode = (mode === 'hydro') ? '3hourly' : 'daily';
                    tlIndex = defaultIndex();
                    self.syncUI(); renderStations(view.zoom);
                    if (window.FloodWatch) { FloodWatch.syncHash(); }
                };
                if (mode === 'hydro' && !FRAMES_HYDRO) {
                    fetch(RW_BASE + '/hydro-frames', RW_XHR)
                        .then(function (r) { return r.json(); })
                        .then(function (d) { FRAMES_HYDRO = d; apply(); })
                        .catch(function () { apply(); });
                } else { apply(); }
            },
            syncUI: function () {
                var r = document.getElementById('tl-range');
                if (r) { r.max = Math.max(0, tlAxisLen() - 1); r.value = tlIndex; }
                var lbl = document.getElementById('tl-label');
                if (lbl) { lbl.textContent = formatStep(); }
                var b3 = document.getElementById('tl-mode-3h'), bd = document.getElementById('tl-mode-d');
                if (b3) { b3.classList.toggle('active', tlMode === '3hourly'); }
                if (bd) { bd.classList.toggle('active', tlMode === 'daily'); }
                var tl = document.getElementById('timeline');
                if (tl) {
                    var isLive = tlMode === 'daily' && FRAMES && FRAMES.live_day && FRAMES.days[tlIndex] === FRAMES.live_day;
                    tl.classList.toggle('tl-live', !!isLive);
                }
                this.syncPlayBtn(); renderPanelStep();
            },
            syncPlayBtn: function () {
                var b = document.getElementById('tl-play');
                if (b) { b.innerHTML = tlPlaying ? '&#9208;' : '&#9654;'; b.title = tlPlaying ? 'Pause' : 'Play'; }
            },
            load: function (data) {
                FRAMES_RAIN = data;
                if (MODE !== 'rain') { return; }
                FRAMES = data; tlMode = 'daily'; tlIndex = defaultIndex();
                this.syncUI(); renderStations(view.zoom);
                if (window.FloodWatch) { FloodWatch.restoreHash(); }
            },
            // ── Accessors for URL-state restore ──
            _state: function () {
                return { ds: MODE, mode: tlMode, step: currentStepDate() ? (tlMode === '3hourly' ? (FRAMES && FRAMES.cycles[tlIndex]) : (FRAMES && FRAMES.days[tlIndex])) : null };
            },
            _restore: function (st) {
                if (!FRAMES) { return; }
                if (st.mode && st.mode !== tlMode && (st.mode === 'daily' || st.mode === '3hourly')) { tlMode = st.mode; }
                if (st.step) {
                    var axis = tlAxis();
                    var idx = axis.indexOf(st.step);
                    if (idx !== -1) { tlIndex = idx; }
                }
                this.syncUI(); renderStations(view.zoom);
            }
        };

        // ── Theme + URL-state controller ──────────────────────────────
        window.FloodWatch = {
            _hashTimer: 0,
            applyTheme: function (t) {
                document.documentElement.setAttribute('data-theme', t);
                try { localStorage.setItem('fw-theme', t); } catch (e) { }
                var link = document.getElementById('arcgis-theme');
                if (link) { link.href = 'https://js.arcgis.com/4.22/esri/themes/' + (t === 'dark' ? 'dark' : 'light') + '/main.css'; }
                var btn = document.getElementById('theme-btn');
                if (btn) { btn.textContent = t === 'dark' ? '☀️' : '🌙'; }
                var sel = document.getElementById('basemap-select');
                if (map && (!sel || sel.value === '__theme')) { map.basemap = defaultBasemap(); }
                buildStatic(); renderStations(view.zoom);
                if (RainWatch._redraw) { RainWatch.redraw(); }
                if (RainWatch._spark) { try { RainWatch._spark(); } catch (e) { } }
                this.syncHash();
            },
            toggleTheme: function () { this.applyTheme(themeName() === 'dark' ? 'light' : 'dark'); },
            syncHash: function () {
                var self = this;
                clearTimeout(this._hashTimer);
                this._hashTimer = setTimeout(function () {
                    var st = RainTimeline._state();
                    var parts = ['ds=' + st.ds, 'mode=' + st.mode, 'theme=' + themeName()];
                    if (st.step) { parts.push('step=' + st.step); }
                    if (RainWatch.cur) { parts.push('st=' + RainWatch.cur.source + ':' + RainWatch.cur.source_station_id); }
                    try { history.replaceState(null, '', '#' + parts.join('&')); } catch (e) { }
                }, 250);
            },
            parseHash: function () {
                var h = (location.hash || '').replace(/^#/, ''); if (!h) { return {}; }
                var o = {}; h.split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) { o[p[0]] = decodeURIComponent(p[1] || ''); } });
                return o;
            },
            restoreHash: function () {
                var o = this.parseHash();
                // A shared link reproduces the sender's theme (localStorage still updates).
                if ((o.theme === 'dark' || o.theme === 'light') && o.theme !== themeName()) { this.applyTheme(o.theme); }
                var doRestore = function () {
                    RainTimeline._restore({ mode: o.mode, step: o.step });
                    if (o.st) { var p = o.st.split(':'); if (p.length === 2) { RainWatch.open(p[0], parseInt(p[1], 10)); } }
                };
                if (o.ds === 'hydro' && MODE !== 'hydro') {
                    RainTimeline.setDataset('hydro');
                    // hydro frames may load async; retry the step/station restore shortly.
                    setTimeout(doRestore, 400);
                } else { doRestore(); }
            }
        };

        var zoomTimeout = 0;
        view.watch("resolution", function () {
            clearTimeout(zoomTimeout);
            zoomTimeout = setTimeout(function () { renderStations(view.zoom); }, 600);
        });

        // Redraw the open SVG chart on container resize (panel + charts are fluid).
        var resizeT = 0;
        window.addEventListener('resize', function () {
            clearTimeout(resizeT);
            resizeT = setTimeout(function () { if (RainWatch.redraw) { RainWatch.redraw(); } if (RainWatch._spark) { try { RainWatch._spark(); } catch (e) { } } }, 200);
        });

        view.when(function () {
            view.ui.move("zoom", "bottom-right");

            // Lock navigation to Pakistan (+ margin); no rotation, sensible min zoom.
            if (pakPoly && pakPoly.extent) {
                var ext = pakPoly.extent.clone().expand(1.18);
                view.constraints = { geometry: ext, minZoom: 5, rotationEnabled: false };
            } else {
                view.constraints = { geometry: new Extent({ xmin: 60, ymin: 22.5, xmax: 78, ymax: 37.5, spatialReference: { wkid: 4326 } }), minZoom: 5, rotationEnabled: false };
            }

            buildStatic();

            // Theme button glyph reflects the already-applied theme.
            var tb = document.getElementById('theme-btn');
            if (tb) { tb.textContent = themeName() === 'dark' ? '☀️' : '🌙'; }

            if (window.matchMedia('(max-width: 768px)').matches) {
                var lg = document.getElementById('legend');
                if (lg) { lg.classList.add('collapsed'); }
            }
            renderStations(7);   // initial paint: mask + border, markers arrive next

            // Markers + timeline are pulled over the token-gated endpoints (not in the
            // HTML). Fetch markers first, then the rainfall frames; retry once on a
            // transient failure so a network blip doesn't leave the map empty.
            function loadMarkers(attempt) {
                fetch(RW_BASE + '/markers', RW_XHR)
                    .then(function (r) { if (!r.ok) { throw new Error('markers ' + r.status); } return r.json(); })
                    .then(function (d) {
                        rwIngestMarkers(d);
                        var totalEl = document.getElementById('rw-total');
                        if (totalEl) { totalEl.textContent = STATIONS.length; }
                        renderStations(view.zoom);
                        fetch(RW_BASE + '/frames', RW_XHR)
                            .then(function (r) { return r.json(); })
                            .then(function (fd) { if (fd && fd.days) { RainTimeline.load(fd); } })
                            .catch(function () { });
                    })
                    .catch(function () { if ((attempt || 0) < 2) { setTimeout(function () { loadMarkers((attempt || 0) + 1); }, 1500); } });
            }
            loadMarkers(0);
        });
    });
