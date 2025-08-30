type ShaderSetterFunction
  = | ((value: number) => void)
    | ((x: number, y: number) => void)
    | ((x: number, y: number, z: number) => void)
    | ((x: number, y: number, z: number, w: number) => void)
    | ((mat: Float32Array) => void)
    | (() => void)

interface ExtendedWebGLActiveInfo extends WebGLActiveInfo {
  set?: ShaderSetterFunction
  get?: () => unknown
  loc?: WebGLUniformLocation | null
  glTexture?: number
}

export default class ShaderProgram {
  private gl: WebGLRenderingContext
  private vertexShader: WebGLShader | null
  private fragmentShader: WebGLShader | null
  private program: WebGLProgram | null
  public uniforms: ExtendedWebGLActiveInfo[]
  public attributes: string[]
  [key: string]: unknown

  location_position!: number
  location_texCoord!: number
  set_source!: (value: number) => void
  set_alpha?: (value: number) => void

  constructor (gl: WebGLRenderingContext, vertexShaderSource: string, fragmentShaderSource: string) {
    this.gl = gl
    this.vertexShader = this.compileShader(vertexShaderSource, false)
    this.fragmentShader = this.compileShader(fragmentShaderSource, true)
    this.program = gl.createProgram()
    let err = ''

    if (!this.program || !this.vertexShader || !this.fragmentShader) {
      throw new Error('Failed to create shader program or shaders')
    }

    gl.attachShader(this.program, this.vertexShader)
    let err2 = gl.getShaderInfoLog(this.vertexShader)
    if (err2) {
      err += `Vertex shader error: ${err2}\n`
    }
    gl.attachShader(this.program, this.fragmentShader)
    err2 = gl.getShaderInfoLog(this.fragmentShader)
    if (err2) {
      err += `Fragment shader error: ${err2}\n`
    }

    gl.linkProgram(this.program)

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      err += gl.getProgramInfoLog(this.program)
      gl.deleteProgram(this.program)
      gl.deleteShader(this.vertexShader)
      gl.deleteShader(this.fragmentShader)
      throw new Error(`Could not initialise shader: ${err}`)
    }

    gl.useProgram(this.program)

    const numUniforms = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS)
    this.uniforms = []
    let i: number
    let info: WebGLActiveInfo | null
    let name: string
    let loc: WebGLUniformLocation | null
    for (i = 0; i < numUniforms; ++i) {
      info = gl.getActiveUniform(this.program, i)
      if (!info) continue

      name = info.name
      loc = gl.getUniformLocation(this.program, name)
      if (!loc) continue

      const extendedInfo = info as ExtendedWebGLActiveInfo;
      (loc as WebGLUniformLocation & { name?: string }).name = name
      extendedInfo.set = this[`set_${name}`] = this.makeShaderSetter(extendedInfo, loc)
      extendedInfo.get = this[`get_${name}`] = this.makeShaderGetter(loc)
      extendedInfo.loc = this[`location_${name}`] = loc
      this.uniforms.push(extendedInfo)
    }

    const numAttribs = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES)
    this.attributes = []
    for (i = 0; i < numAttribs; ++i) {
      info = gl.getActiveAttrib(this.program, i)
      if (!info) continue

      name = info.name
      loc = gl.getAttribLocation(this.program, name)
      this[`location_${name}`] = loc
      this.attributes.push(name)
    }
  }

  compileShader (source: string, fragment: boolean): WebGLShader {
    const { gl } = this
    const shader = fragment ? gl.createShader(gl.FRAGMENT_SHADER) : gl.createShader(gl.VERTEX_SHADER)

    if (!shader) {
      throw new Error('Failed to create shader')
    }

    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`Shader error: ${gl.getShaderInfoLog(shader)}`)
    }

    return shader
  }

  makeShaderSetter (info: ExtendedWebGLActiveInfo, loc: WebGLUniformLocation): ShaderSetterFunction {
    const gl = this.gl
    switch (info.type) {
      case gl.SAMPLER_2D:
        return (value: number) => {
          info.glTexture = (gl as WebGLRenderingContext & Record<string, number>)[`TEXTURE${value}`]
          gl.uniform1i(loc, value)
        }
      case gl.BOOL:
      case gl.INT:
        return (value: number) => {
          gl.uniform1i(loc, value)
        }
      case gl.FLOAT:
        return (value: number) => {
          gl.uniform1f(loc, value)
        }
      case gl.FLOAT_VEC2:
        return (x: number, y: number) => {
          gl.uniform2f(loc, x, y)
        }
      case gl.FLOAT_VEC3:
        return (x: number, y: number, z: number) => {
          gl.uniform3f(loc, x, y, z)
        }
      case gl.FLOAT_VEC4:
        return (x: number, y: number, z: number, w: number) => {
          gl.uniform4f(loc, x, y, z, w)
        }
      case gl.FLOAT_MAT3:
        return (mat3: Float32Array) => {
          gl.uniformMatrix3fv(loc, false, mat3)
        }
      case gl.FLOAT_MAT4:
        return (mat4: Float32Array) => {
          gl.uniformMatrix4fv(loc, false, mat4)
        }
      default:
        break
    }

    return () => {
      throw new Error(`ShaderProgram doesn't know how to set type: ${info.type}`)
    }
  }

  makeShaderGetter (loc: WebGLUniformLocation): () => unknown {
    return () => {
      return this.gl.getUniform(this.program!, loc)
    }
  }

  useProgram (): void {
    this.gl.useProgram(this.program)
  }

  unload (): void {
    this.gl.deleteShader(this.vertexShader)
    this.gl.deleteShader(this.fragmentShader)
    this.gl.deleteProgram(this.program)
  }
}
