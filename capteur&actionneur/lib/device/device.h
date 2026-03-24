#pragma once

#include <stddef.h>

// ============================================================
// device.h — Identifiant unique basé sur l'adresse MAC ESP32
// L'ID est généré une seule fois dans device_init() au format
// "esp32-AABBCC" (3 derniers octets de la MAC en hex minuscule).
// Tous les topics MQTT sont construits à partir de cet ID.
// ============================================================

/**
 * @brief Génère l'identifiant unique du device depuis la MAC WiFi.
 * Construit aussi tous les topics MQTT dérivés.
 * À appeler en premier dans setup(), avant WiFi et MQTT.
 */
void device_init();

/**
 * @brief Retourne l'identifiant unique du device.
 * @return ex: "esp32-a1b2c3"
 */
const char* device_id_get();

// ------------------------------------------------------------
// Topics MQTT correspondant à ce device
// Disponibles après un appel à device_init().
// ------------------------------------------------------------

/** Topic de publication des mesures : iot/sensors/<id>/telemetry */
const char* device_topic_telemetry();

/** Topic de publication des métadonnées : iot/sensors/<id>/info */
const char* device_topic_info();

/** Topic de publication des erreurs : iot/sensors/<id>/errors */
const char* device_topic_errors();

/** Topic d'écoute des commandes : iot/actuators/<id>/command */
const char* device_topic_command();

/** Topic de publication du statut : iot/actuators/<id>/status */
const char* device_topic_status();
