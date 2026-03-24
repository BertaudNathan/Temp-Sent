#pragma once

#include <stddef.h>
#include "sensor.h"

// ============================================================
// telemetry.h — Interface de sérialisation JSON des messages MQTT
// Tous les payloads publiés passent par ce module.
// ============================================================

/** Taille du buffer JSON (en octets). */
static constexpr size_t JSON_BUFFER_SIZE = 256;

/**
 * @brief Sérialise une mesure capteur en JSON.
 * Format : {"device_id":"…","temperature":…,"humidity":…,"timestamp":…}
 * @param data   Mesure à sérialiser.
 * @param out    Buffer de sortie.
 * @param len    Taille du buffer.
 * @return true si la sérialisation a réussi.
 */
bool telemetry_serialiser_mesure(const SensorData& data, char* out, size_t len);

/**
 * @brief Sérialise les métadonnées matérielles en JSON.
 * Format : {"device_id":"…","firmware_version":"…","mac":"…","ip":"…","board":"esp32dev"}
 * @param out Buffer de sortie.
 * @param len Taille du buffer.
 * @return true si la sérialisation a réussi.
 */
bool telemetry_serialiser_info(char* out, size_t len);

/**
 * @brief Sérialise une erreur capteur en JSON.
 * Format : {"device_id":"…","error_code":…,"message":"…","timestamp":…}
 * @param code    Code d'erreur.
 * @param message Description de l'erreur.
 * @param out     Buffer de sortie.
 * @param len     Taille du buffer.
 * @return true si la sérialisation a réussi.
 */
bool telemetry_serialiser_erreur(int code, const char* message, char* out, size_t len);

/**
 * @brief Sérialise le statut de l'actionneur en JSON.
 * Format : {"device_id":"…","motor_speed_pct":…,"state":"…","timestamp":…}
 * @param vitesse_pct Vitesse moteur en pourcentage (0–100).
 * @param etat        Chaîne d'état ("OK", "EMERGENCY_STOP", etc.).
 * @param out         Buffer de sortie.
 * @param len         Taille du buffer.
 * @return true si la sérialisation a réussi.
 */
bool telemetry_serialiser_statut(uint8_t vitesse_pct, const char* etat, char* out, size_t len);
