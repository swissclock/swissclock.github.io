// const textContainer = document.getElementById("text");
// const text = textContainer.getAttribute("data-text");
// const interval = textContainer.getAttribute("data-interval");
// let cursorIndex = 0;

// const type = () => {
//     if(!text) {
//         console.error("data-text attribute not found or is empty");
//         return;
//     }
    
//     document.getElementById("text").innerHTML += text[cursorIndex];
//     cursorIndex++;

//     if (cursorIndex < text.length) {
//         setTimeout(type, interval);
//     }
// }
// setTimeout(type, interval);

// let textContainer = document.getElementById("text");
// let text = textContainer.getAttribute('data-text');

// let cursor = document.createElement('span');
// cursor.classList.add('cursor');
// textContainer.appendChild(cursor);

// let i = 0;
// let typingInterval = setInterval(() => {
//   if (i < text.length) {
//     textContainer.innerHTML += text[i];
//     i++;
//   } else {
//     clearInterval(typingInterval);
//   }

//   let lastChar = textContainer.innerText.slice(-1);
//   let lastCharWidth = textContainer.querySelector(`:contains(${lastChar})`).getBoundingClientRect().width;
//   cursor.style.left = `${lastCharWidth}px`;
// }, 50);

let textContainer = document.querySelector("#text-container p");
let cursor = document.querySelector("#cursor");

let text = textContainer.dataset.text;
let textArr = text.split("");
let i = 0;

let typing = setInterval(() => {
  if (i < textArr.length) {
    textContainer.textContent += textArr[i];
    i++;
  } else {
    clearInterval(typing);
  }
  cursor.style.left = `${textContainer.clientWidth}px`;
}, 30);


