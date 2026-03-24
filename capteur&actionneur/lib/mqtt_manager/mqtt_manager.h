#pragma once

#include <functional>

// ============================================================
// mqtt_manager.h — Interface de gestion MQTT
// Connexion, publication et maintien de la connexion MQTT.
// Reconnexion automatique avec back-off exponentiel.
// ============================================================

/** Type du callback de réception de messages MQTT. */
using MqttCallback = std::function<void(char*, uint8_t*, unsigned int)>;

/**
 * @brief Initialise le client MQTT (serveur, port, callback).
 * @param callback Fonction appelée à la réception d'un message.
 *                 Passer nullptr si aucun abonnement n'est requis.
 */
void mqtt_init(MqttCallback callback);

/**
 * @brief Connexion MQTT initiale (bloquante, tentatives jusqu'au succès).
 * Publie les métadonnées matérielles après connexion réussie.
 */
void mqtt_connecter();

/**
 * @brief Publie une chaîne de caractères sur un topic MQTT.
 * @param topic   Topic de destination.
 * @param payload Contenu du message (chaîne JSON ou texte).
 * @return true si la publication a réussi.
 */
bool mqtt_publier(const char* topic, const char* payload);

/**
 * @brief Vérifie si le client MQTT est connecté.
 * @return true si la connexion est active.
 */
bool mqtt_est_connecte();

/**
 * @brief Maintient la connexion et traite les messages entrants.
 * Tente une reconnexion avec back-off si nécessaire.
 * À appeler dans chaque itération du loop().
 */
void mqtt_maintenir();

/**
 * @brief Abonne le client à un topic MQTT.
 * L'abonnement est mémorisé et rejoué automatiquement après chaque reconnexion.
 * @param topic Topic à écouter.
 */
void mqtt_abonner(const char* topic);
