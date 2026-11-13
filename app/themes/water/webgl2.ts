import { INSTRUMENT_RGB, type VisualFrame, type VisualTheme } from '../types'

/**
 * Agua en WebGL2 (§16.3, §16.16): campo de alturas con ping-pong en texturas half-float.
 * Canales: R = bombo, G = caja, B = platillo, A = pulso neutro (tiempos del compás).
 * El kernel es el de lib/water.ts:  next = (vecinos / 2 − prev) · amortiguación.
 * Devuelve null si el navegador no puede renderizar a texturas flotantes.
 */

const VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`

const MAX_DROPS = 24
/** peso de la onda por instrumento (§16.17, punto 5) */
const WEIGHT: Record<string, number> = { bd: 1, sd: 0.75, hh: 0.5, bass: 0.35, chords: 0.3 }

const SIM_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uCur;
uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform float uDamp;
uniform float uAspect;
uniform int uCount;
uniform vec4 uDrop[${MAX_DROPS}];   // x, y (uv), radio (uv en y), cantidad
uniform vec4 uMask[${MAX_DROPS}];   // canales
out vec4 o;
void main() {
  vec4 n = texture(uCur, vUv + vec2(uTexel.x, 0.0)) + texture(uCur, vUv - vec2(uTexel.x, 0.0))
         + texture(uCur, vUv + vec2(0.0, uTexel.y)) + texture(uCur, vUv - vec2(0.0, uTexel.y));
  vec4 next = (n * 0.5 - texture(uPrev, vUv)) * uDamp;
  for (int i = 0; i < ${MAX_DROPS}; i++) {
    if (i >= uCount) break;
    vec2 d = vUv - uDrop[i].xy;
    d.x *= uAspect;
    float r = uDrop[i].z;
    next += uMask[i] * uDrop[i].w * exp(-dot(d, d) / (r * r));
  }
  // bordes absorbentes suaves
  vec2 e = min(vUv, 1.0 - vUv);
  next *= smoothstep(0.0, 0.02, min(e.x, e.y));
  // nunca se desborda (half-float) aunque lleguen muchas gotas seguidas
  o = clamp(next, -1.5, 1.5);
}`

