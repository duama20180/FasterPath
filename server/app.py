from flask import Flask, request, jsonify
from dotenv import load_dotenv
import os
import requests
from cachetools import TTLCache

# Ініціалізація Flask-додатку
app = Flask(__name__)

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY not found in .env file")

# Ініціалізація кешу (TTL=3600 секунд, тобто 1 година; maxsize=1000 записів)
geocode_cache = TTLCache(maxsize=1000, ttl=3600)

# Базовий маршрут для тестування
@app.route('/')
def home():
    return jsonify({"message": "Flask server is running!"})

# Ендпоінт для геокодування
@app.route('/geocode', methods=['POST'])
def geocode():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON data provided"}), 400

    # Перевірка, чи є поле address (пряме геокодування) або lat/lng (зворотне геокодування)
    address = data.get('address')
    lat = data.get('lat')
    lng = data.get('lng')

    if not address and (lat is None or lng is None):
        return jsonify({"error": "Provide either 'address' or both 'lat' and 'lng'"}), 400

    # Формування ключа для кешу
    cache_key = address if address else f"{lat},{lng}"

    # Перевірка, чи є результат у кеші
    if cache_key in geocode_cache:
        return jsonify(geocode_cache[cache_key])

    # URL для Google Geocoding API
    base_url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {"key": GOOGLE_API_KEY}

    try:
        if address:
            # Пряме геокодування (адреса → координати)
            params["address"] = address
            params["region"] = "ua"  # Обмеження результатів Україною
        else:
            # Зворотне геокодування (координати → адреса)
            params["latlng"] = f"{lat},{lng}"

        # Виконання запиту до Google Geocoding API
        response = requests.get(base_url, params=params)
        response.raise_for_status()  # Викликає виняток для HTTP- помилок
        result = response.json()

        if result["status"] != "OK":
            return jsonify({"error": f"Geocoding API error: {result['status']}", "details": result.get("error_message")}), 500

        # Отримання першого результату
        first_result = result["results"][0]

        if address:
            # Для прямого геокодування повертаємо координати
            location = first_result["geometry"]["location"]
            geocode_result = {
                "lat": location["lat"],
                "lng": location["lng"],
                "formatted_address": first_result["formatted_address"]
            }
        else:
            # Для зворотного геокодування повертаємо адресу
            geocode_result = {
                "address": first_result["formatted_address"],
                "lat": first_result["geometry"]["location"]["lat"],
                "lng": first_result["geometry"]["location"]["lng"]
            }

        # Збереження результату в кеш
        geocode_cache[cache_key] = geocode_result
        return jsonify(geocode_result)

    except requests.RequestException as e:
        return jsonify({"error": f"Failed to connect to Geocoding API: {str(e)}"}), 500
    except (KeyError, IndexError):
        return jsonify({"error": "Invalid response from Geocoding API"}), 500

if __name__ == '__main__':
    app.run(debug=True)