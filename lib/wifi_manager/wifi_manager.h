#pragma once

// ============================================================
// wifi_manager.h — Interface de gestion de la connexion WiFi
// Connexion initiale bloquante + reconnexion non-bloquante
// avec back-off exponentiel dans le loop.
// ============================================================

/**
 * @brief Connexion WiFi initiale (bloquante, timeout = WIFI_CONNECT_TIMEOUT_MS).
 * Si le délai est dépassé, l'ESP32 redémarre.
 */
void wifi_connecter();

/**
 * @brief Vérifie si le WiFi est connecté.
 * @return true si la connexion est active.
 */
bool wifi_est_connecte();

/**
 * @brief Maintient la connexion WiFi depuis le loop.
 * Tente une reconnexion avec back-off exponentiel si nécessaire.
 * Non bloquant — retourne immédiatement si le délai n'est pas écoulé.
 */
void wifi_maintenir();
