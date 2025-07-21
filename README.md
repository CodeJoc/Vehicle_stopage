# Vehicle Stoppage Identification and Visualization Tool

A comprehensive web-based solution for analyzing GPS tracking data to identify and visualize vehicle stoppages with advanced algorithms designed to handle real-world data challenges.

![Vehicle Stoppage Detection](https://img.shields.io/badge/Status-Active-brightgreen) ![License](https://img.shields.io/badge/License-MIT-blue) ![HTML](https://img.shields.io/badge/HTML-5-orange) ![JavaScript](https://img.shields.io/badge/JavaScript-ES6-yellow) ![CSS](https://img.shields.io/badge/CSS-3-blue)

## 🚗 Overview

This tool processes GPS data streams (both real-time and historical) to automatically detect vehicle stoppages and present them on an interactive map. Unlike basic speed-based detection systems, this enhanced solution uses multiple sophisticated algorithms to handle sparse data, large time gaps, and real-world GPS tracking challenges.

## ✨ Key Features

### 🎯 Multiple Detection Algorithms
- **Time-gap Detection**: Specifically designed for sparse GPS data with large time intervals
- **Location Clustering**: Groups nearby GPS points to identify frequent stopping areas
- **Speed-based Detection**: Enhanced traditional approach with adaptive thresholds
- **Hybrid Algorithm**: Combines multiple methods for optimal accuracy

### 🔄 Automatic Trip Segmentation
- Automatically detects large time gaps in GPS data
- Treats each segment as a separate vehicle/trip
- Configurable time threshold (10-240 minutes)
- Visual separation with different colors for each trip

### 📊 Advanced Data Processing
- **Data Quality Assessment**: Identifies and reports GPS data issues
- **Outlier Detection**: Removes unrealistic GPS jumps and speed values
- **Trajectory Smoothing**: Reduces GPS noise using filtering techniques
- **Missing Data Handling**: Gracefully handles incomplete GPS datasets

### 🗺️ Interactive Visualization
- **Multi-trip Display**: Each trip rendered in different colors
- **Stoppage Markers**: Distinct markers for identified stopping locations
- **Detailed Popups**: Click markers to view comprehensive stoppage information
- **Route Visualization**: Complete vehicle paths with color-coded segments
- **Zoom & Pan**: Standard map controls with auto-fit functionality

### 📈 Comprehensive Analytics
- **Trip Statistics**: Duration, distance, and stoppage counts per trip
- **Stoppage Analysis**: Detailed breakdown of stop duration and frequency
- **Data Quality Metrics**: Assessment of GPS data reliability
- **Export Functionality**: CSV export for detailed analysis

## 🛠️ Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Mapping**: Leaflet.js for interactive maps and OpenStreetMap tiles
- **Data Processing**: Custom algorithms for GPS data analysis
- **File Handling**: Client-side CSV parsing and export functionality
- **Visualization**: Custom markers and polylines with responsive design

## 🚀 Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- No server setup required - runs entirely in the browser

### Installation
1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/vehicle-stoppage-detection.git
   cd vehicle-stoppage-detection
   ```

2. **Open in Browser**
   ```bash
   # Simply open the HTML file in your browser
   open vehicle_stoppage_tool.html
   # or
   double-click the file to open in your default browser
   ```

### Quick Start
1. **Load Sample Data**: Click "Load Sample Data" to see the tool in action
2. **Adjust Parameters**: Use sliders to modify detection sensitivity
3. **Upload Your Data**: Use the file upload to process your own GPS files
4. **Analyze Results**: Interact with the map and export findings

## 📋 Usage Instructions

### Data Format Requirements
Your GPS data should be in CSV format with the following columns:
```csv
EquipmentId,latitude,longitude,speed,odometer reading,eventDate,eventGeneratedTime
EQPT-4,12.9294916,74.9173533,0,750424,1716229800000,1716229815000
```

### Column Descriptions
- **EquipmentId**: Unique vehicle identifier
- **latitude**: GPS latitude coordinate (decimal degrees)
- **longitude**: GPS longitude coordinate (decimal degrees)
- **speed**: Vehicle speed (km/h, optional but improves accuracy)
- **odometer reading**: Cumulative distance traveled (meters)
- **eventDate**: Event date timestamp (Unix timestamp)
- **eventGeneratedTime**: Event generation timestamp (Unix timestamp)

### Configuration Options

#### Trip Segmentation
- **Threshold Range**: 10-240 minutes
- **Default**: 60 minutes
- **Purpose**: Separates GPS tracks when time gaps exceed threshold

#### Detection Algorithms
1. **Time-gap Detection**: Best for sparse data with large time intervals
2. **Location Clustering**: Ideal for identifying frequent stopping locations
3. **Speed-based Detection**: Traditional approach with enhancements
4. **Hybrid Algorithm**: Combines all methods (recommended)

#### Stoppage Parameters
- **Minimum Duration**: 1-30 minutes (default: 5 minutes)
- **Distance Tolerance**: Configurable radius for location clustering
- **Speed Threshold**: Maximum speed considered as "stopped"

### Viewing Results

#### Map Features
- **Color-coded Routes**: Each trip displays in a different color
- **Stoppage Markers**: Red circular markers indicate stopping locations
- **Interactive Popups**: Click markers for detailed information including:
  - Reach time and departure time
  - Total stoppage duration
  - Geographic coordinates
  - Trip association

#### Statistics Panel
- **Per-trip Analysis**: Individual statistics for each detected trip
- **Overall Metrics**: Combined statistics across all trips
- **Data Quality Indicators**: Warnings for potential data issues

### Export Options
- **Stoppage Summary**: Detailed CSV with all detected stoppages
- **Trip Analysis**: Per-trip statistics and route information
- **Data Quality Report**: Assessment of GPS data reliability

## 🎯 Problem Solving

### Common Issues and Solutions

#### Issue: Only One Stoppage Detected
**Cause**: Large time gaps in GPS data or inappropriate algorithm selection
**Solution**: 
- Enable trip segmentation with appropriate time threshold
- Use "Time-gap Detection" algorithm for sparse data
- Lower the minimum stoppage duration threshold

#### Issue: Too Many False Positives
**Cause**: GPS noise or overly sensitive parameters
**Solution**:
- Increase minimum stoppage duration
- Use higher speed thresholds
- Enable data quality filtering

#### Issue: Missing Known Stoppages
**Cause**: Insufficient GPS data density or restrictive parameters
**Solution**:
- Lower detection thresholds
- Use "Hybrid Algorithm" for comprehensive detection
- Check data quality metrics for gaps

## 📊 Algorithm Details

### Time-gap Detection
```javascript
// Identifies large time gaps as potential extended stops
if (timeDiff > segmentationThreshold) {
    // Create new trip segment
    // Previous gap treated as stoppage
}
```

### Location Clustering
```javascript
// Groups nearby GPS points to identify stopping areas
const clusters = clusterNearbyPoints(gpsData, distanceThreshold);
const stoppages = identifyStoppagesFromClusters(clusters, timeThreshold);
```

### Hybrid Approach
```javascript
// Combines multiple algorithms for robust detection
const timeGapStops = detectTimeGapStoppages(data, threshold);
const clusterStops = detectClusterStoppages(data, params);
const speedStops = detectSpeedStoppages(data, speedThreshold);
const combinedResults = mergeAndValidateResults([timeGapStops, clusterStops, speedStops]);
```

## 🔧 Advanced Configuration

### Custom Algorithm Parameters
```javascript
const config = {
    segmentationThreshold: 60 * 60 * 1000, // 60 minutes in milliseconds
    minimumStoppageDuration: 5 * 60 * 1000, // 5 minutes
    distanceThreshold: 50, // 50 meters
    speedThreshold: 5, // 5 km/h
    dataQualityCheck: true
};
```

### Data Quality Thresholds
```javascript
const qualityMetrics = {
    maxReasonableSpeed: 150, // km/h
    maxDistanceJump: 5000, // meters
    minSamplingRate: 30000, // milliseconds
    requiredAccuracy: 10 // meters
};
```

## 🤝 Contributing

We welcome contributions to improve the Vehicle Stoppage Detection Tool! Here's how you can help:

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit with descriptive messages: `git commit -m "Add feature description"`
5. Push to your fork: `git push origin feature-name`
6. Submit a Pull Request

### Contribution Areas
- **Algorithm Improvements**: Enhanced detection algorithms
- **Data Format Support**: Additional GPS data formats
- **UI/UX Enhancements**: Improved user interface and experience
- **Performance Optimization**: Faster processing for large datasets
- **Mobile Responsiveness**: Better mobile device support
- **Documentation**: Improved guides and examples

### Code Style Guidelines
- Use meaningful variable and function names
- Add comments for complex algorithms
- Maintain consistent indentation (2 spaces)
- Test with various GPS data formats
- Ensure browser compatibility

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Leaflet.js**: For excellent mapping capabilities
- **OpenStreetMap**: For providing free map tiles
- **Contributors**: Thanks to all contributors who help improve this tool

## 📞 Support

If you encounter issues or have questions:

1. **Check Documentation**: Review this README and inline code comments
2. **Search Issues**: Look through existing GitHub issues
3. **Create Issue**: Open a new issue with:
   - Clear problem description
   - Sample data (if possible)
   - Browser and system information
   - Steps to reproduce the issue

## 🗺️ Roadmap

### Upcoming Features
- [ ] **Real-time GPS Processing**: Live GPS data stream support
- [ ] **Machine Learning Integration**: AI-powered stoppage pattern recognition
- [ ] **Multi-vehicle Analysis**: Simultaneous processing of multiple vehicle tracks
- [ ] **Geofencing Support**: Custom area-based stoppage detection
- [ ] **API Integration**: REST API for programmatic access
- [ ] **Mobile App**: Companion mobile application
- [ ] **Advanced Analytics**: Statistical analysis and reporting dashboard

### Long-term Goals
- Integration with popular GPS tracking platforms
- Support for additional data formats (GPX, KML, etc.)
- Cloud-based processing for large datasets
- Team collaboration features
- Custom alert systems for real-time monitoring

## 📈 Performance Notes

- **Optimal Data Size**: Works efficiently with datasets up to 100,000 GPS points
- **Browser Requirements**: Modern browsers with HTML5 support
- **Memory Usage**: Approximately 1MB per 10,000 GPS points
- **Processing Speed**: ~1000 points per second on typical hardware

---

**Made with ❤️ for better GPS data analysis**