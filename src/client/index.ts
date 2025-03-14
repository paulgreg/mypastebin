import {
  ContentTypeEnum,
  ClientFilesType,
  DatasType,
} from '../PasteBinTypes.js'
import { decrypt, encrypt } from './crypto.js'
import { formatSize, formatDate } from './client.utils.js'

const origin = import.meta.env.DEV ? 'http://localhost:6080' : '.'

const form = document.querySelector('form#pastebin') as HTMLFormElement
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
    passwordContainer.style.display = 'none'
  } else {
    inputFile.style.display = 'none'
    textarea.style.display = 'inline-block'
    passwordContainer.style.display = 'flex'
  }
})

const displayMessage = (msg: string, error: boolean) => {
  dialogMessage.innerText = msg
  dialogMessage.classList[error ? 'add' : 'remove']('error')
  dialog.showModal()
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

const postDataOrFile = (e: SubmitEvent | KeyboardEvent) => {
  e.stopPropagation()
  e.preventDefault()

  if (typeSelect?.value === TYPE_FILE) {
    if (inputFile?.value.length === 0) {
      displayMessage('No file to post', true)
      return
    }

    const files = inputFile?.files ?? []
    const formData = new FormData()
    formData.append('file', files[0])
    formData.append(
      'keep',
      String(parseInt(keepSelect?.value ?? '0', 10) * 1000)
    )

    fetch(`${origin}/api/files`, {
      method: 'POST',
      body: formData,
    })
      .then((response) => {
        if (response.status === 200) {
          inputFile.value = ''
          fetchFiles()
          displayMessage('file posted', false)
        } else {
          throw new Error(`error: ${response.status}`)
        }
      })
      .catch((e) => {
        console.error(e)
        displayMessage('Error while posting file', true)
      })
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
            content,
            keep: parseInt(keepSelect.value, 10) * 1000,
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
  const time = parseInt(target.dataset.time ?? '0', 10) * 1000
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
          removeDataOrFile(ContentTypeEnum.file, file.originalname, file.id),
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

fetchData()
fetchFiles()
