const modal = document.getElementById('previewModal');
const closeBtn = document.getElementById('closeModalBtn');
const overlay = document.getElementById('modalOverlay');
const modalBody = document.querySelector('.modal-body');

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

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
  if (event.key === 'Escape') {
    closeModal();
  }
});

async function generateRandomPreview() {
  openModal();

  if (!modalBody) return;
  modalBody.innerHTML = '<div class="preview-loading">Loading preview pages…</div>';

  if (!window.pdfjsLib) {
    modalBody.innerHTML = '<div class="preview-error">Preview is unavailable right now. Please refresh and try again.</div>';
    return;
  }

  try {
    const pdf = await pdfjsLib.getDocument({ url: '/api/ebook' }).promise;
    const totalPages = pdf.numPages;

    if (totalPages < 2) {
      modalBody.innerHTML = '<div class="preview-error">This preview is temporarily unavailable.</div>';
      return;
    }

    // Choose a random consecutive 3-page window, skipping the first 5 pages.
    // Valid start pages are 6 .. (totalPages - 2)
    const minStart = 6;
    const maxStart = Math.max(minStart, totalPages - 2);
    // If there are not enough pages, fall back to pages 1..3
    let startPage;
    if (totalPages >= minStart + 2) {
      startPage = Math.floor(Math.random() * (maxStart - minStart + 1)) + minStart;
    } else {
      startPage = 1;
    }
    const pagesToRender = [startPage, startPage + 1, startPage + 2];

    modalBody.innerHTML = '';

    // Render the selected pages and show a single label for the range
    const first = pagesToRender[0];
    const last = pagesToRender[pagesToRender.length - 1];

    for (const pageNum of pagesToRender) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.9 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.className = 'preview-canvas';
      canvas.setAttribute('aria-label', `Preview page ${pageNum}`);

      await page.render({ canvasContext: context, viewport }).promise;

      const card = document.createElement('div');
      card.className = 'preview-page-card';
      // Only show the range label at the top of the first rendered card
      if (pageNum === first) {
        const label = document.createElement('p');
        label.className = 'preview-page-label';
        label.textContent = `Sample pages ${first}–${last} of ${totalPages}`;
        card.append(label);
      }
      card.append(canvas);
      modalBody.appendChild(card);
    }
  } catch (error) {
    console.error('Preview render failed:', error);
    modalBody.innerHTML = '<div class="preview-error">The preview could not be loaded. Please try again in a moment.</div>';
  }
}

// Attach event listeners to preview buttons
const previewButtons = [document.getElementById('openPreviewBtn'), document.getElementById('heroPreviewBtn')];
previewButtons.forEach((button) => button?.addEventListener('click', generateRandomPreview));

async function checkout() {
  try {
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '' })
    });

    const data = await response.json();

    if (data?.url) {
      window.location.href = data.url;
      return;
    }

    throw new Error('Checkout session could not be created.');
  } catch (error) {
    console.error('Checkout error:', error);
    window.alert('Checkout is currently unavailable. Please try again shortly.');
  }
}
