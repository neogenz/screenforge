try {
  if (localStorage.getItem('screenforge-theme') === 'light') {
    document.documentElement.classList.add('light')
  }
} catch {}

for (const link of document.querySelectorAll('link[data-screenforge-font]')) {
  if (link.sheet) link.media = 'all'
  else link.addEventListener('load', () => (link.media = 'all'), { once: true })
}
