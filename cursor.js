const INPUT_FIELD = getEl('input-field'),
      INPUT_DISPLAY = getEl('input-display'),
      CURSOR = getEl('cursor')

const STATE = {
  cursorIndex: 0
}

//Bump cursor pos in increments of 12px
const moveCursor = index => {
  STATE.cursorIndex = Math.max(0, index)
  const leftPos = STATE.cursorIndex * 12
  setStyle(CURSOR, 'left', leftPos + 'px')
}

//Wipe input display, then repopulate with span tags
const appendInput = input => {
  removeAllChildren(INPUT_DISPLAY)
  for(let i = 0; i < input.length; i++){
    const span = document.createElement('span')
    span.innerHTML = input[i]
    INPUT_DISPLAY.appendChild(span)
  }
}

moveCursor(newIndex)
let input = INPUT_FIELD.value
input = input.slice(0, newIndex) + input.slice(newIndex + 1)
appendInput(input)
