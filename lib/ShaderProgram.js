export default class ShaderProgram {
  constructor (gl, vertexShaderSource, fragmentShaderSource) {
    this.gl = gl

    const compileShader = (source, fragment) => {
      let shader
      if (fragment) {
        shader = gl.createShader(gl.FRAGMENT_SHADER)
      } else {
        shader = gl.createShader(gl.VERTEX_SHADER)
      }

      gl.shaderSource(shader, source)
      gl.compileShader(shader)

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(`Shader error: ${gl.getShaderInfoLog(shader)}`)
      }

      return shader
    }

    const vertexShader = compileShader(vertexShaderSource)
    const fragmentShader = compileShader(fragmentShaderSource, true)

    let err = ''
    const program = gl.createProgram()
    gl.attachShader(program, vertexShader)
    let err2 = gl.getShaderInfoLog(vertexShader)
    if (err2) {
      err += `Vertex shader error: ${err2}\n`
    }
    gl.attachShader(program, fragmentShader)
    err2 = gl.getShaderInfoLog(fragmentShader)
    if (err2) {
      err += `Fragment shader error: ${err2}\n`
    }
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      err += gl.getProgramInfoLog(program)
      gl.deleteProgram(program)
      gl.deleteShader(vertexShader)
      gl.deleteShader(fragmentShader)
      throw new Error(`Could not initialise shader: ${err}`)
    }

    this.program = program

    gl.useProgram(program)
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)
    this.uniforms = []
    let i
    let info
    let name
    let loc
    for (i = 0; i < numUniforms; ++i) {
      info = gl.getActiveUniform(program, i)
      name = info.name
      loc = gl.getUniformLocation(program, name)
      loc.name = name
      info.set = this[`set_${name}`] = this.makeShaderSetter(info, loc)
      info.get = this[`get_${name}`] = this.makeShaderGetter(this, loc)
      info.loc = this[`location_${name}`] = loc
      this.uniforms.push(info)
    }

    const numAttribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES)
    this.attributes = []
    for (i = 0; i < numAttribs; ++i) {
      info = gl.getActiveAttrib(program, i)
      name = info.name
      loc = gl.getAttribLocation(program, name)
      this[`location_${name}`] = loc
      this.attributes.push(name)
    }
  }

  makeShaderSetter (info, loc) {
    const gl = this.gl
    switch (info.type) {
      case gl.SAMPLER_2D:
        return value => {
          info.glTexture = gl[`TEXTURE${value}`]
          gl.uniform1i(loc, value)
        }
      case gl.BOOL:
      case gl.INT:
        return value => {
          gl.uniform1i(loc, value)
        }
      case gl.FLOAT:
        return value => {
          gl.uniform1f(loc, value)
        }
      case gl.FLOAT_VEC2:
        return (x, y) => {
          gl.uniform2f(loc, x, y)
        }
      case gl.FLOAT_VEC3:
        return (x, y, z) => {
          gl.uniform3f(loc, x, y, z)
        }
      case gl.FLOAT_VEC4:
        return (x, y, z, w) => {
          gl.uniform4f(loc, x, y, z, w)
        }
      case gl.FLOAT_MAT3:
        return mat3 => {
          gl.uniformMatrix3fv(loc, false, mat3)
        }
      case gl.FLOAT_MAT4:
        return mat4 => {
          gl.uniformMatrix4fv(loc, false, mat4)
        }
      default:
        break
    }

    return () => {
      throw new Error(`ShaderProgram doesn't know how to set type: ${info.type}`)
    }
  }

  makeShaderGetter (loc) {
    return function () {
      return this.gl.getUniform(this.program, loc)
    }
  }

  useProgram () {
    this.gl.useProgram(this.program)
  }
}
