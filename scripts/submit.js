const storageKey = 'strategySubmissions';

const saveSubmission = (submission) => {
  try {
    const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
    existing.push(submission);
    localStorage.setItem(storageKey, JSON.stringify(existing));
  } catch (error) {
    console.warn('Unable to save submission:', error);
  }
};

const handleSuggestionForm = () => {
  const form = document.getElementById('suggestion-form');
  if (!form) {
    return;
  }

  const message = form.closest('[data-strategy-form-container]')?.querySelector('[data-form-message]');

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const title = (formData.get('title') || '').toString().trim();
    const description = (formData.get('description') || '').toString().trim();
    const needSlug = (formData.get('need') || '').toString();
    const nameInput = (formData.get('name') || '').toString().trim();
    const locationInput = (formData.get('location') || '').toString().trim();

    if (!title || !description) {
      if (message) {
        message.textContent = 'Please share a strategy name and description before submitting.';
        message.hidden = false;
        message.classList.remove('success');
        message.classList.add('error');
      }
      return;
    }

    let needTitle = '';
    const needSelect = form.querySelector('select[name="need"]');
    if (needSelect instanceof HTMLSelectElement) {
      needTitle = needSelect.options[needSelect.selectedIndex]?.textContent?.trim() || '';
    }

    const submission = {
      title,
      description,
      need: needSlug,
      needTitle,
      tags: needSlug ? [needSlug] : [],
      name: nameInput || 'Anonymous',
      location: locationInput || '',
      timestamp: new Date().toISOString(),
    };

    saveSubmission(submission);

    form.reset();

    if (message) {
      message.textContent =
        'Saved! Personal strategies stay on this browser. Visit the inventory screen to export them whenever you want a backup.';
      message.hidden = false;
      message.classList.remove('error');
      message.classList.add('success');
    }
  });
};

document.addEventListener('DOMContentLoaded', handleSuggestionForm);
