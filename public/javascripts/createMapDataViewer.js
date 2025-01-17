document.addEventListener("DOMContentLoaded", function () {
  var coordinatesElements = document.querySelectorAll('.coordinates');

  var dotIcon = L.divIcon({
    className: 'custom-dot-icon',
    html: '<div class="dot"></div>',
    iconSize: [2, 2]
  });

  var initialGridSize = 10;
  const zoomLevelToGridSize = Array.from({ length: 19 }, (_, i) => initialGridSize / Math.pow(2, i));

  function getGridSizeForZoom(zoomLevel) {
    return zoomLevelToGridSize[Math.floor(zoomLevel)] || initialGridSize;
  }

  function processCoordinates(locations, gridSize) {
    let grid = {};

    locations.forEach(function (location) {
      var [latitude, longitude] = location.split(',').map(Number);
      var latKey = Math.floor(latitude / gridSize) * gridSize;
      var lngKey = Math.floor(longitude / gridSize) * gridSize;
      var key = `${latKey},${lngKey}`;

      if (!grid[key]) {
        grid[key] = { count: 0, latitudes: [], longitudes: [] };
      }

      grid[key].count += 1;
      grid[key].latitudes.push(latitude);
      grid[key].longitudes.push(longitude);
    });

    return grid;
  }

  function calculateQuartiles(counts) {
    counts.sort((a, b) => a - b);
    let q1 = counts[Math.floor(counts.length / 4)] || 0;
    let q2 = counts[Math.floor(counts.length / 2)] || 0;
    let q3 = counts[Math.floor(3 * counts.length / 4)] || 0;
    return { q1, q2, q3 };
  }

  function calculateVarianceAndStdDev(counts) {
    const n = counts.length;
    if (n === 0) return { variance: 0, stdDev: 0 };

    const mean = counts.reduce((sum, count) => sum + count, 0) / n;
    const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    return { variance, stdDev };
  }

  function getColorForCount(count, quartiles) {
    if (count >= quartiles.q3) return 'rgba(255, 0, 0, 0.6)'; // between Q3 & max (75-100%)
    if (count >= quartiles.q2) return 'rgba(255, 150, 0, 0.6)'; // between median & Q3 (50-75%)
    if (count >= quartiles.q1) return 'rgba(255, 255, 0, 0.6)'; // between Q1 & median (25-50%)
    return 'rgba(255, 255, 200, 0.6)'; // between minimum & Q1 (0-25%)
  }

  function logGridCounts(grid) {
    const countsArray = Object.values(grid).map(cell => cell.count);
    countsArray.sort((a, b) => a - b);
    const quartiles = calculateQuartiles(countsArray);
    const { variance, stdDev } = calculateVarianceAndStdDev(countsArray);

    console.log("Sorted grid counts at current zoom level:", countsArray);
    console.log("Quartiles:", quartiles);
    console.log("Variance:", variance);
    console.log("Standard Deviation:", stdDev);

    return { quartiles, variance, stdDev };
  }

  function getGridAreaInKm2(lat, gridSize) {
    const kmPerDegreeLat = 111;
    const kmPerDegreeLng = 111 * Math.cos(lat * Math.PI / 180);
    return (gridSize * kmPerDegreeLat) * (gridSize * kmPerDegreeLng);
  }

  function renderGrid(map, grid, gridSize, coordinatesElement) {
    map.eachLayer(function(layer) {
      if (layer instanceof L.Rectangle) {
        map.removeLayer(layer);
      }
    });

    const countsArray = Object.values(grid).map(cell => cell.count);
    const { quartiles, variance, stdDev } = logGridCounts(grid);

    Object.keys(grid).forEach(function (key) {
      let [latKey, lngKey] = key.split(',').map(Number);
      let count = grid[key].count;
      let color = getColorForCount(count, quartiles);

      let bounds = [
        [latKey, lngKey],
        [latKey + gridSize, lngKey + gridSize]
      ];

      let gridSquare = L.rectangle(bounds, { color: color, weight: 1, fillOpacity: 0.5 }).addTo(map);
      gridSquare.on('click', function () {
        const topLeft = [latKey, lngKey];
        const bottomRight = [latKey + gridSize, lngKey + gridSize];
        const topRight = [latKey, lngKey + gridSize];
        const bottomLeft = [latKey + gridSize, lngKey];
        const centerLat = (latKey + latKey + gridSize) / 2;
        const area = getGridAreaInKm2(centerLat, gridSize);
        const density = count / area;

        // Format coordinates for display
        const coordinatesText = `[(${topLeft[0]},${topLeft[1]}),(${bottomLeft[0]},${bottomLeft[1]}),(${topRight[0]},${topRight[1]}),(${bottomRight[0]},${bottomRight[1]})]`;

        // Update the <div> elements specific to the current map
        const mapContainer = coordinatesElement.closest('td');
        mapContainer.querySelector('.gridCoordinates').innerHTML = `<u>Grid Cell Coordinates</u>:<br> ${coordinatesText}`;
        mapContainer.querySelector('.gridArea').innerHTML = `<u>Area</u>: ${area.toFixed(10)} km²`;
        mapContainer.querySelector('.gridDensity').innerHTML = `<u>Density</u>: ${count}/${area.toFixed(6)} = <br> ${density.toFixed(10)} count/km²`;
      });
    });
  }

  function initializeMap(mapElement, locations) {
    var map = L.map(mapElement).setView([0, 0], 13);
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      attribution: '© Google Maps'
    }).addTo(map);

    var latitudes = [];
    var longitudes = [];
    var bounds = L.latLngBounds();

    locations.forEach(function (location) {
      var [latitude, longitude] = location.split(',').map(Number);
      bounds.extend([latitude, longitude]);
      latitudes.push(latitude);
      longitudes.push(longitude);
    });

    map.fitBounds(bounds.pad(0.5));

    return map;
  }

  coordinatesElements.forEach(function (coordinatesElement) {
    try {
      var locations = JSON.parse(coordinatesElement.dataset.species);
      var commonContainer = coordinatesElement.closest('tr');
      var mapElement = commonContainer.querySelector('.map');
      var mapContainer = commonContainer.querySelector('td.map-container');
      var map = initializeMap(mapElement, locations);

      let gridSize = getGridSizeForZoom(map.getZoom());
      var grid = processCoordinates(locations, gridSize);
      renderGrid(map, grid, gridSize, mapContainer);

      locations.forEach(function (location) {
        var [latitude, longitude] = location.split(',').map(Number);
        L.marker([latitude, longitude], { icon: dotIcon }).addTo(map);
      });

      let previousZoom = map.getZoom();
      map.on('zoomend', function() {
        let currentZoom = map.getZoom();
        if (currentZoom !== previousZoom) {
          gridSize = getGridSizeForZoom(currentZoom);
          grid = processCoordinates(locations, gridSize);
          renderGrid(map, grid, gridSize, mapContainer);
          previousZoom = currentZoom;
        }
      });

    } catch (error) {
      console.error("Error parsing coordinates:", error);
      var coordinates = coordinatesElement.textContent.trim();
      var coordinatesMatch = coordinates.match(/^\s*(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)\s*$/);

      if (coordinatesMatch) {
        var [latitude, longitude] = coordinates.split(',').map(Number);
        var commonContainer = coordinatesElement.closest('tr');
        var mapElement = commonContainer.querySelector('.map');
        var mapContainer = commonContainer.querySelector('td.map-container');
        var map = initializeMap(mapElement, [coordinates]);

        L.marker([latitude, longitude]).addTo(map);

        let previousZoom = map.getZoom();
        map.on('zoomend', function() {
          let currentZoom = map.getZoom();
          if (currentZoom !== previousZoom) {
            gridSize = getGridSizeForZoom(currentZoom);
            var locations = [coordinates];
            grid = processCoordinates(locations, gridSize);
            renderGrid(map, grid, gridSize, mapContainer);
            previousZoom = currentZoom;
          }
        });

      } else {
        console.log("Invalid coordinates format:", coordinates);
      }
    }
  });
});

/*A decision was made regarding the mapping:
Option 1. Use lines connecting to each coordinate point on the map to show potential distribution -> n^2 calculations/drawings
Option 2. Use a grid and simply count the number in the grid -> n calculations (current)
*/