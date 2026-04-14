#pragma once

#include <stdint.h>

// ============================================================
// sensor.h — Interface lecture capteur DHT11
// ============================================================

/**
 * @brief Structure contenant une mesure du capteur.
 * valid = false si la lecture a échoué (NaN ou timeout).
 */
struct SensorData {
    float    temperature;  // Température en °C
    float    humidity;     // Humidité relative en %
    bool     valid;        // true si la mesure est exploitable
    uint32_t timestamp;    // millis() au moment de la lecture
};

/**
 * @brief Initialise le capteur DHT11 (appeler une fois dans setup).
 */
void sensor_init();

/**
 * @brief Lit la température et l'humidité depuis le DHT11.
 * @return SensorData — valid=false si la mesure est invalide.
 */
SensorData sensor_lire();
