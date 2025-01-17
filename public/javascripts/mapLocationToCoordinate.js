//map tool for assisting user in converting location to coordinates (Add & edit species)
var map = L.map('map').setView([0, 0], 2);
L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    attribution: '© Google Maps'
}).addTo(map);

var marker;

// Event listener for when the map is clicked
map.on('click', function (e) {
    var lat = e.latlng.lat.toFixed(6); // Round to 6 decimal places
    var lon = e.latlng.lng.toFixed(6); // Round to 6 decimal places

    if (!marker) {
        marker = L.marker([lat, lon]).addTo(map);
    } else {
        marker.setLatLng([lat, lon]);
    }

    document.getElementById('coordinates').innerHTML = 'Coordinates: ' + lat + ', ' + lon;
});

var input = document.getElementById('location');
input.addEventListener('input', function () {
    // You can use your own geocoding service or API here
    // For simplicity, we are using the Nominatim service
    var inputValue = this.value;
    fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + inputValue)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                var lat = parseFloat(data[0].lat).toFixed(6); // Round to 6 decimal places
                var lon = parseFloat(data[0].lon).toFixed(6); // Round to 6 decimal places

                if (!marker) {
                    marker = L.marker([lat, lon]).addTo(map);
                } else {
                    marker.setLatLng([lat, lon]);
                }

                map.setView([lat, lon], 13);
                document.getElementById('coordinates').innerHTML = 'Coordinates: ' + lat + ', ' + lon;
            }
        })
        .catch(error => console.error('Error:', error));
});