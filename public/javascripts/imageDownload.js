document.addEventListener('DOMContentLoaded', function () {
    const downloadImageLink = document.getElementById('downloadImageLink');
    downloadImageLink.addEventListener('click', function (event) {
        downloadImageLink.href = '/download-images';
    });
});