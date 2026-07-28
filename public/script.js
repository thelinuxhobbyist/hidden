const modal = document.getElementById('previewModal');
const closeBtn = document.getElementById('closeModalBtn');
const overlay = document.getElementById('modalOverlay');
const previewFrame = document.getElementById('previewFrame');
const previewRangeLabel = document.getElementById('previewRangeLabel');
const previewPageIndicator = document.getElementById('previewPageIndicator');
const previewPrevBtn = document.getElementById('previewPrevBtn');
const previewNextBtn = document.getElementById('previewNextBtn');
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

// Preview PDF starts at original page 6, so add this offset in the UI.
const PREVIEW_PAGE_OFFSET = 5;

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const previewState = {
  pdf: null,
  pages: [],
  index: 0,
  totalOriginalPages: 0
};

function setNavOpen(isOpen) {
  if (!navLinks || !navToggle) return;
  navLinks.classList.toggle('is-open', isOpen);
  navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  navToggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
}

navToggle?.addEventListener('click', () => {
  const isOpen = !navLinks?.classList.contains('is-open');
  setNavOpen(isOpen);
});

navLinks?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => setNavOpen(false));
});

document.addEventListener('click', (event) => {
  if (!navLinks?.classList.contains('is-open')) return;
  if (navLinks.contains(event.target) || navToggle?.contains(event.target)) return;
  setNavOpen(false);
});

function openModal() {
  modal?.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modal?.classList.remove('active');
  document.body.style.overflow = 'auto';
}

closeBtn?.addEventListener('click', closeModal);
overlay?.addEventListener('click', closeModal);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && navLinks?.classList.contains('is-open')) {
    setNavOpen(false);
  }

  if (!modal?.classList.contains('active')) return;

  if (event.key === 'Escape') {
    closeModal();
  } else if (event.key === 'ArrowLeft') {
    showPreviewPage(previewState.index - 1);
  } else if (event.key === 'ArrowRight') {
    showPreviewPage(previewState.index + 1);
  }
});

function getPreviewFitScale(page) {
  const base = page.getViewport({ scale: 1 });
  const frame = previewFrame;
  if (!frame) return 1.5;

  const styles = window.getComputedStyle(frame);
  const padX = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
  const padY = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
  const availW = Math.max(240, frame.clientWidth - padX - 8);
  const availH = Math.max(280, frame.clientHeight - padY - 8);

  const byWidth = availW / base.width;
  const byHeight = availH / base.height;

  // Prefer the largest readable size: fill width when the full page would be too small.
  if (byHeight < 1.25 && byWidth > byHeight) {
    return byWidth;
  }

  return Math.min(byWidth, byHeight);
}

