import { DatasType, FilesType } from '../PasteBinTypes.js'
import { decrypt, encrypt } from './crypto.js'
import {
  hideErrorPaste,
  displayErrorPaste,
  formatSize,
  formatDate,
} from './utils'

const origin = import.meta.env.DEV ? 'http://localhost:6080' : '.'

const form = document.querySelector('form') as HTMLFormElement
const textarea = document.querySelector('textarea') as HTMLTextAreaElement
const inputFile = document.querySelector('input[type=file]') as HTMLInputElement
const passwordContainer = document.querySelector(
  '.passwordContainer'
) as HTMLDivElement
const passwordInput = document.querySelector('#password') as HTMLInputElement
const submitButton = document.querySelector(
  'input[type=submit]'
) as HTMLInputElement
const keepSelect = document.querySelector(
  'select[name="keep"]'
) as HTMLSelectElement
const typeSelect = document.querySelector(
  'select[name="type"]'
) as HTMLSelectElement
const errorPaste = document.querySelector(
  '.error.paste'
) as HTMLParagraphElement
const pastedData = document.querySelector('#pastedData') as HTMLDivElement
const pastedFiles = document.querySelector('#pastedFiles') as HTMLDivElement
const templatePastedText = document.querySelector(
  '#templatePastedText'
) as HTMLTemplateElement
const templatePastedCode = document.querySelector(
  '#templatePastedCode'
) as HTMLTemplateElement
const templatePastedFile = document.querySelector(
  '#templatePastedFile'
) as HTMLTemplateElement

const TYPE_TEXT = 'type_text'
const TYPE_CODE = 'type_code'
const TYPE_FILE = 'type_file'

typeSelect.addEventListener('change', (e: Event) => {
  const target = e.target as HTMLSelectElement
  if (target.value === TYPE_FILE) {
    inputFile.style.display = 'inline-block'
    textarea.style.display = 'none'
    passwordContainer.style.display = 'none'
  } else {
    inputFile.style.display = 'none'
    textarea.style.display = 'inline-block'
    passwordContainer.style.display = 'flex'
  }
})

const decryptData = (id: string, salt: string, iv: string) => (e: Event) => {
  e.preventDefault()
  e.stopPropagation()
  const userPassword = prompt('password ?')

  const article = document.getElementById(id)
  const data = article?.querySelector('.data')
  if (!userPassword || !data?.textContent) throw new Error('Can’t continue')
  decrypt(userPassword, salt, iv, data.textContent)
    .then((msg) => {
      article?.classList.remove('encrypted')
      data.textContent = msg
    })
    .catch((e) => {
      alert('decryption failed, bad password ?')
      console.error(e)
    })
}

const fetchData = () =>
  fetch(`${origin}/api/data`)
    .then((response) => response.json())
    .then((data: DatasType) => {
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
        article?.setAttribute('id', item.id)
        if (item.iv && item.salt) {
          article?.classList.add('encrypted')
          const decryptLink = child.querySelector('.decrypt')
          decryptLink?.addEventListener(
            'click',
            decryptData(item.id, item.salt, item.iv),
            false
          )
        }
        const data = child.querySelector('.data')
        if (data) data.textContent = item.content
        const until = child.querySelector('.until')
        if (until?.textContent)
          until.textContent = until.textContent.replace(
            '{}',
            formatDate(item.until)
          )
        child
          .querySelector('a.removeData')
          ?.addEventListener('click', removeData(item.id), false)

        fragment.append(child)
      })
      pastedData.appendChild(fragment)
    })

const removeData = (id: string) => (e: Event) => {
  e.stopPropagation()
  e.preventDefault()
  if (confirm(`remove data ?`)) {
    fetch(`${origin}/api/data/${id}`, {
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

const postDataOrFile = (e: SubmitEvent | KeyboardEvent) => {
  e.stopPropagation()
  e.preventDefault()
  hideErrorPaste(errorPaste)

  if (typeSelect?.value === TYPE_FILE) {
    if (inputFile?.value.length === 0) {
      displayErrorPaste(errorPaste, 'No file to post')
      return
    }

    const files = inputFile?.files ?? []
    const formData = new FormData()
    formData.append('file', files[0])
    formData.append('keep', String(parseInt(keepSelect?.value ?? '0', 10)))

    fetch(`${origin}/api/files`, {
      method: 'POST',
      body: formData,
    })
      .then((response) => {
        if (response.status === 200) {
          inputFile.value = ''
          fetchFiles()
          alert('file posted')
        } else {
          console.log(response)
          displayErrorPaste(errorPaste)
        }
      })
      .catch((e) => {
        console.error(e)
        displayErrorPaste(errorPaste)
      })
  } else if (
    typeSelect?.value === TYPE_TEXT ||
    typeSelect?.value === TYPE_CODE
  ) {
    if (textarea?.value.length === 0) {
      displayErrorPaste(errorPaste, 'No data to post')
      return
    }

    Promise.resolve()
      .then(() => {
        const content = textarea?.value
        if (passwordInput?.value.length === 0) {
          return { content, iv: '', salt: '' }
        } else {
          if (submitButton) submitButton.disabled = true
          return encrypt(passwordInput?.value, content)
        }
      })
      .then(({ content, iv, salt }) => {
        submitButton.disabled = false
        return fetch(`${origin}/api/data`, {
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
      })
      .then((response) => {
        if (response.status === 200) {
          textarea.value = ''
          passwordInput.value = ''
          fetchData()
          alert('data posted')
        } else {
          console.log(response)
          displayErrorPaste(errorPaste)
        }
      })
      .catch((e) => {
        console.error(e)
        displayErrorPaste(errorPaste)
      })
  }
}

const removeFile = (name: string, id: string) => (e: MouseEvent) => {
  e.stopPropagation()
  e.preventDefault()
  if (confirm(`remove ${name} ?`)) {
    fetch(`${origin}/api/files/${id}`, {
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
  fetch(`${origin}/api/files`)
    .then((response) => response.json())
    .then((data: FilesType) => {
      if (!pastedFiles) return
      if (data.length === 0) {
        pastedFiles.innerHTML = 'No file posted'
        return
      }

      pastedFiles.innerHTML = ''

      const fragment = document.createElement('ul')
      data.forEach((file) => {
        if (!templatePastedFile) return
        const child = document.importNode(templatePastedFile.content, true)
        const a = child.querySelector('a')
        if (!a) throw new Error('Missing a')
        a.textContent = file.originalname
        a.setAttribute('href', `${origin}/api/files/${file.id}`)
        const size = child.querySelector('.size')
        if (!size) return
        size.textContent = formatSize(file.size)
        const until = child.querySelector('.until')
        if (!until?.textContent) return
        until.textContent = until.textContent.replace(
          '{}',
          formatDate(file.until)
        )
        const removeLink = child.querySelector(
          'a.removeFile'
        ) as HTMLAnchorElement
        removeLink.addEventListener(
          'click',
          removeFile(file.originalname, file.id),
          false
        )

        fragment.append(child)
      })
      pastedFiles.appendChild(fragment)
    })

textarea?.addEventListener(
  'keydown',
  (e) => {
    if (e.ctrlKey && e.key === 'Enter') postDataOrFile(e)
  },
  false
)

form?.addEventListener('submit', postDataOrFile, false)

fetchData()
fetchFiles()
