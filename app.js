class AdvancedStoppageDetector {
    constructor() {
        this.map = null;
        this.gpsData = [];
        this.trips = [];
        this.detectedStoppages = [];
        this.algorithms = {
            timeGap: true,
            speed: true,
            clustering: true,
            hybrid: true
        };
        this.parameters = {
            tripSegmentationThreshold: 60, // minutes
            timeGap: { minGapMinutes: 5, maxDistanceMeters: 500 },
            speed: { maxSpeedKmh: 5, minDurationMinutes: 2, distanceToleranceMeters: 100 },
            clustering: { clusterRadiusMeters: 150, minPointsInCluster: 3, minDurationMinutes: 3 },
            hybrid: { speedWeight: 0.4, timeWeight: 0.3, locationWeight: 0.3, confidenceThreshold: 0.6 }
        };
        this.routeLayer = null;
        this.stoppageLayer = null;
        this.durationChart = null;
        this.tripColors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#34495e', '#e67e22'];
        
        this.init();
    }

    init() {
        this.initMap();
        this.bindEvents();
        this.updateParameterControls();
        // Auto-load sample data on startup
        setTimeout(() => this.loadSampleData(), 500);
    }

    initMap() {
        this.map = L.map('map').setView([12.9294916, 74.9173533], 15);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        this.routeLayer = L.layerGroup().addTo(this.map);
        this.stoppageLayer = L.layerGroup().addTo(this.map);
    }

    bindEvents() {
        document.getElementById('csvFileInput').addEventListener('change', (e) => this.handleFileUpload(e));
        document.getElementById('useSampleData').addEventListener('click', () => this.loadSampleData());
        document.getElementById('detectStoppages').addEventListener('click', () => this.detectStoppages());
        document.getElementById('compareAlgorithms').addEventListener('click', () => this.compareAlgorithms());
        document.getElementById('exportCSV').addEventListener('click', () => this.exportResults('csv'));
        document.getElementById('exportJSON').addEventListener('click', () => this.exportResults('json'));

        // Algorithm checkboxes
        ['timeGapAlgorithm', 'speedAlgorithm', 'clusteringAlgorithm', 'hybridAlgorithm'].forEach(id => {
            document.getElementById(id).addEventListener('change', (e) => {
                const algorithmMap = {
                    'timeGapAlgorithm': 'timeGap',
                    'speedAlgorithm': 'speed',
                    'clusteringAlgorithm': 'clustering',
                    'hybridAlgorithm': 'hybrid'
                };
                this.algorithms[algorithmMap[id]] = e.target.checked;
                this.updateParameterControls();
            });
        });

        // View mode toggle
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.updateMapView(e.target.dataset.mode);
            });
        });
    }

    updateParameterControls() {
        const container = document.getElementById('parameterControls');
        container.innerHTML = '';

        // Trip segmentation control
        const tripGroup = document.createElement('div');
        tripGroup.className = 'parameter-group';
        tripGroup.innerHTML = `
            <h4>Trip Segmentation</h4>
            <div class="parameter-item">
                <span class="parameter-label">Time Gap Threshold (min)</span>
                <input type="range" class="parameter-slider" value="${this.parameters.tripSegmentationThreshold}" 
                       min="10" max="240" step="10"
                       onchange="detector.updateTripSegmentationThreshold(this.value)"
                       oninput="detector.updateTripSegmentationDisplay(this.value)">
                <span id="tripThresholdDisplay">${this.parameters.tripSegmentationThreshold} min</span>
            </div>
        `;
        container.appendChild(tripGroup);

        Object.keys(this.algorithms).forEach(algorithm => {
            if (!this.algorithms[algorithm]) return;

            const group = document.createElement('div');
            group.className = 'parameter-group';
            
            const titles = {
                timeGap: 'Time-Gap Detection',
                speed: 'Speed-Based Detection',
                clustering: 'Location Clustering',
                hybrid: 'Hybrid Detection'
            };

            group.innerHTML = `<h4>${titles[algorithm]}</h4>`;

            Object.keys(this.parameters[algorithm]).forEach(param => {
                const item = document.createElement('div');
                item.className = 'parameter-item';

                const labels = {
                    minGapMinutes: 'Min Gap (min)',
                    maxDistanceMeters: 'Max Distance (m)',
                    maxSpeedKmh: 'Max Speed (km/h)',
                    minDurationMinutes: 'Min Duration (min)',
                    distanceToleranceMeters: 'Distance Tolerance (m)',
                    clusterRadiusMeters: 'Cluster Radius (m)',
                    minPointsInCluster: 'Min Points',
                    speedWeight: 'Speed Weight',
                    timeWeight: 'Time Weight',
                    locationWeight: 'Location Weight',
                    confidenceThreshold: 'Confidence Threshold'
                };

                item.innerHTML = `
                    <span class="parameter-label">${labels[param] || param}</span>
                    <input type="number" class="parameter-input" value="${this.parameters[algorithm][param]}" 
                           step="${param.includes('Weight') || param.includes('Threshold') ? '0.1' : '1'}"
                           min="0" 
                           max="${param.includes('Weight') || param.includes('Threshold') ? '1' : '9999'}"
                           onchange="detector.updateParameter('${algorithm}', '${param}', this.value)">
                `;

                group.appendChild(item);
            });

            container.appendChild(group);
        });
    }

    updateTripSegmentationThreshold(value) {
        this.parameters.tripSegmentationThreshold = parseInt(value);
        this.updateTripSegmentationDisplay(value);
        if (this.gpsData.length > 0) {
            this.segmentTrips();
            this.visualizeRoutes();
        }
    }

    updateTripSegmentationDisplay(value) {
        document.getElementById('tripThresholdDisplay').textContent = `${value} min`;
    }

    updateParameter(algorithm, param, value) {
        this.parameters[algorithm][param] = parseFloat(value);
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.parseCSV(e.target.result);
                this.showMessage('success', 'GPS data uploaded successfully');
            } catch (error) {
                this.showMessage('error', 'Error parsing CSV file: ' + error.message);
            }
        };
        reader.readAsText(file);
    }

    parseCSV(csvContent) {
        const lines = csvContent.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        this.gpsData = [];
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '') continue;
            
            const values = lines[i].split(',');
            const point = {};
            
            headers.forEach((header, index) => {
                const value = values[index]?.trim();
                if (header === 'latitude' || header === 'longitude') {
                    point[header] = parseFloat(value);
                } else if (header === 'speed') {
                    point[header] = parseFloat(value) || 0;
                } else if (header === 'eventGeneratedTime') {
                    point[header] = parseInt(value);
                    point.timestamp = new Date(parseInt(value));
                } else {
                    point[header] = value;
                }
            });
            
            if (point.latitude && point.longitude && point.eventGeneratedTime) {
                this.gpsData.push(point);
            }
        }

        this.gpsData.sort((a, b) => a.eventGeneratedTime - b.eventGeneratedTime);
        this.preprocessData();
        this.segmentTrips();
        this.updateDataQualityMetrics();
        this.visualizeRoutes();
    }

    loadSampleData() {
        const csvData = `EquipmentId,latitude,longitude,speed,odometer reading,eventDate,eventGeneratedTime
EQPT-4,12.9294916,74.9173533,0,750424,1716229800000,1716229815000
EQPT-4,12.92936,74.91744,0,750429,1716229800000,1716230000000
EQPT-4,12.9292766,74.9175266,8,750452,1716229800000,1716230120000
EQPT-4,12.9290049,74.9177016,7,750488,1716229800000,1716230180000
EQPT-4,12.928745,74.9176766,0,750515,1716229800000,1716230240000
EQPT-4,12.9287266,74.9176866,0,750519,1716229800000,1716230900000
EQPT-5,12.93934,74.9179483,21,750601,1716233400000,1716233423000
EQPT-5,12.9300266,74.9180133,31,750678,1716233400000,1716233456000
EQPT-5,12.9319216,74.9181999,0,750889,1716233400000,1716233567000
EQPT-5,12.933585,74.9183883,0,751075,1716233400000,1716234200000
EQPT-6,12.9451433,74.9443549,7,791435,1716320000000,1716320234000
EQPT-6,12.9454033,74.9335716,0,791072,1716320000000,1716320567000
EQPT-6,12.9454349,74.93355,0,791075,1716320000000,1716322000000
EQPT-6,12.9455016,74.9335033,6,791087,1716320000000,1716322234000`;

        this.parseCSV(csvData);
        this.showMessage('info', 'Sample GPS data loaded with multiple vehicles/trips - Ready to detect stoppages!');
    }

    preprocessData() {
        // Remove outliers and calculate additional metrics
        this.gpsData.forEach((point, index) => {
            if (index > 0) {
                const prev = this.gpsData[index - 1];
                point.timeDiff = (point.eventGeneratedTime - prev.eventGeneratedTime) / 1000; // seconds
                point.distance = this.calculateDistance(prev.latitude, prev.longitude, point.latitude, point.longitude);
                point.calculatedSpeed = point.timeDiff > 0 ? (point.distance / point.timeDiff) * 3.6 : 0; // km/h
            }
        });

        // Mark outliers
        this.gpsData.forEach(point => {
            point.isOutlier = point.calculatedSpeed > 200; // Unrealistic speed
        });
    }

    segmentTrips() {
        this.trips = [];
        if (this.gpsData.length === 0) return;

        // Group by equipment ID first
        const equipmentGroups = {};
        this.gpsData.forEach(point => {
            const equipId = point.EquipmentId || 'Unknown';
            if (!equipmentGroups[equipId]) {
                equipmentGroups[equipId] = [];
            }
            equipmentGroups[equipId].push(point);
        });

        // Segment each equipment group by time gaps
        Object.keys(equipmentGroups).forEach((equipId, equipIndex) => {
            const points = equipmentGroups[equipId].sort((a, b) => a.eventGeneratedTime - b.eventGeneratedTime);
            let currentTrip = [];
            let tripCounter = 1;

            points.forEach((point, index) => {
                if (index === 0) {
                    currentTrip.push(point);
                } else {
                    const timeDiffMinutes = (point.eventGeneratedTime - points[index - 1].eventGeneratedTime) / (1000 * 60);
                    
                    if (timeDiffMinutes > this.parameters.tripSegmentationThreshold) {
                        // End current trip and start new one
                        if (currentTrip.length > 1) {
                            this.trips.push({
                                id: `${equipId}_Trip${tripCounter}`,
                                equipmentId: equipId,
                                tripNumber: tripCounter,
                                points: [...currentTrip],
                                color: this.tripColors[(equipIndex * 3 + tripCounter - 1) % this.tripColors.length],
                                startTime: new Date(currentTrip[0].eventGeneratedTime),
                                endTime: new Date(currentTrip[currentTrip.length - 1].eventGeneratedTime),
                                totalDistance: this.calculateTripDistance(currentTrip),
                                avgSpeed: this.calculateAvgSpeed(currentTrip)
                            });
                        }
                        currentTrip = [point];
                        tripCounter++;
                    } else {
                        currentTrip.push(point);
                    }
                }
            });

            // Add final trip
            if (currentTrip.length > 1) {
                this.trips.push({
                    id: `${equipId}_Trip${tripCounter}`,
                    equipmentId: equipId,
                    tripNumber: tripCounter,
                    points: [...currentTrip],
                    color: this.tripColors[(equipIndex * 3 + tripCounter - 1) % this.tripColors.length],
                    startTime: new Date(currentTrip[0].eventGeneratedTime),
                    endTime: new Date(currentTrip[currentTrip.length - 1].eventGeneratedTime),
                    totalDistance: this.calculateTripDistance(currentTrip),
                    avgSpeed: this.calculateAvgSpeed(currentTrip)
                });
            }
        });

        console.log(`Segmented ${this.gpsData.length} points into ${this.trips.length} trips`);
    }

    calculateTripDistance(points) {
        let distance = 0;
        for (let i = 1; i < points.length; i++) {
            distance += this.calculateDistance(
                points[i-1].latitude, points[i-1].longitude,
                points[i].latitude, points[i].longitude
            );
        }
        return distance;
    }

    calculateAvgSpeed(points) {
        const validSpeeds = points.filter(p => p.speed !== undefined && p.speed >= 0);
        if (validSpeeds.length === 0) return 0;
        return validSpeeds.reduce((sum, p) => sum + p.speed, 0) / validSpeeds.length;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Earth's radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    updateDataQualityMetrics() {
        if (this.gpsData.length === 0) return;

        const totalPoints = this.gpsData.length;
        const outliers = this.gpsData.filter(p => p.isOutlier).length;
        const timeSpan = (this.gpsData[this.gpsData.length - 1].eventGeneratedTime - this.gpsData[0].eventGeneratedTime) / (1000 * 60 * 60); // hours
        
        const timeDiffs = this.gpsData.slice(1).map(p => p.timeDiff).filter(t => t > 0);
        const avgSamplingRate = timeDiffs.length > 0 ? timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length : 0;

        document.getElementById('dataPointsCount').textContent = `${totalPoints} (${this.trips.length} trips)`;
        document.getElementById('timeCoverage').textContent = `${timeSpan.toFixed(1)}h`;
        document.getElementById('samplingRate').textContent = `${avgSamplingRate.toFixed(0)}s`;
        document.getElementById('outlierCount').textContent = `${outliers} (${((outliers/totalPoints)*100).toFixed(1)}%)`;
    }

    visualizeRoutes() {
        if (this.trips.length === 0) return;

        this.routeLayer.clearLayers();

        this.trips.forEach((trip, index) => {
            const routePoints = trip.points.filter(p => !p.isOutlier).map(p => [p.latitude, p.longitude]);
            
            if (routePoints.length > 1) {
                const polyline = L.polyline(routePoints, {
                    color: trip.color,
                    weight: 3,
                    opacity: 0.8
                }).addTo(this.routeLayer);

                // Add start marker
                L.marker(routePoints[0], {
                    icon: L.divIcon({
                        html: `<div style="background-color: ${trip.color}; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">S</div>`,
                        className: 'trip-marker',
                        iconSize: [24, 24]
                    })
                }).addTo(this.routeLayer)
                    .bindPopup(`
                        <div class="popup-content">
                            <div class="popup-title">${trip.id} - Start</div>
                            <div class="popup-details">
                                <div class="popup-detail-item">
                                    <span class="popup-detail-label">Equipment:</span>
                                    <span class="popup-detail-value">${trip.equipmentId}</span>
                                </div>
                                <div class="popup-detail-item">
                                    <span class="popup-detail-label">Start Time:</span>
                                    <span class="popup-detail-value">${trip.startTime.toLocaleString()}</span>
                                </div>
                                <div class="popup-detail-item">
                                    <span class="popup-detail-label">Total Distance:</span>
                                    <span class="popup-detail-value">${(trip.totalDistance / 1000).toFixed(2)} km</span>
                                </div>
                                <div class="popup-detail-item">
                                    <span class="popup-detail-label">Avg Speed:</span>
                                    <span class="popup-detail-value">${trip.avgSpeed.toFixed(1)} km/h</span>
                                </div>
                            </div>
                        </div>
                    `);

                // Add end marker
                L.marker(routePoints[routePoints.length - 1], {
                    icon: L.divIcon({
                        html: `<div style="background-color: ${trip.color}; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">E</div>`,
                        className: 'trip-marker',
                        iconSize: [24, 24]
                    })
                }).addTo(this.routeLayer)
                    .bindPopup(`
                        <div class="popup-content">
                            <div class="popup-title">${trip.id} - End</div>
                            <div class="popup-details">
                                <div class="popup-detail-item">
                                    <span class="popup-detail-label">End Time:</span>
                                    <span class="popup-detail-value">${trip.endTime.toLocaleString()}</span>
                                </div>
                                <div class="popup-detail-item">
                                    <span class="popup-detail-label">Duration:</span>
                                    <span class="popup-detail-value">${this.formatDuration((trip.endTime - trip.startTime) / (1000 * 60))}</span>
                                </div>
                            </div>
                        </div>
                    `);
            }
        });

        // Fit map to show all trips
        if (this.trips.length > 0) {
            const allPoints = this.trips.flatMap(trip => 
                trip.points.filter(p => !p.isOutlier).map(p => [p.latitude, p.longitude])
            );
            if (allPoints.length > 0) {
                const bounds = L.latLngBounds(allPoints);
                this.map.fitBounds(bounds, { padding: [20, 20] });
            }
        }

        this.updateLegend();
    }

    detectStoppages() {
        if (this.trips.length === 0) {
            this.showMessage('warning', 'No trip data available');
            return;
        }

        this.detectedStoppages = [];
        
        document.getElementById('detectStoppages').classList.add('loading');

        setTimeout(() => {
            try {
                // Process each trip separately
                this.trips.forEach(trip => {
                    const tripStoppages = [];
                    
                    if (this.algorithms.timeGap) {
                        tripStoppages.push(...this.detectTimeGapStoppages(trip));
                    }
                    if (this.algorithms.speed) {
                        tripStoppages.push(...this.detectSpeedBasedStoppages(trip));
                    }
                    if (this.algorithms.clustering) {
                        tripStoppages.push(...this.detectClusteringStoppages(trip));
                    }
                    if (this.algorithms.hybrid) {
                        tripStoppages.push(...this.detectHybridStoppages(trip));
                    }

                    // Merge similar stoppages within this trip
                    const mergedTripStoppages = this.mergeSimilarStoppages(tripStoppages);
                    mergedTripStoppages.forEach(stoppage => {
                        stoppage.tripId = trip.id;
                        stoppage.equipmentId = trip.equipmentId;
                        stoppage.tripColor = trip.color;
                    });
                    
                    this.detectedStoppages.push(...mergedTripStoppages);
                });

                this.visualizeStoppages();
                this.updateAnalytics();
                
                if (this.detectedStoppages.length > 0) {
                    this.showMessage('success', `Successfully detected ${this.detectedStoppages.length} stoppages across ${this.trips.length} trips`);
                } else {
                    this.showMessage('warning', 'No stoppages detected with current parameters');
                }
            } catch (error) {
                this.showMessage('error', 'Error detecting stoppages: ' + error.message);
            } finally {
                document.getElementById('detectStoppages').classList.remove('loading');
            }
        }, 100);
    }

    detectTimeGapStoppages(trip) {
        const stoppages = [];
        const params = this.parameters.timeGap;

        for (let i = 1; i < trip.points.length; i++) {
            const current = trip.points[i];
            const previous = trip.points[i - 1];
            
            const timeGapMinutes = (current.eventGeneratedTime - previous.eventGeneratedTime) / (1000 * 60);
            const distance = this.calculateDistance(previous.latitude, previous.longitude, current.latitude, current.longitude);

            if (timeGapMinutes >= params.minGapMinutes && distance <= params.maxDistanceMeters) {
                stoppages.push({
                    id: `timegap_${trip.id}_${i}`,
                    algorithm: 'Time-Gap',
                    startTime: previous.timestamp,
                    endTime: current.timestamp,
                    duration: timeGapMinutes,
                    latitude: (previous.latitude + current.latitude) / 2,
                    longitude: (previous.longitude + current.longitude) / 2,
                    confidence: Math.min(1, timeGapMinutes / 10),
                    type: 'Time Gap'
                });
            }
        }

        return stoppages;
    }

    detectSpeedBasedStoppages(trip) {
        const stoppages = [];
        const params = this.parameters.speed;
        let currentStopStart = null;
        let stopPoints = [];

        for (let i = 0; i < trip.points.length; i++) {
            const point = trip.points[i];
            
            if (point.speed <= params.maxSpeedKmh) {
                if (!currentStopStart) {
                    currentStopStart = point;
                    stopPoints = [point];
                } else {
                    stopPoints.push(point);
                }
            } else {
                if (currentStopStart && stopPoints.length > 1) {
                    const duration = (point.eventGeneratedTime - currentStopStart.eventGeneratedTime) / (1000 * 60);
                    
                    if (duration >= params.minDurationMinutes) {
                        const centerLat = stopPoints.reduce((sum, p) => sum + p.latitude, 0) / stopPoints.length;
                        const centerLng = stopPoints.reduce((sum, p) => sum + p.longitude, 0) / stopPoints.length;

                        stoppages.push({
                            id: `speed_${trip.id}_${stoppages.length}`,
                            algorithm: 'Speed-Based',
                            startTime: currentStopStart.timestamp,
                            endTime: new Date(point.eventGeneratedTime),
                            duration: duration,
                            latitude: centerLat,
                            longitude: centerLng,
                            confidence: Math.min(1, duration / 10),
                            type: 'Low Speed'
                        });
                    }
                }
                currentStopStart = null;
                stopPoints = [];
            }
        }

        return stoppages;
    }

    detectClusteringStoppages(trip) {
        const stoppages = [];
        const params = this.parameters.clustering;
        const clusters = [];

        // Simple clustering algorithm for this trip
        trip.points.forEach(point => {
            let assignedCluster = false;
            
            for (const cluster of clusters) {
                const distance = this.calculateDistance(
                    point.latitude, point.longitude,
                    cluster.centerLat, cluster.centerLng
                );
                
                if (distance <= params.clusterRadiusMeters) {
                    cluster.points.push(point);
                    cluster.centerLat = cluster.points.reduce((sum, p) => sum + p.latitude, 0) / cluster.points.length;
                    cluster.centerLng = cluster.points.reduce((sum, p) => sum + p.longitude, 0) / cluster.points.length;
                    assignedCluster = true;
                    break;
                }
            }
            
            if (!assignedCluster) {
                clusters.push({
                    centerLat: point.latitude,
                    centerLng: point.longitude,
                    points: [point]
                });
            }
        });

        // Convert clusters to stoppages
        clusters.forEach((cluster, index) => {
            if (cluster.points.length >= params.minPointsInCluster) {
                const sortedPoints = cluster.points.sort((a, b) => a.eventGeneratedTime - b.eventGeneratedTime);
                const duration = (sortedPoints[sortedPoints.length - 1].eventGeneratedTime - sortedPoints[0].eventGeneratedTime) / (1000 * 60);
                
                if (duration >= params.minDurationMinutes) {
                    stoppages.push({
                        id: `cluster_${trip.id}_${index}`,
                        algorithm: 'Location Clustering',
                        startTime: sortedPoints[0].timestamp,
                        endTime: sortedPoints[sortedPoints.length - 1].timestamp,
                        duration: duration,
                        latitude: cluster.centerLat,
                        longitude: cluster.centerLng,
                        confidence: Math.min(1, cluster.points.length / 10),
                        type: 'Cluster'
                    });
                }
            }
        });

        return stoppages;
    }

    detectHybridStoppages(trip) {
        const stoppages = [];
        const params = this.parameters.hybrid;
        
        // Combine results from other algorithms with weighted scoring
        const timeGapResults = this.detectTimeGapStoppages(trip);
        const speedResults = this.detectSpeedBasedStoppages(trip);
        const clusterResults = this.detectClusteringStoppages(trip);

        // Create a grid of potential stoppage locations
        const potentialStops = [...timeGapResults, ...speedResults, ...clusterResults];
        
        potentialStops.forEach(stop => {
            let score = 0;
            
            // Speed component
            const avgSpeed = this.getAverageSpeedNearLocation(stop.latitude, stop.longitude, stop.startTime, stop.endTime, trip);
            const speedScore = Math.max(0, 1 - (avgSpeed / 10));
            score += speedScore * params.speedWeight;
            
            // Time component  
            const timeScore = Math.min(1, stop.duration / 20);
            score += timeScore * params.timeWeight;
            
            // Location component
            const locationScore = this.getLocationSignificanceScore(stop.latitude, stop.longitude, trip);
            score += locationScore * params.locationWeight;
            
            if (score >= params.confidenceThreshold) {
                stoppages.push({
                    ...stop,
                    id: `hybrid_${trip.id}_${stoppages.length}`,
                    algorithm: 'Hybrid Multi-Criteria',
                    confidence: score,
                    type: 'Multi-Criteria'
                });
            }
        });

        return stoppages;
    }

    getAverageSpeedNearLocation(lat, lng, startTime, endTime, trip) {
        const nearbyPoints = trip.points.filter(p => {
            const distance = this.calculateDistance(lat, lng, p.latitude, p.longitude);
            const inTimeRange = p.timestamp >= startTime && p.timestamp <= endTime;
            return distance <= 200 && inTimeRange; // within 200m
        });

        if (nearbyPoints.length === 0) return 0;
        return nearbyPoints.reduce((sum, p) => sum + p.speed, 0) / nearbyPoints.length;
    }

    getLocationSignificanceScore(lat, lng, trip) {
        // Count how many times vehicle was near this location within this trip
        const nearbyCount = trip.points.filter(p => {
            const distance = this.calculateDistance(lat, lng, p.latitude, p.longitude);
            return distance <= 100; // within 100m
        }).length;

        return Math.min(1, nearbyCount / 5);
    }

    mergeSimilarStoppages(stoppages) {
        const merged = [];
        const processed = new Set();

        stoppages.forEach((stop, index) => {
            if (processed.has(index)) return;

            const similar = [stop];
            processed.add(index);

            // Find similar stoppages
            stoppages.forEach((otherStop, otherIndex) => {
                if (otherIndex !== index && !processed.has(otherIndex)) {
                    const distance = this.calculateDistance(
                        stop.latitude, stop.longitude,
                        otherStop.latitude, otherStop.longitude
                    );
                    const timeDiff = Math.abs(stop.startTime - otherStop.startTime) / (1000 * 60); // minutes

                    if (distance <= 100 && timeDiff <= 30) { // within 100m and 30 minutes
                        similar.push(otherStop);
                        processed.add(otherIndex);
                    }
                }
            });

            // Merge similar stoppages
            if (similar.length === 1) {
                merged.push(stop);
            } else {
                const earliestStart = new Date(Math.min(...similar.map(s => s.startTime)));
                const latestEnd = new Date(Math.max(...similar.map(s => s.endTime)));
                const avgLat = similar.reduce((sum, s) => sum + s.latitude, 0) / similar.length;
                const avgLng = similar.reduce((sum, s) => sum + s.longitude, 0) / similar.length;
                const algorithms = [...new Set(similar.map(s => s.algorithm))];

                merged.push({
                    id: `merged_${merged.length}`,
                    algorithm: algorithms.join(' + '),
                    startTime: earliestStart,
                    endTime: latestEnd,
                    duration: (latestEnd - earliestStart) / (1000 * 60),
                    latitude: avgLat,
                    longitude: avgLng,
                    confidence: Math.max(...similar.map(s => s.confidence)),
                    type: 'Merged'
                });
            }
        });

        return merged;
    }

    visualizeStoppages() {
        this.stoppageLayer.clearLayers();

        this.detectedStoppages.forEach((stoppage, index) => {
            const color = stoppage.tripColor || this.getStoppageColor(stoppage.algorithm);
            
            const marker = L.circleMarker([stoppage.latitude, stoppage.longitude], {
                color: color,
                fillColor: color,
                fillOpacity: 0.7,
                radius: Math.max(8, Math.min(20, stoppage.duration / 2)),
                weight: 2
            }).addTo(this.stoppageLayer);

            const popupContent = this.createStoppagePopup(stoppage);
            marker.bindPopup(popupContent);
        });

        this.updateLegend();
    }

    getStoppageColor(algorithm) {
        const colors = {
            'Time-Gap': '#FF5459',
            'Speed-Based': '#1FB8CD',
            'Location Clustering': '#FFC185',
            'Hybrid Multi-Criteria': '#B4413C',
            'Merged': '#5D878F'
        };
        return colors[algorithm] || '#964325';
    }

    createStoppagePopup(stoppage) {
        return `
            <div class="popup-content">
                <div class="popup-title">Stoppage Detection</div>
                <div class="popup-details">
                    <div class="popup-detail-item">
                        <span class="popup-detail-label">Trip:</span>
                        <span class="popup-detail-value">${stoppage.tripId || 'Unknown'}</span>
                    </div>
                    <div class="popup-detail-item">
                        <span class="popup-detail-label">Equipment:</span>
                        <span class="popup-detail-value">${stoppage.equipmentId || 'Unknown'}</span>
                    </div>
                    <div class="popup-detail-item">
                        <span class="popup-detail-label">Algorithm:</span>
                        <span class="popup-detail-value">${stoppage.algorithm}</span>
                    </div>
                    <div class="popup-detail-item">
                        <span class="popup-detail-label">Start Time:</span>
                        <span class="popup-detail-value">${stoppage.startTime.toLocaleString()}</span>
                    </div>
                    <div class="popup-detail-item">
                        <span class="popup-detail-label">End Time:</span>
                        <span class="popup-detail-value">${stoppage.endTime.toLocaleString()}</span>
                    </div>
                    <div class="popup-detail-item">
                        <span class="popup-detail-label">Duration:</span>
                        <span class="popup-detail-value">${this.formatDuration(stoppage.duration)}</span>
                    </div>
                    <div class="popup-detail-item">
                        <span class="popup-detail-label">Confidence:</span>
                        <span class="popup-detail-value">${(stoppage.confidence * 100).toFixed(1)}%</span>
                    </div>
                    <div class="popup-detail-item">
                        <span class="popup-detail-label">Type:</span>
                        <span class="popup-detail-value">${stoppage.type}</span>
                    </div>
                </div>
            </div>
        `;
    }

    updateLegend() {
        const legend = document.getElementById('mapLegend');
        
        if (this.trips.length === 0) {
            legend.innerHTML = '<span style="color: var(--color-text-secondary);">No trips loaded</span>';
            return;
        }

        legend.innerHTML = this.trips.map(trip => {
            const stoppageCount = this.detectedStoppages.filter(s => s.tripId === trip.id).length;
            return `
                <div class="legend-item">
                    <div class="legend-marker" style="background-color: ${trip.color}"></div>
                    <span>${trip.id} (${stoppageCount} stops)</span>
                </div>
            `;
        }).join('');
    }

    updateAnalytics() {
        // Update summary
        const totalStoppages = this.detectedStoppages.length;
        const totalStopTime = this.detectedStoppages.reduce((sum, s) => sum + s.duration, 0);
        const avgStopDuration = totalStoppages > 0 ? totalStopTime / totalStoppages : 0;
        const longestStop = totalStoppages > 0 ? Math.max(...this.detectedStoppages.map(s => s.duration)) : 0;

        document.getElementById('totalStoppages').textContent = totalStoppages;
        document.getElementById('totalStopTime').textContent = this.formatDuration(totalStopTime);
        document.getElementById('avgStopDuration').textContent = this.formatDuration(avgStopDuration);
        document.getElementById('longestStop').textContent = this.formatDuration(longestStop);

        // Update duration chart
        this.updateDurationChart();

        // Update algorithm comparison
        this.updateAlgorithmComparison();
    }

    updateDurationChart() {
        const ctx = document.getElementById('durationChart').getContext('2d');
        
        if (this.durationChart) {
            this.durationChart.destroy();
        }

        if (this.detectedStoppages.length === 0) {
            // Show empty chart
            this.durationChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['No Data'],
                    datasets: [{
                        label: 'Number of Stoppages',
                        data: [0],
                        backgroundColor: '#cccccc',
                        borderColor: '#cccccc',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                }
            });
            return;
        }

        const durations = this.detectedStoppages.map(s => s.duration);
        const bins = [0, 5, 10, 20, 30, 60, 120, Infinity];
        const binLabels = ['0-5m', '5-10m', '10-20m', '20-30m', '30-60m', '1-2h', '2h+'];
        const binCounts = new Array(bins.length - 1).fill(0);

        durations.forEach(duration => {
            for (let i = 0; i < bins.length - 1; i++) {
                if (duration >= bins[i] && duration < bins[i + 1]) {
                    binCounts[i]++;
                    break;
                }
            }
        });

        this.durationChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: binLabels,
                datasets: [{
                    label: 'Number of Stoppages',
                    data: binCounts,
                    backgroundColor: '#1FB8CD',
                    borderColor: '#1FB8CD',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    updateAlgorithmComparison() {
        const comparison = document.getElementById('algorithmComparison');
        const algorithmCounts = {};

        this.detectedStoppages.forEach(stoppage => {
            const algorithm = stoppage.algorithm;
            algorithmCounts[algorithm] = (algorithmCounts[algorithm] || 0) + 1;
        });

        comparison.innerHTML = Object.keys(algorithmCounts).length > 0 
            ? Object.keys(algorithmCounts).map(algorithm => `
                <div class="comparison-item">
                    <span class="algorithm-name">${algorithm}</span>
                    <span class="algorithm-count">${algorithmCounts[algorithm]}</span>
                </div>
            `).join('') 
            : '<div class="comparison-item"><span class="algorithm-name">No results yet</span><span class="algorithm-count">-</span></div>';
    }

    compareAlgorithms() {
        if (this.trips.length === 0) {
            this.showMessage('warning', 'No trip data loaded');
            return;
        }

        // Temporarily enable all algorithms for comparison
        const originalSettings = { ...this.algorithms };
        this.algorithms = { timeGap: true, speed: true, clustering: true, hybrid: true };

        const results = {};
        results.timeGap = [];
        results.speed = [];
        results.clustering = [];
        results.hybrid = [];

        this.trips.forEach(trip => {
            results.timeGap.push(...this.detectTimeGapStoppages(trip));
            results.speed.push(...this.detectSpeedBasedStoppages(trip));
            results.clustering.push(...this.detectClusteringStoppages(trip));
            results.hybrid.push(...this.detectHybridStoppages(trip));
        });

        // Restore original settings
        this.algorithms = originalSettings;

        // Display comparison
        this.showAlgorithmComparisonModal(results);
    }

    showAlgorithmComparisonModal(results) {
        const modal = document.createElement('div');
        modal.id = 'comparison-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); z-index: 10000;
            display: flex; align-items: center; justify-content: center;
            padding: 20px;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: var(--color-surface); 
            padding: 2rem;
            border-radius: var(--radius-lg); 
            max-width: 600px; 
            width: 100%;
            max-height: 80vh; 
            overflow-y: auto;
            color: var(--color-text);
            border: 1px solid var(--color-border);
        `;

        content.innerHTML = `
            <h2 style="margin-top: 0; color: var(--color-primary);">Algorithm Comparison Results</h2>
            <p style="color: var(--color-text-secondary); margin-bottom: 1.5rem;">Analysis across ${this.trips.length} trip(s)</p>
            ${Object.keys(results).map(algorithm => {
                const count = results[algorithm].length;
                const avgDuration = count > 0 ? results[algorithm].reduce((sum, s) => sum + s.duration, 0) / count : 0;
                const titles = {
                    timeGap: 'Time-Gap Detection',
                    speed: 'Speed-Based Detection', 
                    clustering: 'Location Clustering',
                    hybrid: 'Hybrid Multi-Criteria'
                };
                return `
                    <div style="margin-bottom: 1rem; padding: 1rem; background: var(--color-bg-1); border-radius: var(--radius-base); border: 1px solid var(--color-border);">
                        <h3 style="color: var(--color-text); margin-top: 0;">${titles[algorithm] || algorithm}</h3>
                        <p style="margin: 0.5rem 0;">Stoppages Found: <strong>${count}</strong></p>
                        <p style="margin: 0.5rem 0;">Average Duration: <strong>${this.formatDuration(avgDuration)}</strong></p>
                    </div>
                `;
            }).join('')}
            <button id="closeModal" 
                    style="background: var(--color-primary); color: var(--color-btn-primary-text); 
                           border: none; padding: 0.75rem 1.5rem; border-radius: var(--radius-base); 
                           cursor: pointer; width: 100%; font-size: var(--font-size-base); margin-top: 1rem;">
                Close Comparison
            </button>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        // Add close event listener
        document.getElementById('closeModal').addEventListener('click', () => {
            modal.remove();
        });

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    updateMapView(mode) {
        if (mode === 'heatmap') {
            // Simple density visualization
            this.stoppageLayer.clearLayers();
            
            this.detectedStoppages.forEach(stoppage => {
                const heatRadius = Math.max(100, stoppage.duration * 10);
                const circle = L.circle([stoppage.latitude, stoppage.longitude], {
                    color: 'rgba(255, 0, 0, 0.3)',
                    fillColor: 'rgba(255, 0, 0, 0.1)',
                    radius: heatRadius,
                    weight: 1
                }).addTo(this.stoppageLayer);
                
                circle.bindPopup(this.createStoppagePopup(stoppage));
            });
        } else {
            this.visualizeStoppages();
        }
    }

    exportResults(format) {
        if (this.detectedStoppages.length === 0) {
            this.showMessage('warning', 'No stoppages to export');
            return;
        }

        const data = this.detectedStoppages.map(s => ({
            id: s.id,
            tripId: s.tripId,
            equipmentId: s.equipmentId,
            algorithm: s.algorithm,
            startTime: s.startTime.toISOString(),
            endTime: s.endTime.toISOString(),
            duration: s.duration,
            latitude: s.latitude,
            longitude: s.longitude,
            confidence: s.confidence,
            type: s.type
        }));

        if (format === 'csv') {
            const csv = this.convertToCSV(data);
            this.downloadFile(csv, 'stoppages.csv', 'text/csv');
        } else if (format === 'json') {
            const json = JSON.stringify({
                trips: this.trips.map(t => ({
                    id: t.id,
                    equipmentId: t.equipmentId,
                    startTime: t.startTime.toISOString(),
                    endTime: t.endTime.toISOString(),
                    totalDistance: t.totalDistance,
                    avgSpeed: t.avgSpeed
                })),
                stoppages: data
            }, null, 2);
            this.downloadFile(json, 'stoppages.json', 'application/json');
        }

        this.showMessage('success', `Results exported as ${format.toUpperCase()}`);
    }

    convertToCSV(data) {
        if (data.length === 0) return '';
        const headers = Object.keys(data[0]);
        const rows = data.map(row => headers.map(header => `"${row[header]}"`).join(','));
        return [headers.join(','), ...rows].join('\n');
    }

    downloadFile(content, filename, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    formatDuration(minutes) {
        if (minutes < 1) {
            return `${Math.round(minutes * 60)}s`;
        }
        if (minutes < 60) {
            return `${Math.round(minutes)}m`;
        }
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return `${hours}h ${mins}m`;
    }

    showMessage(type, message) {
        const container = document.getElementById('statusMessages');
        const messageEl = document.createElement('div');
        messageEl.className = `status-message status-message--${type}`;
        messageEl.textContent = message;
        
        container.appendChild(messageEl);
        
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, 5000);
    }
}

// Initialize the application
let detector;
document.addEventListener('DOMContentLoaded', () => {
    detector = new AdvancedStoppageDetector();
});