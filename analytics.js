// Google Analytics 4 with Consent Mode v2.
// Denied by default in the EU, EEA, UK and Switzerland until the visitor
// allows it via the notice; granted elsewhere. IP anonymisation on. The
// choice is remembered in localStorage.consent. Fill in the Measurement ID
// from GA Admin > Data streams; until then nothing is sent.
(function () {
  "use strict";
  var GA_ID = "G-XXXXXXXXXX";
  var CONSENT_REGIONS = ["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","IS","LI","NO","GB","CH"];

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  var stored = null;
  try { stored = localStorage.getItem("consent"); } catch (e) {}

  gtag("consent", "default", {
    ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
    analytics_storage: "denied", region: CONSENT_REGIONS, wait_for_update: 500,
  });
  gtag("consent", "default", {
    ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
    analytics_storage: "granted",
  });
  if (stored === "granted" || stored === "denied") {
    gtag("consent", "update", { analytics_storage: stored });
  }

  if (GA_ID !== "G-XXXXXXXXXX") {
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(s);
    gtag("js", new Date());
    gtag("config", GA_ID, { anonymize_ip: true });
  }

  // The notice: shown once, until a choice is made, and only once a
  // Measurement ID is configured. With the placeholder nothing runs and
  // nothing is asked.
  var box = document.getElementById("consent");
  if (!box || stored || GA_ID === "G-XXXXXXXXXX") return;
  box.hidden = false;
  requestAnimationFrame(function () { box.classList.add("is-in"); });
  box.querySelectorAll("[data-consent]").forEach(function (b) {
    b.addEventListener("click", function () {
      var v = b.getAttribute("data-consent");
      gtag("consent", "update", { analytics_storage: v });
      try { localStorage.setItem("consent", v); } catch (e) {}
      box.classList.remove("is-in");
      setTimeout(function () { box.hidden = true; }, 400);
    });
  });
})();
