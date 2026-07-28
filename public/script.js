const modal = document.getElementById('previewModal');
const closeBtn = document.getElementById('closeModalBtn');
const overlay = document.getElementById('modalOverlay');
const previewFrame = document.getElementById('previewFrame');
const previewRangeLabel = document.getElementById('previewRangeLabel');
const previewPageIndicator = document.getElementById('previewPageIndicator');
const previewPrevBtn = document.getElementById('previewPrevBtn');
const previewNextBtn = document.getElementById('previewNextBtn');

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const previewState = {
  pdf: null,
  pages: [],
  index: 0,
  totalPages: 0
};

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
  if (!modal?.classList.contains('active')) return;

  if (event.key === 'Escape') {
    closeModal();
  } else if (event.key === 'ArrowLeft') {
    showPreviewPage(previewState.index - 1);
  } else if (event.key === 'ArrowRight') {
    showPreviewPage(previewState.index + 1);
  }
});

function getPreviewScale() {
  const width = Math.min(window.innerWidth - 120, 980);
  // PDF page width is roughly 612pt for letter-ish pages; scale to fill stage.
  return Math.max(1.1, Math.min(2.2, width / 612));
}

async function renderPreviewPage(pageNum) {
  const page = await previewState.pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: getPreviewScale() });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.className = 'preview-canvas preview-canvas--fullscreen';
  canvas.setAttribute('aria-label', `Preview page ${pageNum}`);

  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}

async function showPreviewPage(index) {
  if (!previewState.pages.length || !previewFrame) return;

  const nextIndex = Math.max(0, Math.min(previewState.pages.length - 1, index));
  previewState.index = nextIndex;

  const pageNum = previewState.pages[nextIndex];
  previewFrame.innerHTML = '<div class="preview-loading">Loading page…</div>';

  try {
    const canvas = await renderPreviewPage(pageNum);
    previewFrame.innerHTML = '';
    previewFrame.appendChild(canvas);

    if (previewPageIndicator) {
      previewPageIndicator.textContent = `Sample page ${pageNum} of ${previewState.totalPages} · ${nextIndex + 1}/${previewState.pages.length} in this preview`;
    }

    if (previewPrevBtn) previewPrevBtn.disabled = nextIndex === 0;
    if (previewNextBtn) previewNextBtn.disabled = nextIndex === previewState.pages.length - 1;
  } catch (error) {
    console.error('Preview page render failed:', error);
    previewFrame.innerHTML = '<div class="preview-error">Could not render this page.</div>';
  }
}

async function generateRandomPreview() {
  openModal();

  if (!previewFrame) return;
  previewFrame.innerHTML = '<div class="preview-loading">Loading full-page preview…</div>';
  if (previewPageIndicator) previewPageIndicator.textContent = '';
  if (previewRangeLabel) previewRangeLabel.textContent = 'Preparing sample pages…';

  if (!window.pdfjsLib) {
    previewFrame.innerHTML = '<div class="preview-error">Preview is unavailable right now. Please refresh and try again.</div>';
    return;
  }

  try {
    const pdf = await pdfjsLib.getDocument({ url: '/api/ebook' }).promise;
    const totalPages = pdf.numPages;

    if (totalPages < 2) {
      previewFrame.innerHTML = '<div class="preview-error">This preview is temporarily unavailable.</div>';
      return;
    }

    const minStart = 6;
    const maxStart = Math.max(minStart, totalPages - 2);
    let startPage;
    if (totalPages >= minStart + 2) {
      startPage = Math.floor(Math.random() * (maxStart - minStart + 1)) + minStart;
    } else {
      startPage = 1;
    }

    const pages = [startPage, startPage + 1, startPage + 2].filter((page) => page <= totalPages);

    previewState.pdf = pdf;
    previewState.pages = pages;
    previewState.totalPages = totalPages;
    previewState.index = 0;

    if (previewRangeLabel) {
      previewRangeLabel.textContent = `Full-page samples ${pages[0]}–${pages[pages.length - 1]} of ${totalPages}`;
    }

    await showPreviewPage(0);
  } catch (error) {
    console.error('Preview render failed:', error);
    previewFrame.innerHTML = '<div class="preview-error">The preview could not be loaded. Please try again in a moment.</div>';
  }
}

previewPrevBtn?.addEventListener('click', () => showPreviewPage(previewState.index - 1));
previewNextBtn?.addEventListener('click', () => showPreviewPage(previewState.index + 1));

const previewButtons = [document.getElementById('openPreviewBtn'), document.getElementById('heroPreviewBtn')];
previewButtons.forEach((button) => button?.addEventListener('click', generateRandomPreview));

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
