import {
  ContentTypeEnum,
  ClientFilesType,
  ClientFileType,
  DatasType,
} from '../PasteBinTypes.js'
import { decrypt, decryptBuffer, encrypt, encryptBuffer } from './crypto.js'
import { formatSize, formatDate } from './client.utils.js'
import { MAX_FILE_SIZE } from '../constants.js'

const origin = import.meta.env.DEV ? 'http://localhost:6080' : '.'

const form = document.querySelector('#pastebin form') as HTMLFormElement
const details = document.querySelector(
  '#pastebin details'
) as HTMLDetailsElement
const textarea = document.querySelector('textarea') as HTMLTextAreaElement
const inputFile = document.querySelector('input[type=file]') as HTMLInputElement
const titleInput = document.querySelector('#title') as HTMLInputElement
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
const dialog = document.querySelector('dialog') as HTMLDialogElement
const dialogMessage = dialog.querySelector('p') as HTMLParagraphElement

const TYPE_TEXT = 'type_text'
const TYPE_CODE = 'type_code'
const TYPE_FILE = 'type_file'

typeSelect.addEventListener('change', (e: Event) => {
  const target = e.target as HTMLSelectElement
  if (target.value === TYPE_FILE) {
    inputFile.style.display = 'inline-block'
    textarea.style.display = 'none'
    passwordContainer.style.display = 'flex'
  } else {
    inputFile.style.display = 'none'
    textarea.style.display = 'inline-block'
    passwordContainer.style.display = 'flex'
  }
})

const closeDetails = () => details.removeAttribute('open')

const displayMessage = (msg: string, error: boolean) => {
  dialogMessage.innerText = msg
  dialogMessage.classList[error ? 'add' : 'remove']('error')
  dialog.showModal()
}

const parseOptionalTitle = (value: string) => {
  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : undefined
}

const setTemplateTitle = (element: ParentNode, title?: string) => {
  const titleEl = element.querySelector('.title') as HTMLElement | null
  if (!titleEl) return
  if (title) {
    titleEl.textContent = title
    titleEl.style.removeProperty('display')
  } else {
    titleEl.textContent = ''
    titleEl.style.display = 'none'
  }
}

const downloadAsFile = (
  content: ArrayBuffer,
  fileName: string,
  mimeType: string
) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

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
      displayMessage('decryption failed, bad password ?', true)
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

      closeDetails()

      pastedData.innerHTML = ''

      const fragment = new DocumentFragment()

      data.forEach((item) => {
        const template = item.pre ? templatePastedCode : templatePastedText
        const child = document.importNode(template.content, true)
        setTemplateTitle(child, item.title)
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
          ?.addEventListener(
            'click',
            removeDataOrFile(ContentTypeEnum.data, item.id),
            false
          )

        child
          .querySelectorAll('a.add')
          .forEach((addEl) =>
            addEl.addEventListener(
              'click',
              keepDataOrFile(ContentTypeEnum.data, item.id),
              false
            )
          )

        fragment.append(child)
      })
      pastedData.appendChild(fragment)
    })

const postFile = (file: File, keep: number, title?: string) => {
  if (file.size > MAX_FILE_SIZE) {
    displayMessage('File too large, max 250 Mb', true)
    return
  }

  submitButton.disabled = true

  Promise.resolve()
    .then(() => {
      if (passwordInput?.value.length === 0) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('keep', String(keep))
        if (title) {
          formData.append('title', title)
        }
        return fetch(`${origin}/api/file`, {
          method: 'POST',
          body: formData,
        })
      }

      return file
        .arrayBuffer()
        .then((content) => encryptBuffer(passwordInput.value, content))
        .then(({ content, iv, salt }) =>
          fetch(`${origin}/api/file/encrypted`, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              originalname: file.name,
              mimetype: file.type || 'application/octet-stream',
              content,
              title,
              keep,
              iv,
              salt,
            }),
          })
        )
    })
    .then((response) => {
      submitButton.disabled = false
      if (response.status === 200) {
        inputFile.value = ''
        titleInput.value = ''
        passwordInput.value = ''
        fetchFiles()
        displayMessage('file posted', false)
      } else {
        throw new Error(`error: ${response.status}`)
      }
    })
    .catch((e) => {
      submitButton.disabled = false
      console.error(e)
      displayMessage('Error while posting file', true)
    })
}

