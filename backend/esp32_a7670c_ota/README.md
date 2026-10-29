# ESP32 + SIMCom A7670C — OTA Firmware README

## Architecture
```
MQTT  → sensor data, events, commands, OTA trigger (JSON)
HTTPS → firmware.bin download (A7670C AT+HTTPACTION)
```

## MQTT Topics
| Direction | Topic | Use |
|---|---|---|
| Publish | `enthutech/<ID>/data` | Sensor readings (QoS 0) |
| Publish | `enthutech/<ID>/status` | Device status + FW version (QoS 1) |
| Subscribe | `enthutech/<ID>/cmd` | Remote commands |
| Subscribe | `enthutech/<ID>/ota` | OTA trigger (JSON, QoS 1) |
| Publish | `enthutech/<ID>/ota` | OTA progress report (JSON, QoS 1) |

## OTA Trigger JSON (server → device)
```json
{
  "version": "1.0.3",
  "url": "https://tasecurities.godem.in/api/public/ota/download/5",
  "method": "auto",
  "md5": "abc123..."
}
```

## OTA Progress JSON (device → server)
```json
{
  "Device-ID": "TA001",
  "ota_status": "downloading",
  "progress": 45,
  "version": "1.0.3",
  "message": "fetching firmware"
}
```

## A7670C AT Command OTA Flow
```
AT+HTTPINIT
AT+HTTPPARA="URL","https://tasecurities.godem.in/api/public/ota/download/5"
AT+HTTPACTION=0            ← GET request
+HTTPACTION: 0,200,524288  ← 200 OK, 512KB
AT+HTTPREAD=0,2048         ← read 2KB chunk
+HTTPREAD: 2048
<binary data written to OTA partition>
... repeat until all bytes received ...
esp_ota_end()
esp_ota_set_boot_partition()
esp_restart()
```

## Build
```bash
idf.py set-target esp32
idf.py menuconfig   # set UART pins, DEVICE_ID in main.c
idf.py build
idf.py flash monitor
```

## Required `sdkconfig` settings
```
CONFIG_PARTITION_TABLE_CUSTOM=y
CONFIG_PARTITION_TABLE_CUSTOM_FILENAME="partitions_ota.csv"
CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE=y
```
