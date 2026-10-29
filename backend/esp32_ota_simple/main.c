/* ============================================================================
 * Simple ESP32 OTA firmware — for "AT Induser Home Security" server
 * ----------------------------------------------------------------------------
 * - Connects to MQTT broker on 16.112.243.96:1883
 * - Subscribes to:  enthutech/<DEVICE_ID>/cmd
 * - Server sends:   OTA AUTO <url> <version>     or    OTA SECTION <url> <version>
 * - Device downloads the .bin over HTTP, flashes it with esp_ota_ops.h,
 *   sets the boot partition and reboots.
 * - Reports progress to:  enthutech/<DEVICE_ID>/ota
 *
 * Requirements (ESP-IDF v5.x):
 *   - Partition table MUST have two OTA slots (see partitions_ota.csv below)
 *   - In `idf.py menuconfig` → set the MQTT broker address,
 *     or just edit BROKER_URL / DEVICE_ID below.
 * ========================================================================== */

#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_netif.h"
#include "esp_ota_ops.h"           /* <<< the OTA API */
#include "esp_http_client.h"
#include "mqtt_client.h"

static const char *TAG = "HS01_OTA";

/* ---------------- CHANGE THESE ----------------
 * DEVICE_ID must match the DeviceRegistry row in the server DB,
 * e.g. "ET-78421C7A4BB8"                                        */
#define DEVICE_ID   "ET-78421C7A4BB8"
#define BROKER_URL  "mqtt://16.112.243.96:1883"
#define WIFI_SSID   "your_wifi_ssid"
#define WIFI_PASS   "your_wifi_password"
/* ---------------------------------------------- */

static esp_mqtt_client_handle_t mqtt;

/* ---------- report OTA progress back to the server ---------- */
static void ota_report(const char *status, int progress, const char *version, const char *message)
{
    char payload[320];
    snprintf(payload, sizeof(payload),
             "{\"Device-ID\":\"%s\",\"ota_status\":\"%s\",\"progress\":%d,"
             "\"version\":\"%s\",\"message\":\"%s\"}",
             DEVICE_ID, status, progress,
             version ? version : "",
             message ? message : "");
    esp_mqtt_client_publish(mqtt, "enthutech/" DEVICE_ID "/ota", payload, 0, 1, 0);
    ESP_LOGI(TAG, "report: %s", payload);
}

/* ---------- download counter driven by the HTTP handler ---------- */
static int downloaded_bytes = 0;
static int total_bytes      = 0;

static esp_err_t http_event(esp_http_client_event_t *evt)
{
    esp_ota_handle_t *handle = evt->user_data;
    switch (evt->event_id) {
    case HTTP_EVENT_ON_DATA:
        /* write each received chunk straight into the OTA partition */
        if (esp_ota_write(*handle, evt->data, evt->data_len) != ESP_OK) {
            ESP_LOGE(TAG, "esp_ota_write FAILED");
            return ESP_FAIL;
        }
        downloaded_bytes += evt->data_len;
        if (total_bytes > 0) {
            ota_report("downloading", 100 * downloaded_bytes / total_bytes,
                       NULL, NULL);
        }
        break;
    case HTTP_EVENT_ON_HEADERS:
        total_bytes = esp_http_client_get_content_length(evt->client);
        break;
    case HTTP_EVENT_ON_FINISH:
        ota_report("flashing", 95, NULL, "download done");
        break;
    default:
        break;
    }
    return ESP_OK;
}

/* ================= CORE OTA — esp_ota_ops API ================= */
static esp_err_t do_ota(const char *url, const char *version)
{
    const esp_partition_t *running = esp_ota_get_running_partition();
    const esp_partition_t *next    = esp_ota_get_next_update_partition(NULL);

    if (next == NULL) {                          /* no free OTA slot */
        ota_report("failed", 0, version, "no free OTA partition");
        return ESP_FAIL;
    }
    ESP_LOGI(TAG, "running=%s  updating to=%s (%s)",
             running->label, next->label,
             next->subtype == ESP_PARTITION_SUBTYPE_APP_OTA_0 ? "OTA0" : "OTA1");

    ota_report("downloading", 0, version, "fetching firmware");

    esp_ota_handle_t handle;
    if (esp_ota_begin(next, OTA_SIZE_UNKNOWN, &handle) != ESP_OK) {
        esp_ota_abort(handle);
        ota_report("failed", 0, version, "esp_ota_begin failed");
        return ESP_FAIL;
    }

    downloaded_bytes = 0;
    total_bytes      = 0;

    esp_http_client_config_t cfg = {
        .url           = url,
        .timeout_ms    = 30000,
        .buffer_size   = 1024,
        .event_handler = http_event,
        .user_data     = &handle,
        .method        = HTTP_METHOD_GET,
    };

    esp_http_client_handle_t http = esp_http_client_init(&cfg);
    esp_err_t err = esp_http_client_perform(http);   /* downloads the whole .bin */
    esp_http_client_cleanup(http);

    if (err != ESP_OK) {
        esp_ota_abort(handle);
        ota_report("failed", 0, version, "http download failed");
        return err;
    }

    /* verify the image integrity (checks whole partition) */
    if (esp_ota_end(handle) != ESP_OK) {
        ota_report("failed", 0, version, "image invalid");
        return ESP_FAIL;
    }
    /* point the bootloader at the new image — THIS is the switch */
    if (esp_ota_set_boot_partition(next) != ESP_OK) {
        ota_report("failed", 0, version, "set_boot_partition failed");
        return ESP_FAIL;
    }

    /* mark valid so the app won't roll back after reboot */
    esp_ota_img_states_t state;
    if (esp_ota_get_state_partition(next, &state) == ESP_OK &&
        state == ESP_OTA_IMG_PENDING_VERIFY) {
        esp_ota_mark_app_valid_cancel_rollback();
    }

    ota_report("success", 100, version, "OTA complete, rebooting");
    vTaskDelay(pdMS_TO_TICKS(500));                /* let the report leave */
    esp_restart();
    return ESP_OK;
}

