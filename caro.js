// Get all articles
let articles = document.querySelectorAll('article.carousel-card');
let projects = document.querySelectorAll('article.card');

// Get buttons
const prevArt = document.getElementById('prev-button');
const nextArt = document.getElementById('next-button');
const prevProj = document.getElementById('prev-proj');
const nextProj = document.getElementById('next-proj');

// Keep track of current article
let artIndex = 0;
let projIndex = 0;

// Show the first article
articles[artIndex].style.display = 'block';
projects[projIndex].style.display = 'block';

// Event listener for next button
nextArt.addEventListener('click', function() {
  // Hide current article
  articles[artIndex].style.display = 'none';
  // Increase current index
  artIndex++;
  // If at last article, go back to first
  if (artIndex === articles.length) {
    artIndex = 0;
  }
  // Show next article
  articles[artIndex].style.display = 'block';
});

// Event listener for prev button
prevArt.addEventListener('click', function() {
  // Hide current article
  articles[artIndex].style.display = 'none';
  // Decrease current index
  artIndex--;
  // If at first article, go to last
  if (artIndex < 0) {
    artIndex = articles.length - 1;
  }
  // Show previous article
  articles[artIndex].style.display = 'block';
});

nextProj.addEventListener('click', function() {
  // Hide current article
  projects[projIndex].style.display = 'none';
  // Increase current index
  projIndex++;
  // If at last article, go back to first
  if (projIndex === projects.length) {
    projIndex = 0;
  }
  // Show next article
  projects[projIndex].style.display = 'block';
});

// Event listener for prev button
prevProj.addEventListener('click', function() {
  // Hide current article
  projects[projIndex].style.display = 'none';
  // Decrease current index
  projIndex--;
  // If at first article, go to last
  if (projIndex < 0) {
    projIndex = projects.length - 1;
  }
  // Show previous article
  projects[projIndex].style.display = 'block';
});
