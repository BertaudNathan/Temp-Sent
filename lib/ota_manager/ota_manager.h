#pragma once

// ============================================================
// ota_manager.h — Interface OTA (Over-The-Air update)
// Mise à jour firmware via WiFi (ArduinoOTA, port 3232).
// Protégé par mot de passe (OTA_PASSWORD).
// ============================================================

/**
 * @brief Initialise et configure ArduinoOTA.
 * Configure le hostname, le mot de passe et les callbacks
 * (progression LED, gestion des erreurs).
 * À appeler une fois dans setup(), après la connexion WiFi.
 */
void ota_init();

/**
 * @brief Traite les requêtes OTA en attente.
 * Non bloquant — à appeler à chaque itération du loop().
 */
void ota_handle();
