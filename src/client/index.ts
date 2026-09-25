import {
  ContentTypeEnum,
  ClientFilesType,
  DatasType,
} from '../PasteBinTypes.js'
import { decrypt, decryptBuffer, encrypt, encryptBuffer } from './crypto.js'
import { formatSize, formatDate } from './client.utils.js'
import { MAX_FILE_SIZE } from '../constants.js'

const origin = import.meta.env.DEV ? 'http://localhost:6080' : '.'

const form = document.querySelector('#pastebin form') as HTMLFormElement
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
const pastedItems = document.querySelector('#pastedItems') as HTMLDivElement
const templatePastedItem = document.querySelector(
  '#templatePastedItem'
) as HTMLTemplateElement

const messageDialog = document.querySelector('#messageDialog') as HTMLDialogElement
const messageDialogText = messageDialog.querySelector('p') as HTMLParagraphElement

const contentDialog = document.querySelector('#contentDialog') as HTMLDialogElement
const contentDialogTitle = document.querySelector(
  '#contentDialogTitle'
) as HTMLHeadingElement
const contentDialogBody = document.querySelector(
  '#contentDialogBody'
) as HTMLPreElement
const closeContentDialogButton = document.querySelector(
  '#closeContentDialog'
) as HTMLButtonElement

const TYPE_TEXT = 'type_text'
const TYPE_CODE = 'type_code'
const TYPE_FILE = 'type_file'

type UnifiedDataItem = {
  itemType: ContentTypeEnum.data
  id: string
  title?: string
  content: string
  until: number
  kind: 'text' | 'code'
  encrypted: boolean
  iv?: string
  salt?: string
}

type UnifiedFileItem = {
  itemType: ContentTypeEnum.file
  id: string
  title?: string
  originalname: string
  mimetype: string
  size: number
  until: number
  kind: 'file'
  encrypted: boolean
  iv?: string
  salt?: string
}

type UnifiedItem = UnifiedDataItem | UnifiedFileItem

typeSelect.addEventListener('change', (e: Event) => {
  const target = e.target as HTMLSelectElement
  if (target.value === TYPE_FILE) {
    inputFile.style.display = 'inline-block'
    textarea.style.display = 'none'
  } else {
    inputFile.style.display = 'none'
    textarea.style.display = 'inline-block'
  }
  passwordContainer.style.display = 'flex'
})

const displayMessage = (msg: string, error: boolean) => {
  messageDialogText.innerText = msg
  messageDialogText.classList[error ? 'add' : 'remove']('error')
  messageDialog.showModal()
}

const parseOptionalTitle = (value: string) => {
  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : undefined
}

const setTemplateTitle = (titleEl: HTMLElement, title: string) => {
  titleEl.textContent = title
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

const openContentDialog = (title: string, content: string) => {
  contentDialogTitle.textContent = title
  contentDialogBody.textContent = content
  contentDialog.showModal()
}

closeContentDialogButton.addEventListener('click', () => {
  contentDialog.close()
})

contentDialog.addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  if (target === contentDialog) {
    contentDialog.close()
  }
})

const downloadFile = (file: UnifiedFileItem) => {
  if (file.encrypted && file.iv && file.salt) {
    const userPassword = prompt('password ?')
    if (!userPassword) return
    fetch(`${origin}/api/file/${file.id}`)
      .then((response) => {
        if (response.status !== 200) {
          throw new Error(`error: ${response.status}`)
        }
        return response.arrayBuffer()
      })
      .then((encryptedContent) =>
        decryptBuffer(userPassword, file.salt ?? '', file.iv ?? '', encryptedContent)
      )
      .then((decryptedContent) => {
        downloadAsFile(decryptedContent, file.originalname, file.mimetype)
      })
      .catch((e) => {
        console.error(e)
        displayMessage('decryption failed, bad password ?', true)
      })
    return
  }

  const link = document.createElement('a')
  link.href = `${origin}/api/file/${file.id}`
  link.download = file.originalname
  document.body.appendChild(link)
  link.click()
  link.remove()
}

