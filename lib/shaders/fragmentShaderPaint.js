export default `#version 300 es
  precision mediump float;

  in vec2 vTexCoord;
  out vec4 pixel;

  uniform sampler2D source;
  uniform sampler2D alpha;

  void main(void) {
    vec4 alphaPixel = texture(alpha, vec2(vTexCoord.s, 1.0 - vTexCoord.t));

    pixel = texture(source, vTexCoord);
    pixel.a = alphaPixel.a;
  }
`
