const hideErrorPaste = () => (errorPaste.style.display = '')

const displayErrorPaste = (msg = 'An error occured :/') => {
  errorPaste.textContent = msg
  errorPaste.style.display = 'block'
}

const padZero = (d = 0) => `${d < 10 ? '0' : ''}${d}`

const formatDate = (ms) => {
  const d = new Date(ms)
  const isToday = d.getDate() === new Date().getDate()
  return `${padZero(d.getHours())}:${padZero(d.getMinutes())}, ${
    isToday ? 'today' : 'tomorrow'
  }`
}

const KB = 1024
const MB = KB * KB

const formatSize = (size) => {
  if (size < KB) return `${size} bytes`
  else if (size < MB) return `${(size / KB).toFixed(2)} Kb`
  else return `${(size / MB).toFixed(2)} Mb`
}

if (typeof module !== 'undefined') {
  module.exports = {
    KB,
    MB,
    padZero,
    formatSize,
    formatDate,
  }
}