const RENDER_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uCur;
uniform vec2 uTexel;
uniform vec3 uBd;
uniform vec3 uSd;
uniform vec3 uHh;
uniform float uDim;
out vec4 o;
float total(vec2 p) { vec4 h = texture(uCur, p); return h.r + h.g + h.b + h.a; }
void main() {
  vec4 h = texture(uCur, vUv);
  float dx = total(vUv + vec2(uTexel.x, 0.0)) - total(vUv - vec2(uTexel.x, 0.0));
  float dy = total(vUv + vec2(0.0, uTexel.y)) - total(vUv - vec2(0.0, uTexel.y));
  vec3 normal = normalize(vec3(-dx * 1.6, -dy * 1.6, 1.0));
  vec3 light = normalize(vec3(-0.4, 0.6, 0.7));
  float spec = pow(max(dot(reflect(-light, normal), vec3(0.0, 0.0, 1.0)), 0.0), 32.0);
  vec3 base = vec3(0.043, 0.043, 0.059);
  vec3 col = base
    + uBd * smoothstep(0.0, 0.7, abs(h.r)) * 0.62
    + uSd * smoothstep(0.0, 0.7, abs(h.g)) * 0.62
    + uHh * smoothstep(0.0, 0.7, abs(h.b)) * 0.62
    + vec3(1.0) * smoothstep(0.0, 0.8, abs(h.a)) * 0.12
    + vec3(spec) * 0.12;
  // viñeta muy suave
  vec2 c = vUv - 0.5;
  col *= 1.0 - dot(c, c) * 0.35;
  o = vec4(mix(base, col, uDim), 1.0);
}`

interface Drop {
  x: number
  y: number
  r: number
  amount: number
  mask: [number, number, number, number]
}

function compile(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const make = (type: number, src: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
    return s
  }
  const p = gl.createProgram()!
  gl.attachShader(p, make(gl.VERTEX_SHADER, vs))
  gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs))
  gl.bindAttribLocation(p, 0, 'aPos')
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link')
  return p
}

export function createWaterWebGL2(): VisualTheme | null {
  let gl: WebGL2RenderingContext | null = null
  let canvas: HTMLCanvasElement | null = null
  let sim: WebGLProgram | null = null
  let render: WebGLProgram | null = null
  let tex: WebGLTexture[] = []
  let fbo: WebGLFramebuffer[] = []
  let iPrev = 0
  let iCur = 1
  let iNext = 2
  let sw = 0
  let sh = 0
  let cssW = 1
  let cssH = 1
  let dpr = 1
  let quality = 1
  let accumulator = 0
  let lastT = 0
  let queue: Drop[] = []
  let failed = false

  const uv = (x: number, y: number) => ({ x: x / cssW, y: 1 - y / cssH })
  const radius = (px: number) => px / cssH

  function push(x: number, y: number, rPx: number, amount: number, mask: Drop['mask']) {
    const p = uv(x, y)
    queue.push({ x: p.x, y: p.y, r: radius(rPx), amount, mask })
    if (queue.length > 200) queue.splice(0, queue.length - 200)
  }

  const MASK = { bd: [1, 0, 0, 0], sd: [0, 1, 0, 0], hh: [0, 0, 1, 0], neutral: [0, 0, 0, 1] } as const
  const maskOf = (i: string): Drop['mask'] =>
    [...((MASK as Record<string, readonly number[]>)[i] ?? MASK.neutral)] as Drop['mask']

  function allocate() {
    if (!gl) return
    const long = Math.round(256 * quality)
    const aspect = cssW / cssH
    sw = aspect >= 1 ? long : Math.max(32, Math.round(long * aspect))
    sh = aspect >= 1 ? Math.max(32, Math.round(long / aspect)) : long
    for (const t of tex) gl.deleteTexture(t)
    for (const f of fbo) gl.deleteFramebuffer(f)
    tex = []
    fbo = []
    for (let i = 0; i < 3; i++) {
      const t = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, sw, sh, 0, gl.RGBA, gl.HALF_FLOAT, null)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      const f = gl.createFramebuffer()!
      gl.bindFramebuffer(gl.FRAMEBUFFER, f)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0)
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('fbo half-float')
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      tex.push(t)
      fbo.push(f)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  function simStep() {
    if (!gl || !sim) return
    gl.useProgram(sim)
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[iNext]!)
    gl.viewport(0, 0, sw, sh)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex[iCur]!)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, tex[iPrev]!)
    gl.uniform1i(gl.getUniformLocation(sim, 'uCur'), 0)
    gl.uniform1i(gl.getUniformLocation(sim, 'uPrev'), 1)
    gl.uniform2f(gl.getUniformLocation(sim, 'uTexel'), 1 / sw, 1 / sh)
    gl.uniform1f(gl.getUniformLocation(sim, 'uDamp'), 0.976)
    gl.uniform1f(gl.getUniformLocation(sim, 'uAspect'), cssW / cssH)
    const batch = queue.splice(0, MAX_DROPS)
    gl.uniform1i(gl.getUniformLocation(sim, 'uCount'), batch.length)
    if (batch.length) {
      gl.uniform4fv(gl.getUniformLocation(sim, 'uDrop'), batch.flatMap((d) => [d.x, d.y, d.r, d.amount]))
      gl.uniform4fv(gl.getUniformLocation(sim, 'uMask'), batch.flatMap((d) => d.mask))
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    ;[iPrev, iCur, iNext] = [iCur, iNext, iPrev]
  }

  function draw(dim: number) {
    if (!gl || !render || !canvas) return
    gl.useProgram(render)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex[iCur]!)
    gl.uniform1i(gl.getUniformLocation(render, 'uCur'), 0)
    gl.uniform2f(gl.getUniformLocation(render, 'uTexel'), 1 / sw, 1 / sh)
    gl.uniform3fv(gl.getUniformLocation(render, 'uBd'), INSTRUMENT_RGB.bd)
    gl.uniform3fv(gl.getUniformLocation(render, 'uSd'), INSTRUMENT_RGB.sd)
    gl.uniform3fv(gl.getUniformLocation(render, 'uHh'), INSTRUMENT_RGB.hh)
    gl.uniform1f(gl.getUniformLocation(render, 'uDim'), dim)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  // comprobación previa: ¿hay WebGL2 con render a half-float?
  {
    const probe = document.createElement('canvas').getContext('webgl2')
    if (!probe || !(probe.getExtension('EXT_color_buffer_float') || probe.getExtension('EXT_color_buffer_half_float')))
      return null
    probe.getExtension('WEBGL_lose_context')?.loseContext()
  }

  return {
    id: 'water',
    label: 'Agua',
    renderer: () => (failed ? 'webgl2 (fallido)' : `webgl2 ${sw}×${sh}`),
    mount(c, opts) {
      canvas = c
      dpr = opts.dpr
      gl = c.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: false })
      if (!gl) throw new Error('webgl2')
      gl.getExtension('EXT_color_buffer_float') ?? gl.getExtension('EXT_color_buffer_half_float')
      sim = compile(gl, VS, SIM_FS)
      render = compile(gl, VS, RENDER_FS)
      // triángulo que cubre la pantalla
      const buf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    },
    resize(width, height, d) {
      cssW = Math.max(1, width)
      cssH = Math.max(1, height)
      dpr = d
      if (!canvas) return
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      allocate()
    },
    setQuality(q) {
      const next = Math.min(1, Math.max(0.5, q))
      if (Math.abs(next - quality) < 0.01) return
      quality = next
      allocate()
    },
    beat(e) {
      // algo más flojo que antes: el aro lleva el tiempo (spec 003, E1.1)
      const k = e.scale ?? 1
      push(e.x, e.y, (e.downbeat ? 24 : 14) * k, (e.downbeat ? 0.5 : 0.15) * Math.sqrt(k), maskOf('neutral'))
    },
    hit(e) {
      const m = maskOf(e.instrument)
      if (e.kind === 'heard') return push(e.x, e.y, 6, 0.35, m)
      // el bombo, la onda más fuerte y ancha; el platillo, la más ligera
      const w = WEIGHT[e.instrument] ?? 0.4
      push(e.x, e.y, 7 + 7 * w, 0.75 * w * e.strength, m)
    },
    birth(e) {
      push(e.x, e.y, 20, 1.1, maskOf(e.instrument))
    },
    frame(f: VisualFrame) {
      if (!gl || failed) return
      const t = performance.now() / 1000
      const dt = lastT ? Math.min(0.1, t - lastT) : 1 / 60
      lastT = t
      // paso fijo de 60 Hz (máximo 3 por frame)
      accumulator += dt
      let steps = 0
      while (accumulator >= 1 / 60 && steps < 3) {
        simStep()
        accumulator -= 1 / 60
        steps++
      }
      if (steps === 3) accumulator = 0
      // el filtro cerrado oscurece un poco el agua (respuesta visual del gesto)
      draw(0.55 + 0.45 * f.fx.filter)
    },
    dispose() {
      if (gl) {
        for (const t of tex) gl.deleteTexture(t)
        for (const fb of fbo) gl.deleteFramebuffer(fb)
        gl.getExtension('WEBGL_lose_context')?.loseContext()
      }
      gl = null
      canvas = null
      queue = []
    },
  }
}
