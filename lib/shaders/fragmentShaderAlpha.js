export default `#version 300 es
  precision mediump float;

  in vec2 vTexCoord;
  out vec4 pixel;

  uniform sampler2D source;

  vec4 distAlpha(vec3 target, float tolerance, vec4 pixel) {
    if (target == vec3(-1)) {
      ivec2 size = textureSize(source, 0);
      vec3 c1 = vec3(texelFetch(source, ivec2(0, 0), 0));
      vec3 c2 = vec3(texelFetch(source, size - 1, 0));
      target = (c1 + c2) / vec3(2);
    }

    vec4 sourcePixel = texture(source, vTexCoord);
    pixel.a = min((length(sourcePixel.rgb - target.rgb) - tolerance) * 7.0, pixel.a);
    return pixel;
  }

  void main(void) {
    pixel = vec4(1.0);

    %keys%
  }
`
