// Add a variable to keep track of the current image index for the current item
let currentImageIndex = 0;

// Function to update the image source and show the enlarged image
function showImage(element) {
  const enlargedImage = document.getElementById('enlarged-image'); // Select the enlarged image element
  enlargedImage.src = element.src; // Set the source to the clicked image's source
  document.querySelector('.overlay').style.display = 'flex'; // Show the overlay
}

function hideImage() {
  document.querySelector('.overlay').style.display = 'none'; // Hide the overlay
}