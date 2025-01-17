//documentation tool for auto-filling date and location if available (Add & edit species)
document.addEventListener('DOMContentLoaded', function () {
  const fileInput = document.getElementById('image');
  const dateInput = document.getElementById('updateDate');
  const coordinatesInput = document.getElementById('location');

  fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = function (e) {
      const buffer = e.target.result;

      // Use exif-js to read EXIF data from the image buffer
      EXIF.getData(file, function () {
        // Access the "Date Taken" information
        const dateTaken = EXIF.getTag(this, 'DateTimeOriginal');
        console.log('Date Taken:', dateTaken);

        // Access the GPS information
        const latitudeArray = EXIF.getTag(this, 'GPSLatitude');
        const longitudeArray = EXIF.getTag(this, 'GPSLongitude');
        const latitudeRef = EXIF.getTag(this, 'GPSLatitudeRef');
        const longitudeRef = EXIF.getTag(this, 'GPSLongitudeRef');
        console.log('Latitude:', latitudeArray);
        console.log('Longitude:', longitudeArray);
        console.log('Latitude Ref:', latitudeRef);
        console.log('Longitude Ref:', longitudeRef);

        // Update the updateDate input with the "Date Taken" information
        if (dateTaken) {
          dateInput.value = dateTaken;
          console.log('Date Taken:', dateInput.value);
        }

        // Update coordinates input if available
        if (latitudeArray && longitudeArray && latitudeRef && longitudeRef) {
          const latitude = convertCoordinate(latitudeArray) * (latitudeRef === 'S' ? -1 : 1);
          const longitude = convertCoordinate(longitudeArray) * (longitudeRef === 'W' ? -1 : 1);

          // Round coordinates to 6 decimal places
          const roundedLatitude = latitude.toFixed(6);
          const roundedLongitude = longitude.toFixed(6);

          const coordinates = `${roundedLatitude}, ${roundedLongitude}`;
          coordinatesInput.value = coordinates;
          console.log('Coordinates:', coordinates);

          // Log the image path
        const imagePath = file.name; // Assuming the file name contains the path information
        console.log('Image Path:', imagePath);
        }
      });
    };

    reader.readAsArrayBuffer(file); 
  });

  // Helper function to convert GPS coordinates to decimal format
  function convertCoordinate(coordinateArray) {
    const degrees = coordinateArray[0].numerator / coordinateArray[0].denominator;
    const minutes = coordinateArray[1].numerator / coordinateArray[1].denominator;
    const seconds = coordinateArray[2].numerator / coordinateArray[2].denominator;

    const decimalCoordinate = degrees + minutes / 60 + seconds / 3600;
    return decimalCoordinate;
  }
});