/* =============== MQTT: parse "OTA AUTO <url> <ver>" =============== */
static void command_handler(char *cmd)
{
    char method[16], url[300], version[32];
    if (sscanf(cmd, "OTA %15s %299s %31s", method, url, version) < 3) {
        ESP_LOGW(TAG, "bad OTA command: %s", cmd);
        ota_report("failed", 0, NULL, "bad command format");
        return;
    }
    ESP_LOGI(TAG, ">> %s | %s | v%s", method, url, version);
    do_ota(url, version);
}

static void mqtt_event(void *args, esp_event_base_t base, int32_t id, void *data)
{
    esp_mqtt_event_handle_t evt = data;
    switch ((esp_mqtt_event_id_t)id) {
    case MQTT_EVENT_CONNECTED:
        ESP_LOGI(TAG, "MQTT connected, subscribing to commands");
        esp_mqtt_client_subscribe(mqtt, "enthutech/" DEVICE_ID "/cmd", 1);
        break;
    case MQTT_EVENT_DATA:
        if (strncmp(evt->topic, "enthutech/", 10) == 0 &&
            strstr(evt->topic, "/cmd")) {
            char buf[400];
            memcpy(buf, evt->data, evt->data_len);
            buf[evt->data_len] = 0;
            command_handler(buf);
        }
        break;
    default:
        break;
    }
}

static void wifi_connect(void)
{
    esp_netif_init();
    esp_event_loop_create_default();
    esp_netif_create_default_wifi_sta();
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    esp_wifi_init(&cfg);
    esp_wifi_set_mode(WIFI_MODE_STA);
    wifi_config_t w = {
        .sta = { .ssid = WIFI_SSID, .password = WIFI_PASS,
                 .threshold.authmode = WIFI_AUTH_WPA2_PSK },
    };
    esp_wifi_set_config(WIFI_IF_STA, &w);
    esp_wifi_start();

    /* wait for a working IP (press-and-hold for 15 s) */
    ESP_LOGI(TAG, "connecting to wifi...");
    vTaskDelay(pdMS_TO_TICKS(15000));
}

void app_main(void)
{
    nvs_flash_init();
    wifi_connect();

    /* come back online with whichever firmware we are now running */
    const esp_partition_t *run = esp_ota_get_running_partition();
    esp_ota_img_states_t st;
    if (esp_ota_get_state_partition(run, &st) == ESP_OK && st == ESP_OTA_IMG_PENDING_VERIFY)
        esp_ota_mark_app_valid_cancel_rollback();

    mqtt = esp_mqtt_client_init(&(esp_mqtt_client_config_t){
        .broker.address.uri  = BROKER_URL,
        .session.keepalive   = 30,
        .credentials.client_id = DEVICE_ID,
    });
    esp_mqtt_client_register_event(mqtt, ESP_EVENT_ANY_ID, mqtt_event, NULL);
    esp_mqtt_client_start(mqtt);

    /* simple heartbeat every 60 s — server uses it for last-seen */
    for (;;) {
        char p[128];
        snprintf(p, sizeof(p),
                 "{\"Device-ID\":\"%s\",\"status\":\"online\","
                 "\"firmware_version\":\"%s\"}",
                 DEVICE_ID, "1.0.0");            /* your current FW version */
        esp_mqtt_client_publish(mqtt, "enthutech/" DEVICE_ID "/status",
                                p, 0, 1, 0);
        vTaskDelay(pdMS_TO_TICKS(60000));
    }
}