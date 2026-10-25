---
layout: archive
title: "CV"
permalink: /cv/
author_profile: true
redirect_from:
  - /resume
---

<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.js"></script>

<div class="cv">

<section class="cv__section">
<h2 class="cv__heading"><i class="fa-solid fa-route"></i>Where I've been</h2>
<div class="cv-map" id="cv-map" aria-label="Map of the places I have studied and worked"></div>
<ol class="cv-stops" id="cv-stops"></ol>
</section>

<script>
(function () {
  if (!window.maplibregl) return;
  var stops = [
    { name: "Bad Dürkheim", what: "School · Abitur", when: "–2020", at: [8.1724, 49.4618] },
    { name: "Greifswald", what: "Internship · Leibniz INP", when: "2020", at: [13.3923, 54.0865] },
    { name: "Karlsruhe", what: "B.Sc. Physics · KIT", when: "2020–24", at: [8.4037, 49.0069] },
    { name: "Oslo", what: "Erasmus · UiO", when: "2024", at: [10.7522, 59.9139] },
    { name: "Okinawa", what: "Internship · OIST", when: "2024", at: [127.8336, 26.4625] },
    { name: "Munich", what: "M.Sc. · TUM & LMU, PlanQC", when: "2024–", at: [11.582, 48.1351] }
  ];
  var STYLE = "https://tiles.openfreemap.org/styles/";
  var isDark = function () { return document.documentElement.getAttribute("data-theme") === "dark"; };
  var accent = function () {
    return getComputedStyle(document.documentElement).getPropertyValue("--accent-1").trim() || "#6d4fd8";
  };

  /* curved leg between two stops: quadratic Bezier with a sideways bulge */
  function arc(a, b) {
    var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var c = [mx + dy * 0.22, my - dx * 0.22], pts = [];
    for (var i = 0; i <= 48; i++) {
      var t = i / 48, u = 1 - t;
      pts.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
    }
    return pts;
  }
  var legs = { type: "FeatureCollection", features: [] };
  for (var i = 1; i < stops.length; i++) {
    legs.features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: arc(stops[i - 1].at, stops[i].at) } });
  }

  var bounds = new maplibregl.LngLatBounds();
  stops.forEach(function (s) { bounds.extend(s.at); });

  var map = new maplibregl.Map({
    container: "cv-map",
    style: STYLE + (isDark() ? "dark" : "positron"),
    bounds: bounds,
    fitBoundsOptions: { padding: 40 },
    scrollZoom: false,
    dragRotate: false,
    pitchWithRotate: false,
    attributionControl: { compact: true }
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");

  /* arrowhead image, drawn once per style load */
  function arrowImage(color) {
    var n = 32, c = document.createElement("canvas");
    c.width = c.height = n;
    var g = c.getContext("2d");
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(6, 6); g.lineTo(28, 16); g.lineTo(6, 26); g.lineTo(11, 16);
    g.closePath();
    g.fill();
    return g.getImageData(0, 0, n, n);
  }

  function addRoute() {
    var col = accent();
    if (map.hasImage("cv-arrow")) map.removeImage("cv-arrow");
    map.addImage("cv-arrow", arrowImage(col), { pixelRatio: 2 });
    map.addSource("cv-legs", { type: "geojson", data: legs });
    map.addLayer({
      id: "cv-legs-glow", type: "line", source: "cv-legs",
      layout: { "line-cap": "round" },
      paint: { "line-color": col, "line-width": 7, "line-opacity": 0.15 }
    });
    map.addLayer({
      id: "cv-legs", type: "line", source: "cv-legs",
      layout: { "line-cap": "butt" },
      paint: { "line-color": col, "line-width": 2.5, "line-dasharray": [2, 1.6] }
    });
    map.addLayer({
      id: "cv-arrows", type: "symbol", source: "cv-legs",
      layout: {
        "symbol-placement": "line-center",
        "icon-image": "cv-arrow",
        "icon-size": 1,
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true
      }
    });
  }
  map.on("style.load", addRoute);

  /* marching dashes */
  var dashes = [[0, 2, 1.6], [0.4, 2, 1.2], [0.8, 2, 0.8], [1.2, 2, 0.4], [1.6, 2, 0], [0, 0.4, 1.6, 1.6], [0, 0.8, 1.6, 1.2], [0, 1.2, 1.6, 0.8], [0, 1.6, 1.6, 0.4]];
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce) {
    var step = -1;
    setInterval(function () {
      if (!map.getLayer("cv-legs")) return;
      step = (step + 1) % dashes.length;
      map.setPaintProperty("cv-legs", "line-dasharray", dashes[step]);
    }, 90);
  }

  /* numbered pins and the clickable list */
  var list = document.getElementById("cv-stops");
  stops.forEach(function (s, i) {
    var el = document.createElement("div");
    el.className = "cv-map__pin";
    el.innerHTML = "<span>" + (i + 1) + "</span>";
    var popup = new maplibregl.Popup({ offset: 16, closeButton: false, className: "cv-map__popup" })
      .setHTML("<b>" + s.name + "</b><br>" + s.what + " · " + s.when);
    var marker = new maplibregl.Marker({ element: el }).setLngLat(s.at).setPopup(popup).addTo(map);
    el.addEventListener("mouseenter", function () { if (!popup.isOpen()) marker.togglePopup(); });
    el.addEventListener("mouseleave", function () { if (popup.isOpen()) marker.togglePopup(); });

    var li = document.createElement("li");
    li.innerHTML = '<button type="button"><span class="n">' + (i + 1) + '</span><span><b>' + s.name + "</b> " + s.when + "<br><small>" + s.what + "</small></span></button>";
    li.querySelector("button").addEventListener("click", function () { map.flyTo({ center: s.at, zoom: 6, duration: 1400 }); });
    list.appendChild(li);
  });

  /* "show all" button */
  map.addControl({
    onAdd: function () {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cv-map__reset maplibregl-ctrl";
      b.textContent = "show all";
      b.addEventListener("click", function () { map.fitBounds(bounds, { padding: 40, duration: 1400 }); });
      this._b = b;
      return b;
    },
    onRemove: function () { this._b.remove(); }
  }, "top-right");

  /* follow the site's light / dark toggle */
  new MutationObserver(function () {
    map.setStyle(STYLE + (isDark() ? "dark" : "positron"));
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
</script>

<section class="cv__section">
<h2 class="cv__heading"><i class="fa-solid fa-flask"></i>Experience</h2>
<ul class="cv__timeline">

  <li class="cv__item cv__item--now">
    <div class="cv__meta"><span>06/2026 – today</span><span class="cv__badge">now</span></div>
    <p class="cv__title">Master Thesis: Setting up an Optical Conveyor Belt for a Dual Species Neutral Atom Computing Platform</p>
    <p class="cv__org">LMU Munich · Zeiher Group</p>
    <ul class="cv__points">
      <li>Yb and Rb continuous loading platform with a micro-lens array for ultra-fast mid-circuit readout</li>
      <li>Designing, assembling and characterizing atom transport for both Rb and Yb</li>
    </ul>
  </li>

  <li class="cv__item cv__item--now">
    <div class="cv__meta"><span>10/2026 – today</span><span class="cv__badge">now</span></div>
    <p class="cv__title">Quantum Hardware Working Student</p>
    <p class="cv__org">PlanQC · Garching</p>
  </li>

  <li class="cv__item">
    <div class="cv__meta"><span>11/2025 – 09/2026</span></div>
    <p class="cv__title">Electrical Engineering Intern, then Working Student</p>
    <p class="cv__org">PlanQC · Garching</p>
    <ul class="cv__points">
      <li>Working student 05/2026 – 09/2026</li>
      <li>Intern 11/2025 – 04/2026</li>
    </ul>
  </li>

  <li class="cv__item">
    <div class="cv__meta"><span>07/2024 – 09/2024</span></div>
    <p class="cv__title">Research Internship: NV-Center Quantum Transducer</p>
    <p class="cv__org">Okinawa Institute of Science and Technology · Japan</p>
    <ul class="cv__points">
      <li>Setting up free-space optics and cavities</li>
      <li>Automating measurements</li>
    </ul>
  </li>

  <li class="cv__item">
    <div class="cv__meta"><span>09/2023 – 12/2023</span></div>
    <p class="cv__title">Bachelor Thesis: Microwave Fabry–Pérot Cavity for Investigation of Superconducting Quantum Circuits</p>
    <p class="cv__org">Karlsruhe Institute of Technology (KIT)</p>
    <ul class="cv__points">
      <li>Simulations in Ansys HFSS, design and characterization of the cavity</li>
    </ul>
  </li>

  <li class="cv__item">
    <div class="cv__meta"><span>04/2022 – 09/2023</span></div>
    <p class="cv__title">Theoretical Physics Tutor</p>
    <p class="cv__org">Faculty of Physics · KIT</p>
  </li>

  <li class="cv__item">
    <div class="cv__meta"><span>09/2020</span></div>
    <p class="cv__title">Internship</p>
    <p class="cv__org">Leibniz Institute for Plasma Science and Technology</p>
  </li>

</ul>
</section>

<section class="cv__section">
<h2 class="cv__heading"><i class="fa-solid fa-graduation-cap"></i>Education</h2>
<ul class="cv__timeline">

  <li class="cv__item cv__item--now">
    <div class="cv__meta"><span>10/2024 – 05/2027</span><span class="cv__badge">now</span></div>
    <p class="cv__title">M.Sc. Quantum Science and Technology</p>
    <p class="cv__org">Technical University of Munich & Ludwig Maximilians University Munich</p>
    <ul class="cv__points">
      <li>Focus on neutral atom computing platforms and their hardware</li>
      <li>Current grade 1.8</li>
    </ul>
  </li>

  <li class="cv__item">
    <div class="cv__meta"><span>01/2024 – 06/2024</span><span>Erasmus</span></div>
    <p class="cv__title">Physics (B.Sc.), exchange semester</p>
    <p class="cv__org">University of Oslo · Norway</p>
    <ul class="cv__points">
      <li>Quantum Algorithms (Qiskit) · grade 1.0</li>
      <li>Plasma Physics · grade 1.0</li>
      <li>Climate Modelling and Data Science with Python</li>
    </ul>
  </li>

  <li class="cv__item">
    <div class="cv__meta"><span>10/2020 – 08/2024</span></div>
    <p class="cv__title"><span class="cv__grade">1.4</span>B.Sc. Physics</p>
    <p class="cv__org">Karlsruhe Institute of Technology (KIT)</p>
  </li>

  <li class="cv__item">
    <div class="cv__meta"><span>08/2011 – 03/2020</span></div>
    <p class="cv__title"><span class="cv__grade">1.3</span>Abitur</p>
    <p class="cv__org">Werner-Heisenberg-Gymnasium · Bad Dürkheim</p>
  </li>

</ul>
</section>

<section class="cv__section">
<h2 class="cv__heading"><i class="fa-solid fa-award"></i>Engagement &amp; Awards</h2>
<ul class="cv__timeline">

  <li class="cv__item">
    <div class="cv__meta"><span>4 years</span></div>
    <p class="cv__title">Deutschlandstipendium Scholarship</p>
    <p class="cv__org">3 years at KIT · 1 year at TUM</p>
  </li>

  <li class="cv__item">
    <div class="cv__meta"><span>11/2021 – 06/2025</span></div>
    <p class="cv__title">Voluntary Member, Netzwerk Deutschlandstipendium Karlsruhe e.V.</p>
    <ul class="cv__points">
      <li>04/2023 – 06/2025: member of the executive committee and treasurer</li>
    </ul>
  </li>

  <li class="cv__item">
    <div class="cv__meta"><span>High school</span></div>
    <p class="cv__title">Scientific Competitions for Students</p>
    <ul class="cv__points">
      <li>International Physics Olympiad 2020: 21st place in Germany, internship award</li>
    </ul>
  </li>

</ul>
</section>

</div>
