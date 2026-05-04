#pragma once

#include <stdint.h>

// ============================================================
// actuator.h — Interface pilotage moteur DC (PWM)
// Récepteur uniquement. Contrôle uniquement la vitesse (0–100%).
// Gère le mode arrêt d'urgence.
// ============================================================

/**
 * @brief Structure représentant l'état courant de l'actionneur.
 */
struct ActuatorState {
    uint8_t  motor_speed_pct; // Vitesse moteur (0–100 %)
    bool     emergency_stop;  // true = arrêt d'urgence actif
    uint32_t last_updated;    // millis() de la dernière mise à jour
};

/**
 * @brief Initialise la sortie PWM du moteur.
 * Utilise un `analogWrite()` classique sur la broche définie dans config.h.
 */
void actuator_init();

/**
 * @brief Règle la vitesse du moteur.
 * Clamp automatique entre 0 et 100 %.
 * Sans effet si le mode arrêt d'urgence est actif.
 * @param vitesse_pct Vitesse souhaitée en pourcentage (0–100).
 */
void actuator_set_vitesse(uint8_t vitesse_pct);

/**
 * @brief Déclenche l'arrêt d'urgence (moteur à 0, flag actif).
 * La vitesse ne peut plus être modifiée jusqu'à actuator_reset().
 */
void actuator_emergency_stop();

/**
 * @brief Réinitialise le mode arrêt d'urgence.
 * Remet la vitesse à 0 % après la réinitialisation.
 */
void actuator_reset();

/**
 * @brief Retourne l'état courant de l'actionneur.
 * @return Copie de l'état interne (ActuatorState).
 */
ActuatorState actuator_get_etat();
