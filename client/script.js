let map;
let markers = [];
let points = [];
let directionsService;
let directionsRenderer;

function initMap() {
    // Map initialization
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 48.3794, lng: 31.1656 },
        zoom: 6,
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true
    });

    setupAutocomplete();

    // Map click handler
    map.addListener("click", (event) => {
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();
        fetchGeocodeReverse(lat, lng);
    });

    // Add point handler
    document.getElementById("add-point").addEventListener("click", () => {
        addEmptyPointInput();
    });

    // Remove point handler
    document.getElementById("points-list").addEventListener("click", (event) => {
        if (event.target.classList.contains("remove-point")) {
            const pointEntry = event.target.parentElement;
            const index = Array.from(document.querySelectorAll(".point-entry")).indexOf(pointEntry);
            pointEntry.remove();
            points.splice(index, 1);
            markers[index]?.setMap(null);
            markers.splice(index, 1);
            updateRemoveButtons();
            updateMarkers();
            directionsRenderer.setDirections({ routes: [] });
            document.getElementById("save-route").disabled = true;
        }
    });

    // Build route handler
    document.getElementById("build-route").addEventListener("click", () => {
        const inputs = document.querySelectorAll(".point-input");
        const preparedPoints = [];
        inputs.forEach((input, index) => {
            const lat = parseFloat(input.dataset.lat);
            const lng = parseFloat(input.dataset.lng);
            if (!isNaN(lat) && !isNaN(lng)) {
                preparedPoints.push({
                    address: input.value,
                    lat,
                    lng
                });
            }
        });
        if (preparedPoints.length < 2) {
            alert("At least 2 points are required to build a route");
            return;
        }
        points = preparedPoints;
        buildRoute();
    });

    // Save route handler
    document.getElementById("save-route").addEventListener("click", () => {
        saveRoute();
    });
}

function addEmptyPointInput() {
    // Add a new empty point input field
    const pointsList = document.getElementById("points-list");
    const pointEntry = document.createElement("div");
    pointEntry.className = "point-entry flex items-center space-x-2";
    pointEntry.innerHTML = `
        <input type="text" class="point-input flex-1 p-2 border rounded" placeholder="Enter a place (e.g., Kyiv, Ukraine)" required>
        <button class="remove-point bg-red-500 text-white p-2 rounded hover:bg-red-600">✕</button>
    `;
    pointsList.appendChild(pointEntry);
    setupAutocomplete();
    updateRemoveButtons();
}

function setupAutocomplete() {
    // Set up autocomplete using Google Places API
    const inputs = document.querySelectorAll(".point-input");
    inputs.forEach((input, index) => {
        const autocomplete = new google.maps.places.Autocomplete(input, {
            componentRestrictions: { country: "ua" },
            fields: ["formatted_address", "geometry"]
        });
        autocomplete.setOptions({ sessionToken: new google.maps.places.AutocompleteSessionToken() });
        autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            if (!place.geometry) {
                alert("Place not found");
                return;
            }
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            const address = place.formatted_address;
            input.value = address;
            input.dataset.lat = lat;
            input.dataset.lng = lng;
            points[index] = { lat, lng, address };
            updateMarkers();
        });
    });
}

function fetchGeocodeReverse(lat, lng) {
    // Reverse geocoding via server
    fetch("/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng })
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(`Geocoding error: ${data.error}`);
                return;
            }
            const address = data.address;
            const inputs = document.querySelectorAll(".point-input");
            const lastInput = inputs[inputs.length - 1];
            if (lastInput && !lastInput.value.trim()) {
                lastInput.value = address;
                lastInput.dataset.lat = lat;
                lastInput.dataset.lng = lng;
                points[inputs.length - 1] = { lat, lng, address };
            } else {
                addPointFromClick(lat, lng, address);
            }
            updateMarkers();
        })
        .catch(error => alert(`Error: ${error.message}`));
}

function addPointFromClick(lat, lng, address) {
    // Add point from click
    points.push({ lat, lng, address });
    const pointsList = document.getElementById("points-list");
    const pointEntry = document.createElement("div");
    pointEntry.className = "point-entry flex items-center space-x-2";
    pointEntry.innerHTML = `
        <input type="text" class="point-input flex-1 p-2 border rounded" value="${address}" readonly data-lat="${lat}" data-lng="${lng}">
        <button class="remove-point bg-red-500 text-white p-2 rounded hover:bg-red-600">✕</button>
    `;
    pointsList.appendChild(pointEntry);
    setupAutocomplete();
    updateRemoveButtons();
}

