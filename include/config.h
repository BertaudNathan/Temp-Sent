#pragma once
// Réseau WiFi
#define WIFI_SSID              "SamsungA52s"
#define WIFI_PASS              "nathanleboss"
#define WIFI_CONNECT_TIMEOUT_MS 15000   // Délai max de connexion initiale (ms)

// Broker MQTT (Raspberry Pi Mosquitto)
#define MQTT_HOST              "192.168.175.45"
#define MQTT_PORT              1883
#define MQTT_USER              ""           // Laisser vide si non requis
#define MQTT_PASS              ""           // Laisser vide si non requis
#define MQTT_KEEPALIVE_S       60           // Keep-alive MQTT en secondes

// Capteur DHT22
#define PIN_DHT                4       // GPIO connecté au DATA du DHT22
#define DHT_TYPE               DHT22

// LED de statut
#define PIN_LED                15       // GPIO LED embarquée (active HIGH)

// Moteur DC 2 fils (récepteur uniquement)
#define PIN_MOTOR_PWM          18      // GPIO signal PWM moteur (via transistor)
#define PWM_CHANNEL            0       // Canal LEDC (0–15)
#define PWM_FREQ_HZ            1000    // Fréquence PWM (Hz) — 1 kHz adapté transistor NPN + moteur DC
#define PWM_RESOLUTION_BITS    8       // Résolution : 0–255

// Seuils de régulation thermique automatique (récepteur)
// Le moteur s'enclenche si temp >= TEMP_THRESHOLD_C OU humi >= HUMIDITY_THRESHOLD_PCT.
// Il s'arrête uniquement quand temp ET humi repassent sous leur seuil réduit de ALERT_HYSTERESIS_PCT %.
#define TEMP_THRESHOLD_C        26.0f  // Seuil température déclenchant le moteur (°C)
#define HUMIDITY_THRESHOLD_PCT  70.0f  // Seuil humidité déclenchant le moteur (%)
#define MOTOR_SPEED_ALERT_PCT   75     // Vitesse moteur en mode alerte (0–100 %)
#define ALERT_HYSTERESIS_PCT    15     // Hystérésis de coupure : OFF si 15 % sous le seuil

// Topic wildcard : récepteur écoute toutes les télémétries capteurs
#define TOPIC_SENSOR_WILDCARD   "iot/sensors/+/telemetry"

// Intervalles et temporisations
#define SENSOR_INTERVAL_MS     5000    // Intervalle entre deux lectures capteur
#define RECONNECT_BASE_DELAY_MS 1000  // Délai initial de reconnexion
#define RECONNECT_MAX_DELAY_MS  30000 // Délai maximum de reconnexion (back-off)

// OTA (Over-The-Air update)
// OTA_HOSTNAME = device_id_get() (dérivé de la MAC, cf. device.h)
#define OTA_PASSWORD           "ota-secret-password"

// Firmware
#define FIRMWARE_VERSION       "1.0.0"
