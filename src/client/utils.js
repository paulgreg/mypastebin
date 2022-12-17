export const hideErrorPaste = (errorPaste) => (errorPaste.style.display = '')

export const displayErrorPaste = (errorPaste, msg = 'An error occured :/') => {
  errorPaste.textContent = msg
  errorPaste.style.display = 'block'
}

export const padZero = (d = 0) => `${d < 10 ? '0' : ''}${d}`

export const formatDate = (ms) => {
  const d = new Date(ms)
  const isToday = d.getDate() === new Date().getDate()
  return `${padZero(d.getHours())}:${padZero(d.getMinutes())}, ${
    isToday ? 'today' : 'tomorrow'
  }`
}

export const KB = 1024
export const MB = KB * KB

export const formatSize = (size) => {
  if (size < KB) return `${size} bytes`
  else if (size < MB) return `${(size / KB).toFixed(2)} Kb`
  else return `${(size / MB).toFixed(2)} Mb`
}
