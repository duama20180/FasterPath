import requests
from cachetools import TTLCache
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
from dotenv import load_dotenv
import os

load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY not found in .env file")

distance_cache = TTLCache(maxsize=100, ttl=3600)


def get_distance_matrix(points, travel_mode):
    """Отримує матрицю часу/відстані через Google Distance Matrix API."""
    cache_key = f"{travel_mode}:{str(sorted([(p['lat'], p['lng']) for p in points]))}"
    if cache_key in distance_cache:
        return distance_cache[cache_key]

    base_url = "https://maps.googleapis.com/maps/api/distancematrix/json"
    origins = "|".join([f"{p['lat']},{p['lng']}" for p in points])
    destinations = origins
    params = {
        "key": GOOGLE_API_KEY,
        "origins": origins,
        "destinations": destinations,
        "mode": travel_mode.lower(),
        "region": "ua"
    }

    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()
        result = response.json()

        if result["status"] != "OK":
            raise ValueError(f"Distance Matrix API error: {result['status']}")

        matrix = []
        for row in result["rows"]:
            row_distances = []
            for element in row["elements"]:
                if element["status"] != "OK":
                    raise ValueError(f"Element error: {element['status']}")
                row_distances.append({
                    "distance": element["distance"]["value"],
                    "duration": element["duration"]["value"]
                })
            matrix.append(row_distances)

        distance_cache[cache_key] = matrix
        return matrix

    except requests.RequestException as e:
        raise Exception(f"Failed to connect to Distance Matrix API: {str(e)}")


def optimize_with_directions_api(points, travel_mode, is_round_trip):
    """Оптимізація маршруту через Directions API для <10 точок."""
    base_url = "https://maps.googleapis.com/maps/api/directions/json"
    origin = f"{points[0]['lat']},{points[0]['lng']}"
    destination = origin if is_round_trip else f"{points[-1]['lat']},{points[-1]['lng']}"
    waypoints = "|".join([f"{p['lat']},{p['lng']}" for p in points[1:-1]]) if len(points) > 2 else ""

    params = {
        "key": GOOGLE_API_KEY,
        "origin": origin,
        "destination": destination,
        "waypoints": f"optimize:true|{waypoints}" if waypoints else "",
        "mode": travel_mode.lower(),
        "region": "ua"
    }

    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()
        result = response.json()

        if result["status"] != "OK":
            raise ValueError(f"Directions API error: {result['status']}")

        route = result["routes"][0]
        order = [0] + ([int(i) + 1 for i in route["waypoint_order"]] if "waypoint_order" in route else [])
        if not is_round_trip:
            order.append(len(points) - 1)

        total_distance = sum(leg["distance"]["value"] for leg in route["legs"])
        total_duration = sum(leg["duration"]["value"] for leg in route["legs"])

        return {
            "order": order,
            "total_distance": total_distance,
            "total_duration": total_duration
        }

    except requests.RequestException as e:
        raise Exception(f"Failed to connect to Directions API: {str(e)}")


def optimize_with_ortools(points, distance_matrix, is_round_trip):
    """Оптимізація маршруту через OR-Tools для ≥10 точок."""
    num_locations = len(points)
    manager = pywrapcp.RoutingIndexManager(num_locations, 1, 0 if is_round_trip else None)
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return distance_matrix[from_node][to_node]["distance"]

    routing.SetArcCostEvaluatorOfAllVehicles(routing.RegisterTransitCallback(distance_callback))
    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC

    solution = routing.SolveWithParameters(search_parameters)
    if not solution:
        raise ValueError("No solution found by OR-Tools")

    order = []
    index = routing.Start(0)
    total_distance = 0
    total_duration = 0
    while not routing.IsEnd(index):
        node = manager.IndexToNode(index)
        order.append(node)
        next_index = solution.Value(routing.NextVar(index))
        if not routing.IsEnd(next_index):
            next_node = manager.IndexToNode(next_index)
            total_distance += distance_matrix[node][next_node]["distance"]
            total_duration += distance_matrix[node][next_node]["duration"]
        index = next_index

    if is_round_trip:
        total_distance += distance_matrix[order[-1]][0]["distance"]
        total_duration += distance_matrix[order[-1]][0]["duration"]
        order.append(0)

    return {
        "order": order,
        "total_distance": total_distance,
        "total_duration": total_duration
    }


def optimize_route(points, travel_mode, is_round_trip):
    """Головний метод для оптимізації маршруту."""
    if not points or len(points) < 2:
        raise ValueError("At least 2 points are required")

    if travel_mode not in ["DRIVING", "WALKING", "BICYCLING", "TRANSIT"]:
        raise ValueError("Invalid travel mode")

    distance_matrix = get_distance_matrix(points, travel_mode)

    if len(points) < 10:
        result = optimize_with_directions_api(points, travel_mode, is_round_trip)
    else:
        result = optimize_with_ortools(points, distance_matrix, is_round_trip)

    ordered_points = [points[i] for i in result["order"]]
    return {
        "ordered_points": ordered_points,
        "total_distance": result["total_distance"],
        "total_duration": result["total_duration"]
    }