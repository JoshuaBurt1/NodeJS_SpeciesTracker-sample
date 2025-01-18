const imageInput = document.getElementById('image');
const preview = document.getElementById('preview');
//this is the size of noimage.png
const previewHeight = preview.clientHeight;
const previewWidth = preview.clientWidth;
imageInput.addEventListener('change', function() {
    const file = this.files[0];
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.src = e.target.result;
            img.onload = function() {
                preview.src = this.src;
                // Check if image height is greater than width
                if (img.height > img.width) {
                    const scaleFactor = previewHeight / img.height;
                    preview.style.width = (img.width * scaleFactor) + 'px';
                    preview.style.height = previewHeight + 'px';
                } else {
                preview.style.width = previewWidth + 'px';
                preview.style.height = previewHeight + 'px';
                }
            }
        }
        reader.readAsDataURL(file);
    } else {
        preview.src = "/site_images/noimage.png";
        preview.style.width = previewWidth+'px'; // Reset width to auto
        preview.style.height = previewHeight+'px'; // Reset height to auto
    }
});