const decryptAndDownloadFile = (file: ClientFileType) => (e: Event) => {
  e.preventDefault()
  e.stopPropagation()
  const userPassword = prompt('password ?')
  if (!userPassword || !file.iv || !file.salt) return

  fetch(`${origin}/api/file/${file.id}`)
    .then((response) => {
      if (response.status !== 200) {
        throw new Error(`error: ${response.status}`)
      }
      return response.arrayBuffer()
    })
    .then((encryptedContent) =>
      decryptBuffer(
        userPassword,
        file.salt ?? '',
        file.iv ?? '',
        encryptedContent
      )
    )
    .then((decryptedContent) => {
      downloadAsFile(decryptedContent, file.originalname, file.mimetype)
    })
    .catch((e) => {
      console.error(e)
      displayMessage('decryption failed, bad password ?', true)
    })
}

const postDataOrFile = (e: SubmitEvent | KeyboardEvent) => {
  e.stopPropagation()
  e.preventDefault()

  if (typeSelect?.value === TYPE_FILE) {
    if (inputFile?.value.length === 0) {
      displayMessage('No file to post', true)
      return
    }

    const file = inputFile?.files?.[0]
    if (!file) {
      displayMessage('No file to post', true)
      return
    }

    const title = parseOptionalTitle(titleInput.value) ?? file.name
    postFile(file, Number.parseInt(keepSelect?.value ?? '0', 10) * 1000, title)
  } else if (
    typeSelect?.value === TYPE_TEXT ||
    typeSelect?.value === TYPE_CODE
  ) {
    if (textarea?.value.length === 0) {
      displayMessage('No data to post', true)
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
            title: parseOptionalTitle(titleInput.value),
            content,
            keep: Number.parseInt(keepSelect.value, 10) * 1000,
            pre: typeSelect.value === TYPE_CODE,
            iv,
            salt,
          }),
        })
      })
      .then((response) => {
        if (response.status === 200) {
          textarea.value = ''
          titleInput.value = ''
          passwordInput.value = ''
          fetchData()
          displayMessage('data posted', false)
        } else {
          throw new Error(`error: ${response.status}`)
        }
      })
      .catch((e) => {
        console.error(e)
        displayMessage('Error while posting data', true)
      })
  }
}

const keepDataOrFile = (type: ContentTypeEnum, id: string) => (e: Event) => {
  e.stopPropagation()
  e.preventDefault()
  const target = e.target as HTMLAnchorElement
  const time = Number.parseInt(target.dataset.time ?? '0', 10) * 1000
  fetch(`${origin}/api/${type}/keep/${id}?time=${time}`, {
    method: 'GET',
  })
    .then(() => {
      if (type === ContentTypeEnum.data) fetchData()
      else if (type === ContentTypeEnum.file) fetchFiles()
    })
    .catch((e) => {
      console.error(e)
    })
}

const removeDataOrFile =
  (type: ContentTypeEnum, id: string, name?: string) => (e: Event) => {
    e.stopPropagation()
    e.preventDefault()
    if (confirm(`remove ${name ?? 'data'} ?`)) {
      fetch(`${origin}/api/${type}/${id}`, {
        method: 'DELETE',
      })
        .then(() => {
          if (type === ContentTypeEnum.data) fetchData()
          else if (type === ContentTypeEnum.file) fetchFiles()
        })
        .catch((e) => {
          console.error(e)
        })
    }
  }

const fetchFiles = () =>
  fetch(`${origin}/api/files`)
    .then((response) => response.json())
    .then((data: ClientFilesType) => {
      if (data.length === 0) {
        pastedFiles.innerHTML = 'No file posted'
        return
      }
      closeDetails()

      pastedFiles.innerHTML = ''

      const fragment = document.createElement('ul')
      data.forEach((file) => {
        const child = document.importNode(templatePastedFile.content, true)
        setTemplateTitle(child, file.title ?? file.originalname)
        const a = child.querySelector('a.pastedFile') as HTMLAnchorElement
        if (!a) throw new Error('Missing a')
        const encrypted = !!file.iv && !!file.salt
        a.textContent = `${file.originalname}${encrypted ? ' (encrypted)' : ''}`
        if (encrypted) {
          a.setAttribute('href', '#')
          a.removeAttribute('target')
          a.addEventListener('click', decryptAndDownloadFile(file), false)
        } else {
          a.setAttribute('href', `${origin}/api/file/${file.id}`)
        }
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
          removeDataOrFile(ContentTypeEnum.file, file.id),
          false
        )

        child
          .querySelectorAll('a.add')
          .forEach((addEl) =>
            addEl.addEventListener(
              'click',
              keepDataOrFile(ContentTypeEnum.file, file.id),
              false
            )
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

inputFile?.addEventListener('change', () => {
  const file = inputFile.files?.[0]
  if (!file) return
  titleInput.value = file.name
})

fetchData()
fetchFiles()
