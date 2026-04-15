/* ═══════════════════════════════════════════════
   AI FASHION GENERATOR — MAIN JAVASCRIPT
   ═══════════════════════════════════════════════ */

'use strict';

// ── LOADER ──────────────────────────────────────
(function initLoader() {
  const loader   = document.getElementById('loader');
  const fill     = document.getElementById('loaderFill');
  const heroH1   = document.querySelectorAll('.hero-headline .line');

  // Animate loader bar
  requestAnimationFrame(() => {
    fill.style.width = '100%';
  });

  setTimeout(() => {
    loader.classList.add('hidden');
    // Animate hero headline in
    heroH1.forEach(line => line.classList.add('visible'));
  }, 1600);
})();


// ── CUSTOM CURSOR ───────────────────────────────
(function initCursor() {
  const cursor   = document.getElementById('cursor');
  const follower = document.getElementById('cursorFollower');
  if (!cursor || !follower) return;

  let mx = 0, my = 0;
  let fx = 0, fy = 0;

  document.addEventListener('mousemove', e => {
    mx = e.clientX;
    my = e.clientY;
    cursor.style.left = mx + 'px';
    cursor.style.top  = my + 'px';
  });

  function animateFollower() {
    fx += (mx - fx) * 0.12;
    fy += (my - fy) * 0.12;
    follower.style.left = fx + 'px';
    follower.style.top  = fy + 'px';
    requestAnimationFrame(animateFollower);
  }
  animateFollower();

  document.addEventListener('mouseleave', () => {
    cursor.style.opacity   = '0';
    follower.style.opacity = '0';
  });
  document.addEventListener('mouseenter', () => {
    cursor.style.opacity   = '1';
    follower.style.opacity = '1';
  });
})();


// ── NAVIGATION ──────────────────────────────────
(function initNav() {
  const nav     = document.getElementById('nav');
  const menuBtn = document.getElementById('menuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileLinks = document.querySelectorAll('.mobile-menu-link');

  // Scroll state
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });

  // Mobile toggle
  let menuOpen = false;
  menuBtn.addEventListener('click', () => {
    menuOpen = !menuOpen;
    mobileMenu.classList.toggle('open', menuOpen);
    // Animate hamburger lines
    const spans = menuBtn.querySelectorAll('span');
    if (menuOpen) {
      spans[0].style.transform = 'rotate(45deg) translate(4px, 4px)';
      spans[1].style.transform = 'rotate(-45deg) translate(4px, -4px)';
    } else {
      spans[0].style.transform = '';
      spans[1].style.transform = '';
    }
  });

  mobileLinks.forEach(link => {
    link.addEventListener('click', () => {
      menuOpen = false;
      mobileMenu.classList.remove('open');
      const spans = menuBtn.querySelectorAll('span');
      spans[0].style.transform = '';
      spans[1].style.transform = '';
    });
  });
})();


// ── SCROLL REVEAL ───────────────────────────────
(function initReveal() {
  const revealEls = document.querySelectorAll(
    '.reveal-fade, .reveal-slide-right, .reveal-scale, .reveal-item'
  );

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el    = entry.target;
        const delay = el.dataset.delay ? parseInt(el.dataset.delay) : 0;
        setTimeout(() => el.classList.add('visible'), delay);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });

  revealEls.forEach(el => observer.observe(el));
})();


// ── LOOKBOOK HORIZONTAL SCROLL ──────────────────
(function initLookbook() {
  const container  = document.getElementById('lookbookScroll');
  const track      = document.getElementById('lookbookTrack');
  const progressBar = document.getElementById('lookbookProgressBar');
  const prevBtn    = document.getElementById('lookbookPrev');
  const nextBtn    = document.getElementById('lookbookNext');

  if (!container || !track) return;

  let currentOffset = 0;
  let isDown = false;
  let startX, scrollLeft;
  const itemWidth = () => container.offsetWidth * 0.30 + 24; // approx item + gap

  function getMaxOffset() {
    return track.scrollWidth - container.offsetWidth;
  }

  function applyOffset(offset) {
    currentOffset = Math.max(0, Math.min(offset, getMaxOffset()));
    track.style.transform = `translateX(-${currentOffset}px)`;
    const pct = getMaxOffset() > 0 ? (currentOffset / getMaxOffset()) * 100 : 0;
    progressBar.style.width = pct + '%';
  }

  // Arrow buttons
  nextBtn.addEventListener('click', () => applyOffset(currentOffset + itemWidth()));
  prevBtn.addEventListener('click', () => applyOffset(currentOffset - itemWidth()));

  // Drag scroll
  container.addEventListener('mousedown', e => {
    isDown = true;
    container.style.userSelect = 'none';
    startX = e.pageX - container.offsetLeft;
    scrollLeft = currentOffset;
  });
  document.addEventListener('mouseup', () => {
    isDown = false;
    container.style.userSelect = '';
  });
  container.addEventListener('mousemove', e => {
    if (!isDown) return;
    e.preventDefault();
    const x    = e.pageX - container.offsetLeft;
    const walk = (x - startX) * 1.4;
    applyOffset(scrollLeft - walk);
  });

  // Touch scroll
  let touchStart = 0;
  container.addEventListener('touchstart', e => {
    touchStart = e.touches[0].pageX;
    scrollLeft = currentOffset;
  }, { passive: true });
  container.addEventListener('touchmove', e => {
    const diff = touchStart - e.touches[0].pageX;
    applyOffset(scrollLeft + diff);
  }, { passive: true });
})();


// ── CHAR COUNTER ────────────────────────────────
(function initCharCounter() {
  const input  = document.getElementById('promptInput');
  const count  = document.getElementById('charCount');
  if (!input || !count) return;

  input.addEventListener('input', () => {
    const len = input.value.length;
    count.textContent = len;
    if (len > 280) {
      count.style.color = '#c0392b';
    } else {
      count.style.color = '';
    }
    if (input.value.length > 300) {
      input.value = input.value.slice(0, 300);
    }
  });
})();


