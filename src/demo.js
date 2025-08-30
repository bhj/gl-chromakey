import GLChroma from './gl-chromakey.js'

const videoUrl = 'MY_VIDEO.mp4' // place in /public (create if it doesn't exist)
let chroma

document.addEventListener('DOMContentLoaded', () => {
  const video = document.getElementById('video')
  const canvas = document.getElementById('canvas')

  // Create overlay canvas for bounds drawing
  const overlayCanvas = document.createElement('canvas')
  overlayCanvas.style.position = 'absolute'
  overlayCanvas.style.pointerEvents = 'none'
  canvas.parentNode.appendChild(overlayCanvas)
  const overlayCtx = overlayCanvas.getContext('2d')

  let frameId
  let key = { color: 'auto', tolerance: 0.1, smoothness: 0.1, spill: 0.1, debug: false }
  let enableKeys = true // flag to track if keys should be enabled

  video.src = videoUrl
  video.load()

  chroma = new GLChroma(video, canvas)
  chroma.key(key)

  // helper function to update the enableKeys flag
  const updateEnableKeysFlag = () => {
    if (autoKeyCheckbox.checked) {
      enableKeys = true
    } else {
      enableKeys = keyColorInput.value.trim() !== ''
    }
  }

  // render loop
  const pause = () => cancelAnimationFrame(frameId)
  const play = () => {
    frameId = requestAnimationFrame(play)
    chroma.render({ enableKeys })

    // for demo UI only
    updateContentBounds()
  }

  // follow video events (depending on your app, not all are strictly necessary)
  video.addEventListener('play', play)
  video.addEventListener('pause', pause)
  video.addEventListener('ended', pause)
  video.addEventListener('seeked', () => chroma.render({ enableKeys }))
  video.addEventListener('loadedmetadata', () => {
    overlayCanvas.width = canvas.width
    overlayCanvas.height = canvas.height
  })

  // for demo UI only
  const autoKeyCheckbox = document.getElementById('autoKey')
  const keyColorInput = document.getElementById('keyColor')
  const tolerance = document.getElementById('tolerance')
  const smoothness = document.getElementById('smoothness')
  const spill = document.getElementById('spill')
  const showContentBoundsCheckbox = document.getElementById('showContentBounds')
  const enableDebugCheckbox = document.getElementById('enableDebug')

  // Initialize the enableKeys flag
  updateEnableKeysFlag()

  const setKey = (name, value) => {
    key[name] = value
    chroma.key(key)
  }

  const parseKeyColor = (colorString) => {
    try {
      const parts = colorString.split(',').map(s => s.trim())
      if (parts.length !== 3) return null

      const rgb = parts.map((p) => {
        const num = parseInt(p, 10)
        return isNaN(num) ? null : Math.max(0, Math.min(255, num))
      })

      if (rgb.some(c => c === null)) return null
      return rgb
    } catch {
      return null
    }
  }

  const updateKeyColor = () => {
    if (autoKeyCheckbox.checked) {
      setKey('color', 'auto')
      keyColorInput.disabled = true
    } else {
      keyColorInput.disabled = false
      const colorValue = parseKeyColor(keyColorInput.value)
      if (colorValue) {
        setKey('color', colorValue)
      } else {
        chroma.key()
      }
    }
    updateEnableKeysFlag() // Update the flag whenever inputs change
    chroma.render({ enableKeys }) // Re-render when key settings change
    updateContentBounds()
  }

  const updateContentBounds = () => {
    // Clear previous bounds
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)

    if (showContentBoundsCheckbox.checked) {
      const [x1, y1, x2, y2] = chroma.getContentBounds()

      overlayCanvas.style.top = canvas.offsetTop + 'px'
      overlayCanvas.style.left = canvas.offsetLeft + 'px'

      // Draw new bounds
      overlayCtx.strokeStyle = 'green'
      overlayCtx.lineWidth = 2
      overlayCtx.strokeRect(x1, y1, (x2 - x1), (y2 - y1))
    }
  }

  autoKeyCheckbox.addEventListener('change', updateKeyColor)
  keyColorInput.addEventListener('input', () => {
    if (!autoKeyCheckbox.checked) {
      updateKeyColor()
    }
  })

  tolerance.addEventListener('change', () => setKey('tolerance', parseFloat(tolerance.value)))
  smoothness.addEventListener('change', () => setKey('smoothness', parseFloat(smoothness.value)))
  spill.addEventListener('change', () => setKey('spill', parseFloat(spill.value)))

  showContentBoundsCheckbox.addEventListener('change', () => {
    chroma.render({ enableKeys })
    updateContentBounds()
  })

  enableDebugCheckbox.addEventListener('change', () => {
    setKey('debug', enableDebugCheckbox.checked)
    chroma.render({ enableKeys })
    updateContentBounds()
  })
})
