const form = document.querySelector('form')
const textarea = document.querySelector('textarea')
const inputFile = document.querySelector('input[type=file]')
const keepSelect = document.querySelector('select[name="keep"]')
const typeSelect = document.querySelector('select[name="type"]')
const errorPaste = document.querySelector('.error.paste')
const pastedData = document.querySelector('#pastedData')
const pastedFiles = document.querySelector('#pastedFiles')
const templatePastedData = document.querySelector('#templatePastedData')
const templatePastedFile = document.querySelector('#templatePastedFile')

const TYPE_TEXT = 'type_text'
const TYPE_FILE = 'type_file'

typeSelect.addEventListener('change', (e) => {
  if (e.target.value === TYPE_FILE) {
    inputFile.style.display = 'block'
    textarea.style.display = 'none'
  } else {
    inputFile.style.display = 'none'
    textarea.style.display = 'block'
  }
})

const fetchData = () =>
  fetch('./api/data')
    .then((response) => response.json())
    .then((data) => {
      if (data.length === 0) {
        pastedData.innerHTML = 'No data posted'
        return
      }

      pastedData.innerHTML = ''

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
      pastedData.appendChild(fragment)
    })

const postDataOrFile = (e) => {
  hideErrorPaste()
  e.stopPropagation()
  e.preventDefault()

  if (typeSelect.value === TYPE_FILE) {
    if (inputFile.value.length === 0) {
      displayErrorPaste('No file to post')
      return
    }

    const files = inputFile.files
    const formData = new FormData()
    formData.append('file', files[0])
    formData.append('keep', parseInt(keepSelect.value, 10))

    fetch('./api/file', {
      method: 'POST',
      body: formData,
    })
      .then((response) => {
        if (response.status === 200) {
          inputFile.value = ''
          fetchFiles()
        } else {
          console.log(response)
          displayErrorPaste()
        }
      })
      .catch((e) => {
        console.error(e)
        displayErrorPaste()
      })
  } else if (typeSelect.value === TYPE_TEXT) {
    if (textarea.value.length === 0) {
      displayErrorPaste('No data to post')
      return
    }

    fetch('./api/data', {
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
}

const fetchFiles = () =>
  fetch('./api/files')
    .then((response) => response.json())
    .then((data) => {
      if (data.length === 0) {
        pastedFiles.innerHTML = 'No file posted'
        return
      }

      pastedFiles.innerHTML = ''

      const fragment = document.createElement('ul')
      data.forEach((file) => {
        const child = document.importNode(templatePastedFile.content, true)
        const a = child.querySelector('a')
        a.textContent = file.originalname
        a.setAttribute('href', `./api/files/${file.id}`)
        child.querySelector('.size').textContent = formatSize(file.size)
        const until = child.querySelector('.until')
        until.textContent = until.textContent.replace(
          '{}',
          formatDate(file.until)
        )
        fragment.append(child)
      })
      pastedFiles.appendChild(fragment)
    })

textarea.addEventListener(
  'keydown',
  (e) => {
    if (e.ctrlKey && e.key === 'Enter') postDataOrFile(e)
  },
  false
)

form.addEventListener('submit', postDataOrFile, false)

fetchData()
fetchFiles()
