document.addEventListener('DOMContentLoaded', function () {
  const downloadCsvLink = document.getElementById('downloadCsvLink'); // or download-button if you want

  // Ensure the download link exists before adding the event listener
  if (downloadCsvLink) {
    downloadCsvLink.addEventListener('click', function (event) {
      event.preventDefault(); // Prevent default link behavior

      // Send an AJAX request to the download endpoint
      fetch('/download-csv')
        .then(response => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.blob();
        })
        .then(blob => {
          // Create a temporary link and trigger a download
          const link = document.createElement('a');
          link.href = window.URL.createObjectURL(blob);
          link.download = 'speciesData.csv';
          link.click();
        })
        .catch(error => console.error('Error downloading CSV:', error));
    });
  }
});
