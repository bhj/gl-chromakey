export default `#version 300 es
  precision mediump float;

  in vec2 vTexCoord;
  out vec4 pixel;

  uniform sampler2D source;

  void main(void) {
    pixel = texture(source, vTexCoord);
  }
`
