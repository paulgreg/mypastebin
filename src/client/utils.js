export const hideErrorPaste = (errorPaste) => (errorPaste.style.display = '')

export const displayErrorPaste = (errorPaste, msg = 'An error occured :/') => {
  errorPaste.textContent = msg
  errorPaste.style.display = 'block'
}

export const padZero = (d = 0) => `${d < 10 ? '0' : ''}${d}`

export const formatDate = (ms) => {
  const d = new Date(ms)
  const dateStr = `${padZero(d.getHours())}:${padZero(d.getMinutes())}`

  const today = new Date()
  const isToday = d.getDate() === today.getDate()
  if (isToday) return `${dateStr}, today`

  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)
  const isTomorrow = d.getDate() == tomorrow.getDate()
  if (isTomorrow) return `${dateStr}, tomorrow`

  const diffInDays = Math.floor((ms - today) / 86400_000)
  return `${dateStr}, in ${diffInDays} days`
}

export const KB = 1024
export const MB = KB * KB

export const formatSize = (size) => {
  if (size < KB) return `${size} bytes`
  else if (size < MB) return `${(size / KB).toFixed(2)} Kb`
  else return `${(size / MB).toFixed(2)} Mb`
}