async function renderPreviewPage(pageNum) {
  const page = await previewState.pdf.getPage(pageNum);
  const fitScale = getPreviewFitScale(page);
  const outputScale = Math.min(window.devicePixelRatio || 1, 2.5);
  const viewport = page.getViewport({ scale: fitScale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;
  canvas.className = 'preview-canvas preview-canvas--fullscreen';
  canvas.setAttribute('aria-label', `Preview page ${pageNum + PREVIEW_PAGE_OFFSET}`);

  context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}

async function showPreviewPage(index) {
  if (!previewState.pages.length || !previewFrame) return;

  const nextIndex = Math.max(0, Math.min(previewState.pages.length - 1, index));
  previewState.index = nextIndex;

  const pageNum = previewState.pages[nextIndex];
  const originalPage = pageNum + PREVIEW_PAGE_OFFSET;
  previewFrame.innerHTML = '<div class="preview-loading">Loading full page…</div>';

  try {
    // Wait a frame so the modal layout has real dimensions before measuring.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = await renderPreviewPage(pageNum);
    previewFrame.innerHTML = '';
    previewFrame.appendChild(canvas);
    previewFrame.scrollTop = 0;

    if (previewPageIndicator) {
      previewPageIndicator.textContent = `Page ${originalPage} of ${previewState.totalOriginalPages} · sample ${nextIndex + 1} of ${previewState.pages.length}`;
    }

    if (previewPrevBtn) previewPrevBtn.disabled = nextIndex === 0;
    if (previewNextBtn) previewNextBtn.disabled = nextIndex === previewState.pages.length - 1;
  } catch (error) {
    console.error('Preview page render failed:', error);
    previewFrame.innerHTML = '<div class="preview-error">Could not render this page.</div>';
  }
}

function pickRandomPreviewPages(totalPreviewPages) {
  if (totalPreviewPages < 1) return [];

  const maxStart = Math.max(1, totalPreviewPages - 2);
  const startPage = Math.floor(Math.random() * maxStart) + 1;
  return [startPage, startPage + 1, startPage + 2].filter((page) => page <= totalPreviewPages);
}

async function generateRandomPreview() {
  openModal();
  setNavOpen(false);

  if (!previewFrame) return;
  previewFrame.innerHTML = '<div class="preview-loading">Opening a full-page sample…</div>';
  if (previewPageIndicator) previewPageIndicator.textContent = '';
  if (previewRangeLabel) previewRangeLabel.textContent = 'Choosing 3 random pages after the first 5…';

  if (!window.pdfjsLib) {
    previewFrame.innerHTML = '<div class="preview-error">Preview is unavailable right now. Please refresh and try again.</div>';
    return;
  }

  try {
    const pdf = await pdfjsLib.getDocument({ url: `/api/preview?t=${Date.now()}` }).promise;
    const totalPreviewPages = pdf.numPages;
    const pages = pickRandomPreviewPages(totalPreviewPages);

    if (!pages.length) {
      previewFrame.innerHTML = '<div class="preview-error">This preview is temporarily unavailable.</div>';
      return;
    }

    previewState.pdf = pdf;
    previewState.pages = pages;
    previewState.totalOriginalPages = totalPreviewPages + PREVIEW_PAGE_OFFSET;
    previewState.index = 0;

    const firstOriginal = pages[0] + PREVIEW_PAGE_OFFSET;
    const lastOriginal = pages[pages.length - 1] + PREVIEW_PAGE_OFFSET;

    if (previewRangeLabel) {
      previewRangeLabel.textContent = `Random sample · pages ${firstOriginal}–${lastOriginal}`;
    }

    await showPreviewPage(0);
  } catch (error) {
    console.error('Preview render failed:', error);
    previewFrame.innerHTML = '<div class="preview-error">The preview could not be loaded. Please try again in a moment.</div>';
  }
}

let previewResizeTimer = null;
window.addEventListener('resize', () => {
  if (!modal?.classList.contains('active') || !previewState.pdf) return;
  clearTimeout(previewResizeTimer);
  previewResizeTimer = setTimeout(() => {
    showPreviewPage(previewState.index);
  }, 150);
});

previewPrevBtn?.addEventListener('click', () => showPreviewPage(previewState.index - 1));
previewNextBtn?.addEventListener('click', () => showPreviewPage(previewState.index + 1));

document.getElementById('heroPreviewBtn')?.addEventListener('click', generateRandomPreview);

async function loadSiteConfig() {
  try {
    const response = await fetch(`/api/config?t=${Date.now()}`, { cache: 'no-store' });
    const config = await response.json();
    if (!response.ok || !config?.priceLabel) return;

    applySitePrices(config);
  } catch (error) {
    console.error('Failed to load site config:', error);
  }
}

function applySitePrices(config) {
  document.querySelectorAll('[data-price]').forEach((el) => {
    el.textContent = config.priceLabel;
  });

  document.querySelectorAll('[data-currency-label]').forEach((el) => {
    el.textContent = (config.currency || 'usd').toUpperCase();
  });
}


function showCheckoutError(message) {
  const errorBox = document.getElementById('checkoutError');
  if (errorBox) {
    errorBox.textContent = message;
    errorBox.style.display = message ? 'block' : 'none';
  }
}

function showPurchaseOverlay({ title, body, note, cancelled = false }) {
  const overlay = document.getElementById('purchaseOverlay');
  const titleEl = document.getElementById('purchaseOverlayTitle');
  const bodyEl = document.getElementById('purchaseOverlayBody');
  const noteEl = document.getElementById('purchaseOverlayNote');
  const iconEl = document.getElementById('purchaseOverlayIcon');

  if (!overlay) return;

  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.innerHTML = body;
  if (noteEl) noteEl.textContent = note;
  if (iconEl) {
    iconEl.textContent = cancelled ? '!' : '✓';
    iconEl.classList.toggle('is-cancelled', cancelled);
  }

  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
}

function hidePurchaseOverlay() {
  const overlay = document.getElementById('purchaseOverlay');
  if (overlay) overlay.hidden = true;
  document.body.style.overflow = 'auto';
}

function showCheckoutBanner(kind) {
  const success = document.getElementById('checkoutSuccess');
  const cancelled = document.getElementById('checkoutCancelled');
  if (success) success.hidden = kind !== 'success';
  if (cancelled) cancelled.hidden = kind !== 'cancelled';
}

async function fulfillPurchase(sessionId) {
  const detail = document.getElementById('checkoutSuccessDetail');
  const noteEl = document.getElementById('purchaseOverlayNote');

  try {
    const response = await fetch('/api/fulfill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.error || 'Delivery failed');
    }

    const message = data.email
      ? `Ebook sent to ${data.email}. Check your inbox and spam folder.`
      : 'Ebook sent. Check your inbox and spam folder.';

    if (detail) detail.textContent = message;
    if (noteEl) noteEl.textContent = message;
  } catch (error) {
    console.error('Fulfillment error:', error);
    const fallback = 'Payment succeeded, but email delivery hit a snag. Keep your Stripe receipt and contact support so we can resend the book.';
    if (detail) detail.textContent = fallback;
    if (noteEl) noteEl.textContent = fallback;
  }
}

function handleCheckoutReturn() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('checkout');
  const sessionId = params.get('session_id');

  if (status === 'success') {
    showCheckoutBanner('success');
    showPurchaseOverlay({
      title: 'Payment successful',
      body: 'Thank you for buying <strong>Hidden Linux</strong>. Your payment went through. We’re emailing the ebook PDF to the address you used at checkout — please check your inbox and spam folder.',
      note: sessionId ? 'Sending your ebook now…' : 'Check the email you used at checkout for your PDF.'
    });
    if (sessionId) {
      fulfillPurchase(sessionId);
    }
    window.history.replaceState({}, '', window.location.pathname + window.location.hash);
  } else if (status === 'cancelled') {
    showCheckoutBanner('cancelled');
    showPurchaseOverlay({
      title: 'Checkout cancelled',
      body: 'No payment was taken. You can return to the buy section and try again whenever you’re ready.',
      note: 'Nothing was charged.',
      cancelled: true
    });
    window.history.replaceState({}, '', window.location.pathname + window.location.hash);
  }
}

document.getElementById('purchaseOverlayClose')?.addEventListener('click', hidePurchaseOverlay);

async function checkout() {
  showCheckoutError('');

  try {
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '' })
    });

    const text = await response.text();
    let data = {};

    try {
      data = JSON.parse(text);
    } catch {
      console.error('Checkout response was not valid JSON:', text);
    }

    if (!response.ok) {
      throw new Error(data?.error || `Checkout failed (${response.status})`);
    }

    if (data?.url) {
      window.location.href = data.url;
      return;
    }

    throw new Error('Checkout session could not be created.');
  } catch (error) {
    console.error('Checkout error:', error);
    const message = 'Checkout is currently unavailable. Please try again shortly.';
    showCheckoutError(message);
    window.alert(message);
  }
}

loadSiteConfig();
handleCheckoutReturn();
