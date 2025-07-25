# FasterPath — Fastest Route Optimization Tool

**FasterPath** is a web application for building **the fastest optimized route** between multiple locations. Users can add locations manually or by clicking on the map, select travel mode, enable round-trip, and save optimized routes. The system automatically rearranges waypoints to minimize total travel time or distance.

---

## Features

- Add points manually or by clicking on the map  
- Address autocomplete using Google Places API  
- Reverse geocoding for clicked coordinates  
- Automatic reordering of waypoints for fastest route  
- Support for driving, walking, bicycling, and public transit  
- Option for round-trip routing (return to starting point)  
- Detailed route info: total duration and distance    
- View saved routes (`/saved_routes` endpoint)

---

## Technologies Used

**Frontend**
- HTML, CSS, JavaScript  
- Google Maps JavaScript API (map, directions, autocomplete)  

**Backend**
- Python + Flask  
- Google Maps APIs: Geocoding, Directions, Distance Matrix, Places  
- OR-Tools (for advanced route optimization with ≥10 points)  
- Cachetools (in-memory caching for performance)  


---

## Route Optimization Logic

- Fewer than 10 points: uses Google Directions API with `optimize:true`  
- 10 or more points: uses Google OR-Tools + Distance Matrix API  
- Round trip support included in both methods

---

## Screenshots
<div style="display: flex; justify-content: space-between; flex-wrap: nowrap; gap: 20px; margin-bottom: 20px;">
  <div style="flex: 1; min-width: 0; text-align: center;">
    <img src="https://raw.githubusercontent.com/duama20180/FasterPath/main/screenshots/1_1.png" alt="Before" style="width: 100%; max-width: 500px; height: auto;">
    <p><strong>Before</strong></p>
  </div>
  <div style="flex: 1; min-width: 0; text-align: center;">
    <img src="https://raw.githubusercontent.com/duama20180/FasterPath/main/screenshots/1_2.png" alt="After" style="width: 100%; max-width: 500px; height: auto;">
    <p><strong>After</strong></p>
  </div>
</div>

<div style="display: flex; justify-content: space-between; flex-wrap: nowrap; gap: 20px; margin-bottom: 20px;">
  <div style="flex: 1; min-width: 0; text-align: center;">
    <img src="https://raw.githubusercontent.com/duama20180/FasterPath/main/screenshots/2_1.png" alt="Before" style="width: 100%; max-width: 500px; height: auto;">
    <p><strong>Before</strong></p>
  </div>
  <div style="flex: 1; min-width: 0; text-align: center;">
    <img src="https://raw.githubusercontent.com/duama20180/FasterPath/main/screenshots/2_2.png" alt="After" style="width: 100%; max-width: 500px; height: auto;">
    <p><strong>After</strong></p>
  </div>
</div>


---

## Getting Started

### 1. Clone the Repository

```
git clone https://github.com/duama20180/FasterPath.git
cd FasterPath
```

### 2. Set up `.env`

Create a `.env` file inside the `server/` directory with the following content:

```
GOOGLE_API_KEY=your_api_key_here
```

Make sure you have enabled these APIs in your Google Cloud Console:
- Maps JavaScript API  
- Places API  
- Geocoding API  
- Distance Matrix API  
- Directions API

### 3. Install Python Dependencies

```
pip install -r requirements.txt
```

Contents of `requirements.txt`:

```
flask==2.3.3
requests==2.31.0
python-dotenv==1.0.0
ortools==9.10.4067
cachetools==5.3.3
```

### 4. Run the Application

```
python server/app.py
```

Then open your browser and navigate to:  
`http://localhost:5000`

---


## API Endpoints

- `POST /geocode` — Forward or reverse geocoding  
- `POST /optimize_route` — Optimize route using coordinates  
- `POST /save_route` — Save a route with duration/distance  
- `GET /saved_routes` — Retrieve all saved routes

---

## Future Improvements

- User login and personal route management   
- Mobile-friendly UI  
- Route editing and history

---

## License

MIT License

---

## Author
[me](https://github.com/duama20180)