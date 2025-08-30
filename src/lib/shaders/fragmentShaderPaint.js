export default `#version 300 es
  precision mediump float;

  in vec2 vTexCoord;
  out vec4 pixel;

  uniform sampler2D source;
  uniform sampler2D alpha;

  // Standard BT.709 RGB to YUV conversion
  vec3 RGBtoYUV(vec3 rgb) {
    return vec3(
      rgb.r *  0.2126 + rgb.g *  0.7152 + rgb.b *  0.0722,           // Y (luma)
      rgb.r * -0.1146 + rgb.g * -0.3854 + rgb.b *  0.5,             // U (chroma)
      rgb.r *  0.5    + rgb.g * -0.4542 + rgb.b * -0.0458           // V (chroma)
    );
  }

  vec4 ProcessChromaKey(vec2 texCoord, vec3 keyColor, float tolerance, float smoothness, float spill) {
    // Remap 0-1 parameters to effective ranges
    float mappedTolerance = tolerance * 0.2;  // 0-0.2 range
    float mappedSmoothness = smoothness * 0.2 + 0.01;  // 0.01-0.21 range
    float mappedSpill = spill * 0.5 + 0.01;  // 0.01-0.51 range

    vec4 rgba = texture(source, texCoord);
    
    // Convert to YUV for both pixel and key color
    vec3 pixelYUV = RGBtoYUV(rgba.rgb);
    vec3 keyYUV = RGBtoYUV(keyColor);
    
    // Use improved distance calculation that includes luminance for achromatic colors
    vec2 pixelUV = pixelYUV.yz;
    vec2 keyUV = keyYUV.yz;
    float chromaDist = distance(pixelUV, keyUV);
    
    // For achromatic colors (low chrominance), also consider luminance difference
    float chromaLength = length(keyUV);
    if (chromaLength < 0.1) {  // Key color is achromatic (black, white, gray)
      float lumaDiff = abs(pixelYUV.x - keyYUV.x);
      chromaDist = max(chromaDist, lumaDiff);
    }

    float baseMask = chromaDist - mappedTolerance;
    float fullMask = pow(clamp(max(baseMask, 0.0) / mappedSmoothness, 0., 1.), 1.5);
    float spillVal = pow(clamp(max(baseMask, 0.0) / mappedSpill, 0., 1.), 1.5);
    rgba.a = fullMask;
    
    // Use the Y component from YUV for more accurate desaturation
    vec3 yuv = RGBtoYUV(rgba.rgb);
    float desat = yuv.x; // Use luma component instead of manual calculation
    rgba.rgb = mix(vec3(desat), rgba.rgb, spillVal);

    return rgba;
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
    float minDist = 999.0;
    int idx1 = 0, idx2 = 1;

    // Find the two closest corner colors
    for (int i = 0; i < 4; i++) {
      for (int j = i + 1; j < 4; j++) {
        float dist = distance(p[i], p[j]);
        if (dist < minDist) {
          minDist = dist;
          idx1 = i;
          idx2 = j;
        }
      }
    }

    return (p[idx1] + p[idx2]) / 2.0;
  }

  // show corner pixels from downsampled source
  void debug (void) {
    vec3 p[4] = corners();

    if (vTexCoord.x < 0.1) {
      if (vTexCoord.y < 0.1) {
        pixel = vec4(p[0], 1);  // top left corner
      } else if (vTexCoord.y > 0.9) {
        pixel = vec4(p[2], 1);  // bottom left corner
      }
    } else if (vTexCoord.x > 0.9) {
      if (vTexCoord.y < 0.1) {
        pixel = vec4(p[1], 1);  // top right corner
      } else if (vTexCoord.y > 0.9) {
        pixel = vec4(p[3], 1);  // bottom right corner
      }
    }
  }

  void main(void) {
    pixel = texture(source, vTexCoord);

    %keys%
  }
`
