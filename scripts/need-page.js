const needRoot = document.querySelector('[data-need-slug]');

if (needRoot) {
  const slug = needRoot.getAttribute('data-need-slug');
  const title = document.querySelector('.need-title');
  if (slug && title) {
    title.style.setProperty('--need-icon', `url("/icons/needs/${slug}.svg")`);
  }
}
