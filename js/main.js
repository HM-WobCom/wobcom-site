(function () {
  "use strict";

  var header = document.querySelector(".site-header");
  var nav = document.getElementById("site-nav");
  var navToggle = document.querySelector(".nav-toggle");
  var reveals = document.querySelectorAll("[data-reveal]");
  var yearEl = document.getElementById("year");
  var form = document.getElementById("demo-request-form");
  var formStatus = document.getElementById("form-status");
  var submitBtn = document.getElementById("demo-submit-btn");

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  function loadRecaptchaScript(siteKey) {
    return new Promise(function (resolve, reject) {
      if (!siteKey) {
        resolve(null);
        return;
      }
      if (window.grecaptcha) {
        resolve(window.grecaptcha);
        return;
      }
      var s = document.createElement("script");
      s.src = "https://www.google.com/recaptcha/api.js?render=" + encodeURIComponent(siteKey);
      s.async = true;
      s.onload = function () {
        resolve(window.grecaptcha);
      };
      s.onerror = function () {
        reject(new Error("recaptcha load failed"));
      };
      document.head.appendChild(s);
    });
  }

  function getRecaptchaToken(siteKey) {
    if (!siteKey || !window.grecaptcha) {
      return Promise.resolve(null);
    }
    return new Promise(function (resolve, reject) {
      window.grecaptcha.ready(function () {
        window.grecaptcha
          .execute(siteKey, { action: "demo_request" })
          .then(resolve)
          .catch(reject);
      });
    });
  }

  function setFormMessage(text, kind) {
    if (!formStatus) return;
    formStatus.textContent = text || "";
    formStatus.classList.remove("form-success", "form-error");
    if (kind === "success") formStatus.classList.add("form-success");
    if (kind === "error") formStatus.classList.add("form-error");
  }

  function setLoading(loading) {
    if (!submitBtn) return;
    submitBtn.classList.toggle("is-loading", loading);
    submitBtn.disabled = loading;
  }

  if (form && formStatus) {
    var cfg = window.__WOBCOM__ || {};
    var recaptchaSiteKey = cfg.recaptchaSiteKey || null;

    form.addEventListener("submit", function (e) {
  e.preventDefault();

  var fd = new FormData(form);

  var payload = {
    name: fd.get("name"),
    email: fd.get("email"),
    phone: fd.get("phone"),
    businessName: fd.get("businessName"),
    message: fd.get("message"),
    date: new Date().toISOString()
  };

  if (!payload.message || payload.message.length < 10) {
    setFormMessage("Message must be at least 10 characters.", "error");
    return;
  }

  setLoading(true);

  emailjs.send("service_1xmvmun", "template_w0hzbpr", payload)
    .then(function () {
      setFormMessage("✅ Email sent successfully!", "success");
      form.reset();
    })
    .catch(function () {
      setFormMessage("❌ Email failed", "error");
    })
    .finally(function () {
      setLoading(false);
    });
});
  }

  function setHeaderScrolled() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  }

  setHeaderScrolled();
  window.addEventListener("scroll", setHeaderScrolled, { passive: true });

  if (navToggle && nav) {
    navToggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
      navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      document.body.classList.toggle("nav-open", open);
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.setAttribute("aria-label", "Open menu");
        document.body.classList.remove("nav-open");
      });
    });
  }

  if ("IntersectionObserver" in window && reveals.length) {
    var delayAttr = function (el) {
      var d = el.getAttribute("data-reveal-delay");
      return d ? parseInt(d, 10) : 0;
    };

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          var ms = delayAttr(el);
          setTimeout(function () {
            el.classList.add("is-visible");
          }, ms);
          observer.unobserve(el);
        });
      },
      { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );

    reveals.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    reveals.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }
})();
