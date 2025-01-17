// Update based on saving the previous variable before a route change
let previousId;

// Event listener for the carousel
const carousel = document.getElementById('carouselBackground');
carousel.addEventListener('slid.bs.carousel', () => {
    const activeItem = document.querySelector('.carousel-item.active');
    const carouselId = activeItem.querySelector('img').getAttribute('id');
    
    // Save the previous ID before updating
    previousId = carouselId;

    // Log the current and previous IDs
    console.log('Current ID:', carouselId);
    console.log('Previous ID:', previousId);
});