// ── IMAGE GENERATOR (Flask API) ─────────────────
(function initGenerator() {
  const btn            = document.getElementById('generateBtn');
  const input          = document.getElementById('promptInput');
  const charCount      = document.getElementById('charCount');
  const placeholder    = document.getElementById('outputPlaceholder');
  const loadingEl      = document.getElementById('outputLoading');
  const resultEl       = document.getElementById('outputResult');
  const errorEl        = document.getElementById('outputError');
  const errorMsg       = document.getElementById('errorMessage');
  const generatedImg   = document.getElementById('generatedImage');
  const outputPrompt   = document.getElementById('outputPromptEcho');
  const saveBtn        = document.getElementById('saveBtn');
  const generateOutput = document.getElementById('generateOutput');

  if (!btn || !input) return;

  let isGenerating = false;

  function showPanel(name) {
    placeholder.style.display = name === 'placeholder' ? 'flex'  : 'none';
    loadingEl.style.display   = name === 'loading'     ? 'flex'  : 'none';
    resultEl.style.display    = name === 'result'      ? 'block' : 'none';
    errorEl.style.display     = name === 'error'       ? 'flex'  : 'none';
  }

  // ── Core generate function (reusable) ──
  async function generateDesign() {
    const prompt = input.value.trim();
    if (!prompt || isGenerating) {
      if (!prompt) {
        input.focus();
        input.style.borderColor = '#c0392b';
        setTimeout(() => input.style.borderColor = '', 2000);
      }
      return;
    }

    isGenerating = true;
    btn.classList.add('loading');
    btn.querySelector('.btn-text').textContent = 'Generating...';
    showPanel('loading');

    // Scroll the generate output area into view
    if (generateOutput) {
      generateOutput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    try {
      const response = await fetch('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      const data = await response.json();

      // Handle all possible backend response formats:
      //   { image: "/static/generated/generated_001.png" }
      //   { image_url: "/static/images/output.png" }
      //   { image_base64: "<base64 string>" }
      let src = '';
      if (data.image) {
        // Add cache-busting param so browser always loads the fresh image
        src = data.image + '?t=' + Date.now();
      } else if (data.image_url) {
        src = data.image_url + '?t=' + Date.now();
      } else if (data.image_base64) {
        src = `data:image/png;base64,${data.image_base64}`;
      } else {
        throw new Error('No image returned from server.');
      }

      generatedImg.src = src;
      generatedImg.onload = () => {
        const timeInfo = data.time ? ` (${data.time}s)` : '';
        outputPrompt.textContent = `"${prompt}"${timeInfo}`;
        showPanel('result');
      };
      generatedImg.onerror = () => {
        errorMsg.textContent = 'Failed to load generated image.';
        showPanel('error');
      };

    } catch (err) {
      console.error('Generation error:', err);
      errorMsg.textContent = err.message || 'Generation failed. Please try again.';
      showPanel('error');
    } finally {
      isGenerating = false;
      btn.classList.remove('loading');
      btn.querySelector('.btn-text').textContent = 'Generate Design';
    }
  }

  // ── setPrompt: fill input and optionally auto-generate ──
  function setPrompt(promptText, autoGenerate = true) {
    input.value = promptText;
    if (charCount) charCount.textContent = promptText.length;
    input.focus();

    // Scroll to the generate section so user sees the action
    const generateSection = document.getElementById('generate');
    if (generateSection) {
      generateSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (autoGenerate) {
      // Small delay to let the scroll + input fill feel intentional
      setTimeout(() => generateDesign(), 400);
    }
  }

  // Expose globally so chips and external code can call them
  window.setPrompt      = setPrompt;
  window.generateDesign = generateDesign;

  // ── Button click handler ──
  btn.addEventListener('click', () => generateDesign());

  // ── Save / Download ──
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const src = generatedImg.src;
      if (!src) return;
      const a = document.createElement('a');
      a.href     = src;
      a.download = `ai-fashion-${Date.now()}.png`;
      a.click();
    });
  }
})();


// ── SUGGESTION CHIPS (auto-fill + auto-generate) ─
(function initSuggestions() {
  const chips = document.querySelectorAll('.suggestion-chip');
  if (!chips.length) return;

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const promptText = chip.dataset.prompt;
      if (!promptText) return;

      // Visual feedback on the clicked chip
      chip.style.borderColor = 'rgba(245,245,240,0.6)';
      chip.style.color       = 'var(--white)';
      setTimeout(() => {
        chip.style.borderColor = '';
        chip.style.color       = '';
      }, 600);

      // Fill prompt and auto-trigger generation
      if (typeof window.setPrompt === 'function') {
        window.setPrompt(promptText, true);
      }
    });
  });
})();


// ── SMOOTH SCROLL FOR NAV LINKS ─────────────────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});


// ── SUBTLE PARALLAX ON HERO IMAGE ───────────────
(function initParallax() {
  const heroFrame = document.querySelector('.hero-image-frame');
  if (!heroFrame) return;

  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    if (scrolled < window.innerHeight) {
      heroFrame.style.transform = `translateY(${scrolled * 0.08}px)`;
    }
  }, { passive: true });
})();


// ── COLLECTION GRID ITEMS REVEAL ────────────────
// Extra staggered reveal specifically for grid items
(function initGridReveal() {
  const items = document.querySelectorAll('.grid-item');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        const delay = parseInt(entry.target.dataset.delay || 0);
        setTimeout(() => entry.target.classList.add('visible'), delay);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

  items.forEach(item => obs.observe(item));
})();
