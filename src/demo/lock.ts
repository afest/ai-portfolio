// Замочек у переключателя (круг 9): превью следующего кадра не ходит за курсором, а прилипает к левому нижнему углу —
// курсор свободен (в проектах мешало водить мышью по картинке). Общий для главной и галереи проектов, помнится в браузере.
const KEY = 'lp-preview-lock'

export function readLock() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function saveLock(v: boolean) {
  try {
    localStorage.setItem(KEY, v ? '1' : '0')
  } catch { /* без памяти — только на эту загрузку */ }
}
