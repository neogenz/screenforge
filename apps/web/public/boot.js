try {
  if (localStorage.getItem('screenforge-theme') !== 'light') {
    document.documentElement.classList.add('dark')
  }
} catch {
  document.documentElement.classList.add('dark')
}
