/**
 * Utilitaires pour les opérations géospatiales
 */

/**
 * Calcule la distance entre deux points géographiques (en kilomètres)
 * @param {Array} point1 - Coordonnées [longitude, latitude] du premier point
 * @param {Array} point2 - Coordonnées [longitude, latitude] du deuxième point
 * @returns {Number} - Distance en kilomètres
 */
const calculateDistance = (point1, point2) => {
  const [lon1, lat1] = point1;
  const [lon2, lat2] = point2;
  
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Convertit des degrés en radians
 * @param {Number} degrees - Angle en degrés
 * @returns {Number} - Angle en radians
 */
const toRad = (degrees) => {
  return degrees * Math.PI / 180;
};

/**
 * Vérifie si un point est à l'intérieur d'un polygone
 * @param {Array} point - Coordonnées [longitude, latitude] du point
 * @param {Array} polygon - Tableau de coordonnées [longitude, latitude] formant un polygone
 * @returns {Boolean} - True si le point est dans le polygone
 */
const isPointInPolygon = (point, polygon) => {
  const [lon, lat] = point;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    
    const intersect = ((yi > lat) !== (yj > lat)) &&
        (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
};

/**
 * Crée un cercle géographique (approximation par un polygone)
 * @param {Array} center - Coordonnées [longitude, latitude] du centre
 * @param {Number} radiusKm - Rayon en kilomètres
 * @param {Number} points - Nombre de points pour l'approximation (défaut: 32)
 * @returns {Array} - Tableau de coordonnées [longitude, latitude] formant un cercle
 */
const createCircle = (center, radiusKm, points = 32) => {
  const [lon, lat] = center;
  const circle = [];
  
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = radiusKm / 111.32 * Math.cos(angle);
    const dy = radiusKm / (111.32 * Math.cos(toRad(lat))) * Math.sin(angle);
    
    circle.push([lon + dx, lat + dy]);
  }
  
  // Fermer le polygone
  circle.push(circle[0]);
  
  return circle;
};

/**
 * Trouve les zones à risque (hotspots) basées sur la densité des alertes
 * @param {Array} points - Tableau de coordonnées [longitude, latitude]
 * @param {Number} radiusKm - Rayon de recherche en kilomètres
 * @param {Number} minPoints - Nombre minimum de points pour former un hotspot
 * @returns {Array} - Tableau de hotspots avec leurs coordonnées et densité
 */
const findHotspots = (points, radiusKm, minPoints) => {
  const hotspots = [];
  
  for (const point of points) {
    let count = 0;
    
    for (const otherPoint of points) {
      if (calculateDistance(point, otherPoint) <= radiusKm) {
        count++;
      }
    }
    
    if (count >= minPoints) {
      // Vérifier si ce hotspot n'est pas déjà couvert par un autre
      let isNewHotspot = true;
      
      for (const hotspot of hotspots) {
        if (calculateDistance(point, hotspot.center) <= radiusKm) {
          isNewHotspot = false;
          break;
        }
      }
      
      if (isNewHotspot) {
        hotspots.push({
          center: point,
          density: count,
          radius: radiusKm
        });
      }
    }
  }
  
  return hotspots;
};

module.exports = {
  calculateDistance,
  isPointInPolygon,
  createCircle,
  findHotspots
};
