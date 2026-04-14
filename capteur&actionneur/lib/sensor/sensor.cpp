// ============================================================
// sensor.cpp — Implémentation lecture capteur DHT11
// ============================================================

#include "sensor.h"
#include "config.h"
#include <DHT.h>
#include <Arduino.h>

// Instance DHT statique (locale au module)
static DHT dht(PIN_DHT, DHT_TYPE);

// -----------------------------------------------------------
// Initialise le capteur DHT11
// -----------------------------------------------------------
void sensor_init() {
    dht.begin();
    Serial.printf("[Sensor] DHT11 initialisé sur pin %d\n", PIN_DHT);
}

// -----------------------------------------------------------
// Lit température et humidité depuis le DHT11.
// Retourne valid=false si la valeur est NaN (lecture ratée).
// -----------------------------------------------------------
SensorData sensor_lire() {
    SensorData data;
    data.timestamp   = millis();
    data.temperature = dht.readTemperature();
    data.humidity    = dht.readHumidity();

    // Validation : isnan() détecte les erreurs de lecture DHT
    data.valid = !isnan(data.temperature) && !isnan(data.humidity);

    if (data.valid) {
        Serial.printf("[Sensor] T=%.1f°C  H=%.1f%%\n",
                      data.temperature, data.humidity);
    } else {
        Serial.println(F("[Sensor] Echec de lecture DHT11"));
    }

    return data;
}
