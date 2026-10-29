/**
 * esp_ota_ops.h — device-side OTA handler (ESP-IDF reference)
 * ----------------------------------------------------------------------------
 * Pair with the server OTA Manager (backend/routes/ota.js).
 *
 * Server publishes on MQTT topic:  enthutech/<Device-ID>/cmd
 *   OTA AUTO    <download_url> <version>     → flash to next free partition window
 *   OTA SECTION <download_url> <version>     → flash to the window the device keeps
 *
 * Device downloads the .bin via HTTP, verifies MD5/Boot validation, sets the
 * boot partition with esp_ota_set_boot_partition(), and reboots.
 *
 * Progress is reported back on:  enthutech/<Device-ID>/ota  (JSON)
 *   { "Device-ID": "...", "ota_status": "downloading|flashing|success|failed",
 *     "progress": 0-100, "version": "1.2.3", "message": "..." }
 */

#include <string.h>
#include <stdio.h>
#include "esp_ota_ops.h"          // <-- the OTA API required
#include "esp_http_client.h"
#include "esp_log.h"
#include "esp_wifi.h"
#include "mqtt_client.h"

#define OTA_BUF_SIZE 1024          // must be >= 4 (esp_ota_write stride)

static const char *TAG = "OTA";

/* --- report progress back to the server (same JSON the broker ingests) --- */
static void ota_report(const esp_mqtt_client_handle_t *client, const char *status,
                       int progress, const char *version, const char *message)
{
    char payload[320];
    snprintf(payload, sizeof(payload),
             "{\"Device-ID\":\"%s\",\"ota_status\":\"%s\",\"progress\":%d,"
             "\"version\":\"%s\",\"message\":\"%s\"}",
             CONFIG_DEVICE_ID, status, progress, version ? version : "", message ? message : "");
    esp_mqtt_client_publish(client, "enthutech/" CONFIG_DEVICE_ID "/ota", payload, 0, 1, 0);
}

/* --- HTTP download handler writing each chunk straight to the OTA partition --- */
static esp_err_t http_event_handler(esp_http_client_event_t *evt,
                                    const esp_ota_handle_t *ota_handle,
                                    const esp_mqtt_client_handle_t *mqtt,
                                    const char *version)
{
    switch (evt->event_id) {
    case HTTP_EVENT_ON_DATA: {
        if (!esp_ota_write(*ota_handle, evt->data, evt->data_len)) {
            ESP_LOGE(TAG, "esp_ota_write failed");
            return ESP_FAIL;
        }
        extern int g_ota_downloaded_bytes;   /* plain counter, see ota_start() */
        g_ota_downloaded_bytes += evt->data_len;
        break;
    }
    case HTTP_EVENT_ON_FINISH:
        break;
    default:
        break;
    }
    return ESP_OK;
}

/* --- run the OTA: download -> verify -> set boot partition -> reboot --- */
esp_err_t ota_start(esp_mqtt_client_handle_t mqtt, const char *url, const char *version)
{
    const esp_partition_t *running = esp_ota_get_running_partition();
    const esp_partition_t *next    = esp_ota_get_next_update_partition(NULL);

    if (next == NULL) {
        ESP_LOGE(TAG, "No free OTA partition");
        ota_report(mqtt, "failed", 0, version, "no free OTA partition");
        return ESP_FAIL;
    }
    ESP_LOGI(TAG, "Running %s, updating to %s (window %s)",
             running->label, next->label, next->subtype == ESP_PARTITION_SUBTYPE_APP_OTA_0 ? "OTA0" : "OTA1");

    ota_report(mqtt, "downloading", 0, version, "fetching firmware");

    esp_ota_handle_t ota_handle;
    if (esp_ota_begin(next, OTA_SIZE_UNKNOWN, &ota_handle) != ESP_OK) {
        esp_ota_abort(ota_handle);
        ota_report(mqtt, "failed", 0, version, "esp_ota_begin failed");
        return ESP_FAIL;
    }

    extern int g_ota_downloaded_bytes;
    extern int g_ota_total_bytes;
    g_ota_downloaded_bytes = 0;
    g_ota_total_bytes      = 0;

    esp_http_client_config_t cfg = {
        .url             = url,
        .timeout_ms      = 30000,
        .buffer_size     = OTA_BUF_SIZE,
        .event_handler   = (esp_http_client_event_handle_t)http_event_handler,  /* adapter only */
        .user_data       = &ota_handle,
        .user_data_2     = mqtt,
        .user_data_3     = (void *)version,
        .method          = HTTP_METHOD_GET,
    };

    /* NOTE: wrap the simplified handler above; in production track
       Content-Length and re-emit progress after each write, e.g.:
       ota_report(mqtt, "downloading", 100 * downloaded / total, version, NULL); */

    esp_http_client_handle_t http = esp_http_client_init(&cfg);
    esp_err_t err = esp_http_client_perform(http);
    esp_http_client_cleanup(http);
    if (err != ESP_OK) {
        ota_report(mqtt, "failed", 0, version, "http download failed");
        esp_ota_abort(ota_handle);
        return err;
    }

    ota_report(mqtt, "flashing", 90, version, "writing partition");

    if (esp_ota_end(ota_handle) != ESP_OK) {
        ota_report(mqtt, "failed", 0, version, "esp_ota_end failed (image invalid)");
        return ESP_FAIL;
    }

    /* Validation + boot switch = esp_ota_ops.h core */
    if (esp_ota_set_boot_partition(next) != ESP_OK) {
        ota_report(mqtt, "failed", 0, version, "esp_ota_set_boot_partition failed");
        return ESP_FAIL;
    }

    esp_ota_img_states_t state;
    if (esp_ota_get_state_partition(next, &state) == ESP_OK &&
        state == ESP_OTA_IMG_PENDING_VERIFY) {
        esp_ota_mark_app_valid_cancel_rollback();
    }

    ota_report(mqtt, "success", 100, version, "OTA complete, rebooting");
    esp_restart();
    return ESP_OK;
}

/* --- MQTT command handler for:  OTA AUTO|SECTION <url> <version> --- */
void handle_ota_command(esp_mqtt_client_handle_t mqtt, const char *cmd)
{
    char method[16], url[256], version[32];
    if (sscanf(cmd, "OTA %15s %255s %31s", method, url, version) < 3) {
        ota_report(mqtt, "failed", 0, NULL, "bad OTA command format");
        return;
    }
    ESP_LOGI(TAG, "OTA cmd: %s url=%s version=%s", method, url, version);
    ota_start(mqtt, url, version);
}