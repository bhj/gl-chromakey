export default `#version 300 es
  precision mediump float;

  in vec3 position;
  in vec2 texCoord;

  out vec2 vTexCoord;

  void main(void) {
    gl_Position = vec4(position, 1.0);
    vTexCoord = vec2(texCoord.s, texCoord.t);
  }
`
