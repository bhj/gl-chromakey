export default `#version 300 es
  precision mediump float;

  in vec2 vTexCoord;
  out vec4 pixel;

  uniform sampler2D source;
  uniform sampler2D alpha;

  float distAlpha(vec3 target, float tolerance, float amount) {
    float a = ((length(pixel.rgb - target.rgb) - tolerance)) * 7.0;

    if (amount <= 0.0) {
      return 1.0;
    } else if (a < 1.0) {
      return (1.0 - max(0.0, a)) * (1.0 - amount) * (1.0 - amount);
    }

    return a;
  }

  // sample each corner's RGB value
  vec3[4] corners (void) {
    ivec2 size = textureSize(alpha, 0);
    vec3 p[4];

    p[0] = vec3(texelFetch(alpha, ivec2(0, 0), 0));
    p[1] = vec3(texelFetch(alpha, ivec2(size.x - 1, 0), 0));
    p[2] = vec3(texelFetch(alpha, ivec2(0, size.y - 1), 0));
    p[3] = vec3(texelFetch(alpha, size - 1, 0));

    return p;
  }

  // average the two "nearest" colors
  vec3 auto (void) {
    vec3 p[4] = corners();
    mat4 dist;
    float minDist = 999.0;
    int pCol, pRow;

    for (int col = 0; col < 4; col++) {
      for (int row = 0; row < 4; row++) {
        if (row != col) {
          dist[col][row] = distance(p[col], p[row]);

          if (dist[col][row] < minDist) {
            pCol = col;
            pRow = row;
            minDist = dist[col][row];
          }
        }
      }
    }

    return (p[pRow] + p[pCol]) / 2.0;
  }

  // show corner pixels from downsampled source
  void debug (void) {
    vec3 p[4] = corners();

    if (vTexCoord.x < 0.1) {
      if (vTexCoord.y < 0.1) {
        pixel = vec4(p[2], 1);
      } else if (vTexCoord.y > 0.9) {
        pixel = vec4(p[0], 1);
      }
    } else if (vTexCoord.x > 0.9) {
      if (vTexCoord.y > 0.9) {
        pixel = vec4(p[1], 1);
      } else if (vTexCoord.y < 0.1) {
        pixel = vec4(p[3], 1);
      }
    }
  }

  void main(void) {
    pixel = texture(alpha, vTexCoord); // avoid error if no keys defined
    pixel = texture(source, vTexCoord);

    %keys%
  }
`
