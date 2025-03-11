import { padZero, formatSize, KB, MB, formatDate } from '../../src/client/utils'

describe('utils', () => {
  describe('padZero', () => {
    ;[
      {
        nb: 0,
        expected: '00',
      },
      {
        nb: 5,
        expected: '05',
      },
      {
        nb: 10,
        expected: '10',
      },
    ].forEach(({ nb, expected }) =>
      test(`should return ${expected} for ${nb}`, () =>
        expect(padZero(nb)).toEqual(expected))
    )
  })
  describe('formatSize', () => {
    ;[
      {
        size: 10,
        expected: '10 bytes',
      },
      {
        size: KB - 1,
        expected: '1023 bytes',
      },
      {
        size: KB,
        expected: '1.00 Kb',
      },
      {
        size: 15.25 * KB,
        expected: '15.25 Kb',
      },
      {
        size: MB,
        expected: '1.00 Mb',
      },
      {
        size: 1500.5 * MB,
        expected: '1500.50 Mb',
      },
    ].forEach(({ size, expected }) =>
      test(`should return ${expected} for ${size}`, () =>
        expect(formatSize(size)).toEqual(expected))
    )
  })
  describe('formatDate', () => {
    test('should return today', () => {
      const d = new Date()
      const expected = `${padZero(d.getHours())}:${padZero(
        d.getMinutes()
      )}, today`
      expect(formatDate(d)).toEqual(expected)
    })
    test('should return tomorrow', () => {
      const d = new Date(Date.now() + 86400_000 + 12345)
      const expected = `${padZero(d.getHours())}:${padZero(
        d.getMinutes()
      )}, tomorrow`
      expect(formatDate(d)).toEqual(expected)
    })
    test('should return in 2 days', () => {
      const d = new Date(Date.now() + 2 * 86400_000 + 12345)
      const expected = `${padZero(d.getHours())}:${padZero(
        d.getMinutes()
      )}, in 2 days`
      expect(formatDate(d)).toEqual(expected)
    })
  })
})
