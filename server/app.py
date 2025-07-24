from flask import Flask, request, jsonify, send_from_directory, render_template
from flask_cors import CORS
from dotenv import load_dotenv
import os
import requests
from cachetools import TTLCache
from route_optimizer import optimize_route
import json
from datetime import datetime

app = Flask(__name__, template_folder="../client")
CORS(app)

load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY not found in .env file")

geocode_cache = TTLCache(maxsize=1000, ttl=3600)

ROUTES_FILE = "routes.json"

def init_routes_file():
    if not os.path.exists(ROUTES_FILE):
        with open(ROUTES_FILE, 'w') as f:
            json.dump({"routes": []}, f, indent=2)

def read_routes():
    try:
        with open(ROUTES_FILE, 'r') as f:
            return json.load(f).get("routes", [])
    except (FileNotFoundError, json.JSONDecodeError):
        return []

def write_routes(routes):
    with open(ROUTES_FILE, 'w') as f:
        json.dump({"routes": routes}, f, indent=2)

init_routes_file()

# Рендеринг index.html
@app.route('/')
def serve_index():
    return render_template("index.html", google_api_key=GOOGLE_API_KEY)

# Статичні файли з папки client
@app.route('/<path:path>')
def serve_client(path):
    return send_from_directory("../client", path)

# Ендпоінт для геокодування
@app.route('/geocode', methods=['POST'])
def geocode():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON data provided"}), 400

    address = data.get('address')
    lat = data.get('lat')
    lng = data.get('lng')

    if not address and (lat is None or lng is None):
        return jsonify({"error": "Provide either 'address' or both 'lat' and 'lng'"}), 400

    cache_key = address if address else f"{lat},{lng}"
    if cache_key in geocode_cache:
        return jsonify(geocode_cache[cache_key])

    base_url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {"key": GOOGLE_API_KEY}

    try:
        if address:
            params["address"] = address
            params["region"] = "ua"
        else:
            params["latlng"] = f"{lat},{lng}"

        response = requests.get(base_url, params=params)
        response.raise_for_status()
        result = response.json()

        if result["status"] != "OK":
            return jsonify({"error": f"Geocoding API error: {result['status']}", "details": result.get("error_message")}), 500

        first_result = result["results"][0]
        if address:
            location = first_result["geometry"]["location"]
            geocode_result = {
                "lat": location["lat"],
                "lng": location["lng"],
                "formatted_address": first_result["formatted_address"]
            }
        else:
            geocode_result = {
                "address": first_result["formatted_address"],
                "lat": first_result["geometry"]["location"]["lat"],
                "lng": first_result["geometry"]["location"]["lng"]
            }

        geocode_cache[cache_key] = geocode_result
        return jsonify(geocode_result)

    except requests.RequestException as e:
        return jsonify({"error": f"Failed to connect to Geocoding API: {str(e)}"}), 500
    except (KeyError, IndexError):
        return jsonify({"error": "Invalid response from Geocoding API"}), 500

# Ендпоінт для оптимізації маршруту
@app.route('/optimize_route', methods=['POST'])
def optimize_route_endpoint():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON data provided"}), 400

    points = data.get('points')
    travel_mode = data.get('travel_mode', 'DRIVING')
    is_round_trip = data.get('is_round_trip', False)

    if not points or not isinstance(points, list) or len(points) < 2:
        return jsonify({"error": "At least 2 points are required"}), 400

    for point in points:
        if not all(key in point for key in ['lat', 'lng', 'address']):
            return jsonify({"error": "Each point must have lat, lng, and address"}), 400

    try:
        result = optimize_route(points, travel_mode, is_round_trip)
        return jsonify({
            "ordered_points": result["ordered_points"],
            "total_distance": result["total_distance"],
            "total_duration": result["total_duration"]
        })

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Route optimization failed: {str(e)}"}), 500

# Ендпоінт для збереження маршруту
@app.route('/save_route', methods=['POST'])
def save_route():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON data provided"}), 400

    points = data.get('points')
    travel_mode = data.get('travel_mode', 'DRIVING')
    total_time = data.get('total_time')
    total_distance = data.get('total_distance')

    if not points or not isinstance(points, list) or len(points) < 2:
        return jsonify({"error": "At least 2 points are required"}), 400
    if not total_time or not total_distance:
        return jsonify({"error": "total_time and total_distance are required"}), 400
    if travel_mode not in ["DRIVING", "WALKING", "BICYCLING", "TRANSIT"]:
        return jsonify({"error": "Invalid travel mode"}), 400
    for point in points:
        if not all(key in point for key in ['lat', 'lng', 'address']):
            return jsonify({"error": "Each point must have lat, lng, and address"}), 400

    try:
        routes = read_routes()
        new_id = max([route["id"] for route in routes], default=0) + 1
        new_route = {
            "id": new_id,
            "points": points,
            "travel_mode": travel_mode,
            "total_time": total_time,
            "total_distance": total_distance,
            "created_at": datetime.utcnow().isoformat()
        }
        routes.append(new_route)
        write_routes(routes)
        return jsonify({"message": "Route saved successfully", "id": new_id}), 201

    except Exception as e:
        return jsonify({"error": f"Failed to save route: {str(e)}"}), 500

# Ендпоінт для отримання списку маршрутів
@app.route('/saved_routes', methods=['GET'])
def get_saved_routes():
    try:
        routes = read_routes()
        return jsonify({"routes": routes})

    except Exception as e:
        return jsonify({"error": f"Failed to retrieve routes: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True)