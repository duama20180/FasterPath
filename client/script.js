let map;
let markers = [];
let points = [];
let directionsService;
let directionsRenderer;

function initMap() {
    // Ініціалізація карти (Крок 7)
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 48.3794, lng: 31.1656 },
        zoom: 6,
    });

    // Ініціалізація DirectionsService та DirectionsRenderer (Крок 10)
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true
    });

    // Додавання автодоповнення (Крок 8)
    setupAutocomplete();

    // Обробник кліку по карті (Крок 9)
    map.addListener("click", (event) => {
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();
        fetchGeocodeReverse(lat, lng);
    });

    // Обробник додавання точки
    document.getElementById("add-point").addEventListener("click", () => {
        const pointsList = document.getElementById("points-list");
        const pointEntry = document.createElement("div");
        pointEntry.className = "point-entry flex items-center space-x-2";
        pointEntry.innerHTML = `
            <input type="text" class="point-input flex-1 p-2 border rounded" placeholder="Введіть місце (наприклад, Київ, Україна)" required>
            <button class="remove-point bg-red-500 text-white p-2 rounded hover:bg-red-600">✕</button>
        `;
        pointsList.appendChild(pointEntry);
        setupAutocomplete();
        updateRemoveButtons();
    });

    // Обробник видалення точки
    document.getElementById("points-list").addEventListener("click", (event) => {
        if (event.target.classList.contains("remove-point")) {
            const pointEntry = event.target.parentElement;
            const index = Array.from(document.querySelectorAll(".point-entry")).indexOf(pointEntry);
            pointEntry.remove();
            points.splice(index, 1);
            markers[index].setMap(null);
            markers.splice(index, 1);
            updateRemoveButtons();
            updateMarkers();
        }
    });

    // Обробник побудови маршруту
    document.getElementById("build-route").addEventListener("click", () => {
        if (points.length < 2) {
            alert("Потрібно щонайменше 2 точки для побудови маршруту");
            return;
        }
        buildRoute();
    });

    // Обробник збереження маршруту
    document.getElementById("save-route").addEventListener("click", () => {
        saveRoute();
    });
}

function setupAutocomplete() {
    // Налаштування автодоповнення через проксі (Крок 8)
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
                alert("Місце не знайдено");
                return;
            }
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            const address = place.formatted_address;
            points[index] = { lat, lng, address };
            updateMarkers();
        });
    });
}

function fetchGeocodeReverse(lat, lng) {
    // Зворотне геокодування через сервер (Крок 9)
    fetch("/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng })
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(`Помилка геокодування: ${data.error}`);
                return;
            }
            const address = data.address;
            addPointFromClick(lat, lng, address);
        })
        .catch(error => alert(`Помилка: ${error.message}`));
}

function addPointFromClick(lat, lng, address) {
    // Додавання точки з кліку (Крок 9)
    points.push({ lat, lng, address });
    const pointsList = document.getElementById("points-list");
    const pointEntry = document.createElement("div");
    pointEntry.className = "point-entry flex items-center space-x-2";
    pointEntry.innerHTML = `
        <input type="text" class="point-input flex-1 p-2 border rounded" value="${address}" readonly>
        <button class="remove-point bg-red-500 text-white p-2 rounded hover:bg-red-600">✕</button>
    `;
    pointsList.appendChild(pointEntry);
    setupAutocomplete();
    updateMarkers();
    updateRemoveButtons();
}

function updateMarkers() {
    // Оновлення маркерів
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
    // Оновлення стану кнопок видалення
    const removeButtons = document.querySelectorAll(".remove-point");
    removeButtons.forEach((button, index) => {
        button.disabled = removeButtons.length === 1;
    });
}

function buildRoute() {
    // Побудова маршруту (Крок 10)
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
                alert(`Помилка оптимізації: ${data.error}`);
                return;
            }
            points = data.ordered_points;
            displayRoute(data.ordered_points, travelMode, isRoundTrip, data.total_duration, data.total_distance);
        })
        .catch(error => alert(`Помилка: ${error.message}`));
}

function displayRoute(orderedPoints, travelMode, isRoundTrip, totalDuration, totalDistance) {
    // Відображення маршруту (Крок 10)
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
            } else {
                alert(`Помилка відображення маршруту: ${status}`);
            }
        }
    );

    // Оновлення полів введення
    const pointsList = document.getElementById("points-list");
    pointsList.innerHTML = "";
    orderedPoints.forEach(point => {
        const pointEntry = document.createElement("div");
        pointEntry.className = "point-entry flex items-center space-x-2";
        pointEntry.innerHTML = `
            <input type="text" class="point-input flex-1 p-2 border rounded" value="${point.address}" readonly>
            <button class="remove-point bg-red-500 text-white p-2 rounded hover:bg-red-600">✕</button>
        `;
        pointsList.appendChild(pointEntry);
    });
    setupAutocomplete();
    updateRemoveButtons();
}

function displayRouteDetails(totalDuration, totalDistance) {
    // Відображення деталей маршруту
    const routeDetails = document.getElementById("route-details");
    routeDetails.classList.remove("hidden");
    document.getElementById("route-time").textContent = `${Math.round(totalDuration / 60)} хвилин`;
    document.getElementById("route-distance").textContent = `${(totalDistance / 1000).toFixed(2)} км`;
}

function saveRoute() {
    // Збереження маршруту
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
                alert(`Помилка збереження: ${data.error}`);
            } else {
                alert(`Маршрут збережено з ID: ${data.id}`);
            }
        })
        .catch(error => alert(`Помилка: ${error.message}`));
}

// Ініціалізація карти
window.initMap = initMap;