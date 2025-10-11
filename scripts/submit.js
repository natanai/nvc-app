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

  const message = form.parentElement?.querySelector('.form-message');

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const strategy = (formData.get('strategy') || '').toString().trim();
    const nameInput = (formData.get('name') || '').toString().trim();
    const locationInput = (formData.get('location') || '').toString().trim();
    const tags = formData
      .getAll('tags')
      .map((value) => value.toString());

    if (!strategy) {
      if (message) {
        message.textContent = 'Please share a strategy before submitting.';
        message.hidden = false;
        message.classList.remove('success');
        message.classList.add('error');
      }
      return;
    }

    const submission = {
      strategy,
      tags,
      name: nameInput || 'Anonymous',
      location: locationInput || '',
      timestamp: new Date().toISOString(),
    };

    saveSubmission(submission);

    form.reset();

    if (message) {
      message.textContent = 'Thanks for your suggestion! It will be reviewed.';
      message.hidden = false;
      message.classList.remove('error');
      message.classList.add('success');
    }
  });
};

document.addEventListener('DOMContentLoaded', handleSuggestionForm);
