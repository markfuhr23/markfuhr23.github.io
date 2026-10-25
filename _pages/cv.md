---
layout: archive
title: "CV"
permalink: /cv/
author_profile: true
redirect_from:
  - /resume
---

<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>

<div class="cv">

<section class="cv__section">
<h2 class="cv__heading"><i class="fa-solid fa-route"></i>Where I've been</h2>
<div class="cv-map" id="cv-map" aria-label="Map of the places I have studied and worked"></div>
<ol class="cv-stops" id="cv-stops"></ol>
</section>

<script>
(function () {
  if (!window.L) return;
  var stops = [
    { name: "Bad Dürkheim", what: "School · Abitur", when: "–2020", at: [49.4618, 8.1724] },
    { name: "Greifswald", what: "Internship · Leibniz INP", when: "2020", at: [54.0865, 13.3923] },
    { name: "Karlsruhe", what: "B.Sc. Physics · KIT", when: "2020–24", at: [49.0069, 8.4037] },
    { name: "Oslo", what: "Erasmus · UiO", when: "2024", at: [59.9139, 10.7522] },
    { name: "Okinawa", what: "Internship · OIST", when: "2024", at: [26.4625, 127.8336] },
    { name: "Munich", what: "M.Sc. · TUM & LMU, PlanQC", when: "2024–", at: [48.1351, 11.582] }
  ];

  var map = L.map("cv-map", { scrollWheelZoom: false, worldCopyJump: true, zoomSnap: 0.25 });
  var tiles = null;
  function setTiles() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    if (tiles) map.removeLayer(tiles);
    tiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/" + (dark ? "dark_all" : "light_all") + "/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd", maxZoom: 12
    }).addTo(map);
  }
  setTiles();
  new MutationObserver(setTiles).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  /* curved leg between two stops: quadratic Bezier with a sideways bulge */
  function arc(a, b) {
    var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var c = [mx - dy * 0.22, my + dx * 0.22], pts = [];
    for (var i = 0; i <= 40; i++) {
      var t = i / 40, u = 1 - t;
      pts.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
    }
    return pts;
  }

  var legs = [];
  for (var i = 1; i < stops.length; i++) {
    legs.push(L.polyline(arc(stops[i - 1].at, stops[i].at), { className: "cv-map__leg", weight: 2.5 }).addTo(map));
  }

  /* arrowheads: an SVG marker on every leg */
  var svg = map.getPanes().overlayPane.querySelector("svg");
  if (svg) {
    var ns = "http://www.w3.org/2000/svg";
    var defs = document.createElementNS(ns, "defs");
    defs.innerHTML = '<marker id="cv-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="cv-map__head"/></marker>';
    svg.insertBefore(defs, svg.firstChild);
    legs.forEach(function (l) { l.getElement().setAttribute("marker-end", "url(#cv-arrow)"); });
  }

  var list = document.getElementById("cv-stops");
  stops.forEach(function (s, i) {
    var icon = L.divIcon({ className: "cv-map__pin", html: "<span>" + (i + 1) + "</span>", iconSize: [24, 24] });
    L.marker(s.at, { icon: icon, title: s.name }).addTo(map)
      .bindTooltip("<b>" + s.name + "</b><br>" + s.what + " · " + s.when, { direction: "top", offset: [0, -12] });
    var li = document.createElement("li");
    li.innerHTML = '<button type="button"><span class="n">' + (i + 1) + '</span><span><b>' + s.name + "</b> " + s.when + "<br><small>" + s.what + "</small></span></button>";
    li.querySelector("button").addEventListener("click", function () { map.flyTo(s.at, 7, { duration: 1.2 }); });
    list.appendChild(li);
  });

  var all = L.latLngBounds(stops.map(function (s) { return s.at; }));
  map.fitBounds(all, { padding: [30, 30] });
  var reset = L.control({ position: "topright" });
  reset.onAdd = function () {
    var b = L.DomUtil.create("button", "cv-map__reset");
    b.type = "button";
    b.textContent = "show all";
    L.DomEvent.on(b, "click", function (e) { L.DomEvent.stop(e); map.flyToBounds(all, { padding: [30, 30], duration: 1.2 }); });
    return b;
  };
  reset.addTo(map);
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
    <ul class="cv__tags"><li>optical lattices</li><li>atom transport</li><li>Yb · Rb</li></ul>
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
    <ul class="cv__tags"><li>free-space optics</li><li>cavities</li><li>automation</li></ul>
  </li>

  <li class="cv__item">
    <div class="cv__meta"><span>09/2023 – 12/2023</span></div>
    <p class="cv__title">Bachelor Thesis: Microwave Fabry–Pérot Cavity for Investigation of Superconducting Quantum Circuits</p>
    <p class="cv__org">Karlsruhe Institute of Technology (KIT)</p>
    <ul class="cv__points">
      <li>Simulations in Ansys HFSS, design and characterization of the cavity</li>
    </ul>
    <ul class="cv__tags"><li>microwave</li><li>Ansys HFSS</li><li>superconducting circuits</li></ul>
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
