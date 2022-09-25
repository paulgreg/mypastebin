const form = document.querySelector('form')
const textarea = document.querySelector('textarea')
const keepSelect = document.querySelector('select[name="keep"]')
const errorPaste = document.querySelector('.error.paste')
const pastedData = document.querySelector('#pastedData')
const templatePastedData = document.querySelector('#templatePastedData')

const hideErrorPaste = () => (errorPaste.style.display = '')
const displayErrorPaste = () => (errorPaste.style.display = 'block')

const padZero = (d = 0) => (d < 10 ? `0${d}` : d)

const formatDate = (ms) => {
  const d = new Date(ms)
  const isToday = d.getDate() === new Date().getDate()
  return `${padZero(d.getHours())}:${padZero(d.getMinutes())}, ${
    isToday ? 'today' : 'tomorrow'
  }`
}

const fetchData = () =>
  fetch('./api/data')
    .then((response) => response.json())
    .then((data) => {
      if (data.length === 0) {
        parsedData.innerHTML = 'No data posted'
        return
      }

      parsedData.innerHTML = ''

      const fragment = new DocumentFragment()
      data.forEach((item) => {
        const child = document.importNode(templatePastedData.content, true)
        child.querySelector('.data').textContent = item.content
        const until = child.querySelector('.until')
        until.textContent = until.textContent.replace(
          '{}',
          formatDate(item.until)
        )
        fragment.append(child)
      })
      parsedData.appendChild(fragment)
    })

fetchData()

const postData = (e) => {
  hideErrorPaste()
  e.stopPropagation()
  e.preventDefault()

  fetch('./api/paste', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: textarea.value,
      keep: parseInt(keepSelect.value, 10),
    }),
  })
    .then((response) => {
      if (response.status === 200) {
        textarea.value = ''
        fetchData()
      } else {
        console.log(response)
        displayErrorPaste()
      }
    })
    .catch((e) => {
      console.error(e)
      displayErrorPaste()
    })
}

textarea.addEventListener(
  'keydown',
  (e) => {
    if (e.ctrlKey && e.key === 'Enter') postData(e)
  },
  false
)

form.addEventListener('submit', postData, false)
