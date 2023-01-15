// Get all articles
let articles = document.querySelectorAll('article.carousel-card');

// Get buttons
const prevBtn = document.getElementById('prev-button');
const nextBtn = document.getElementById('next-button');
// Keep track of current article
let currentIndex = 0;

// Show the first article
articles[currentIndex].style.display = 'block';

// Event listener for next button
nextBtn.addEventListener('click', function() {
  // Hide current article
  articles[currentIndex].style.display = 'none';
  // Increase current index
  currentIndex++;
  // If at last article, go back to first
  if (currentIndex === articles.length) {
    currentIndex = 0;
  }
  // Show next article
  articles[currentIndex].style.display = 'block';
});

// Event listener for prev button
prevBtn.addEventListener('click', function() {
  // Hide current article
  articles[currentIndex].style.display = 'none';
  // Decrease current index
  currentIndex--;
  // If at first article, go to last
  if (currentIndex < 0) {
    currentIndex = articles.length - 1;
  }
  // Show previous article
  articles[currentIndex].style.display = 'block';
});
