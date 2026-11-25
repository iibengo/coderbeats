import { beforeEach, describe, expect, it, vi } from 'vitest'
import { detectInApp, isIos, silentWavDataUri } from '../../app/lib/inApp'
import { resetUnlockForTests, unlockIosAudio } from '../../app/composables/useAudioUnlock'

const IG = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21E219 Instagram 330.0.0.20.113 (iPhone14,5; iOS 17_4; es_ES; es; scale=3.00; 1170x2532; 568271124)'
const FB = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21E219 [FBAN/FBIOS;FBAV/450.0.0.38.108;FBBV/573546812]'
const TT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21E219 musical_ly_33.1.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/es'
const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const CHROME = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

describe('navegadores internos (spec 062)', () => {
  it('reconoce Instagram, Facebook y TikTok, y no los navegadores normales', () => {
    expect(detectInApp(IG)).toBe('instagram')
    expect(detectInApp(FB)).toBe('facebook')
    expect(detectInApp(TT)).toBe('tiktok')
    expect(detectInApp(SAFARI)).toBeNull()
    expect(detectInApp(CHROME)).toBeNull()
    expect(detectInApp('')).toBeNull()
    expect(detectInApp(undefined as never)).toBeNull()
  })
  it('iPhone, iPad y el iPad que se hace pasar por Mac', () => {
    expect(isIos(SAFARI)).toBe(true)
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15', 5)).toBe(true)
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15', 0)).toBe(false)
    expect(isIos(CHROME)).toBe(false)
  })
  it('el WAV mudo es un WAV válido y de verdad silencioso', () => {
    const uri = silentWavDataUri(0.5)
    expect(uri.startsWith('data:audio/wav;base64,')).toBe(true)
    const b = Uint8Array.from(atob(uri.split(',')[1]!), (c) => c.charCodeAt(0))
    expect(String.fromCharCode(...b.slice(0, 4))).toBe('RIFF')
    expect(String.fromCharCode(...b.slice(8, 12))).toBe('WAVE')
    expect(b.length).toBe(44 + 4000)
    expect(b.slice(44).every((x) => x === 128)).toBe(true)
    expect(uri.length).toBeLessThan(7000)
  })
})

describe('desbloqueo del audio en el primer toque (spec 062)', () => {
  beforeEach(() => resetUnlockForTests())
  it('con audioSession: tipo «playback» y no reproduce nada', () => {
    const audioSession = { type: 'auto' }
    const make = vi.fn()
    expect(unlockIosAudio({ nav: { audioSession, userAgent: SAFARI }, makeAudio: make })).toBe('audioSession')
    expect(audioSession.type).toBe('playback')
    expect(make).not.toHaveBeenCalled()
  })
  it('sin audioSession en iOS: un audio mudo en bucle', () => {
    const play = vi.fn(() => Promise.resolve())
    const a = { loop: false, setAttribute: vi.fn(), play }
    expect(unlockIosAudio({ nav: { userAgent: IG }, makeAudio: () => a })).toBe('silentAudio')
    expect(a.loop).toBe(true)
    expect(a.setAttribute).toHaveBeenCalledWith('playsinline', '')
    expect(play).toHaveBeenCalledOnce()
  })
  it('fuera de iOS y sin audioSession no hace nada', () => {
    const make = vi.fn()
    expect(unlockIosAudio({ nav: { userAgent: CHROME }, makeAudio: make })).toBe('none')
    expect(make).not.toHaveBeenCalled()
  })
  it('una sola vez, y si el navegador no deja (play rechaza o lanza) no falla', async () => {
    const play = vi.fn(() => Promise.reject(new Error('NotAllowedError')))
    const a = { loop: false, play }
    expect(unlockIosAudio({ nav: { userAgent: SAFARI }, makeAudio: () => a })).toBe('silentAudio')
    await Promise.resolve()
    expect(unlockIosAudio({ nav: { userAgent: SAFARI }, makeAudio: () => a })).toBe('silentAudio') // el rechazo lo reabre: se reintenta en el siguiente toque
    expect(play).toHaveBeenCalledTimes(2)
    resetUnlockForTests()
    expect(unlockIosAudio({ nav: { userAgent: SAFARI }, makeAudio: () => { throw new Error('sin Audio') } })).toBe('none')
  })
})
