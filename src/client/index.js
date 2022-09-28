const form = document.querySelector('form')
const textarea = document.querySelector('textarea')
const inputFile = document.querySelector('input[type=file]')
const passwordContainer = document.querySelector('.passwordContainer')
const passwordInput = document.querySelector('#password')
const keepSelect = document.querySelector('select[name="keep"]')
const typeSelect = document.querySelector('select[name="type"]')
const errorPaste = document.querySelector('.error.paste')
const pastedData = document.querySelector('#pastedData')
const pastedFiles = document.querySelector('#pastedFiles')
const templatePastedText = document.querySelector('#templatePastedText')
const templatePastedCode = document.querySelector('#templatePastedCode')
const templatePastedFile = document.querySelector('#templatePastedFile')

const TYPE_TEXT = 'type_text'
const TYPE_CODE = 'type_code'
const TYPE_FILE = 'type_file'

typeSelect.addEventListener('change', (e) => {
  if (e.target.value === TYPE_FILE) {
    inputFile.style.display = 'inline-block'
    textarea.style.display = 'none'
    passwordContainer.style.display = 'none'
  } else {
    inputFile.style.display = 'none'
    textarea.style.display = 'inline-block'
    passwordContainer.style.display = 'flex'
  }
})

const decryptData = (id, salt, iv, encryptedMsg) => (e) => {
  e.preventDefault()
  e.stopPropagation()
  const userPassword = prompt('password ?')
  decrypt(userPassword, salt, iv, encryptedMsg)
    .then((msg) => {
      const article = document.getElementById(id)
      article.classList.remove('encrypted')
      article.querySelector('.data').textContent = msg
    })
    .catch((e) => {
      alert('decryption failed, bad password ?')
      console.error(e)
    })
}

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
        const template = item.pre ? templatePastedCode : templatePastedText
        const child = document.importNode(template.content, true)
        const article = child.querySelector('article')
        article.setAttribute('id', item.id)
        if (item.iv && item.salt) {
          article.classList.add('encrypted')
          const decryptLink = child.querySelector('.decrypt')
          decryptLink.addEventListener(
            'click',
            decryptData(item.id, item.salt, item.iv, item.content),
            false
          )
        }
        child.querySelector('.data').textContent = item.content
        const until = child.querySelector('.until')
        until.textContent = until.textContent.replace(
          '{}',
          formatDate(item.until)
        )
        child
          .querySelector('a.removeData')
          .addEventListener('click', removeData(item.id), false)

        fragment.append(child)
      })
      pastedData.appendChild(fragment)
    })

const removeData = (id) => (e) => {
  e.stopPropagation()
  e.preventDefault()
  if (confirm(`remove data ?`)) {
    fetch(`./api/data/${id}`, {
      method: 'DELETE',
    })
      .then((response) => {
        console.log(response)
        fetchData()
      })
      .catch((e) => {
        console.error(e)
      })
  }
}

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

    fetch('./api/files', {
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
  } else if (typeSelect.value === TYPE_TEXT || typeSelect.value === TYPE_CODE) {
    if (textarea.value.length === 0) {
      displayErrorPaste('No data to post')
      return
    }

    Promise.resolve()
      .then(() => {
        const content = textarea.value
        if (passwordInput.value.length === 0) {
          return { content }
        } else {
          return encrypt(passwordInput.value, content)
        }
      })
      .then(({ content, iv, salt }) =>
        fetch('./api/data', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content,
            keep: parseInt(keepSelect.value, 10),
            pre: typeSelect.value === TYPE_CODE,
            iv,
            salt,
          }),
        })
      )
      .then((response) => {
        if (response.status === 200) {
          textarea.value = ''
          passwordInput.value = ''
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

const removeFile = (name, id) => (e) => {
  e.stopPropagation()
  e.preventDefault()
  if (confirm(`remove ${name} ?`)) {
    fetch(`./api/files/${id}`, {
      method: 'DELETE',
    })
      .then((response) => {
        console.log(response)
        fetchFiles()
      })
      .catch((e) => {
        console.error(e)
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
        child
          .querySelector('a.removeFile')
          .addEventListener(
            'click',
            removeFile(file.originalname, file.id),
            false
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