const fetchItems = () =>
  Promise.all([
    fetch(`${origin}/api/data`).then((response) => response.json() as Promise<DatasType>),
    fetch(`${origin}/api/files`).then(
      (response) => response.json() as Promise<ClientFilesType>
    ),
  ])
    .then(([datas, files]) => {
      const dataItems: Array<UnifiedDataItem> = datas.map((item) => ({
        itemType: ContentTypeEnum.data,
        id: item.id,
        title: item.title,
        content: item.content,
        until: item.until,
        kind: item.pre ? 'code' : 'text',
        encrypted: Boolean(item.iv && item.salt),
        iv: item.iv,
        salt: item.salt,
      }))

      const fileItems: Array<UnifiedFileItem> = files.map((file) => ({
        itemType: ContentTypeEnum.file,
        id: file.id,
        title: file.title,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        until: file.until,
        kind: 'file',
        encrypted: Boolean(file.iv && file.salt),
        iv: file.iv,
        salt: file.salt,
      }))

      const items: Array<UnifiedItem> = [...dataItems, ...fileItems].sort(
        (a, b) => a.until - b.until
      )

      if (items.length === 0) {
        pastedItems.textContent = 'No item posted'
        return
      }

      pastedItems.innerHTML = ''
      const fragment = new DocumentFragment()

      items.forEach((item) => {
        const child = document.importNode(templatePastedItem.content, true)
        const article = child.querySelector('article') as HTMLElement | null
        const cardMain = child.querySelector('.cardMain') as HTMLButtonElement | null
        const kind = child.querySelector('.kind') as HTMLElement | null
        const title = child.querySelector('.title') as HTMLElement | null
        const meta = child.querySelector('.meta') as HTMLElement | null
        const preview = child.querySelector('.preview') as HTMLElement | null
        const until = child.querySelector('.until') as HTMLElement | null
        const removeLink = child.querySelector('.removeItem') as HTMLAnchorElement | null

        if (!article || !cardMain || !kind || !title || !meta || !preview || !until) {
          return
        }

        article.setAttribute('id', item.id)
        kind.textContent = item.kind
        until.textContent = until.textContent?.replace('{}', formatDate(item.until)) ?? ''

        if (item.itemType === ContentTypeEnum.file) {
          setTemplateTitle(title, item.title ?? item.originalname)
          meta.textContent = `${item.originalname} • ${formatSize(item.size)}${
            item.encrypted ? ' • encrypted' : ''
          }`
          preview.textContent = 'Click to download file'
          cardMain.addEventListener('click', () => downloadFile(item), false)
        } else {
          setTemplateTitle(
            title,
            item.title ?? (item.kind === 'code' ? 'Untitled code' : 'Untitled text')
          )
          meta.textContent = `${item.content.length} chars${
            item.encrypted ? ' • encrypted' : ''
          }`
          preview.textContent = item.encrypted ? 'Encrypted content' : item.content

          if (item.encrypted) {
            article.classList.add('encrypted')
          }

          cardMain.addEventListener(
            'click',
            () => {
              if (item.encrypted && item.iv && item.salt) {
                const userPassword = prompt('password ?')
                if (!userPassword) return

                decrypt(userPassword, item.salt, item.iv, item.content)
                  .then((msg) => {
                    item.content = msg
                    item.encrypted = false
                    article.classList.remove('encrypted')
                    preview.textContent = msg
                    meta.textContent = `${msg.length} chars`
                  })
                  .catch((error) => {
                    displayMessage('decryption failed, bad password ?', true)
                    console.error(error)
                  })
                return
              }

              openContentDialog(title.textContent ?? 'Untitled', item.content)
            },
            false
          )
        }

        removeLink?.addEventListener(
          'click',
          removeDataOrFile(
            item.itemType,
            item.id,
            item.itemType === ContentTypeEnum.file
              ? item.originalname
              : title.textContent ?? 'data'
          ),
          false
        )

        child
          .querySelectorAll('a.add')
          .forEach((addEl) =>
            addEl.addEventListener(
              'click',
              keepDataOrFile(item.itemType, item.id),
              false
            )
          )

        fragment.append(child)
      })

      pastedItems.appendChild(fragment)
    })
    .catch((e) => {
      console.error(e)
      displayMessage('Failed to refresh list', true)
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
        fetchItems()
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
          fetchItems()
          displayMessage('data posted', false)
        } else {
          throw new Error(`error: ${response.status}`)
        }
      })
      .catch((error) => {
        console.error(error)
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
      fetchItems()
    })
    .catch((error) => {
      console.error(error)
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
          fetchItems()
        })
        .catch((error) => {
          console.error(error)
        })
    }
  }

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

fetchItems()