function updateMarkers() {
    // Update markers
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    points.forEach((point, index) => {
        const marker = new google.maps.Marker({
            position: { lat: point.lat, lng: point.lng },
            map: map,
            label: String(index + 1),
            title: point.address
        });
        markers.push(marker);
    });
}

function updateRemoveButtons() {
    // Update state of remove buttons
    const removeButtons = document.querySelectorAll(".remove-point");
    removeButtons.forEach(button => {
        button.disabled = removeButtons.length === 1;
    });
}

function buildRoute() {
    // Build route
    const travelMode = document.getElementById("travel-mode").value;
    const isRoundTrip = document.getElementById("is-round-trip").checked;

    fetch("/optimize_route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            points: points,
            travel_mode: travelMode,
            is_round_trip: isRoundTrip
        })
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(`Optimization error: ${data.error}`);
                return;
            }
            points = data.ordered_points;
            displayRoute(data.ordered_points, travelMode, isRoundTrip, data.total_duration, data.total_distance);
        })
        .catch(error => alert(`Error: ${error.message}`));
}

function displayRoute(orderedPoints, travelMode, isRoundTrip, totalDuration, totalDistance) {
    // Display route
    const origin = orderedPoints[0];
    const destination = isRoundTrip ? orderedPoints[0] : orderedPoints[orderedPoints.length - 1];
    const waypoints = orderedPoints.slice(1, isRoundTrip ? -1 : undefined).map(point => ({
        location: new google.maps.LatLng(point.lat, point.lng),
        stopover: true
    }));

    directionsService.route(
        {
            origin: new google.maps.LatLng(origin.lat, origin.lng),
            destination: new google.maps.LatLng(destination.lat, destination.lng),
            waypoints: waypoints,
            optimizeWaypoints: false,
            travelMode: google.maps.TravelMode[travelMode]
        },
        (result, status) => {
            if (status === google.maps.DirectionsStatus.OK) {
                directionsRenderer.setDirections(result);
                updateMarkers();
                document.getElementById("save-route").disabled = false;
                displayRouteDetails(totalDuration, totalDistance);
                updatePointInputs(orderedPoints);
            } else {
                alert(`Route display error: ${status}`);
            }
        }
    );
}

function updatePointInputs(orderedPoints) {
    // Update input fields based on optimized order
    const pointsList = document.getElementById("points-list");
    pointsList.innerHTML = "";
    orderedPoints.forEach(point => {
        const pointEntry = document.createElement("div");
        pointEntry.className = "point-entry flex items-center space-x-2";
        pointEntry.innerHTML = `
            <input type="text" class="point-input flex-1 p-2 border rounded" value="${point.address}" readonly data-lat="${point.lat}" data-lng="${point.lng}">
            <button class="remove-point bg-red-500 text-white p-2 rounded hover:bg-red-600">✕</button>
        `;
        pointsList.appendChild(pointEntry);
    });
    setupAutocomplete();
    updateRemoveButtons();
}

function displayRouteDetails(totalDuration, totalDistance) {
    // Display route details
    const routeDetails = document.getElementById("route-details");
    routeDetails.classList.remove("hidden");
    document.getElementById("route-time").textContent = `${Math.round(totalDuration / 60)} minutes`;
    document.getElementById("route-distance").textContent = `${(totalDistance / 1000).toFixed(2)} km`;
}

function saveRoute() {
    // Save route
    const travelMode = document.getElementById("travel-mode").value;
    const totalDuration = parseFloat(document.getElementById("route-time").textContent) * 60;
    const totalDistance = parseFloat(document.getElementById("route-distance").textContent) * 1000;

    fetch("/save_route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            points: points,
            travel_mode: travelMode,
            total_time: totalDuration,
            total_distance: totalDistance
        })
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(`Save error: ${data.error}`);
            } else {
                alert(`Route saved with ID: ${data.id}`);
            }
        })
        .catch(error => alert(`Error: ${error.message}`));
}

// Map initialization
window.initMap = initMap;