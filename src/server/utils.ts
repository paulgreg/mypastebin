import type { ParsedQs } from 'qs'

export const ONE_MINUTE_MS = 1000 * 60
export const ONE_HOUR_MS = ONE_MINUTE_MS * 60
export const ONE_DAY_MS = ONE_HOUR_MS * 24
export const ONE_WEEK_MS = ONE_DAY_MS * 7

export const isNumeric = (value: string) => /^-?\d+$/.test(value)

export const isString = (value: unknown) => typeof value === 'string'

interface HasId {
  id: string
}

export const findItem = <T extends HasId>(arr: Array<T>, idToFind: string) =>
  arr.find(({ id }) => id === idToFind)
interface HasId {
  id: string
}

export const filterById = <T extends HasId>(
  arr: Array<T>,
  idToRemove: string
) => arr.filter(({ id }) => id !== idToRemove)

interface HasIdAndUntil {
  id: string
  until: number
}

export const incrementUntilById = <T extends HasIdAndUntil>(
  arr: Array<T>,
  idToInc: string,
  max: number,
  maybeTime?: string | ParsedQs | Array<string | ParsedQs>
) => {
  const time =
    isString(maybeTime) && isNumeric(maybeTime) ? parseInt(maybeTime, 10) : 0
  const item = findItem(arr, idToInc)
  return item
    ? arr.map((item) =>
        item.id === idToInc
          ? {
              ...item,
              until: Math.min(item.until + time, Date.now() + max),
            }
          : item
      )
    : arr
}
